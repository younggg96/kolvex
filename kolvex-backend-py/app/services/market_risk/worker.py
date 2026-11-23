"""Scheduled daily ingestion for the Market Risk Monitor (M1b).

Cboe posts the day's index closes in the evening. After 18:30 ET on each trading day
(15:30 on early-close days) the worker ingests a short trailing window, so late
provider corrections are picked up as new revisions. A Redis lease keeps it to one
replica. When the day's values are not all published yet it retries every 30 minutes
until the next session takes over; nothing is filled in meanwhile.
"""

import asyncio
import logging
import os
from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4

from app.services.market_risk import ingest
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


def _done_key(session: date) -> str:
    return f"market_risk:ingest:done:{session.isoformat()}"


def _retry_key(session: date) -> str:
    return f"market_risk:ingest:retry:{session.isoformat()}"


async def run_tick(now: datetime, redis, db_factory, collect=ingest.collect, store=ingest.store):
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
        await asyncio.to_thread(store, db_factory(), report, "daily", start)
        if is_complete(report, session):
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

    while True:
        try:
            redis = get_redis()
            if redis.is_connected:
                await run_tick(datetime.now(timezone.utc), redis, get_supabase_service)
        except Exception:
            logger.exception("market_risk worker tick failed")
        await asyncio.sleep(POLL_SECONDS)
