"""Estimate portfolio value over time from the current holdings and price bars.

Saved snapshots only exist for days a sync completed, so a new connection has a
few points joined by straight lines. This series instead values *today's*
quantities at each bar's close, using the same bar sizes as the stock chart
(1-minute for 4H, 5-minute for 1D, 15-minute for 1W, daily beyond that). It does not know about past trades, so
callers must label it as an estimate. Positions without a daily close (options,
cash, non-US listings, failed lookups) are held at today's value and reported in
``fixed_value`` / ``unpriced_symbols`` rather than guessed.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from app.services.portfolio.live_prices import quote_symbol

logger = logging.getLogger(__name__)

NEW_YORK = ZoneInfo("America/New_York")
HISTORY_TIMEOUT_SECONDS = 15
# period -> (yfinance period, bar interval). "1d" covers the latest session even overnight.
PERIOD_BARS: Dict[str, Tuple[str, str]] = {
    "4H": ("1d", "1m"),
    "1D": ("1d", "5m"),
    "1W": ("5d", "15m"),
    "1M": ("1mo", "1d"),
    "3M": ("3mo", "1d"),
    "YTD": ("ytd", "1d"),
    "ALL": ("5y", "1d"),
}
PERIODS = tuple(PERIOD_BARS)
WINDOW = {"4H": timedelta(hours=4)}

HistoryProvider = Callable[[str, str, str], List[Dict[str, Any]]]


def default_history_provider() -> HistoryProvider:
    from app.services.yfinance.client import get_yfinance_service

    service = get_yfinance_service()
    # Intraday bars include pre- and after-hours trading (04:00–20:00 ET).
    return lambda symbol, period, interval: service.get_history(
        symbol, period=period, interval=interval, prepost=interval.endswith("m")
    )


def is_intraday(period: str) -> bool:
    return PERIOD_BARS[period][1].endswith("m")


def _number(value: Any) -> Optional[float]:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _bar_key(raw: Any, intraday: bool) -> Optional[str]:
    """Daily bars key on the NY date; intraday bars on the bar's NY start time."""
    text = str(raw or "")
    if not intraday:
        return text[:10] if len(text) >= 10 else None
    try:
        stamp = datetime.fromisoformat(text)
    except ValueError:
        return None
    if stamp.tzinfo is None:
        return None
    return stamp.astimezone(NEW_YORK).isoformat()


def _closes(bars: List[Dict[str, Any]], intraday: bool) -> Dict[str, float]:
    out: Dict[str, float] = {}
    for bar in bars or []:
        close = _number(bar.get("close"))
        key = _bar_key(bar.get("date"), intraday)
        if close is not None and close > 0 and key:
            out[key] = close
    return out


def _market_time(position: Dict[str, Any]) -> Optional[datetime]:
    """When the holding's live market price was observed, if it has one."""
    if position.get("price_source") != "market":
        return None
    try:
        stamp = datetime.fromisoformat(str(position.get("price_as_of")))
    except ValueError:
        return None
    return stamp.astimezone(NEW_YORK) if stamp.tzinfo else None


def _position_rows(accounts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows = []
    for account in accounts:
        for position in account.get("portfolio_positions") or []:
            units = _number(position.get("units"))
            price = _number(position.get("price"))
            if not units or price is None:
                continue
            multiplier = 100 if position.get("position_type") == "option" else 1
            value = price * units * multiplier
            open_pnl = _number(position.get("open_pnl"))
            average = _number(position.get("average_purchase_price"))
            if open_pnl is not None:
                cost = value - open_pnl
            elif average is not None and multiplier == 1:
                cost = average * units
            else:
                cost = None
            rows.append(
                {
                    "symbol": quote_symbol(position),
                    "label": position.get("symbol"),
                    "units": units,
                    "value": value,
                    "cost": cost,
                    "as_of": _market_time(position),
                }
            )
    return rows


async def _load_closes(
    symbols: List[str], period: str, provider: HistoryProvider
) -> Dict[str, Dict[str, float]]:
    found: Dict[str, Dict[str, float]] = {}
    yf_period, interval = PERIOD_BARS[period]

    async def one(symbol: str) -> None:
        try:
            bars = await asyncio.to_thread(provider, symbol, yf_period, interval)
        except Exception:
            logger.warning("Portfolio history closes failed for %s", symbol)
            return
        closes = _closes(bars, is_intraday(period))
        if closes:
            found[symbol] = closes

    try:
        await asyncio.wait_for(
            asyncio.gather(*(one(symbol) for symbol in symbols)), HISTORY_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        logger.warning("Portfolio history closes timed out")
    return dict(found)


async def estimate_history(
    accounts: List[Dict[str, Any]],
    period: str,
    provider: Optional[HistoryProvider] = None,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Value and open P&L of today's holdings over ``period``, ending at today's prices."""
    now = (now or datetime.now(NEW_YORK)).astimezone(NEW_YORK)
    intraday = is_intraday(period)
    rows = _position_rows(accounts)
    symbols = sorted({row["symbol"] for row in rows if row["symbol"]})
    closes = (
        await _load_closes(symbols, period, provider or default_history_provider())
        if symbols
        else {}
    )

    tracked = [row for row in rows if row["symbol"] in closes]
    fixed = [row for row in rows if row["symbol"] not in closes]
    fixed_value = sum(row["value"] for row in fixed)
    fixed_pnl = sum(row["value"] - row["cost"] for row in fixed if row["cost"] is not None)
    known_cost = sum(row["cost"] for row in rows if row["cost"] is not None)

    # Start once every tracked symbol has a close, so no value is invented before a listing.
    first_common = max((min(closes[row["symbol"]]) for row in tracked), default=None)
    # The live point follows the bars it belongs after (intraday: earlier bar starts;
    # daily: earlier days). Without any live quote the series ends at the last bar
    # instead of reusing a stale broker price.
    live_at = max((row["as_of"] for row in tracked if row["as_of"]), default=None)
    if not tracked:
        live_at = now
    live_key = None
    if live_at:
        live_key = live_at.isoformat() if intraday else live_at.date().isoformat()
    days = sorted({day for row in tracked for day in closes[row["symbol"]]})
    days = [
        day
        for day in days
        if first_common and day >= first_common and (live_key is None or day < live_key)
    ]

    def point(day: str, values: List[float]) -> Dict[str, Any]:
        value = sum(values) + fixed_value
        pnl = fixed_pnl + sum(
            v - row["cost"] for row, v in zip(tracked, values) if row["cost"] is not None
        )
        return {
            "date": day,
            "value": round(value, 2),
            "pnl": round(pnl, 2),
            "pnl_percent": round(pnl / known_cost * 100, 4) if known_cost > 0 else 0.0,
        }

    data = []
    last_close: Dict[str, float] = {}
    for day in days:
        for row in tracked:
            close = closes[row["symbol"]].get(day)
            if close is not None:
                last_close[row["symbol"]] = close
        data.append(point(day, [row["units"] * last_close[row["symbol"]] for row in tracked]))

    if rows and live_key:
        data.append(point(live_key, [row["value"] for row in tracked]))

    window = WINDOW.get(period)
    if window and data:
        end = datetime.fromisoformat(data[-1]["date"])
        data = [p for p in data if datetime.fromisoformat(p["date"]) >= end - window]

    return {
        "period": period,
        "method": "current_holdings",
        "data": data,
        "fixed_value": round(fixed_value, 2),
        "unpriced_symbols": sorted({str(row["label"]) for row in fixed}),
    }
