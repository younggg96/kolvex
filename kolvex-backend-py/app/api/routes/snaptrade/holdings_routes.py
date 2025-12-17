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
    TogglePositionVisibilityRequest,
    BatchTogglePositionVisibilityRequest,
    PrivacySettings,
    PrivacySettingsResponse,
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
    sort_by: str = "updated",  # "updated" or "pnl_percent"
    sort_order: str = "desc",  # "asc" or "desc"
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Get list of users who have public portfolios
    
    No authentication required - this is public data
    
    Args:
        sort_by: Sort field - "updated" (last_synced_at) or "pnl_percent"
        sort_order: Sort order - "asc" or "desc"
    """
    try:
        result = await service.get_public_users(
            limit=limit, 
            offset=offset, 
            sort_by=sort_by, 
            sort_order=sort_order
        )
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


@router.post("/positions/{position_id}/visibility", response_model=MessageResponse)
async def toggle_position_visibility(
    position_id: str,
    request: TogglePositionVisibilityRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Toggle visibility of a single position when portfolio is public
    
    Hidden positions will not be shown in public portfolio view
    """
    try:
        success = await service.toggle_position_visibility(
            user_id=current_user_id,
            position_id=position_id,
            is_hidden=request.is_hidden
        )

        if success:
            status_text = "hidden" if request.is_hidden else "visible"
            return MessageResponse(
                message=f"Position is now {status_text}",
                success=True
            )
        else:
            return MessageResponse(message="Operation failed", success=False)
    except Exception as e:
        logger.error(f"Failed to toggle position visibility: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Operation failed: {str(e)}",
        )


@router.post("/positions/visibility/batch", response_model=MessageResponse)
async def batch_toggle_position_visibility(
    request: BatchTogglePositionVisibilityRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Batch toggle visibility of multiple positions
    
    Useful for hiding/showing multiple positions at once
    """
    try:
        count = await service.batch_toggle_position_visibility(
            user_id=current_user_id,
            position_ids=request.position_ids,
            is_hidden=request.is_hidden
        )

        status_text = "hidden" if request.is_hidden else "visible"
        return MessageResponse(
            message=f"{count} positions are now {status_text}",
            success=True
        )
    except Exception as e:
        logger.error(f"Failed to batch toggle position visibility: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Operation failed: {str(e)}",
        )


@router.get("/privacy-settings", response_model=PrivacySettingsResponse)
async def get_privacy_settings(
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Get current privacy settings for public portfolio sharing
    """
    try:
        settings = await service.get_privacy_settings(current_user_id)
        return PrivacySettingsResponse(settings=settings)
    except Exception as e:
        logger.error(f"Failed to get privacy settings: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get privacy settings: {str(e)}",
        )


@router.put("/privacy-settings", response_model=PrivacySettingsResponse)
async def update_privacy_settings(
    request: PrivacySettings,
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Update privacy settings for public portfolio sharing
    
    Only provided fields will be updated
    """
    try:
        # Convert request to dict, excluding None values
        settings_update = {
            k: v for k, v in request.model_dump().items() if v is not None
        }
        
        updated_settings = await service.update_privacy_settings(
            user_id=current_user_id,
            settings=settings_update
        )
        
        return PrivacySettingsResponse(settings=updated_settings)
    except Exception as e:
        logger.error(f"Failed to update privacy settings: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update privacy settings: {str(e)}",
        )

