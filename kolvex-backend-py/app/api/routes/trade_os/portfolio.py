"""
Trade OS Portfolio Risk Routes
"""

from decimal import Decimal
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service
from app.services.trade_os.account_service import AccountService
from app.services.trade_os.decimal_utils import ZERO, d
from app.services.trade_os.drawdown import compute_cash_flow_adjusted_drawdown
from app.services.trade_os.position_service import PositionService

router = APIRouter(prefix="/portfolio", tags=["Trade OS Portfolio"])


def get_position_service() -> PositionService:
    return PositionService()


def get_account_service() -> AccountService:
    return AccountService()


@router.get("/risk-summary/{account_id}")
def get_portfolio_risk(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    account_svc: AccountService = Depends(get_account_service),
    pos_svc: PositionService = Depends(get_position_service),
):
    """Fetch portfolio open risk, exposure weights, and theme breakdown."""
    account = account_svc.get_account(user_id, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    latest_equity_snap = account_svc.get_latest_equity(user_id, account_id)
    equity_val = (
        d(latest_equity_snap["net_liquidation_value"])
        if latest_equity_snap
        else d(account.get("initial_equity", ZERO))
    )

    return pos_svc.get_portfolio_risk_summary(user_id, account_id, equity_val)


@router.get("/positions/{account_id}", response_model=List[Dict[str, Any]])
def list_positions(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    pos_svc: PositionService = Depends(get_position_service),
):
    """List open positions for account."""
    return pos_svc.get_open_positions(user_id, account_id)


@router.get("/drawdown/{account_id}")
def get_drawdown(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    account_svc: AccountService = Depends(get_account_service),
):
    """Calculate cash-flow-adjusted account drawdown."""
    account = account_svc.get_account(user_id, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    init_eq = d(account.get("initial_equity", Decimal("100000")))
    snaps = account_svc.get_equity_history(user_id, account_id, limit=200)

    db = get_supabase_service()
    cfs = (
        db.table("cash_flows")
        .select("*")
        .eq("account_id", account_id)
        .eq("user_id", user_id)
        .execute()
    ).data or []

    metrics = compute_cash_flow_adjusted_drawdown(init_eq, snaps, cfs)
    return {
        "current_drawdown_pct": str(metrics["current_drawdown_pct"] * Decimal(100)),
        "max_drawdown_pct": str(metrics["max_drawdown_pct"] * Decimal(100)),
        "peak_unit_value": str(metrics["peak_unit_value"]),
        "current_unit_value": str(metrics["current_unit_value"]),
    }
