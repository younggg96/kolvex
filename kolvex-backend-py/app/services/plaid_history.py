"""Value Plaid's observed holdings for the latest completed US market session."""

import asyncio
import re
from collections.abc import Awaitable, Callable, Iterable
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from math import isfinite
from zoneinfo import ZoneInfo

import exchange_calendars

NEW_YORK = ZoneInfo("America/New_York")
US_EQUITY_MARKETS = {"XNYS", "XNAS", "XASE", "ARCX", "BATS", "IEXG"}
CloseLookup = Callable[[str, date], Awaitable[float | None]]


@lru_cache(maxsize=1)
def _calendar():
    return exchange_calendars.get_calendar("XNYS")


def capture_session(now: datetime) -> date | None:
    """Allow collection after the close and overnight while Plaid updates holdings."""
    calendar = _calendar()
    today = now.astimezone(NEW_YORK).date()
    session = calendar.date_to_session(today, direction="previous")
    close = calendar.session_close(session)
    if now < close:
        session = calendar.previous_session(session)
        close = calendar.session_close(session)
    next_open = calendar.session_open(calendar.next_session(session))
    if close <= now < min(next_open, close + timedelta(hours=18)):
        return session.date()
    return None


def _number(value) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if isfinite(parsed) else None


def _price_date(as_of: str | None, timestamp: str | None) -> date | None:
    try:
        if as_of:
            return date.fromisoformat(as_of)
        if timestamp:
            parsed = datetime.fromisoformat(timestamp)
            # A date-only quote can come back as midnight UTC.
            if parsed.tzinfo is None or parsed.time() == datetime.min.time():
                return parsed.date()
            return parsed.astimezone(NEW_YORK).date()
    except (TypeError, ValueError):
        return None
    return None


def _us_market_symbol(security: dict) -> str | None:
    symbol = security.get("ticker_symbol") or ""
    isin = security.get("isin") or ""
    if (
        security.get("type") in {"equity", "etf"}
        and (security.get("market_identifier_code") in US_EQUITY_MARKETS or isin.startswith("US"))
        and re.fullmatch(r"[A-Z][A-Z0-9]*(?:\.[A-Z])?", symbol)
    ):
        return symbol.replace(".", "-")
    return None


def _is_cash(security: dict) -> bool:
    return security.get("type") == "cash" or (security.get("ticker_symbol") or "").startswith(
        "CUR:"
    )


async def load_market_close(symbol: str, session: date) -> float | None:
    from app.services.yfinance.client import get_yfinance_service

    bars = await asyncio.to_thread(
        get_yfinance_service().get_history,
        symbol,
        start=session.isoformat(),
        end=(session + timedelta(days=1)).isoformat(),
    )
    for bar in bars:
        if str(bar.get("date", ""))[:10] == session.isoformat():
            close = _number(bar.get("close"))
            if close is not None and close > 0:
                return close
    return None


async def _market_value(
    holding: dict, security: dict, units: float, session: date, close_lookup: CloseLookup
) -> float | None:
    institution_value = _number(holding.get("institution_value"))
    institution_price = _number(holding.get("institution_price"))
    if _is_cash(security) or session == _price_date(
        holding.get("institution_price_as_of"), holding.get("institution_price_datetime")
    ):
        if institution_value is not None:
            return -abs(institution_value) if units < 0 else institution_value
        if institution_price is not None and institution_price >= 0:
            return units * institution_price

    if security.get("iso_currency_code") == "USD" and session == _price_date(
        security.get("close_price_as_of"), security.get("close_price_datetime")
    ):
        close = _number(security.get("close_price"))
        if close is not None and close > 0:
            return units * close

    symbol = _us_market_symbol(security)
    if symbol:
        close = _number(await close_lookup(symbol, session))
        if close is not None and close > 0:
            return units * close
    return None


async def calculate_snapshot(
    payloads: Iterable[dict], session: date, close_lookup: CloseLookup = load_market_close
) -> dict | None:
    """Return a complete USD snapshot, or leave a gap if a valuation cannot be verified."""
    total_value = total_cost = total_pnl = 0.0
    accounts = positions = 0
    closes: dict[str, float | None] = {}

    async def cached_close(symbol: str, day: date) -> float | None:
        if symbol not in closes:
            closes[symbol] = await close_lookup(symbol, day)
        return closes[symbol]

    for payload in payloads:
        account_ids = {account["account_id"] for account in payload["accounts"]}
        if not account_ids:
            return None
        accounts += len(account_ids)
        securities = {security["security_id"]: security for security in payload["securities"]}
        for holding in payload["holdings"]:
            if holding["account_id"] not in account_ids:
                return None
            units = _number(holding.get("quantity"))
            if units is None:
                return None
            if units == 0:
                continue
            security = securities.get(holding["security_id"], {})
            currency = (
                holding.get("iso_currency_code")
                or holding.get("unofficial_currency_code")
                or security.get("iso_currency_code")
            )
            if currency != "USD":
                return None
            value = await _market_value(holding, security, units, session, cached_close)
            if value is None:
                return None
            cost = _number(holding.get("cost_basis"))
            if cost is None and not _is_cash(security):
                return None
            total_value += value
            if cost is not None:
                total_cost += abs(cost)
                total_pnl += value - abs(cost) if units > 0 else value + abs(cost)
            positions += 1

    if not positions:
        return None
    return {
        "total_value": round(total_value, 2),
        "total_cost_basis": round(total_cost, 2),
        "unrealized_pnl": round(total_pnl, 2),
        "positions_count": positions,
        "accounts_count": accounts,
    }


def connected_during_session(connection: dict, session: date) -> bool:
    created_at = datetime.fromisoformat(connection["created_at"])
    return created_at.astimezone(timezone.utc) <= _calendar().session_close(session)
