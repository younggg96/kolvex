"""NYSE calendar and the after-close job (PRD §6.4, §23, AC-23, AC-28)."""

import asyncio
from datetime import date, datetime, timezone

from app.services.trade_os.daily_job import run_daily_close
from app.services.trade_os.trading_calendar import (
    completed_bars,
    daily_job_session,
    is_stale,
    last_completed_session,
    sessions_after,
)


def utc(y, m, d, h, mi=0):
    return datetime(y, m, d, h, mi, tzinfo=timezone.utc)


def test_last_completed_session_skips_weekend_and_intraday():
    # Mon 2026-11-23 15:00 ET (20:00 UTC) is before the close -> Friday
    assert last_completed_session(utc(2026, 11, 23, 20)) == date(2026, 11, 20)
    # Mon after the close -> Monday
    assert last_completed_session(utc(2026, 11, 23, 22)) == date(2026, 11, 23)


def test_thanksgiving_and_early_close():
    # 2026-11-26 is Thanksgiving; 11-27 closes at 13:00 ET (18:00 UTC)
    assert sessions_after(date(2026, 11, 25), date(2026, 11, 27)) == 1
    assert daily_job_session(utc(2026, 11, 27, 18, 30)) is None  # still settling
    assert daily_job_session(utc(2026, 11, 27, 19, 0)) == date(2026, 11, 27)


def test_job_window_closes_at_next_open():
    assert daily_job_session(utc(2026, 11, 23, 21, 50)) == date(2026, 11, 23)
    assert daily_job_session(utc(2026, 11, 24, 15, 0)) is None  # market open again


def test_staleness_counts_sessions_not_days():
    # Friday's close read on Monday morning is fine (one session lag at most)
    assert not is_stale(date(2026, 11, 20), utc(2026, 11, 23, 14))
    # A close from the week before is stale
    assert is_stale(date(2026, 11, 13), utc(2026, 11, 23, 14))


def test_completed_bars_drop_todays_unfinished_bar():
    bars = [{"date": "2026-11-20T00:00:00-05:00"}, {"date": "2026-11-23T00:00:00-05:00"}]
    assert len(completed_bars(bars, utc(2026, 11, 23, 18))) == 1
    assert len(completed_bars(bars, utc(2026, 11, 23, 22))) == 2


def flat(n, price, last):
    return [
        {"date": "2026-01-01" if i < n - 1 else last, "open": price, "high": price + 1,
         "low": price - 1, "close": price, "volume": 1_000_000}
        for i in range(n)
    ]  # fmt: skip


def test_waits_when_the_day_has_no_bar_yet():
    res = asyncio.run(
        run_daily_close(
            date(2026, 11, 23), bar_fetcher=lambda s: flat(250, 500, "2026-11-20"), save_to_db=False
        )
    )
    assert res["status"] == "waiting_for_data"


def test_completes_and_fetches_each_symbol_once():
    calls = []

    def fetch(sym):
        calls.append(sym)
        return flat(250, 500, "2026-11-23")

    res = asyncio.run(
        run_daily_close(
            date(2026, 11, 23),
            bar_fetcher=fetch,
            earnings_lookup=lambda s: {"next_date": None},
            save_to_db=False,
        )
    )
    assert res["status"] == "completed"
    assert res["regime"] in ("risk_on", "cautious", "risk_off", "unknown")
    assert calls.count("SPY") == 1 and calls.count("QQQ") == 1
