"""Batch intraday closes for holdings sparklines: one request instead of one per symbol."""

import asyncio
import logging
import math
from typing import Callable, Dict, Iterable, List, Optional

from app.services.market_performance import normalize_symbols

logger = logging.getLogger(__name__)

MAX_SYMBOLS = 60
INTERVALS = ("1m", "2m", "5m", "15m", "30m", "60m")
# Yahoo rate-limits bursts; a few symbols at a time is still far faster than the
# browser's one-request-per-symbol fan-out it replaces.
CONCURRENCY = 6


class TooManySymbolsError(ValueError):
    pass


def _closes(bars: Iterable[dict]) -> List[float]:
    values: List[float] = []
    for bar in bars or ():
        close = bar.get("close") if isinstance(bar, dict) else None
        if isinstance(close, (int, float)) and math.isfinite(close) and close > 0:
            values.append(float(close))
    return values


async def get_sparklines(
    symbols: Iterable[str],
    interval: str,
    fetch_intraday: Callable[[str, str], List[dict]],
) -> Dict[str, List[float]]:
    """Closes per symbol. Symbols whose history fails or is empty are left out, never zero-filled."""
    wanted = normalize_symbols(symbols)
    if len(wanted) > MAX_SYMBOLS:
        raise TooManySymbolsError(f"Too many symbols (max {MAX_SYMBOLS})")

    limiter = asyncio.Semaphore(CONCURRENCY)

    async def one(symbol: str) -> Optional[List[float]]:
        async with limiter:
            try:
                bars = await asyncio.to_thread(fetch_intraday, symbol, interval)
            except Exception as error:  # noqa: BLE001 — one bad symbol must not sink the batch
                logger.warning("Sparkline history failed for %s: %s", symbol, error)
                return None
        return _closes(bars) or None

    results = await asyncio.gather(*(one(symbol) for symbol in wanted))
    return {symbol: values for symbol, values in zip(wanted, results) if values}
