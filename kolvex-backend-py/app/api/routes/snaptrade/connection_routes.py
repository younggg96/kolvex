"""
SnapTrade Connection Routes
Endpoints for managing SnapTrade connections
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette import status as http_status
from typing import Optional
import logging

from app.api.dependencies.auth import get_current_user_id
from app.services.snaptrade import SnapTradeService, get_snaptrade_service
from .schemas import ConnectionStatusResponse, ConnectionPortalResponse, MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status", response_model=ConnectionStatusResponse)
async def get_connection_status(
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Get current user's SnapTrade connection status
    """
    try:
        connection_status = await service.get_connection_status(current_user_id)
        return ConnectionStatusResponse(**connection_status)
    except Exception as e:
        logger.error(f"Failed to get connection status: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get connection status: {str(e)}",
        )


@router.post("/connect", response_model=ConnectionPortalResponse)
async def get_connection_portal(
    redirect_uri: Optional[str] = Query(None, description="Redirect URI after successful connection"),
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Get connection portal URL for connecting brokerage account
    
    Users can connect their brokerage accounts through the returned URL
    """
    try:
        url = await service.get_connection_portal_url(
            user_id=current_user_id, redirect_uri=redirect_uri
        )
        return ConnectionPortalResponse(redirect_url=url)
    except Exception as e:
        logger.error(f"Failed to get connection portal URL: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get connection portal: {str(e)}",
        )


@router.delete("/disconnect", response_model=MessageResponse)
async def disconnect_snaptrade(
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Disconnect SnapTrade connection
    
    Deletes all account and holdings data
    """
    try:
        success = await service.disconnect(current_user_id)
        if success:
            return MessageResponse(message="SnapTrade disconnected successfully", success=True)
        else:
            return MessageResponse(message="Failed to disconnect", success=False)
    except Exception as e:
        logger.error(f"Failed to disconnect: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disconnect: {str(e)}",
        )

