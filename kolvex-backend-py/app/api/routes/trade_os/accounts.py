"""
Trade OS Account Routes
"""

from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user_id
from app.services.trade_os.account_service import AccountService

router = APIRouter(prefix="/accounts", tags=["Trade OS Accounts"])


class AccountCreateRequest(BaseModel):
    broker: str = Field(default="manual", description="Broker name (manual, robinhood, etc.)")
    account_name: str = Field(default="Primary", max_length=100)
    account_type: str = Field(default="manual", description="manual | imported | read_only | paper")
    initial_equity: Optional[Decimal] = Field(
        default=None, description="Starting cash or net equity"
    )
    execution_capability: str = Field(default="manual")


class AccountUpdateRequest(BaseModel):
    account_name: Optional[str] = Field(None, max_length=100)
    connection_status: Optional[str] = None
    execution_capability: Optional[str] = None


def get_account_service() -> AccountService:
    return AccountService()


@router.get("", response_model=List[Dict[str, Any]])
def list_accounts(
    user_id: str = Depends(get_current_user_id),
    service: AccountService = Depends(get_account_service),
):
    """List all Trade OS trading accounts for the user."""
    return service.get_accounts(user_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_account(
    req: AccountCreateRequest,
    user_id: str = Depends(get_current_user_id),
    service: AccountService = Depends(get_account_service),
):
    """Create a new trading account."""
    try:
        return service.create_account(
            user_id=user_id,
            broker=req.broker,
            account_name=req.account_name,
            account_type=req.account_type,
            initial_equity=req.initial_equity,
            execution_capability=req.execution_capability,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create account: {str(e)}",
        )


@router.get("/{account_id}")
def get_account(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    service: AccountService = Depends(get_account_service),
):
    """Retrieve details for a specific trading account."""
    account = service.get_account(user_id, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


@router.patch("/{account_id}")
def update_account(
    account_id: str,
    req: AccountUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    service: AccountService = Depends(get_account_service),
):
    """Update settings for a trading account."""
    updates = req.model_dump(exclude_unset=True)
    updated = service.update_account(user_id, account_id, updates)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return updated
