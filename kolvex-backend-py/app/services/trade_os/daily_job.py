"""
Trade OS after-close job (PRD §23).

Once per NYSE session, after the close has settled: confirm SPY has the new daily
bar, store that day's market state, then run and store the Swing V3.0 scan with
that state. Uses the trading calendar (holidays, early closes) and a Redis lease
so only one API replica runs it, once per session. If the day's data isn't
published yet it simply tries again on the next tick.
"""

import asyncio
import logging
import os
from datetime import date, datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from uuid import uuid4

from app.services.trade_os.trading_calendar import bar_session, completed_bars, daily_job_session

logger = logging.getLogger(__name__)

POLL_SECONDS = 120
LEASE_KEY = "trade_os:daily_job:lease"
LEASE_SECONDS = 20 * 60
DONE_TTL_SECONDS = 5 * 24 * 3600


def worker_enabled() -> bool:
    override = os.getenv("TRADE_OS_DAILY_JOB_ENABLED")
    if override is not None:
        return override.lower() == "true"
    return bool(os.getenv("RAILWAY_DEPLOYMENT_ID")) and (
        os.getenv("RAILWAY_ENVIRONMENT_NAME") == "production"
    )


def _default_fetcher() -> Callable[[str], List[Dict[str, Any]]]:
    from app.services.yfinance.client import get_yfinance_service

    yf_svc = get_yfinance_service()
    return lambda sym: completed_bars(yf_svc.get_history(sym, period="1y"))


async def run_daily_close(
    session: date,
    bar_fetcher: Optional[Callable[[str], List[Dict[str, Any]]]] = None,
    earnings_lookup: Optional[Callable[[str], Dict[str, Any]]] = None,
    save_to_db: bool = True,
) -> Dict[str, Any]:
    """Market state, then scan, both stamped with ``session``. Pure apart from I/O hooks."""
    from app.services.trade_os.market_regime import evaluate_market_regime
    from app.services.trade_os.scanner import run_opportunity_scanner

    fetch = bar_fetcher or _default_fetcher()
    cache: Dict[str, List[Dict[str, Any]]] = {}

    def cached(sym: str) -> List[Dict[str, Any]]:
        if sym not in cache:
            cache[sym] = fetch(sym) or []
        return cache[sym]

    spy = cached("SPY")
    latest = bar_session(spy[-1]) if spy else None
    if latest != session:
        return {
            "status": "waiting_for_data",
            "session": session.isoformat(),
            "spy_last": str(latest),
        }

    regime = await evaluate_market_regime(cached, save_to_db=save_to_db, trading_date=session)
    scan = await run_opportunity_scanner(
        bar_fetcher=cached,
        save_to_db=save_to_db,
        market_regime=regime["regime"],
        earnings_lookup=earnings_lookup,
        trading_date=session,
    )
    return {
        "status": "completed",
        "session": session.isoformat(),
        "regime": regime["regime"],
        "signals": scan["candidates_count"],
        "scanned": scan["total_scanned"],
        "failed": scan.get("failed_symbols", []),
    }


async def run_daily_tick(now: datetime) -> Optional[Dict[str, Any]]:
    from app.core.redis import get_redis

    session = daily_job_session(now)
    if session is None:
        return None
    redis = get_redis()
    done_key = f"trade_os:daily_job:done:{session.isoformat()}"
    if await redis.get(done_key):
        return None
    token = uuid4().hex
    if not await redis.acquire_lock(LEASE_KEY, token, ttl=LEASE_SECONDS):
        return None
    try:
        if await redis.get(done_key):
            return None
        # yfinance and Supabase calls are blocking; keep them off the API event loop.
        result = await asyncio.wait_for(
            asyncio.to_thread(lambda: asyncio.run(run_daily_close(session))),
            LEASE_SECONDS - 60,
        )
        if result["status"] == "completed":
            await redis.set(done_key, "1", ttl=DONE_TTL_SECONDS)
        logger.info("Trade OS daily job %s: %s", session, result)
        return result
    finally:
        await redis.release_lock(LEASE_KEY, token)


async def run_trade_os_daily_worker() -> None:
    while True:
        try:
            await run_daily_tick(datetime.now(timezone.utc))
        except Exception:
            logger.exception("Trade OS daily job pass failed")
        await asyncio.sleep(POLL_SECONDS)
