"""
Trade OS Equity Routes
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user_id
from app.services.trade_os.account_service import AccountService

router = APIRouter(prefix="/equity", tags=["Trade OS Equity"])


class EquitySnapshotRequest(BaseModel):
    net_liquidation_value: Decimal = Field(..., description="Total portfolio liquidation value")
    cash_balance: Optional[Decimal] = None
    securities_value: Optional[Decimal] = None
    margin_debit: Optional[Decimal] = Field(default=Decimal(0))
    buying_power: Optional[Decimal] = None
    snapshot_at: Optional[datetime] = None
    source: str = Field(default="manual")
    quality_status: str = Field(default="confirmed")


def get_account_service() -> AccountService:
    return AccountService()


@router.post("/{account_id}/snapshots", status_code=status.HTTP_201_CREATED)
def record_equity_snapshot(
    account_id: str,
    req: EquitySnapshotRequest,
    user_id: str = Depends(get_current_user_id),
    service: AccountService = Depends(get_account_service),
):
    """Record an equity snapshot for a trading account."""
    account = service.get_account(user_id, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    return service.record_equity_snapshot(
        user_id=user_id,
        account_id=account_id,
        net_liquidation_value=req.net_liquidation_value,
        cash_balance=req.cash_balance,
        securities_value=req.securities_value,
        margin_debit=req.margin_debit,
        buying_power=req.buying_power,
        snapshot_at=req.snapshot_at,
        source=req.source,
        quality_status=req.quality_status,
    )


@router.get("/{account_id}/history", response_model=List[Dict[str, Any]])
def get_equity_history(
    account_id: str,
    limit: int = 100,
    user_id: str = Depends(get_current_user_id),
    service: AccountService = Depends(get_account_service),
):
    """Fetch equity snapshots history for an account."""
    account = service.get_account(user_id, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    return service.get_equity_history(user_id, account_id, limit=limit)
