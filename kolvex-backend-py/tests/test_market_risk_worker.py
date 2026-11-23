import asyncio
from datetime import date, datetime, timezone

from app.services.market_risk import worker
from app.services.market_risk.ingest import IngestReport
from app.services.market_risk.metrics import OBSERVED
from app.services.market_risk.quality import Observation, SeriesResult

UTC = timezone.utc


class FakeRedis:
    def __init__(self):
        self.values, self.ttls, self.locked = {}, {}, False

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, ttl=None):
        self.values[key], self.ttls[key] = value, ttl

    async def acquire_lock(self, key, token, ttl):
        if self.locked:
            return False
        self.locked = True
        return True

    async def release_lock(self, key, token):
        self.locked = False


def _report(session: date, missing: set[str] = frozenset(), errors=None) -> IngestReport:
    report = IngestReport(expected_through=session, retrieved_at=datetime.now(UTC))
    report.source_errors = errors or {}
    for metric in OBSERVED:
        result = SeriesResult(metric.key)
        if metric.key not in missing:
            result.accepted = [
                Observation(metric.key, "cboe", metric.source_symbol, session, 20.0, None)
            ]
        report.series[metric.key] = result
    return report


def _run(now, redis, report):
    calls = {"collect": [], "store": []}

    async def collect(now, start):
        calls["collect"].append(start)
        return report

    def store(db, rep, job_type, since):
        calls["store"].append((db, job_type, since))
        return rep

    result = asyncio.run(worker.run_tick(now, redis, lambda: "db", collect=collect, store=store))
    return result, calls


def test_target_session_waits_for_publish_time():
    before = datetime(2026, 11, 20, 23, 0, tzinfo=UTC)  # 18:00 ET Friday
    after = datetime(2026, 11, 20, 23, 45, tzinfo=UTC)  # 18:45 ET
    weekend = datetime(2026, 11, 22, 12, 0, tzinfo=UTC)
    assert worker.target_session(before) == date(2026, 11, 19)
    assert worker.target_session(after) == date(2026, 11, 20)
    assert worker.target_session(weekend) == date(2026, 11, 20)
    # Early close on the day after Thanksgiving: values due at 15:30 ET.
    assert worker.target_session(datetime(2026, 11, 27, 21, 0, tzinfo=UTC)) == date(2026, 11, 27)


def test_complete_day_marks_done_and_skips_later_ticks():
    now, session, redis = datetime(2026, 11, 21, 0, 0, tzinfo=UTC), date(2026, 11, 20), FakeRedis()
    result, calls = _run(now, redis, _report(session))
    assert result is not None
    assert calls["store"] == [("db", "daily", date(2026, 10, 21))]
    assert redis.values == {f"market_risk:ingest:done:{session}": "1"}
    assert not redis.locked
    again, calls = _run(now, redis, _report(session))
    assert again is None and calls["collect"] == []


def test_incomplete_day_retries_later_without_marking_done():
    now, session, redis = datetime(2026, 11, 21, 0, 0, tzinfo=UTC), date(2026, 11, 20), FakeRedis()
    _run(now, redis, _report(session, missing={"vvix"}))
    assert f"market_risk:ingest:done:{session}" not in redis.values
    assert redis.ttls[f"market_risk:ingest:retry:{session}"] == worker.RETRY_SECONDS
    result, calls = _run(now, redis, _report(session))
    assert result is None and calls["collect"] == []  # still inside the retry window


def test_source_error_is_never_complete():
    session = date(2026, 11, 20)
    assert worker.is_complete(_report(session), session)
    assert not worker.is_complete(_report(session, errors={"vix": "HTTPError"}), session)
    assert not worker.is_complete(_report(session, missing={"vix3m"}), session)


def test_lease_held_elsewhere_skips():
    redis = FakeRedis()
    redis.locked = True
    result, calls = _run(
        datetime(2026, 11, 21, 0, 0, tzinfo=UTC), redis, _report(date(2026, 11, 20))
    )
    assert result is None and calls["collect"] == []


def test_worker_disabled_by_default(monkeypatch):
    monkeypatch.delenv("MARKET_RISK_WORKER_ENABLED", raising=False)
    assert worker.worker_enabled() is False
    monkeypatch.setenv("MARKET_RISK_WORKER_ENABLED", "true")
    assert worker.worker_enabled() is True
