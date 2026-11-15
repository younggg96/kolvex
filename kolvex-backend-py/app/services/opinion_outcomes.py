"""What a stock did after each creator opinion on it. Facts only: no verdict on the call.

Method: app/services/opinion_backtest.py. Prices are adjusted daily bars from yfinance, cached
in memory; a failed download is never cached and surfaces as PricesUnavailable.
"""

import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional

from app.services import opinion_backtest as bt

HORIZONS = (5, 20)
CACHE_TTL_SECONDS = 1800.0
LOOKBACK_PAD_DAYS = 7

_RESULT_KEYS = ("status", "exit_date", "return_pct", "benchmark_return_pct", "excess_return_pct")

Downloader = Callable[[str, str, str], bt.Bars]

# symbol -> (monotonic time stored, start date covered, bars)
_cache: dict[str, tuple[float, str, bt.Bars]] = {}
_cache_lock = threading.Lock()


class PricesUnavailable(RuntimeError):
    """The price provider failed; outcomes cannot be stated right now."""


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()


def download_adjusted_bars(symbol: str, start: str, end: str) -> bt.Bars:
    import yfinance as yf

    frame = yf.Ticker(symbol).history(start=start, end=end, interval="1d", auto_adjust=True)
    bars = []
    for timestamp, row in frame.iterrows():
        open_, close = float(row["Open"]), float(row["Close"])
        if open_ > 0 and close > 0:  # NaN fails both comparisons
            bars.append({"date": timestamp.date().isoformat(), "open": open_, "close": close})
    return bars


def _bars(symbol: str, start: str, now: datetime, download: Downloader) -> bt.Bars:
    with _cache_lock:
        cached = _cache.get(symbol)
    if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS and cached[1] <= start:
        return bt.completed_bars(cached[2], now)
    end = (now.astimezone(bt.NY).date() + timedelta(days=1)).isoformat()
    try:
        bars = download(symbol, start, end)
    except Exception as error:
        raise PricesUnavailable(f"{symbol}: {type(error).__name__}") from error
    with _cache_lock:
        _cache[symbol] = (time.monotonic(), start, bars)
    return bt.completed_bars(bars, now)


def _public(event: dict[str, Any]) -> dict[str, Any]:
    horizons = {}
    for days, result in event["horizons"].items():
        horizons[str(days)] = {key: result.get(key) for key in _RESULT_KEYS}
    latest = event.get("latest")
    if latest:
        latest = {key: latest.get(key) for key in ("sessions", *_RESULT_KEYS[1:])}
    return {
        "status": event["status"],
        "entry_date": event["entry_date"],
        "entry_price": event["entry_price"],
        "latest": latest,
        "horizons": horizons,
    }


def stock_outcomes(
    ticker: str,
    rows: list[dict[str, Any]],
    now: Optional[datetime] = None,
    download: Downloader = download_adjusted_bars,
) -> dict[str, Any]:
    """Outcome per opinion id for one ticker. Blocking: call it from a worker thread."""
    now = now or datetime.now(timezone.utc)
    symbol = bt.price_symbol(ticker)
    base = {
        "ticker": symbol,
        "benchmark": bt.BENCHMARK,
        "horizons": list(HORIZONS),
        "method_version": bt.METHOD_VERSION,
        "as_of": None,
        "outcomes": {},
    }
    published = [p for p in (bt.published_ny(r.get("video_published_at")) for r in rows) if p]
    if not published:
        outcomes = {str(r["id"]): _public(bt.score_opinion(r, [], [], HORIZONS)) for r in rows}
        return {**base, "outcomes": outcomes}
    start = (min(published).date() - timedelta(days=LOOKBACK_PAD_DAYS)).isoformat()
    bars = _bars(symbol, start, now, download)
    benchmark = _bars(bt.BENCHMARK, start, now, download) if bars else []
    if bars and not benchmark:
        raise PricesUnavailable(f"{bt.BENCHMARK}: no bars")
    outcomes = {
        str(row["id"]): _public(bt.score_opinion(row, bars, benchmark, HORIZONS)) for row in rows
    }
    return {**base, "as_of": bars[-1]["date"] if bars else None, "outcomes": outcomes}
