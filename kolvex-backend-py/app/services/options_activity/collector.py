"""Fetches the near-the-money, near-dated chain for every symbol in the universe."""

import asyncio
import logging
import time
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from app.core.redis import get_redis
from app.services.options_chain import metrics
from app.services.options_chain.alpaca_client import AlpacaOptionsClient
from app.services.options_activity.universe import MAX_DAYS_TO_EXPIRATION, STRIKE_BAND, UNIVERSE, is_etf

logger = logging.getLogger(__name__)
NY = ZoneInfo("America/New_York")
REQUESTS_PER_MINUTE = 180  # under Alpaca's ~200/min free-tier limit
CONCURRENCY = 4
EARNINGS_TTL = 12 * 3600


class RateLimiter:
    """Spaces requests evenly: at most `per_minute` calls, shared by all tasks."""

    def __init__(self, per_minute: int, clock=time.monotonic, sleep=asyncio.sleep):
        self.interval = 60.0 / per_minute
        self._clock, self._sleep = clock, sleep
        self._next = 0.0
        self._lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self._lock:
            now = self._clock()
            delay = self._next - now
            self._next = max(now, self._next) + self.interval
        if delay > 0:
            await self._sleep(delay)


def stock_quote(snapshot: dict) -> dict:
    """Price, change and the ET session date of the latest daily bar (used to detect market holidays)."""
    trade = snapshot.get("latestTrade") or {}
    bar = snapshot.get("dailyBar") or {}
    prev = snapshot.get("prevDailyBar") or {}
    price = metrics._num(trade.get("p")) or metrics._num(bar.get("c"))
    prev_close = metrics._num(prev.get("c"))
    bar_date = None
    if bar.get("t"):
        try:
            bar_date = datetime.fromisoformat(bar["t"].replace("Z", "+00:00")).astimezone(NY).date().isoformat()
        except ValueError:
            bar_date = None
    return {
        "price": price,
        "prev_close": prev_close,
        "change_pct": round((price / prev_close - 1) * 100, 2) if price and prev_close else None,
        "bar_date": bar_date,
    }


async def next_earnings_date(symbol: str, today: date) -> Optional[str]:
    """Next earnings date from yfinance's calendar, cached; ETFs and failures return None."""
    if is_etf(symbol):
        return None
    redis = get_redis()
    key = f"options_activity:earnings:v1:{symbol}"
    cached = await redis.get_json(key)
    if isinstance(cached, dict):
        return cached.get("date")

    def lookup() -> Optional[str]:
        from app.services.yfinance.client import get_yfinance_service

        calendar = get_yfinance_service().get_ticker(symbol).calendar or {}
        dates = calendar.get("Earnings Date") if isinstance(calendar, dict) else None
        upcoming = sorted(d.isoformat() for d in (dates or []) if hasattr(d, "isoformat") and d >= today)
        return upcoming[0] if upcoming else None

    try:
        found = await asyncio.wait_for(asyncio.to_thread(lookup), timeout=15)
    except Exception as exc:
        logger.info("Earnings lookup failed for %s: %s", symbol, exc)
        return None
    await redis.set_json(key, {"date": found}, ttl=EARNINGS_TTL)
    return found


class OptionsActivityCollector:
    def __init__(self, client: Optional[AlpacaOptionsClient] = None, universe: tuple[str, ...] = UNIVERSE):
        self.client = client or AlpacaOptionsClient(limiter=RateLimiter(REQUESTS_PER_MINUTE))
        self.universe = universe

    @property
    def configured(self) -> bool:
        return self.client.configured

    async def scan_symbol(self, symbol: str, today: date) -> Optional[dict]:
        stock = stock_quote(await self.client.get_stock_snapshot(symbol))
        spot = stock["price"]
        if not spot:
            return None
        window = {
            "expiration_gte": today.isoformat(),
            "expiration_lte": (today + timedelta(days=MAX_DAYS_TO_EXPIRATION)).isoformat(),
            "strike_gte": spot * (1 - STRIKE_BAND),
            "strike_lte": spot * (1 + STRIKE_BAND),
        }
        snapshots, contracts, earnings = await asyncio.gather(
            self.client.get_chain_snapshots(symbol, **window),
            self.client.get_contracts(symbol, **window),
            next_earnings_date(symbol, today),
        )
        by_symbol = {c["symbol"]: c for c in contracts if c.get("symbol")}
        rows = []
        for occ in set(snapshots) | set(by_symbol):
            row = metrics.normalize_contract(occ, snapshots.get(occ), by_symbol.get(occ))
            if row and row.get("strike") is not None:
                rows.append(row)
        return {"symbol": symbol, "is_etf": is_etf(symbol), "rows": rows, "stock": stock, "earnings": earnings}

    async def scan(self, today: date, symbols: Optional[list[str]] = None) -> tuple[list[dict], list[str]]:
        """Returns (scans, failed_symbols). One symbol failing never sinks the run.
        `symbols` defaults to the fixed universe."""
        universe = list(symbols) if symbols is not None else list(self.universe)
        semaphore = asyncio.Semaphore(CONCURRENCY)

        async def one(symbol: str):
            async with semaphore:
                try:
                    return await self.scan_symbol(symbol, today)
                except Exception as exc:
                    logger.warning("Options activity scan failed for %s: %s", symbol, exc)
                    return exc

        results = await asyncio.gather(*(one(s) for s in universe))
        scans = [r for r in results if isinstance(r, dict)]
        failed = [s for s, r in zip(universe, results) if not isinstance(r, dict)]
        return scans, failed
