"""Client for the Kronos forecast service, with Redis caching.

Bars come from yfinance here; the forecast service only runs the model.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict

import httpx

from app.core.config import settings
from app.core.redis import get_redis
from app.services.yfinance.client import get_yfinance_service

logger = logging.getLogger(__name__)

# Enough history to fill the 400-bar lookback after dropping incomplete bars.
HISTORY_PERIOD = {"1d": "2y", "1wk": "10y"}
CACHE_TTL = {"1d": 6 * 3600, "1wk": 24 * 3600}
SAMPLES = 16


class ForecastNotConfigured(Exception):
    pass


class ForecastUnavailable(Exception):
    pass


def _cache_key(symbol: str, interval: str, horizon: int) -> str:
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"kline_forecast:v1:{symbol}:{interval}:{horizon}:{day}"


async def get_kline_forecast(symbol: str, interval: str = "1d", horizon: int = 20) -> Dict[str, Any]:
    if not settings.FORECAST_SERVICE_URL:
        raise ForecastNotConfigured()
    symbol = symbol.upper()
    redis = get_redis()
    key = _cache_key(symbol, interval, horizon)
    if redis.is_connected:
        cached = await redis.get_json(key)
        if cached is not None:
            return cached

    bars = await asyncio.to_thread(
        get_yfinance_service().get_history, symbol, HISTORY_PERIOD[interval], interval
    )
    bars = [b for b in bars if b.get("close") is not None]
    if len(bars) < 64:
        raise ForecastUnavailable("not_enough_history")

    payload = {
        "bars": [{k: b.get(k) for k in ("date", "open", "high", "low", "close", "volume")} for b in bars[-400:]],
        "interval": interval,
        "horizon": horizon,
        "samples": SAMPLES,
    }
    headers = {"x-forecast-token": settings.FORECAST_SERVICE_TOKEN} if settings.FORECAST_SERVICE_TOKEN else {}
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{settings.FORECAST_SERVICE_URL.rstrip('/')}/forecast", json=payload, headers=headers)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Forecast service failed for %s: %s", symbol, exc)
        raise ForecastUnavailable("forecast_service_error") from exc

    result = {"symbol": symbol, **resp.json()}
    if redis.is_connected:
        await redis.set_json(key, result, CACHE_TTL[interval])
    return result
