"""Adjusted daily close history for the disclosed holdings chart."""

from datetime import date, timedelta
from functools import lru_cache
from math import isfinite
from zoneinfo import ZoneInfo

from .performance import yahoo_closes

MARKET_TZ = ZoneInfo("America/New_York")


@lru_cache(maxsize=256)
def adjusted_history(symbol: str, end: date):
    """Cache a year of completed sessions per symbol and market date."""
    bars = yahoo_closes([symbol], (end - timedelta(days=370)).isoformat(), end.isoformat())
    prices = [
        {"date": day, "adjusted_close": close}
        for day, close in bars.get(symbol, ())
        if isfinite(close) and close > 0
    ]
    if len(prices) < 2:
        raise ValueError("Adjusted stock prices unavailable")
    return {"symbol": symbol, "prices": prices}
