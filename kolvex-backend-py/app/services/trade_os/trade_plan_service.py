"""
Trade OS Trade Plan Service

Manages Trade Plan lifecycle: Draft -> Validating -> Approved / Blocked -> Executed.
Enforces server-side Risk Assessment before approval.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.core.supabase import get_supabase_service
from app.services.trade_os.account_service import AccountService
from app.services.trade_os.decimal_utils import ZERO, d
from app.services.trade_os.drawdown import compute_cash_flow_adjusted_drawdown
from app.services.trade_os.position_service import PositionService
from app.services.trade_os.risk_engine import assess_trade_plan

logger = logging.getLogger(__name__)


class TradePlanError(ValueError):
    """Raised when plan parameters or lifecycle transitions are invalid."""

    pass


class TradePlanService:
    def __init__(self, supabase=None):
        self.supabase = supabase or get_supabase_service()
        self.account_service = AccountService(self.supabase)
        self.position_service = PositionService(self.supabase)

    def create_plan(
        self,
        user_id: str,
        account_id: str,
        symbol: str,
        side: str,
        planned_entry: Any,
        planned_stop: Any,
        planned_target: Any,
        planned_quantity: int,
        setup_reason: str,
        invalidation_reason: str,
        strategy_version_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new trade plan in draft status."""
        entry = d(planned_entry)
        stop = d(planned_stop)
        target = d(planned_target)
        qty = int(planned_quantity)

        if qty <= 0:
            raise TradePlanError("Planned quantity must be greater than zero")

        if side.lower() == "long":
            if stop >= entry:
                raise TradePlanError(
                    "Stop price must be strictly lower than entry price for long trades"
                )
            risk_per_share = entry - stop
            reward_per_share = target - entry
        elif side.lower() == "short":
            if stop <= entry:
                raise TradePlanError(
                    "Stop price must be strictly higher than entry price for short trades"
                )
            risk_per_share = stop - entry
            reward_per_share = entry - target
        else:
            raise TradePlanError(f"Unsupported side: {side}")

        rr_ratio = float(reward_per_share / risk_per_share) if risk_per_share > ZERO else None
        planned_risk_amount = qty * risk_per_share
        planned_notional = qty * entry

        plan_id = str(uuid4())
        payload = {
            "id": plan_id,
            "user_id": user_id,
            "account_id": account_id,
            "strategy_version_id": strategy_version_id,
            "symbol": symbol.strip().upper(),
            "side": side.lower(),
            "planned_entry": float(entry),
            "planned_stop": float(stop),
            "planned_target": float(target),
            "planned_quantity": qty,
            "planned_risk_per_share": float(risk_per_share),
            "planned_risk_amount": float(planned_risk_amount),
            "planned_notional": float(planned_notional),
            "reward_risk_ratio": rr_ratio,
            "setup_reason": setup_reason.strip(),
            "invalidation_reason": invalidation_reason.strip(),
            "status": "draft",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        res = self.supabase.table("trade_plans").insert(payload).execute()
        if not res.data:
            raise RuntimeError("Failed to create trade plan")
        return res.data[0]

    def get_plan(self, user_id: str, plan_id: str) -> Optional[Dict[str, Any]]:
        """Fetch trade plan by ID."""
        res = (
            self.supabase.table("trade_plans")
            .select("*")
            .eq("id", plan_id)
            .eq("user_id", user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def list_plans(
        self,
        user_id: str,
        account_id: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List trade plans for user."""
        query = self.supabase.table("trade_plans").select("*").eq("user_id", user_id)
        if account_id:
            query = query.eq("account_id", account_id)
        if status_filter:
            query = query.eq("status", status_filter)
        res = query.order("created_at", desc=True).execute()
        return res.data or []

    def validate_and_approve_plan(
        self,
        user_id: str,
        plan_id: str,
        market_regime: str = "risk_on",
    ) -> Dict[str, Any]:
        """
        Server-side gatekeeper: assesses trade plan against all risk constraints.
        If compliant, marks plan approved and records immutable risk assessment.
        """
        plan = self.get_plan(user_id, plan_id)
        if not plan:
            raise TradePlanError("Trade plan not found")

        account_id = plan["account_id"]
        account = self.account_service.get_account(user_id, account_id)
        if not account:
            raise TradePlanError("Account not found")

        # 1. Retrieve latest account equity
        latest_equity_snap = self.account_service.get_latest_equity(user_id, account_id)
        if not latest_equity_snap:
            # Fall back to initial_equity if set
            if account.get("initial_equity") is not None:
                equity_val = d(account["initial_equity"])
            else:
                raise TradePlanError(
                    "Account equity unavailable. Connect account or enter validated snapshot."
                )
        else:
            equity_val = d(latest_equity_snap["net_liquidation_value"])

        if equity_val <= ZERO:
            raise TradePlanError("Account equity must be greater than zero to approve trade plans.")

        # 2. Risk configuration
        risk_conf_res = (
            self.supabase.table("risk_configs").select("*").eq("account_id", account_id).execute()
        )
        risk_config = risk_conf_res.data[0] if risk_conf_res.data else {}

        # 3. Account risk state
        state_res = (
            self.supabase.table("account_risk_states")
            .select("*")
            .eq("account_id", account_id)
            .eq("is_active", True)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        account_risk_state = state_res.data[0]["state"] if state_res.data else "normal"

        # 4. Open positions
        positions = self.position_service.get_open_positions(user_id, account_id)

        # 5. Calculate drawdown
        snaps = self.account_service.get_equity_history(user_id, account_id, limit=60)
        cfs_res = (
            self.supabase.table("cash_flows").select("*").eq("account_id", account_id).execute()
        )
        cfs = cfs_res.data or []
        init_eq = d(account.get("initial_equity") or equity_val)
        dd_metrics = compute_cash_flow_adjusted_drawdown(init_eq, snaps, cfs)
        drawdown_pct = dd_metrics["current_drawdown_pct"]

        # 6. Execute Risk Engine Assessment
        assessment = assess_trade_plan(
            symbol=plan["symbol"],
            side=plan["side"],
            planned_entry=plan["planned_entry"],
            planned_stop=plan["planned_stop"],
            planned_target=plan["planned_target"],
            planned_quantity=plan["planned_quantity"],
            account_equity=equity_val,
            risk_config=risk_config,
            market_regime=market_regime,
            account_risk_state=account_risk_state,
            current_positions=positions,
            current_drawdown_pct=drawdown_pct,
        )

        now = datetime.now(timezone.utc)
        decision = assessment["decision"]

        # 7. Persist Assessment
        assessment_id = str(uuid4())
        assessment_payload = {
            "id": assessment_id,
            "trade_plan_id": plan_id,
            "user_id": user_id,
            "rule_version": assessment["rule_version"],
            "account_snapshot": {
                "equity": str(equity_val),
                "drawdown_pct": str(drawdown_pct),
                "risk_state": account_risk_state,
            },
            "market_snapshot": {
                "regime": market_regime,
            },
            "decision": decision,
            "checks": assessment["checks"],
            "violations": assessment["violations"],
            "calculated_limits": assessment["calculated_limits"],
            "input_hash": assessment["input_hash"],
            "created_at": now.isoformat(),
        }
        self.supabase.table("risk_assessments").insert(assessment_payload).execute()

        # 8. Update Plan Status
        new_status = (
            "approved"
            if decision == "approved"
            else "review_required"
            if decision == "needs_review"
            else "blocked"
        )
        approved_at = now.isoformat() if decision == "approved" else None
        expires_at = (now + timedelta(hours=24)).isoformat() if decision == "approved" else None

        self.supabase.table("trade_plans").update(
            {
                "status": new_status,
                "approved_at": approved_at,
                "expires_at": expires_at,
                "updated_at": now.isoformat(),
            }
        ).eq("id", plan_id).execute()

        # 9. Audit Log
        self.supabase.table("trade_os_audit_logs").insert(
            {
                "user_id": user_id,
                "entity_type": "trade_plan",
                "entity_id": plan_id,
                "action": f"assessment_{decision}",
                "new_values": {
                    "status": new_status,
                    "violations_count": len(assessment["violations"]),
                },
            }
        ).execute()

        return {
            "plan_id": plan_id,
            "status": new_status,
            "decision": decision,
            "assessment": assessment,
        }
