"""
Trade OS Position Sizing Engine

Calculates maximum allowed position sizes based on risk budget, per-share stop distance,
and single-stock capital notional limits.
All calculations use Python Decimal with explicit rounding.
"""

from decimal import ROUND_DOWN, Decimal
from typing import Any, Dict

from app.services.trade_os.decimal_utils import ZERO, d


class PositionSizingError(ValueError):
    """Raised when sizing inputs violate financial or logical invariants."""

    pass


def calculate_position_size(
    account_equity: Any,
    entry_price: Any,
    stop_price: Any,
    allowed_risk_pct: Any = Decimal("0.0050"),  # Default: 0.5%
    max_position_notional_pct: Any = Decimal("0.1000"),  # Default: 10%
    side: str = "long",
) -> Dict[str, Any]:
    """
    Computes exact allowed quantities and dollar risks.

    Formulas:
      Risk Budget = floor(Account Equity * Allowed Risk %)
      Risk Per Share = Entry Price - Stop Price (for long)
      Quantity by Risk = floor(Risk Budget / Risk Per Share)
      Quantity by Notional = floor(Account Equity * Max Notional % / Entry Price)
      Final Quantity = min(Quantity by Risk, Quantity by Notional)

    Example (PRD 10.3):
      Equity: $30,000, Risk%: 0.5%, Entry: $180, Stop: $171, Notional%: 10%
      -> Risk Budget = $150
      -> Risk Per Share = $9
      -> Qty by Risk = floor(150 / 9) = 16
      -> Qty by Notional = floor(30,000 * 0.10 / 180) = floor(3000 / 180) = 16
      -> Final Quantity = 16
      -> Planned Notional = 16 * $180 = $2,880
      -> Planned Risk = 16 * $9 = $144
    """
    eq = d(account_equity)
    entry = d(entry_price)
    stop = d(stop_price)
    risk_pct = d(allowed_risk_pct)
    notional_pct = d(max_position_notional_pct)

    if eq <= ZERO:
        raise PositionSizingError("Account equity must be greater than zero")

    if entry <= ZERO:
        raise PositionSizingError("Entry price must be greater than zero")

    if stop <= ZERO:
        raise PositionSizingError("Stop price must be greater than zero")

    if side.lower() == "long":
        if stop >= entry:
            raise PositionSizingError(
                "For long trade, stop price must be strictly lower than entry price"
            )
        risk_per_share = entry - stop
    elif side.lower() == "short":
        if stop <= entry:
            raise PositionSizingError(
                "For short trade, stop price must be strictly higher than entry price"
            )
        risk_per_share = stop - entry
    else:
        raise PositionSizingError(f"Unsupported side: {side}")

    # Dollar risk budget
    risk_budget = eq * risk_pct

    # Max shares by risk budget
    quantity_by_risk = int(
        (risk_budget / risk_per_share).quantize(Decimal("1"), rounding=ROUND_DOWN)
    )

    # Max shares by notional capital allocation
    notional_budget = eq * notional_pct
    quantity_by_notional = int(
        (notional_budget / entry).quantize(Decimal("1"), rounding=ROUND_DOWN)
    )

    # Overall max shares allowed
    max_allowed_quantity = max(0, min(quantity_by_risk, quantity_by_notional))

    planned_risk_amount = Decimal(max_allowed_quantity) * risk_per_share
    planned_notional = Decimal(max_allowed_quantity) * entry

    return {
        "account_equity": eq,
        "entry_price": entry,
        "stop_price": stop,
        "risk_per_share": risk_per_share,
        "risk_budget": risk_budget,
        "quantity_by_risk": quantity_by_risk,
        "quantity_by_notional": quantity_by_notional,
        "max_allowed_quantity": max_allowed_quantity,
        "planned_risk_amount": planned_risk_amount,
        "planned_notional": planned_notional,
        "notional_weight_pct": (planned_notional / eq * Decimal(100)) if eq > ZERO else ZERO,
        "risk_weight_pct": (planned_risk_amount / eq * Decimal(100)) if eq > ZERO else ZERO,
    }
