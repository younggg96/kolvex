"""
Trade OS Trade Plan Routes
"""

from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service
from app.services.trade_os.position_sizing import PositionSizingError, calculate_position_size
from app.services.trade_os.trade_plan_service import TradePlanError, TradePlanService

router = APIRouter(prefix="/plans", tags=["Trade OS Trade Plans"])


class TradePlanCreateRequest(BaseModel):
    account_id: str
    symbol: str = Field(..., max_length=20)
    side: str = Field(default="long")
    planned_entry: Decimal = Field(..., gt=0)
    planned_stop: Decimal = Field(..., gt=0)
    planned_target: Decimal = Field(..., gt=0)
    planned_quantity: int = Field(..., gt=0)
    setup_reason: str = Field(..., min_length=3)
    invalidation_reason: str = Field(..., min_length=3)
    strategy_version_id: Optional[str] = None


class SizingCalculateRequest(BaseModel):
    account_equity: Decimal = Field(..., gt=0)
    entry_price: Decimal = Field(..., gt=0)
    stop_price: Decimal = Field(..., gt=0)
    allowed_risk_pct: Optional[Decimal] = Decimal("0.0050")
    max_position_notional_pct: Optional[Decimal] = Decimal("0.1000")
    side: Optional[str] = "long"


class PlanApproveRequest(BaseModel):
    market_regime: Optional[str] = "risk_on"


def get_plan_service() -> TradePlanService:
    return TradePlanService()


@router.post("/calculate-sizing")
def calculate_sizing(req: SizingCalculateRequest):
    """
    Interactive position sizing helper for UI calculation before plan submission.
    """
    try:
        res = calculate_position_size(
            account_equity=req.account_equity,
            entry_price=req.entry_price,
            stop_price=req.stop_price,
            allowed_risk_pct=req.allowed_risk_pct,
            max_position_notional_pct=req.max_position_notional_pct,
            side=req.side or "long",
        )
        return {k: str(v) for k, v in res.items()}
    except PositionSizingError as pe:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(pe))


@router.get("", response_model=List[Dict[str, Any]])
def list_plans(
    account_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    service: TradePlanService = Depends(get_plan_service),
):
    """List trade plans for user."""
    return service.list_plans(user_id, account_id, status_filter)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_plan(
    req: TradePlanCreateRequest,
    user_id: str = Depends(get_current_user_id),
    service: TradePlanService = Depends(get_plan_service),
):
    """Create a draft trade plan."""
    try:
        return service.create_plan(
            user_id=user_id,
            account_id=req.account_id,
            symbol=req.symbol,
            side=req.side,
            planned_entry=req.planned_entry,
            planned_stop=req.planned_stop,
            planned_target=req.planned_target,
            planned_quantity=req.planned_quantity,
            setup_reason=req.setup_reason,
            invalidation_reason=req.invalidation_reason,
            strategy_version_id=req.strategy_version_id,
        )
    except TradePlanError as te:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(te))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{plan_id}")
def get_plan(
    plan_id: str,
    user_id: str = Depends(get_current_user_id),
    service: TradePlanService = Depends(get_plan_service),
):
    """Get trade plan and its latest risk assessment."""
    plan = service.get_plan(user_id, plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade plan not found")

    db = get_supabase_service()
    assessments = (
        db.table("risk_assessments")
        .select("*")
        .eq("trade_plan_id", plan_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data or []

    plan["latest_assessment"] = assessments[0] if assessments else None
    return plan


@router.post("/{plan_id}/approve")
def approve_plan(
    plan_id: str,
    req: Optional[PlanApproveRequest] = None,
    user_id: str = Depends(get_current_user_id),
    service: TradePlanService = Depends(get_plan_service),
):
    """
    Submits a trade plan for server-side Risk Assessment.
    If compliant, marks plan approved; otherwise marks blocked.
    """
    regime = req.market_regime if req and req.market_regime else "risk_on"
    try:
        return service.validate_and_approve_plan(user_id, plan_id, market_regime=regime)
    except TradePlanError as te:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(te))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{plan_id}/cancel")
def cancel_plan(
    plan_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Cancel a draft or approved trade plan."""
    db = get_supabase_service()
    res = (
        db.table("trade_plans")
        .update({"status": "cancelled"})
        .eq("id", plan_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade plan not found")
    return res.data[0]
