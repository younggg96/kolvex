"""Mark cached holdings to the latest market quote.

Broker prices (Plaid ``institution_price`` or a manual import) are stored at sync
time and can be a day or more old. When a holding is a plain US-listed USD equity
or ETF, we replace its price with the latest regular-session quote and keep the
broker price alongside it. Anything we cannot price reliably keeps the broker
price, labelled as such, so the UI never shows a made-up value.
"""

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)

QuoteProvider = Callable[[str], Dict[str, Any]]

QUOTE_TIMEOUT_SECONDS = 8
MAX_CONCURRENT_QUOTES = 8
QUOTE_SOURCE = "Yahoo Finance"
_TICKER = re.compile(r"[A-Z][A-Z0-9]{0,5}(?:\.[A-Z])?")


def default_quote_provider() -> QuoteProvider:
    from app.services.yfinance.client import get_yfinance_service

    return get_yfinance_service().get_quote


def quote_symbol(position: Dict[str, Any]) -> Optional[str]:
    """The Yahoo symbol for a USD stock/ETF position, or None if we should not quote it."""
    if position.get("position_type", "equity") != "equity":
        return None
    if (position.get("currency") or "USD").upper() != "USD":
        return None
    symbol = str(position.get("symbol") or "").upper()
    if not _TICKER.fullmatch(symbol):
        return None
    return symbol.replace(".", "-")


def _positive(value: Any) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 and number != float("inf") else None


def normalize_quote(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Accept only a timestamped regular-session USD price for a stock or ETF."""
    if not isinstance(raw, dict):
        return None
    if raw.get("currency") != "USD" or raw.get("quote_type") not in ("EQUITY", "ETF"):
        return None
    price = _positive(raw.get("current_price"))
    try:
        at = datetime.fromtimestamp(float(raw.get("market_time")), timezone.utc)
    except (TypeError, ValueError, OverflowError, OSError):
        return None
    if price is None:
        return None
    return {"price": price, "at": at.isoformat()}


async def fetch_quotes(
    symbols: Iterable[str], provider: Optional[QuoteProvider] = None
) -> Dict[str, Dict[str, Any]]:
    """Quote each symbol concurrently; symbols that fail or time out are left out."""
    unique = sorted(set(symbols))
    if not unique:
        return {}
    provider = provider or default_quote_provider()
    gate = asyncio.Semaphore(MAX_CONCURRENT_QUOTES)
    quotes: Dict[str, Dict[str, Any]] = {}

    async def one(symbol: str) -> None:
        async with gate:
            try:
                quote = normalize_quote(await asyncio.to_thread(provider, symbol))
            except Exception:
                logger.warning("Holdings quote lookup failed for %s", symbol)
                return
        if quote:
            quotes[symbol] = quote

    try:
        await asyncio.wait_for(
            asyncio.gather(*(one(symbol) for symbol in unique)), QUOTE_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        logger.warning("Holdings quotes timed out; %d of %d priced", len(quotes), len(unique))
    return dict(quotes)


def apply_quote(position: Dict[str, Any], quote: Optional[Dict[str, Any]], broker_as_of) -> None:
    """Reprice one position in place and record where its price came from."""
    broker_price = position.get("price")
    position["broker_price"] = broker_price
    if not quote:
        position["price_source"] = "broker" if broker_price is not None else None
        position["price_as_of"] = broker_as_of if broker_price is not None else None
        return

    price = quote["price"]
    units = position.get("units") or 0
    open_pnl = position.get("open_pnl")
    average = position.get("average_purchase_price")
    if isinstance(open_pnl, (int, float)) and isinstance(broker_price, (int, float)):
        # Plaid's open P&L is value minus total cost, so move it by the price change.
        position["open_pnl"] = round(open_pnl + (price - broker_price) * units, 4)
    elif isinstance(average, (int, float)):
        position["open_pnl"] = round((price - average) * units, 4)
    position["price"] = price
    position["price_source"] = "market"
    position["price_as_of"] = quote["at"]


async def mark_to_market(
    accounts: List[Dict[str, Any]], provider: Optional[QuoteProvider] = None
) -> None:
    """Reprice every quotable position in place; ``synced_at`` dates broker prices."""
    rows = [
        (position, account.get("synced_at"))
        for account in accounts
        for position in account.get("portfolio_positions") or []
    ]
    symbols = [quote_symbol(position) for position, _ in rows]
    quotes = await fetch_quotes((s for s in symbols if s), provider)
    for (position, synced_at), symbol in zip(rows, symbols):
        apply_quote(position, quotes.get(symbol) if symbol else None, synced_at)
