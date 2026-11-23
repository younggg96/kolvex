"""
Manual Trade Parser and Validator

Parses and validates manual trade entry dictionaries or JSON lists.
"""

import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.services.trade_os.decimal_utils import ZERO, DecimalError, d


class ManualTradeValidationError(ValueError):
    """Raised when manual trade input does not meet required criteria."""

    pass


def parse_manual_trade(item: Dict[str, Any], row_index: int = 1) -> Dict[str, Any]:
    """Validate and normalize a single manual trade dictionary."""
    symbol = str(item.get("symbol", "")).strip().upper()
    if not symbol:
        raise ManualTradeValidationError(f"Row {row_index}: Symbol is required")

    side = str(item.get("side", "")).strip().lower()
    if side not in ("buy", "sell"):
        raise ManualTradeValidationError(
            f"Row {row_index}: Side must be 'buy' or 'sell', got '{side}'"
        )

    try:
        raw_qty = d(item.get("quantity"))
        if raw_qty <= ZERO:
            raise ManualTradeValidationError(f"Row {row_index}: Quantity must be greater than 0")
        quantity = raw_qty
    except DecimalError:
        raise ManualTradeValidationError(f"Row {row_index}: Invalid quantity value")

    try:
        raw_price = d(item.get("price"))
        if raw_price <= ZERO:
            raise ManualTradeValidationError(f"Row {row_index}: Price must be greater than 0")
        price = raw_price
    except DecimalError:
        raise ManualTradeValidationError(f"Row {row_index}: Invalid price value")

    fees = ZERO
    if item.get("fees") is not None:
        try:
            fees = abs(d(item.get("fees")))
        except DecimalError:
            fees = ZERO

    # Executed date
    raw_date = item.get("executed_at")
    if isinstance(raw_date, datetime):
        executed_at = raw_date if raw_date.tzinfo else raw_date.replace(tzinfo=timezone.utc)
    elif isinstance(raw_date, str):
        try:
            executed_at = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
        except Exception:
            raise ManualTradeValidationError(
                f"Row {row_index}: Invalid ISO executed_at date '{raw_date}'"
            )
    else:
        executed_at = datetime.now(timezone.utc)

    amount = quantity * price

    # Generate stable ID
    fp = f"manual|{symbol}|{side}|{quantity}|{price}|{executed_at.isoformat()}|{row_index}"
    source_id = "man_" + hashlib.sha256(fp.encode("utf-8")).hexdigest()[:24]

    return {
        "source_execution_id": item.get("source_execution_id") or source_id,
        "symbol": symbol,
        "side": side,
        "quantity": quantity,
        "price": price,
        "amount": amount,
        "fees": fees,
        "executed_at": executed_at,
        "activity_type": item.get("activity_type", "trade"),
        "instrument_type": item.get("instrument_type", "equity"),
        "description": item.get("description", "Manual trade entry"),
        "source": "manual",
        "trade_plan_id": item.get("trade_plan_id"),
    }


def parse_manual_trades(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Validate and parse a list of manual trade items."""
    results = []
    for i, item in enumerate(items, 1):
        results.append(parse_manual_trade(item, row_index=i))
    return results
