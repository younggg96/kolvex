"""
Trade OS Risk Config & State Routes
"""

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service
from app.services.trade_os.account_service import AccountService

router = APIRouter(prefix="/risk", tags=["Trade OS Risk"])


class RiskConfigUpdateRequest(BaseModel):
    max_risk_per_trade_pct: Optional[Decimal] = Field(None, gt=0, le=Decimal("0.05"))
    max_risk_per_trade_neutral_pct: Optional[Decimal] = Field(None, gt=0, le=Decimal("0.05"))
    max_single_position_pct: Optional[Decimal] = Field(None, gt=0, le=Decimal("0.50"))
    max_portfolio_risk_pct: Optional[Decimal] = Field(None, gt=0, le=Decimal("0.10"))
    max_sector_exposure_pct: Optional[Decimal] = Field(None, gt=0, le=Decimal("0.50"))
    drawdown_warning_pct: Optional[Decimal] = Field(None, gt=0, le=Decimal("0.20"))
    drawdown_freeze_pct: Optional[Decimal] = Field(None, gt=0, le=Decimal("0.30"))


@router.get("/config/{account_id}")
def get_risk_config(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Retrieve risk configuration for account, returning defaults if not yet customized."""
    account_svc = AccountService()
    account = account_svc.get_account(user_id, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    db = get_supabase_service()
    res = db.table("risk_configs").select("*").eq("account_id", account_id).execute()
    if res.data:
        return res.data[0]

    # Defaults
    return {
        "account_id": account_id,
        "max_risk_per_trade_pct": 0.005,
        "max_risk_per_trade_neutral_pct": 0.0025,
        "max_single_position_pct": 0.10,
        "max_portfolio_risk_pct": 0.02,
        "max_sector_risk_pct": 0.01,
        "max_sector_exposure_pct": 0.20,
        "drawdown_warning_pct": 0.06,
        "drawdown_freeze_pct": 0.08,
        "drawdown_critical_pct": 0.10,
        "daily_loss_limit_pct": 0.015,
        "weekly_loss_limit_pct": 0.03,
        "plan_expiry_hours": 24,
    }


@router.patch("/config/{account_id}")
def update_risk_config(
    account_id: str,
    req: RiskConfigUpdateRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Update risk configuration thresholds for an account."""
    account_svc = AccountService()
    account = account_svc.get_account(user_id, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    db = get_supabase_service()
    updates = {k: float(v) for k, v in req.model_dump(exclude_unset=True).items()}
    updates["account_id"] = account_id
    updates["user_id"] = user_id

    res = db.table("risk_configs").upsert(updates, on_conflict="account_id").execute()
    return res.data[0] if res.data else updates


@router.get("/state/{account_id}")
def get_risk_state(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Retrieve active risk lock state for account."""
    account_svc = AccountService()
    account = account_svc.get_account(user_id, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    db = get_supabase_service()
    res = (
        db.table("account_risk_states")
        .select("*")
        .eq("account_id", account_id)
        .eq("is_active", True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]

    return {
        "account_id": account_id,
        "state": "normal",
        "reason": "Account operating within standard risk parameters.",
        "is_active": True,
    }
