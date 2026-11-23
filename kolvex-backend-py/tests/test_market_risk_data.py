import asyncio
from datetime import date, datetime, timezone

import httpx
import pytest

from app.services.market_risk import calendar, ingest, sources
from app.services.market_risk.metrics import METRICS
from app.services.market_risk.quality import (
    Observation,
    cross_check,
    derive_ratios,
    validate_series,
)
from app.services.market_risk.repository import plan_observation_rows
from app.services.market_risk.sources import RawPoint, SourceFormatError

UTC = timezone.utc


# --- calendar -----------------------------------------------------------------


@pytest.mark.parametrize(
    "day",
    [
        date(2026, 1, 1),  # New Year's Day
        date(2026, 4, 3),  # Good Friday
        date(2026, 7, 3),  # Independence Day observed (Jul 4 is Saturday)
        date(2026, 11, 26),  # Thanksgiving
        date(2027, 12, 24),  # Christmas observed (Dec 25 is Saturday)
        date(2022, 6, 20),  # Juneteenth observed
        date(2012, 10, 29),  # Hurricane Sandy
        date(2025, 1, 9),  # President Carter funeral
    ],
)
def test_holidays_are_closed(day):
    assert not calendar.is_trading_day(day)


@pytest.mark.parametrize(
    "day",
    [
        date(2021, 12, 31),  # Saturday New Year's Day is not observed on Friday
        date(2021, 6, 18),  # Juneteenth only from 2022
        date(1997, 1, 20),  # MLK Day only from 1998
        date(2026, 11, 27),  # day after Thanksgiving: open, early close
    ],
)
def test_open_days(day):
    assert calendar.is_trading_day(day)


def test_early_close_moves_session_close():
    assert calendar.is_early_close(date(2026, 11, 27))
    assert calendar.session_close_utc(date(2026, 11, 27)) == datetime(
        2026, 11, 27, 18, 0, tzinfo=UTC
    )
    # Regular close across DST: 16:00 ET is 20:00 UTC in summer, 21:00 UTC in winter.
    assert calendar.session_close_utc(date(2026, 7, 1)) == datetime(2026, 7, 1, 20, 0, tzinfo=UTC)
    assert calendar.session_close_utc(date(2026, 12, 1)) == datetime(2026, 12, 1, 21, 0, tzinfo=UTC)


def test_latest_completed_trading_day():
    friday_before_close = datetime(2026, 11, 20, 20, 0, tzinfo=UTC)  # 15:00 ET
    friday_after_close = datetime(2026, 11, 20, 22, 0, tzinfo=UTC)
    sunday = datetime(2026, 11, 22, 15, 0, tzinfo=UTC)
    assert calendar.latest_completed_trading_day(friday_before_close) == date(2026, 11, 19)
    assert calendar.latest_completed_trading_day(friday_after_close) == date(2026, 11, 20)
    assert calendar.latest_completed_trading_day(sunday) == date(2026, 11, 20)
    assert calendar.previous_trading_day(date(2026, 11, 27)) == date(2026, 11, 25)


# --- parsers ------------------------------------------------------------------


def test_parse_cboe_ohlc_and_single_column():
    ohlc = (
        b"DATE,OPEN,HIGH,LOW,CLOSE\n11/19/2026,22.06,29.13,21.84,28.44\n11/20/2026,28.6,40,26.9,\n"
    )
    points = sources.parse_cboe_history(ohlc, "VIX")
    assert points[0] == RawPoint(date(2026, 11, 19), 28.44, 2)
    assert points[1].value is None
    single = sources.parse_cboe_history(b"\xef\xbb\xbfDATE,VVIX\n11/20/2026,138.03\n", "VVIX")
    assert single[0].value == 138.03


@pytest.mark.parametrize(
    "payload",
    [
        b"<html>307 Temporary Redirect</html>",
        b"DATE,OPEN\n11/20/2026,1\n",
        b"DATE,CLOSE\n2026-11-20,1\n",
        b"DATE,CLOSE\n",
    ],
)
def test_parse_cboe_rejects_changed_format(payload):
    with pytest.raises(SourceFormatError):
        sources.parse_cboe_history(payload, "VIX")


