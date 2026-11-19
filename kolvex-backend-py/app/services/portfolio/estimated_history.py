"""Estimate portfolio value over time from the current holdings and daily closes.

Saved snapshots only exist for days a sync completed, so a new connection has a
few points joined by straight lines. This series instead values *today's*
quantities at each trading day's close. It does not know about past trades, so
callers must label it as an estimate. Positions without a daily close (options,
cash, non-US listings, failed lookups) are held at today's value and reported in
``fixed_value`` / ``unpriced_symbols`` rather than guessed.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import Any, Callable, Dict, List, Optional
from zoneinfo import ZoneInfo

from app.services.portfolio.live_prices import quote_symbol

logger = logging.getLogger(__name__)

NEW_YORK = ZoneInfo("America/New_York")
HISTORY_TIMEOUT_SECONDS = 15
PERIOD_DAYS = {"1W": 7, "1M": 31, "3M": 92, "ALL": 365 * 5}
PERIODS = ("1W", "1M", "3M", "YTD", "ALL")

HistoryProvider = Callable[[str, str, str], List[Dict[str, Any]]]


def default_history_provider() -> HistoryProvider:
    from app.services.yfinance.client import get_yfinance_service

    service = get_yfinance_service()
    return lambda symbol, start, end: service.get_history(symbol, start=start, end=end)


def period_start(period: str, today: date) -> date:
    if period == "YTD":
        return date(today.year, 1, 1)
    return today - timedelta(days=PERIOD_DAYS.get(period, 31))


def _number(value: Any) -> Optional[float]:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _closes(bars: List[Dict[str, Any]]) -> Dict[str, float]:
    out: Dict[str, float] = {}
    for bar in bars or []:
        close = _number(bar.get("close"))
        day = str(bar.get("date") or "")[:10]
        if close is not None and close > 0 and len(day) == 10:
            out[day] = close
    return out


def _market_day(position: Dict[str, Any]) -> Optional[str]:
    """New York trading day of a live market price, if the holding has one."""
    if position.get("price_source") != "market":
        return None
    try:
        return (
            datetime.fromisoformat(str(position.get("price_as_of")))
            .astimezone(NEW_YORK)
            .date()
            .isoformat()
        )
    except ValueError:
        return None


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
                    "as_of": _market_day(position),
                }
            )
    return rows


async def _load_closes(
    symbols: List[str], start: date, end: date, provider: HistoryProvider
) -> Dict[str, Dict[str, float]]:
    found: Dict[str, Dict[str, float]] = {}

    async def one(symbol: str) -> None:
        try:
            bars = await asyncio.to_thread(provider, symbol, start.isoformat(), end.isoformat())
        except Exception:
            logger.warning("Portfolio history closes failed for %s", symbol)
            return
        closes = _closes(bars)
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
    """Daily value and open P&L of today's holdings over ``period``, ending at today's prices."""
    now = now or datetime.now(NEW_YORK)
    today = now.astimezone(NEW_YORK).date()
    start = period_start(period, today)
    rows = _position_rows(accounts)
    symbols = sorted({row["symbol"] for row in rows if row["symbol"]})
    closes = (
        await _load_closes(
            symbols, start, today + timedelta(days=1), provider or default_history_provider()
        )
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
    # The live point replaces the close of the day its quote belongs to. Without any
    # live quote the series ends at the last close instead of reusing a stale price.
    live_day = max((row["as_of"] for row in tracked if row["as_of"]), default=None)
    if not tracked:
        live_day = today.isoformat()
    days = sorted({day for row in tracked for day in closes[row["symbol"]]})
    days = [
        day
        for day in days
        if first_common and day >= first_common and (live_day is None or day < live_day)
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

    if rows and live_day:
        data.append(point(live_day, [row["value"] for row in tracked]))

    return {
        "period": period,
        "method": "current_holdings",
        "data": data,
        "fixed_value": round(fixed_value, 2),
        "unpriced_symbols": sorted({str(row["label"]) for row in fixed}),
    }
