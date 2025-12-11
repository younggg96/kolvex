"""
SnapTrade Holdings Routes
Endpoints for managing and viewing holdings data
"""

from fastapi import APIRouter, Depends, HTTPException
from starlette import status as http_status
from typing import Optional
import logging

from app.api.dependencies.auth import get_current_user_id
from app.services.snaptrade import SnapTradeService, get_snaptrade_service
from .schemas import (
    HoldingsResponse, 
    PublicHoldingsResponse, 
    PublicUsersResponse,
    TogglePublicRequest, 
    MessageResponse
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/holdings", response_model=HoldingsResponse)
async def get_my_holdings(
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Get current user's holdings data
    """
    try:
        holdings = await service.get_user_holdings(current_user_id)
        return HoldingsResponse(**holdings)
    except Exception as e:
        logger.error(f"Failed to get holdings: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get holdings: {str(e)}",
        )


@router.get("/public-users", response_model=PublicUsersResponse)
async def get_public_users(
    limit: int = 20,
    offset: int = 0,
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Get list of users who have public portfolios
    
    No authentication required - this is public data
    """
    try:
        result = await service.get_public_users(limit=limit, offset=offset)
        return PublicUsersResponse(**result)
    except Exception as e:
        logger.error(f"Failed to get public users: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get public users: {str(e)}",
        )


@router.get("/holdings/{user_id}", response_model=Optional[PublicHoldingsResponse])
async def get_public_holdings(
    user_id: str, 
    service: SnapTradeService = Depends(get_snaptrade_service)
):
    """
    Get user's public holdings data
    
    Only viewable if user has enabled public sharing
    """
    try:
        holdings = await service.get_public_holdings(user_id)
        if not holdings:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="User has not shared their portfolio or is not connected to SnapTrade",
            )
        return PublicHoldingsResponse(**holdings)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get public holdings: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get public holdings: {str(e)}",
        )


@router.post("/toggle-public", response_model=MessageResponse)
async def toggle_public_sharing(
    request: TogglePublicRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Toggle portfolio public sharing status
    """
    try:
        success = await service.toggle_public_sharing(
            user_id=current_user_id, is_public=request.is_public
        )

        if success:
            status_text = "enabled" if request.is_public else "disabled"
            return MessageResponse(
                message=f"Public sharing {status_text}", 
                success=True
            )
        else:
            return MessageResponse(message="Operation failed", success=False)
    except Exception as e:
        logger.error(f"Failed to toggle public sharing: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Operation failed: {str(e)}",
        )