def test_parse_fred_blank_values():
    points = sources.parse_fred_series(
        b"observation_date,VIXCLS\n2026-11-19,28.44\n2026-11-26,\n", "VIXCLS"
    )
    assert [p.value for p in points] == [28.44, None]
    with pytest.raises(SourceFormatError):
        sources.parse_fred_series(b"observation_date,OTHER\n2026-11-19,1\n", "VIXCLS")


# --- validation ---------------------------------------------------------------


def _points(values: dict[date, float | None]) -> list[RawPoint]:
    return [RawPoint(day, value, i) for i, (day, value) in enumerate(values.items())]


def test_validate_buckets_every_row():
    vix = METRICS["vix"]
    points = _points(
        {
            date(2026, 11, 16): 20.0,
            date(2026, 11, 17): None,  # blank
            date(2026, 11, 18): 400.0,  # out of range
            date(2026, 9, 7): 21.0,  # Labor Day session row
            date(2026, 11, 15): 21.0,  # Sunday
            date(2026, 11, 23): 22.0,  # after the cutoff
        }
    )
    result = validate_series(vix, points, expected_through=date(2026, 11, 20))
    assert [o.trading_date for o in result.accepted] == [date(2026, 11, 16)]
    assert result.fetched == len(points)
    assert {(i.trading_date, i.code) for i in result.rejected} == {
        (date(2026, 11, 17), "null_value"),
        (date(2026, 11, 18), "out_of_range"),
        (date(2026, 11, 23), "not_final"),
    }
    assert {i.trading_date for i in result.skipped} == {date(2026, 9, 7), date(2026, 11, 15)}
    # Nothing is filled in: rejected and unpublished trading days are reported missing.
    assert result.missing_days == [date(2026, 11, d) for d in (17, 18, 19, 20)]
    assert result.accepted[0].observation_time == datetime(2026, 11, 16, 21, 15, tzinfo=UTC)


def test_conflicting_duplicates_are_rejected_identical_ones_kept():
    vix = METRICS["vix"]
    day = date(2026, 11, 16)
    same = [RawPoint(day, 20.0, 1), RawPoint(day, 20.0, 2)]
    conflict = [RawPoint(day, 20.0, 1), RawPoint(day, 21.0, 2)]
    assert len(validate_series(vix, same, day).accepted) == 1
    result = validate_series(vix, conflict, day)
    assert not result.accepted and result.rejected[0].code == "conflicting_duplicate"


def test_reverting_spike_is_suspect_but_kept():
    days = calendar.trading_days(date(2026, 11, 2), date(2026, 11, 6))
    spike = dict(zip(days, [20.0, 20.5, 45.0, 21.0, 21.5]))
    sustained = dict(zip(days, [20.0, 20.5, 45.0, 44.0, 40.0]))
    flagged = validate_series(METRICS["vix"], _points(spike), days[-1]).accepted
    assert [o.quality_flags for o in flagged][2] == ("spike",)
    assert all(o.quality_status == "valid" for i, o in enumerate(flagged) if i != 2)
    assert all(
        o.quality_status == "valid"
        for o in validate_series(METRICS["vix"], _points(sustained), days[-1]).accepted
    )


def _obs(key, day, value, status="valid"):
    metric = METRICS[key]
    return Observation(
        key, metric.source, metric.source_symbol, day, value,
        calendar.session_close_utc(day, metric.close_time), status,
        () if status == "valid" else ("spike",),
    )  # fmt: skip


def test_cross_check_flags_mismatch_only():
    day1, day2 = date(2026, 11, 19), date(2026, 11, 20)
    primary = [_obs("vix", day1, 28.44), _obs("vix", day2, 35.89)]
    checked, issues = cross_check(
        primary, [RawPoint(day1, 28.44, 1), RawPoint(day2, 30.0, 2)], "fred"
    )
    assert checked[0].quality_status == "valid"
    assert checked[1].quality_flags == ("mismatch_fred",)
    assert [i.trading_date for i in issues] == [day2]


