"""Blue Ocean ATS trades and bars, enabled for an entitled Alpaca account."""

import logging
import math
import os
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

NEW_YORK = ZoneInfo("America/New_York")
DATA_URL = "https://data.alpaca.markets/v2/stocks"
INTERVALS = {
    "1m": "1Min",
    "2m": "2Min",
    "5m": "5Min",
    "15m": "15Min",
    "30m": "30Min",
    "60m": "1Hour",
    "1h": "1Hour",
    "90m": "30Min",
}
_LOOKBACK = {"1d": 5, "5d": 9, "1mo": 32, "3mo": 93, "6mo": 185, "1y": 367, "2y": 733}
logger = logging.getLogger(__name__)


def is_us_symbol(symbol):
    # Yahoo's cash indices, futures, crypto pairs and foreign suffixes have their own sessions.
    return re.fullmatch(r"[A-Z][A-Z0-9]{0,9}(?:-[A-Z])?", symbol.upper()) is not None


def _alpaca_symbol(symbol):
    return symbol.upper().replace("-", ".")


def _headers(symbol):
    if os.getenv("ALPACA_BOATS_ENABLED") != "true" or not re.fullmatch(
        r"[A-Z][A-Z0-9]{0,9}(?:\.[A-Z])?", symbol
    ):
        return None
    key = os.getenv("ALPACA_API_KEY_ID")
    secret = os.getenv("ALPACA_API_SECRET_KEY")
    return {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret} if key and secret else None


def _session_start(at):
    if at.hour >= 20 and at.weekday() in (6, 0, 1, 2, 3):
        return at.replace(hour=20, minute=0, second=0, microsecond=0)
    if at.hour < 4 and at.weekday() < 5:
        yesterday = at - timedelta(days=1)
        return yesterday.replace(hour=20, minute=0, second=0, microsecond=0)
    return None


def _stamp(value):
    stamp = datetime.fromisoformat(value)
    if stamp.tzinfo is None:
        raise ValueError("Alpaca timestamp is missing an offset")
    return stamp.astimezone(NEW_YORK)


def latest_trade(symbol):
    symbol = _alpaca_symbol(symbol)
    headers = _headers(symbol)
    if not headers:
        return None
    now = datetime.now(NEW_YORK)
    # Keep the just-completed overnight quote available until the next pre-market print.
    at = now if now.hour < 4 or now.hour >= 20 else now.replace(hour=3)
    open_time = _session_start(at)
    if open_time is None or (9 * 60 + 30 <= now.hour * 60 + now.minute < 20 * 60):
        return None
    try:
        response = httpx.get(
            f"{DATA_URL}/{symbol}/trades/latest",
            params={"feed": "boats"},
            headers=headers,
            timeout=3,
        )
        response.raise_for_status()
        trade = response.json()["trade"]
        price = float(trade["p"])
        stamp = _stamp(trade["t"])
        if (
            math.isfinite(price)
            and price > 0
            and stamp <= now
            and _session_start(stamp) == open_time
        ):
            return price, int(stamp.timestamp())
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
        logger.debug("BOATS latest trade unavailable for %s (%s)", symbol, type(error).__name__)
    return None


def history(symbol, period, interval, start, end):
    symbol = _alpaca_symbol(symbol)
    headers = _headers(symbol)
    if not headers:
        return []
    now = datetime.now(NEW_YORK)
    if start and end:
        start_at = datetime.fromisoformat(start).replace(tzinfo=NEW_YORK)
        end_at = min(now, datetime.fromisoformat(end).replace(tzinfo=NEW_YORK))
    elif period == "ytd":
        start_at = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_at = now
    elif period in _LOOKBACK:
        start_at = (now - timedelta(days=_LOOKBACK[period])).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end_at = now
    else:
        return []
    if not start_at < end_at:
        return []
    params = {
        "symbols": symbol,
        "feed": "boats",
        "timeframe": INTERVALS[interval],
        "start": start_at.isoformat(),
        "end": end_at.isoformat(),
        "limit": 10000,
        "sort": "desc",
    }
    points = []
    try:
        with httpx.Client(headers=headers, timeout=4) as client:
            for _ in range(3):
                response = client.get(f"{DATA_URL}/bars", params=params)
                response.raise_for_status()
                data = response.json()
                for bar in (data.get("bars") or {}).get(symbol, []):
                    stamp = _stamp(bar["t"])
                    prices = [float(bar[key]) for key in ("o", "h", "l", "c")]
                    if (
                        start_at <= stamp < end_at
                        and _session_start(stamp) is not None
                        and all(math.isfinite(price) and price > 0 for price in prices)
                    ):
                        points.append(
                            {
                                "Datetime": stamp,
                                **dict(zip(("Open", "High", "Low", "Close"), prices)),
                                "Volume": bar.get("v"),
                                "Source": "boats",
                            }
                        )
                token = data.get("next_page_token")
                if not token:
                    break
                params["page_token"] = token
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
        logger.debug("BOATS bars unavailable for %s (%s)", symbol, type(error).__name__)
    return points
