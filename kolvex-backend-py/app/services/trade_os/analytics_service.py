"""
Performance Analytics Service for Kolvex Trade OS.
Aggregates Expectancy, Profit Factor, R-Multiple distribution,
and Plan Discipline metrics for an account.
"""

import logging
from decimal import Decimal
from typing import Any, Dict, List

from app.services.trade_os.decimal_utils import ZERO, d, quantize_money
from app.services.trade_os.journal_service import get_journal_entries

logger = logging.getLogger(__name__)


def compute_account_analytics(journal_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes statistical and discipline performance metrics from journal entries.
    """
    closed_trades = [item for item in journal_items if item.get("status") == "closed"]
    total_closed = len(closed_trades)

    if total_closed == 0:
        return {
            "total_closed_trades": 0,
            "win_rate_pct": 0.0,
            "profit_factor": 1.0,
            "expectancy_r": 0.0,
            "plan_coverage_pct": 0.0,
            "outside_plan_count": 0,
            "gross_profit": "0.00",
            "gross_loss": "0.00",
            "net_realized_pnl": "0.00",
            "average_win_pnl": "0.00",
            "average_loss_pnl": "0.00",
            "r_distribution": {
                "loss_gt_2r": 0,
                "loss_1_to_2r": 0,
                "loss_0_to_1r": 0,
                "win_0_to_1r": 0,
                "win_1_to_2r": 0,
                "win_2_to_3r": 0,
                "win_gt_3r": 0,
            },
            "mistake_tag_counts": {},
        }

    # Plan coverage
    planned_trades = [t for t in closed_trades if t.get("planned") is True]
    outside_plan_trades = [t for t in closed_trades if t.get("planned") is not True]
    plan_coverage_pct = quantize_money(
        Decimal(len(planned_trades)) / Decimal(total_closed) * Decimal(100)
    )

    winning_trades = [t for t in closed_trades if float(t.get("realized_pnl", 0)) > 0]
    losing_trades = [t for t in closed_trades if float(t.get("realized_pnl", 0)) < 0]

    win_count = len(winning_trades)
    win_rate = quantize_money(Decimal(win_count) / Decimal(total_closed) * Decimal(100))

    gross_profit = sum([d(t["realized_pnl"]) for t in winning_trades], ZERO)
    gross_loss = abs(sum([d(t["realized_pnl"]) for t in losing_trades], ZERO))
    net_pnl = sum([d(t["realized_pnl"]) for t in closed_trades], ZERO)

    profit_factor = (
        quantize_money(gross_profit / gross_loss)
        if gross_loss > ZERO
        else (Decimal("99.99") if gross_profit > ZERO else Decimal("1.00"))
    )

    avg_win = quantize_money(gross_profit / Decimal(win_count)) if win_count > 0 else ZERO
    avg_loss = quantize_money(gross_loss / Decimal(len(losing_trades))) if losing_trades else ZERO

    # R-Multiple statistics
    trades_with_r = [t for t in closed_trades if t.get("realized_r") is not None]
    if trades_with_r:
        total_r = sum([d(t["realized_r"]) for t in trades_with_r], ZERO)
        expectancy_r = quantize_money(total_r / Decimal(len(trades_with_r)))
    else:
        expectancy_r = ZERO

    # R distribution buckets
    r_dist = {
        "loss_gt_2r": 0,
        "loss_1_to_2r": 0,
        "loss_0_to_1r": 0,
        "win_0_to_1r": 0,
        "win_1_to_2r": 0,
        "win_2_to_3r": 0,
        "win_gt_3r": 0,
    }

    mistake_counts: Dict[str, int] = {}

    for t in closed_trades:
        r = t.get("realized_r")
        if r is not None:
            r_val = float(r)
            if r_val < -2.0:
                r_dist["loss_gt_2r"] += 1
            elif -2.0 <= r_val < -1.0:
                r_dist["loss_1_to_2r"] += 1
            elif -1.0 <= r_val < 0.0:
                r_dist["loss_0_to_1r"] += 1
            elif 0.0 <= r_val < 1.0:
                r_dist["win_0_to_1r"] += 1
            elif 1.0 <= r_val < 2.0:
                r_dist["win_1_to_2r"] += 1
            elif 2.0 <= r_val < 3.0:
                r_dist["win_2_to_3r"] += 1
            else:
                r_dist["win_gt_3r"] += 1

        review = t.get("review")
        if review and review.get("mistake_tags"):
            for tag in review["mistake_tags"]:
                mistake_counts[tag] = mistake_counts.get(tag, 0) + 1

    return {
        "total_closed_trades": total_closed,
        "win_rate_pct": float(win_rate),
        "profit_factor": float(profit_factor),
        "expectancy_r": float(expectancy_r),
        "plan_coverage_pct": float(plan_coverage_pct),
        "outside_plan_count": len(outside_plan_trades),
        "gross_profit": str(quantize_money(gross_profit)),
        "gross_loss": str(quantize_money(gross_loss)),
        "net_realized_pnl": str(quantize_money(net_pnl)),
        "average_win_pnl": str(avg_win),
        "average_loss_pnl": str(avg_loss),
        "r_distribution": r_dist,
        "mistake_tag_counts": mistake_counts,
    }


async def get_account_performance_analytics(account_id: str) -> Dict[str, Any]:
    """Fetches journal items and computes analytics."""
    journal_items = await get_journal_entries(account_id)
    return compute_account_analytics(journal_items)