def test_ratios_need_both_inputs_on_the_same_day():
    d1, d2 = date(2026, 11, 19), date(2026, 11, 20)
    derived = derive_ratios(
        {
            "vix": [_obs("vix", d1, 28.44), _obs("vix", d2, 35.89, "suspect")],
            "vix9d": [_obs("vix9d", d2, 40.72)],
            "vix3m": [_obs("vix3m", d1, 27.03)],
        }
    )
    [short] = derived["vix9d_vix_ratio"]
    assert short.trading_date == d2 and short.value == round(40.72 / 35.89, 6)
    assert short.quality_flags == ("input_vix_suspect",)
    [term] = derived["vix_vix3m_ratio"]
    assert term.trading_date == d1 and term.quality_status == "valid"


# --- storage plan -------------------------------------------------------------


def test_plan_skips_unchanged_and_versions_corrections():
    day1, day2, day3 = date(2026, 11, 18), date(2026, 11, 19), date(2026, 11, 20)
    now = datetime(2026, 11, 21, 0, 30, tzinfo=UTC)
    observations = [_obs("vix", day1, 24.56), _obs("vix", day2, 28.5), _obs("vix", day3, 35.89)]
    latest = {("vix", "cboe", day1): 24.56, ("vix", "cboe", day2): 28.44}
    rows = plan_observation_rows(observations, latest, now, "run-1")
    assert [(r["trading_date"], r["source_revision"]) for r in rows] == [
        ("2026-11-19", "r20261121T003000Z"),
        ("2026-11-20", "initial"),
    ]
    assert rows[0]["ingestion_run_id"] == "run-1" and rows[0]["is_estimated"] is False


# --- ingestion ----------------------------------------------------------------

CBOE = {
    "VIX": "DATE,OPEN,HIGH,LOW,CLOSE\n11/19/2026,1,1,1,28.44\n11/20/2026,1,1,1,35.89\n",
    "VVIX": "DATE,VVIX\n11/19/2026,127.10\n11/20/2026,138.03\n",
    "VIX9D": "DATE,OPEN,HIGH,LOW,CLOSE\n11/19/2026,1,1,1,29.26\n11/20/2026,1,1,1,40.72\n",
    "VIX3M": "DATE,OPEN,HIGH,LOW,CLOSE\n11/19/2026,1,1,1,27.03\n11/20/2026,1,1,1,30.94\n",
}
FRED = {
    "VIXCLS": "observation_date,VIXCLS\n2026-11-19,28.44\n",
    "VXVCLS": "observation_date,VXVCLS\n2026-11-19,27.03\n",
}
AFTER_CLOSE = datetime(2026, 11, 21, 15, 0, tzinfo=UTC)  # Saturday


def _client(drop: set[str] = frozenset()):
    def handler(request: httpx.Request):
        if request.url.host == "fred.stlouisfed.org":
            series = request.url.params["id"]
            return httpx.Response(200, text=FRED[series])
        symbol = request.url.path.rsplit("/", 1)[-1].removesuffix("_History.csv")
        if symbol in drop:
            return httpx.Response(503)
        return httpx.Response(200, text=CBOE[symbol])

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _collect(drop=frozenset()):
    async def run():
        async with _client(drop) as client:
            return await ingest.collect(now=AFTER_CLOSE, client=client)

    return asyncio.run(run())


def test_collect_all_sources():
    report = _collect()
    assert report.status == "succeeded"
    assert report.expected_through == date(2026, 11, 20)
    keys = {o.metric_key for o in report.observations}
    assert keys == set(METRICS)
    assert len(report.observations) == 2 * len(METRICS)
    assert report.summary()["cross_check_mismatch_count"] == 0


def test_collect_one_source_down_is_partial_without_fill():
    report = _collect({"VVIX"})
    assert report.status == "partial"
    assert "vvix" in report.source_errors
    assert not any(o.metric_key == "vvix" for o in report.observations)


def test_collect_all_sources_down_fails():
    report = _collect(set(CBOE))
    assert report.status == "failed"
    assert report.observations == []
