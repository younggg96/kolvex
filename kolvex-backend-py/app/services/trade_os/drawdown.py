"""
Trade OS Drawdown Calculator

Computes cash-flow-adjusted account drawdown using Time-Weighted Return (TWR)
unit value methodology. Prevents cash deposits or withdrawals from artificially
masking or fabricating trading drawdowns.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List

from app.services.trade_os.decimal_utils import ONE, ZERO, d, safe_div


def compute_cash_flow_adjusted_drawdown(
    initial_equity: Any,
    equity_snapshots: List[Dict[str, Any]],
    cash_flows: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Computes current and maximum drawdown adjusting for deposits and withdrawals.

    Args:
      initial_equity: Starting capital.
      equity_snapshots: List of dicts with 'snapshot_at' and 'net_liquidation_value'.
      cash_flows: List of dicts with 'effective_date', 'amount', 'flow_type'.
                  Deposits > 0, Withdrawals < 0 (or flow_type='withdrawal' with positive amount).

    Returns:
      {
        "current_drawdown_pct": Decimal, # e.g. 0.0520 for 5.2%
        "max_drawdown_pct": Decimal,
        "peak_unit_value": Decimal,
        "current_unit_value": Decimal,
      }
    """
    init_eq = d(initial_equity)
    if init_eq <= ZERO:
        return {
            "current_drawdown_pct": ZERO,
            "max_drawdown_pct": ZERO,
            "peak_unit_value": ONE,
            "current_unit_value": ONE,
        }

    if not equity_snapshots:
        return {
            "current_drawdown_pct": ZERO,
            "max_drawdown_pct": ZERO,
            "peak_unit_value": ONE,
            "current_unit_value": ONE,
        }

    # Sort snapshots ascending
    sorted_snaps = sorted(
        equity_snapshots,
        key=lambda s: (
            s["snapshot_at"]
            if isinstance(s["snapshot_at"], (datetime, date))
            else datetime.fromisoformat(str(s["snapshot_at"]).replace("Z", "+00:00"))
        ),
    )

    # Aggregate cash flows by effective date
    cf_by_date: Dict[date, Decimal] = {}
    for cf in cash_flows:
        raw_dt = cf.get("effective_date")
        if isinstance(raw_dt, datetime):
            cf_date = raw_dt.date()
        elif isinstance(raw_dt, date):
            cf_date = raw_dt
        elif isinstance(raw_dt, str):
            cf_date = datetime.fromisoformat(raw_dt.replace("Z", "+00:00")).date()
        else:
            continue

        amt = d(cf.get("amount", ZERO))
        flow_type = cf.get("flow_type", "").lower()
        # If flow_type is withdrawal and amt is positive, flip to negative
        signed_amt = -abs(amt) if flow_type == "withdrawal" else amt
        cf_by_date[cf_date] = cf_by_date.get(cf_date, ZERO) + signed_amt

    unit_val = ONE
    peak_val = ONE
    max_dd = ZERO

    prev_equity = init_eq

    for snap in sorted_snaps:
        raw_at = snap.get("snapshot_at")
        if isinstance(raw_at, (datetime, date)):
            snap_date = raw_at if isinstance(raw_at, date) else raw_at.date()
        else:
            snap_date = datetime.fromisoformat(str(raw_at).replace("Z", "+00:00")).date()

        end_equity = d(snap["net_liquidation_value"])
        cf_today = cf_by_date.get(snap_date, ZERO)

        # Market-driven ending equity before today's net injection
        market_end = end_equity - cf_today

        # Daily period return
        if prev_equity > ZERO:
            daily_ret = safe_div(market_end, prev_equity) - ONE
        else:
            daily_ret = ZERO

        unit_val = unit_val * (ONE + daily_ret)
        if unit_val > peak_val:
            peak_val = unit_val

        # Drawdown from peak
        if peak_val > ZERO:
            dd = max(ZERO, (peak_val - unit_val) / peak_val)
        else:
            dd = ZERO

        if dd > max_dd:
            max_dd = dd

        prev_equity = end_equity

    # Current drawdown
    if peak_val > ZERO:
        current_dd = max(ZERO, (peak_val - unit_val) / peak_val)
    else:
        current_dd = ZERO

    return {
        "current_drawdown_pct": current_dd,
        "max_drawdown_pct": max_dd,
        "peak_unit_value": peak_val,
        "current_unit_value": unit_val,
    }
