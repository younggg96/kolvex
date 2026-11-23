"""
Trade OS Position & Lot Service

Manages managed positions and lots for Trade OS accounts, aggregates open risk,
theme exposures, and position compliance.
"""

import logging
from decimal import Decimal
from typing import Any, Dict, List

from app.core.supabase import get_supabase_service
from app.services.trade_os.decimal_utils import ZERO, d, safe_div

logger = logging.getLogger(__name__)


class PositionService:
    def __init__(self, supabase=None):
        self.supabase = supabase or get_supabase_service()

    def get_open_positions(self, user_id: str, account_id: str) -> List[Dict[str, Any]]:
        """Fetch all currently open positions for an account."""
        res = (
            self.supabase.table("trade_os_positions")
            .select("*")
            .eq("account_id", account_id)
            .eq("user_id", user_id)
            .eq("status", "open")
            .execute()
        )
        return res.data or []

    def get_portfolio_risk_summary(
        self,
        user_id: str,
        account_id: str,
        account_equity: Decimal,
    ) -> Dict[str, Any]:
        """
        Computes total portfolio open risk, exposure weights, and theme allocations.
        """
        positions = self.get_open_positions(user_id, account_id)
        total_open_risk = ZERO
        total_securities_notional = ZERO
        theme_exposure: Dict[str, Decimal] = {}

        for p in positions:
            qty = d(p.get("quantity", ZERO))
            cost = d(p.get("average_cost", ZERO))
            stop = d(p.get("current_stop", ZERO), default=cost * Decimal("0.90"))
            notional = qty * cost
            total_securities_notional += notional

            if cost > stop:
                risk = qty * (cost - stop)
                total_open_risk += risk

            theme = p.get("theme") or "other"
            theme_exposure[theme] = theme_exposure.get(theme, ZERO) + notional

        risk_pct = (
            safe_div(total_open_risk, account_equity) * Decimal(100)
            if account_equity > ZERO
            else ZERO
        )
        exposure_pct = (
            safe_div(total_securities_notional, account_equity) * Decimal(100)
            if account_equity > ZERO
            else ZERO
        )

        return {
            "account_equity": str(account_equity),
            "total_open_risk": str(total_open_risk),
            "portfolio_risk_pct": str(risk_pct),
            "total_exposure": str(total_securities_notional),
            "portfolio_exposure_pct": str(exposure_pct),
            "position_count": len(positions),
            "theme_exposure": {k: str(v) for k, v in theme_exposure.items()},
        }
