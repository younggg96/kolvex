"""Scheduled daily ingestion for the Market Risk Monitor (M1b).

Cboe posts the day's index closes in the evening. After 18:30 ET on each trading day
(15:30 on early-close days) the worker ingests a short trailing window, so late
provider corrections are picked up as new revisions. A Redis lease keeps it to one
replica. When the day's values are not all published yet it retries every 30 minutes
until the next session takes over; nothing is filled in meanwhile.

Without Redis the worker keeps its done / retry markers in process memory instead of
skipping every tick, like the economic-indicator and options-activity jobs. Writes stay
safe across replicas: observations are insert-only and skip unchanged values, and a
snapshot with an unchanged ``inputs_hash`` is not inserted again.
"""

import asyncio
import logging
import os
import time as time_module
from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4

from app.services.market_risk import engine, ingest, repository
from app.services.market_risk.calendar import latest_completed_trading_day
from app.services.market_risk.metrics import OBSERVED

logger = logging.getLogger(__name__)

PUBLISH_TIME = time(18, 30)  # ET; 2h15m after the 16:15 index close
POLL_SECONDS = 600
RETRY_SECONDS = 1800
LOOKBACK_DAYS = 30
LEASE_KEY = "market_risk:ingest:lease"
LEASE_SECONDS = 10 * 60
DONE_TTL = 10 * 24 * 3600


def worker_enabled() -> bool:
    """Off unless explicitly enabled: the tables exist only after the migration is applied."""
    return os.getenv("MARKET_RISK_WORKER_ENABLED", "false").lower() == "true"


def target_session(now: datetime) -> date:
    """Most recent trading day whose Cboe values should be published by ``now``."""
    return latest_completed_trading_day(now, PUBLISH_TIME)


def is_complete(report: ingest.IngestReport, session: date) -> bool:
    """True when every observed metric has an accepted value for ``session``."""
    if report.source_errors:
        return False
    return all(
        any(o.trading_date == session for o in report.series[m.key].accepted)
        if m.key in report.series
        else False
        for m in OBSERVED
    )


def publish_snapshot(db, session: date) -> str | None:
    """Score the stored history and insert the latest snapshot (insert-only)."""
    evaluation = engine.evaluate(repository.load_series(db))
    latest = evaluation.latest
    if latest is None:
        return None
    freshness = "fresh" if latest.trading_date >= session else "delayed"
    return repository.store_snapshot(db, evaluation, freshness)


class LocalState:
    """In-process stand-in for the Redis calls ``run_tick`` makes, used when Redis is down."""

    def __init__(self, clock=time_module.monotonic):
        self._clock = clock
        self._values: dict[str, tuple[str, float | None]] = {}
        self._lock: tuple[str, float] | None = None

    async def get(self, key: str) -> str | None:
        item = self._values.get(key)
        if item is None:
            return None
        value, expires = item
        if expires is not None and self._clock() >= expires:
            del self._values[key]
            return None
        return value

    async def set(self, key: str, value: str, ttl: int | None = None) -> None:
        self._values[key] = (value, None if ttl is None else self._clock() + ttl)

    async def acquire_lock(self, key: str, token: str, ttl: int = 300) -> bool:
        if self._lock and self._clock() < self._lock[1]:
            return False
        self._lock = (token, self._clock() + ttl)
        return True

    async def release_lock(self, key: str, token: str) -> None:
        if self._lock and self._lock[0] == token:
            self._lock = None


def _done_key(session: date) -> str:
    return f"market_risk:ingest:done:{session.isoformat()}"


def _retry_key(session: date) -> str:
    return f"market_risk:ingest:retry:{session.isoformat()}"


async def run_tick(
    now: datetime,
    redis,
    db_factory,
    collect=ingest.collect,
    store=ingest.store,
    publish=publish_snapshot,
):
    """One scheduling check. Returns the report when an ingestion ran, else None."""
    session = target_session(now)
    if await redis.get(_done_key(session)) or await redis.get(_retry_key(session)):
        return None
    token = uuid4().hex
    if not await redis.acquire_lock(LEASE_KEY, token, ttl=LEASE_SECONDS):
        return None
    try:
        if await redis.get(_done_key(session)):
            return None
        start = session - timedelta(days=LOOKBACK_DAYS)
        report = await collect(now=now, start=start)
        db = db_factory()
        await asyncio.to_thread(store, db, report, "daily", start)
        if is_complete(report, session):
            # The day is scored only once every key input is in (PRD §7.4).
            await asyncio.to_thread(publish, db, session)
            await redis.set(_done_key(session), "1", ttl=DONE_TTL)
        else:
            await redis.set(_retry_key(session), "1", ttl=RETRY_SECONDS)
        logger.info(
            "market_risk ingest %s: %s, %d rows written",
            session,
            report.status,
            report.rows_written,
        )
        return report
    finally:
        await redis.release_lock(LEASE_KEY, token)


async def run_market_risk_worker() -> None:
    from app.core.redis import get_redis
    from app.core.supabase import get_supabase_service

    local = LocalState()
    if not get_redis().is_connected:
        logger.warning("market_risk worker running without Redis; state kept in this process")
    while True:
        try:
            redis = get_redis()
            state = redis if redis.is_connected else local
            await run_tick(datetime.now(timezone.utc), state, get_supabase_service)
        except Exception:
            logger.exception("market_risk worker tick failed")
        await asyncio.sleep(POLL_SECONDS)
