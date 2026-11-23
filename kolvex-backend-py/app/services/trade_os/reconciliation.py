"""
Trade OS Reconciliation and Execution Aggregator

Aggregates individual executions into logical round-trip Trade Groups (FIFO / Average Cost),
calculates realized PnL, detects unmatched fills, and identifies reconciliation anomalies.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.services.trade_os.decimal_utils import ZERO, d, safe_div


def group_executions_fifo(
    executions: List[Dict[str, Any]],
    symbol: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Groups executions for a given symbol (or all symbols) into logical round-trip Trade Groups.
    Executions must be ordered chronologically by executed_at ASC.

    Returns:
      (trade_groups, reconciliation_issues)
    """
    if not executions:
        return [], []

    # Sort executions chronologically
    sorted_execs = sorted(
        executions,
        key=lambda x: (
            x["executed_at"]
            if isinstance(x["executed_at"], datetime)
            else datetime.fromisoformat(str(x["executed_at"]).replace("Z", "+00:00"))
        ),
    )

    # Filter by symbol if specified
    if symbol:
        sorted_execs = [e for e in sorted_execs if e["symbol"].upper() == symbol.upper()]

    # Partition by symbol
    by_symbol: Dict[str, List[Dict[str, Any]]] = {}
    for e in sorted_execs:
        sym = e["symbol"].upper()
        if sym not in by_symbol:
            by_symbol[sym] = []
        by_symbol[sym].append(e)

    trade_groups: List[Dict[str, Any]] = []
    issues: List[Dict[str, Any]] = []

    for sym, symbol_execs in by_symbol.items():
        # Current active open trade group for this symbol
        current_group: Optional[Dict[str, Any]] = None
        # Queue of open buy lots for FIFO matching: list of [execution_id, remaining_qty, price, executed_at]
        buy_lots: List[Dict[str, Any]] = []

        for ex in symbol_execs:
            side = ex["side"].lower()
            qty = abs(d(ex["quantity"]))
            price = abs(d(ex["price"]))
            fees = abs(d(ex.get("fees", ZERO)))
            ex_id = ex.get("id") or ex.get("source_execution_id")
            ex_time = (
                ex["executed_at"]
                if isinstance(ex["executed_at"], datetime)
                else datetime.fromisoformat(str(ex["executed_at"]).replace("Z", "+00:00"))
            )

            if side == "buy":
                # Start new trade group if none open
                if current_group is None:
                    current_group = {
                        "symbol": sym,
                        "side": "long",
                        "status": "open",
                        "open_quantity": ZERO,
                        "total_buy_quantity": ZERO,
                        "total_sell_quantity": ZERO,
                        "average_entry_price": ZERO,
                        "realized_pnl": ZERO,
                        "total_fees": ZERO,
                        "first_entry_at": ex_time,
                        "last_activity_at": ex_time,
                        "closed_at": None,
                        "execution_ids": [],
                    }

                # Update buy tracking in current group
                old_buy_qty = current_group["total_buy_quantity"]
                new_buy_qty = old_buy_qty + qty
                # Weighted average entry price
                current_cost = old_buy_qty * current_group["average_entry_price"] + qty * price
                current_group["average_entry_price"] = safe_div(current_cost, new_buy_qty)
                current_group["total_buy_quantity"] = new_buy_qty
                current_group["open_quantity"] += qty
                current_group["total_fees"] += fees
                current_group["last_activity_at"] = ex_time
                current_group["execution_ids"].append(ex_id)

                # Add lot for FIFO matching
                buy_lots.append(
                    {
                        "execution_id": ex_id,
                        "remaining_qty": qty,
                        "price": price,
                        "entry_fee_per_share": safe_div(fees, qty),
                        "executed_at": ex_time,
                    }
                )

            elif side == "sell":
                if not buy_lots or current_group is None:
                    # Sell without open buy: missing initial cost basis or unsupported short
                    issues.append(
                        {
                            "issue_type": "missing_cost_basis",
                            "symbol": sym,
                            "description": (
                                f"Sell of {qty} {sym} executed at {price} on {ex_time.strftime('%Y-%m-%d')} "
                                f"without prior open position. Recorded as unmatched sell."
                            ),
                            "raw_data": {
                                "execution_id": ex_id,
                                "quantity": str(qty),
                                "price": str(price),
                            },
                        }
                    )
                    continue

                # Match against FIFO lots
                remaining_to_sell = qty
                realized_gain_on_this_sell = ZERO
                matched_entry_fees_total = ZERO

                while remaining_to_sell > ZERO and buy_lots:
                    lot = buy_lots[0]
                    matched_qty = min(remaining_to_sell, lot["remaining_qty"])
                    lot_cost = matched_qty * lot["price"]
                    sell_proceeds = matched_qty * price
                    entry_fee_portion = matched_qty * lot["entry_fee_per_share"]

                    realized_gain_on_this_sell += sell_proceeds - lot_cost
                    matched_entry_fees_total += entry_fee_portion

                    lot["remaining_qty"] -= matched_qty
                    remaining_to_sell -= matched_qty

                    if lot["remaining_qty"] == ZERO:
                        buy_lots.pop(0)

                # If still oversold
                if remaining_to_sell > ZERO:
                    issues.append(
                        {
                            "issue_type": "oversold_execution",
                            "symbol": sym,
                            "description": (
                                f"Sell of {qty} {sym} exceeded open long quantity by {remaining_to_sell}."
                            ),
                            "raw_data": {
                                "execution_id": ex_id,
                                "oversold_quantity": str(remaining_to_sell),
                            },
                        }
                    )

                actual_sold = qty - remaining_to_sell
                current_group["total_sell_quantity"] += actual_sold
                current_group["open_quantity"] -= actual_sold
                # Realized PnL = gross gain - entry fees for matched shares - exit fees for this execution
                current_group["realized_pnl"] += (
                    realized_gain_on_this_sell - matched_entry_fees_total - fees
                )
                current_group["total_fees"] += fees
                current_group["last_activity_at"] = ex_time
                current_group["execution_ids"].append(ex_id)

                # Check if group is closed
                if current_group["open_quantity"] <= ZERO:
                    current_group["status"] = "closed"
                    current_group["closed_at"] = ex_time
                    trade_groups.append(current_group)
                    current_group = None
                else:
                    current_group["status"] = "partial"

        # If loop finishes with an open group
        if current_group is not None:
            trade_groups.append(current_group)

    return trade_groups, issues
