"""
SnapTrade Sync Routes
Endpoints for syncing account and position data
"""

from fastapi import APIRouter, Depends, HTTPException
from starlette import status as http_status
from typing import List
import logging

from app.api.dependencies.auth import get_current_user_id
from app.services.snaptrade import SnapTradeService, get_snaptrade_service
from .schemas import AccountResponse, MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync")


@router.post("/accounts", response_model=List[AccountResponse])
async def sync_accounts(
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Sync brokerage accounts
    
    Fetches the latest account list from SnapTrade and saves to database
    """
    try:
        accounts = await service.sync_accounts(current_user_id)
        return [AccountResponse(**acc) for acc in accounts]
    except Exception as e:
        logger.error(f"Failed to sync accounts: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync accounts: {str(e)}",
        )


@router.post("/positions", response_model=MessageResponse)
async def sync_positions(
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Sync positions data
    
    Fetches the latest positions data from SnapTrade and saves to database
    """
    try:
        positions = await service.sync_positions(current_user_id)
        return MessageResponse(
            message=f"Successfully synced {len(positions)} positions", 
            success=True
        )
    except Exception as e:
        logger.error(f"Failed to sync positions: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync positions: {str(e)}",
        )

