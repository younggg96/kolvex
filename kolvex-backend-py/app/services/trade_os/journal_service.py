"""
Trade Journal Service for Kolvex Trade OS.
Reconciles closed/open trade groups against approved Trade Plans,
computes realized R-Multiples, detects unplanned executions,
and manages post-trade discipline reviews and AI explanations.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.core.supabase import get_supabase_service
from app.services.trade_os.decimal_utils import ZERO, d, quantize_money

logger = logging.getLogger(__name__)


def generate_structured_ai_review(
    symbol: str,
    realized_pnl: Decimal,
    planned: bool,
    planned_entry: Optional[Decimal] = None,
    planned_stop: Optional[Decimal] = None,
    planned_target: Optional[Decimal] = None,
    realized_r: Optional[Decimal] = None,
    mistake_tags: Optional[List[str]] = None,
) -> str:
    """
    Generates deterministic, non-predictive, rules-based retrospective trade review.
    Enforces Kolvex AGENTS.md rules: no paid model calls, explainable facts only.
    """
    tags = mistake_tags or []
    lines = []

    if not planned:
        lines.append(
            f"• **Execution Fidelity (纪律评估)**: This trade on {symbol} was executed **Outside Plan** without a prior approved Trade Plan. Operating outside risk bounds increases vulnerability to emotional sizing."
        )
    else:
        lines.append(
            f"• **Execution Fidelity (纪律评估)**: Trade was initiated under an approved Trade Plan. Entry was established near planned level (${planned_entry or 'N/A'})."
        )

    # Risk & R-Multiple
    if realized_pnl > ZERO:
        r_str = f"+{realized_r:.2f}R" if realized_r is not None else "positive"
        lines.append(
            f"• **Risk Management (盈亏表现)**: Realized profit of ${realized_pnl:.2f} ({r_str}). Risk was controlled throughout the lifecycle."
        )
    else:
        loss_val = abs(realized_pnl)
        r_str = f"{realized_r:.2f}R" if realized_r is not None else "negative"
        lines.append(
            f"• **Risk Management (盈亏表现)**: Closed with loss of -${loss_val:.2f} ({r_str}). Acceptable business cost if contained within the 1.0R boundary."
        )

    # Mistake feedback
    if "moved_stop" in tags:
        lines.append(
            "• **System Improvement (改进建议)**: Stop was adjusted after entry. Moving stops during adverse moves violates risk containment rule G2."
        )
    elif "early_exit" in tags:
        lines.append(
            "• **System Improvement (改进建议)**: Exited prematurely before reaching target or technical invalidation. Let the trade bracket play out."
        )
    elif "fomo" in tags:
        lines.append(
            "• **System Improvement (改进建议)**: Entry was chased due to FOMO. Wait for price confirmation at the predetermined breakout level."
        )
    else:
        lines.append(
            "• **System Improvement (改进建议)**: Maintain current plan-first discipline. Ensure all future entries carry a predefined invalidation price."
        )

    return "\n\n".join(lines)


async def get_journal_entries(account_id: str) -> List[Dict[str, Any]]:
    """
    Fetches trade groups for an account, annotates them with Trade Plan matches,
    realized R-Multiples, and reviews.
    """
    try:
        client = get_supabase_service()
    except Exception:
        return []

    # 1. Fetch trade groups
    tg_res = (
        client.table("trade_groups")
        .select("*")
        .eq("account_id", account_id)
        .order("created_at", desc=True)
        .execute()
    )
    trade_groups = tg_res.data or []

    # 2. Fetch approved trade plans for this account
    plans_res = (
        client.table("trade_plans")
        .select("*")
        .eq("account_id", account_id)
        .in_("status", ["approved", "executed", "closed"])
        .execute()
    )
    plans = plans_res.data or []

    # 3. Fetch existing journal reviews
    # Only this account's trade groups: the service-role client bypasses RLS.
    group_ids = [tg["id"] for tg in trade_groups if tg.get("id")]
    reviews = []
    if group_ids:
        reviews = (
            client.table("trade_os_journal_reviews")
            .select("*")
            .in_("trade_group_id", group_ids)
            .execute()
            .data
            or []
        )
    reviews_map = {r["trade_group_id"]: r for r in reviews}

    journal_items: List[Dict[str, Any]] = []

    for tg in trade_groups:
        symbol = tg.get("symbol", "").upper()
        pnl = d(tg.get("realized_pnl", ZERO))
        is_closed = tg.get("status") == "closed"

        # Find matching plan by symbol
        matching_plan = None
        for p in plans:
            if p.get("symbol", "").upper() == symbol:
                matching_plan = p
                break

        planned = matching_plan is not None
        planned_risk = d(matching_plan.get("planned_risk_amount", ZERO)) if matching_plan else ZERO

        realized_r = None
        if planned and planned_risk > ZERO and is_closed:
            realized_r = quantize_money(pnl / planned_risk)

        review = reviews_map.get(tg["id"])

        journal_items.append(
            {
                "trade_group_id": tg["id"],
                "account_id": account_id,
                "symbol": symbol,
                "status": tg.get("status", "open"),
                "total_quantity": str(tg.get("total_quantity", 0)),
                "remaining_quantity": str(tg.get("remaining_quantity", 0)),
                "average_cost": str(tg.get("average_cost", "0.00")),
                "average_exit_price": str(tg.get("average_exit_price", "0.00")),
                "realized_pnl": str(quantize_money(pnl)),
                "planned": planned,
                "plan_id": matching_plan.get("id") if matching_plan else None,
                "planned_entry": str(matching_plan.get("planned_entry")) if matching_plan else None,
                "planned_stop": str(matching_plan.get("planned_stop")) if matching_plan else None,
                "planned_target": str(matching_plan.get("planned_target"))
                if matching_plan
                else None,
                "planned_risk": str(planned_risk) if planned else None,
                "realized_r": float(realized_r) if realized_r is not None else None,
                "compliance_status": "compliant" if planned else "outside_plan",
                "opened_at": tg.get("opened_at"),
                "closed_at": tg.get("closed_at"),
                "review": {
                    "execution_rating": review.get("execution_rating", "good")
                    if review
                    else "unreviewed",
                    "discipline_score": review.get("discipline_score", 5) if review else 5,
                    "mistake_tags": review.get("mistake_tags", []) if review else [],
                    "notes": review.get("notes", "") if review else "",
                    "ai_review": review.get("ai_review", "") if review else "",
                }
                if review
                else None,
            }
        )

    return journal_items


async def save_journal_review(
    trade_group_id: str,
    execution_rating: str = "good",
    discipline_score: int = 5,
    mistake_tags: Optional[List[str]] = None,
    notes: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Saves user notes, discipline rating, and generates structured AI review.
    """
    try:
        client = get_supabase_service()
    except Exception as e:
        raise ValueError(f"Database client unavailable: {e}")

    # Fetch trade group for context
    tg_res = client.table("trade_groups").select("*").eq("id", trade_group_id).limit(1).execute()
    if not tg_res.data or len(tg_res.data) == 0:
        raise ValueError(f"Trade group not found: {trade_group_id}")

    tg = tg_res.data[0]
    pnl = d(tg.get("realized_pnl", ZERO))
    symbol = tg.get("symbol", "").upper()

    # Check plan
    plan_res = (
        client.table("trade_plans")
        .select("*")
        .eq("account_id", tg["account_id"])
        .eq("symbol", symbol)
        .limit(1)
        .execute()
    )
    plan = plan_res.data[0] if (plan_res.data and len(plan_res.data) > 0) else None

    planned = plan is not None
    planned_risk = d(plan.get("planned_risk_amount", ZERO)) if plan else ZERO
    realized_r = quantize_money(pnl / planned_risk) if (planned and planned_risk > ZERO) else None

    ai_review = generate_structured_ai_review(
        symbol=symbol,
        realized_pnl=pnl,
        planned=planned,
        planned_entry=d(plan.get("planned_entry")) if plan else None,
        planned_stop=d(plan.get("planned_stop")) if plan else None,
        planned_target=d(plan.get("planned_target")) if plan else None,
        realized_r=realized_r,
        mistake_tags=mistake_tags,
    )

    review_payload = {
        "trade_group_id": trade_group_id,
        "user_id": user_id,
        "execution_rating": execution_rating,
        "discipline_score": discipline_score,
        "mistake_tags": mistake_tags or [],
        "notes": notes or "",
        "ai_review": ai_review,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    res = (
        client.table("trade_os_journal_reviews")
        .upsert(review_payload, on_conflict="trade_group_id")
        .execute()
    )
    return res.data[0] if (res.data and len(res.data) > 0) else review_payload
