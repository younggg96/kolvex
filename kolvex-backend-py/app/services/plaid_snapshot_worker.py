"""Collect daily Plaid portfolio history using the backend's Redis worker lease."""

import asyncio
import logging
import os
from datetime import date, datetime, timezone
from uuid import uuid4

from app.core.redis import get_redis
from app.services.plaid import PLAID_CLIENT_ID, PLAID_ENV, PLAID_SECRET, PlaidService
from app.services.plaid_history import capture_session

logger = logging.getLogger(__name__)
POLL_SECONDS = 60
LEASE_KEY = "plaid_history:worker"
LEASE_SECONDS = 25 * 60
PAGE_SIZE = 100


def worker_enabled() -> bool:
    override = os.getenv("PLAID_SNAPSHOT_WORKER_ENABLED")
    if override is not None:
        return override.lower() == "true"
    return (
        PLAID_ENV == "production"
        and bool(os.getenv("RAILWAY_DEPLOYMENT_ID"))
        and os.getenv("RAILWAY_ENVIRONMENT_NAME") == "production"
    )


async def collect_snapshots(service: PlaidService, session: date) -> None:
    saved = failed = 0
    cursor = None
    while True:
        query = (
            service.supabase.table("portfolio_connections")
            .select("id,user_id,created_at")
            .eq("provider", "plaid")
            .eq("is_connected", True)
            .order("id")
            .limit(PAGE_SIZE)
        )
        if cursor:
            query = query.gt("id", cursor)
        page = (await asyncio.to_thread(query.execute)).data or []
        for connection in page:
            user_id = connection["user_id"]
            try:
                if await service.capture_daily_snapshot(connection, session):
                    saved += 1
            except Exception:
                failed += 1
                logger.exception("Plaid history collection failed for %s", user_id[:8])
        if len(page) < PAGE_SIZE:
            break
        cursor = page[-1]["id"]
    logger.info("Plaid history %s: %d saved, %d failed", session, saved, failed)


async def run_snapshot_tick(now: datetime) -> None:
    session = capture_session(now)
    if session is None:
        return
    redis = get_redis()
    # At most one pass per two-hour UTC slot, across API replicas and restarts.
    slot = int(now.timestamp()) // (2 * 3600)
    completed_key = f"plaid_history:completed:{slot}"
    if await redis.get(completed_key):
        return
    token = uuid4().hex
    if not await redis.acquire_lock(LEASE_KEY, token, ttl=LEASE_SECONDS):
        return
    try:
        if await redis.get(completed_key):
            return
        await asyncio.wait_for(collect_snapshots(PlaidService(), session), LEASE_SECONDS - 30)
        await redis.set(completed_key, "1", ttl=3 * 3600)
    finally:
        await redis.release_lock(LEASE_KEY, token)


async def run_plaid_snapshot_worker() -> None:
    if not PLAID_CLIENT_ID or not PLAID_SECRET:
        logger.warning("Plaid history worker disabled because Plaid credentials are missing")
        return
    if not get_redis().is_connected:
        logger.warning("Plaid history worker is waiting for a Redis connection")
    while True:
        try:
            await run_snapshot_tick(datetime.now(timezone.utc))
        except Exception:
            logger.exception("Plaid history worker pass failed")
        await asyncio.sleep(POLL_SECONDS)
