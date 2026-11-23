"""
Trade OS Execution and Trade Group Routes
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service
from app.services.trade_os.account_service import AccountService
from app.services.trade_os.parsers.manual import parse_manual_trade
from app.services.trade_os.reconciliation import group_executions_fifo

router = APIRouter(prefix="/executions", tags=["Trade OS Executions"])


class ManualExecutionRequest(BaseModel):
    symbol: str = Field(..., max_length=20)
    side: str = Field(..., description="buy | sell")
    quantity: Decimal = Field(..., gt=0)
    price: Decimal = Field(..., gt=0)
    fees: Optional[Decimal] = Field(default=Decimal(0), ge=0)
    executed_at: Optional[datetime] = None
    description: Optional[str] = None
    trade_plan_id: Optional[str] = None


@router.get("/{account_id}", response_model=List[Dict[str, Any]])
def list_executions(
    account_id: str,
    symbol: Optional[str] = None,
    limit: int = 200,
    user_id: str = Depends(get_current_user_id),
):
    """Retrieve normalized executions for an account."""
    account_svc = AccountService()
    account = account_svc.get_account(user_id, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    db = get_supabase_service()
    query = db.table("executions").select("*").eq("account_id", account_id).eq("user_id", user_id)
    if symbol:
        query = query.eq("symbol", symbol.upper())

    res = query.order("executed_at", desc=True).limit(limit).execute()
    return res.data or []


@router.post("/{account_id}/manual", status_code=status.HTTP_201_CREATED)
def record_manual_execution(
    account_id: str,
    req: ManualExecutionRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Record a single manual trade execution and update trade groups."""
    account_svc = AccountService()
    account = account_svc.get_account(user_id, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    try:
        normalized = parse_manual_trade(req.model_dump())
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    db = get_supabase_service()
    payload = {
        "account_id": account_id,
        "user_id": user_id,
        "source_execution_id": normalized["source_execution_id"],
        "symbol": normalized["symbol"],
        "side": normalized["side"],
        "quantity": float(normalized["quantity"]),
        "price": float(normalized["price"]),
        "amount": float(normalized["amount"]),
        "fees": float(normalized["fees"]),
        "executed_at": normalized["executed_at"].isoformat(),
        "activity_type": normalized["activity_type"],
        "instrument_type": normalized["instrument_type"],
        "description": normalized["description"],
        "source": "manual",
        "trade_plan_id": normalized.get("trade_plan_id"),
        "quality_status": "confirmed",
    }

    res = db.table("executions").insert(payload).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to persist execution"
        )

    # Re-run reconciliation on this account
    all_execs = (
        db.table("executions")
        .select("*")
        .eq("account_id", account_id)
        .order("executed_at", desc=False)
        .execute()
    ).data or []

    trade_groups, _ = group_executions_fifo(all_execs)
    db.table("trade_groups").delete().eq("account_id", account_id).execute()
    for tg in trade_groups:
        tg_payload = {
            "account_id": account_id,
            "user_id": user_id,
            "symbol": tg["symbol"],
            "side": tg["side"],
            "status": tg["status"],
            "open_quantity": float(tg["open_quantity"]),
            "total_buy_quantity": float(tg["total_buy_quantity"]),
            "total_sell_quantity": float(tg["total_sell_quantity"]),
            "average_entry_price": float(tg["average_entry_price"]),
            "realized_pnl": float(tg["realized_pnl"]),
            "total_fees": float(tg["total_fees"]),
            "first_entry_at": tg["first_entry_at"].isoformat()
            if isinstance(tg["first_entry_at"], datetime)
            else str(tg["first_entry_at"]),
            "last_activity_at": tg["last_activity_at"].isoformat()
            if isinstance(tg["last_activity_at"], datetime)
            else str(tg["last_activity_at"]),
            "closed_at": tg["closed_at"].isoformat()
            if isinstance(tg.get("closed_at"), datetime)
            else None,
        }
        db.table("trade_groups").insert(tg_payload).execute()

    return res.data[0]


@router.get("/{account_id}/trade-groups", response_model=List[Dict[str, Any]])
def list_trade_groups(
    account_id: str,
    status_filter: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    """Retrieve round-trip aggregated trade groups for an account."""
    account_svc = AccountService()
    account = account_svc.get_account(user_id, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    db = get_supabase_service()
    query = db.table("trade_groups").select("*").eq("account_id", account_id).eq("user_id", user_id)
    if status_filter:
        query = query.eq("status", status_filter.lower())

    res = query.order("last_activity_at", desc=True).execute()
    return res.data or []
