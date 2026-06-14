"""
Portfolio Connection Routes
Endpoints for managing Portfolio connections
"""

from fastapi import APIRouter, Depends, HTTPException
from starlette import status as http_status
import logging

from app.api.dependencies.auth import get_current_user_id
from app.services.portfolio import PortfolioService, get_portfolio_service
from .schemas import ConnectionStatusResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status", response_model=ConnectionStatusResponse)
async def get_connection_status(
    current_user_id: str = Depends(get_current_user_id),
    service: PortfolioService = Depends(get_portfolio_service),
):
    """
    Get current user's Portfolio connection status
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

