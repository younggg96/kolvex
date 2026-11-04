"""Bounded Yahoo screener discovery; rankings are snapshots, not live quotes.

The presets cover qualifying US equities, not the entire exchange universe.
Volume multiples compare accumulated regular-session volume with full-day 3M
average volume. They are deliberately NOT same-time-of-day relative volume.
"""

import copy
import logging
import math
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import yfinance as yf

logger = logging.getLogger(__name__)
SCREENS = ("day_gainers", "day_losers", "most_actives")
TTL = 60
MAX_AGE = 15 * 60
TIMEOUT = 12
LIMIT = 100
MIN_VOLUME_MULTIPLE = 1.5
_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="stock-discovery")
_lock = threading.Lock()
_cache = {}
_pending = {}


class DiscoveryUnavailable(Exception):
    pass


def _number(value):
    if isinstance(value, bool):
        return None
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError, OverflowError):
        return None


def _normalize(row, now):
    if not isinstance(row, dict):
        return None
    symbol = row.get("symbol")
    if not isinstance(symbol, str) or not re.fullmatch(r"[A-Z][A-Z0-9.-]{0,9}", symbol):
        return None
    if row.get("quoteType") != "EQUITY" or row.get("currency") != "USD":
        return None
    price = _number(row.get("regularMarketPrice"))
    change = _number(row.get("regularMarketChangePercent"))
    volume = _number(row.get("regularMarketVolume"))
    cap = _number(row.get("marketCap"))
    stamp = _number(row.get("regularMarketTime"))
    # Keep one explicit eligibility policy across all three upstream presets.
    if (price is None or price < 5 or change is None or volume is None or volume < 20_000
            or cap is None or cap < 2_000_000_000 or stamp is None
            or not now - 7 * 86400 <= stamp <= now + 300):
        return None
    average = _number(row.get("averageDailyVolume3Month"))
    session = datetime.fromtimestamp(stamp, ZoneInfo("America/New_York")).date().isoformat()
    return {
        "symbol": symbol, "name": row.get("shortName") or row.get("longName") or symbol,
        "price": price, "changePercent": change, "volume": int(volume),
        "averageVolume": average if average and average > 0 else None,
        "volumeMultiple": volume / average if average and average > 0 else None,
        "marketTime": int(stamp), "sessionDate": session,
    }


def _fetch(screen):
    result = yf.screen(screen, count=LIMIT)
    if not isinstance(result, dict) or not isinstance(result.get("quotes"), list):
        raise DiscoveryUnavailable("Malformed screener response")
    return result["quotes"]


def _board(screens, now, clock, active=False):
    available, stale, items = [], [], {}
    for screen in screens:
        saved = _cache.get(screen)
        if saved is None or clock - saved[0] > MAX_AGE:
            continue
        available.append(screen)
        if clock - saved[0] >= TTL:
            stale.append(screen)
        for raw in saved[1]:
            item = _normalize(raw, now)
            if item is None:
                continue
            previous = items.get(item["symbol"])
            if previous is None or item["marketTime"] > previous["marketTime"]:
                items[item["symbol"]] = item
    # Never put a suspended ticker's old move alongside the newest session.
    session = max((item["sessionDate"] for item in items.values()), default=None)
    rows = [item for item in items.values() if item["sessionDate"] == session]
    if active:
        rows = [item for item in rows if item["volumeMultiple"] is not None
                and item["volumeMultiple"] >= MIN_VOLUME_MULTIPLE]
        rows.sort(key=lambda item: (-item["volumeMultiple"], -item["volume"] * item["price"], item["symbol"]))
    else:
        rows.sort(key=lambda item: (-abs(item["changePercent"]), item["symbol"]))
    return {
        "items": rows[:LIMIT], "sessionDate": session,
        "unavailable": not available, "partial": len(available) < len(screens),
        "stale": bool(stale),
        "fetchedAt": min((_cache[name][2] for name in available), default=None),
    }


def get_stock_discovery():
    """Single-flight per preset, bounded waiting, and explicitly labelled fallback."""
    if not _lock.acquire(timeout=TIMEOUT + 1):
        raise DiscoveryUnavailable("Discovery busy")
    try:
        clock = time.monotonic()
        for screen in SCREENS:
            saved = _cache.get(screen)
            if saved and clock - saved[0] < TTL:
                continue
            if screen not in _pending:
                _pending[screen] = _executor.submit(_fetch, screen)
        if _pending:
            wait(list(_pending.values()), timeout=TIMEOUT)
        for screen, future in list(_pending.items()):
            if not future.done():
                continue
            del _pending[screen]
            try:
                rows = future.result()
                _cache[screen] = (time.monotonic(), rows, datetime.now(timezone.utc).isoformat())
            except Exception:
                logger.warning("Stock discovery preset unavailable: %s", screen)
        now, clock = time.time(), time.monotonic()
        movers = _board(SCREENS[:2], now, clock)
        active = _board(SCREENS[2:], now, clock, active=True)
        if movers["unavailable"] and active["unavailable"]:
            raise DiscoveryUnavailable("Screeners unavailable")
        return copy.deepcopy({"source": "Yahoo Finance", "movers": movers, "active": active})
    finally:
        _lock.release()
