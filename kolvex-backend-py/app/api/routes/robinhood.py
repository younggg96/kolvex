"""Robinhood broker connection API routes."""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette import status as http_status

from app.api.dependencies.auth import get_current_user_id
from app.services.robinhood.service import (
    RobinhoodLoginApprovalRequired,
    RobinhoodStorageNotReady,
    RobinhoodService,
    get_robinhood_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/robinhood", tags=["Robinhood"])


class RobinhoodConnectRequest(BaseModel):
    username: str = Field(..., description="Robinhood username or email")
    password: str = Field(..., description="Robinhood password")
    totp_secret: Optional[str] = Field(
        None,
        description="Optional TOTP secret from an authenticator app, not a 6-digit code",
    )


class RobinhoodMessageResponse(BaseModel):
    message: str
    success: bool = True


class RobinhoodStatusResponse(BaseModel):
    is_connected: bool
    last_synced_at: Optional[str] = None
    profile: Optional[Dict[str, Any]] = None
    positions_count: int = 0
    orders_count: int = 0
    setup_required: bool = False
    message: Optional[str] = None


class RobinhoodConnectResponse(RobinhoodStatusResponse):
    success: bool = True
    positions_synced: int = 0
    approval_required: bool = False
    message: Optional[str] = None


@router.get("/status", response_model=RobinhoodStatusResponse)
async def get_robinhood_status(
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
):
    try:
        return RobinhoodStatusResponse(**await service.get_status(current_user_id))
    except Exception as e:
        logger.error("Failed to get Robinhood status: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Robinhood status: {str(e)}",
        )


@router.post("/connect", response_model=RobinhoodConnectResponse)
async def connect_robinhood(
    request: RobinhoodConnectRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
):
    try:
        result = await service.connect(
            user_id=current_user_id,
            username=request.username,
            password=request.password,
            totp_secret=request.totp_secret,
        )
        status = await service.get_status(current_user_id)
        return RobinhoodConnectResponse(
            **status,
            success=True,
            positions_synced=result.get("positions_synced", 0),
        )
    except RobinhoodLoginApprovalRequired as e:
        return RobinhoodConnectResponse(
            is_connected=False,
            last_synced_at=None,
            profile=None,
            positions_count=0,
            orders_count=0,
            success=False,
            positions_synced=0,
            approval_required=True,
            message=str(e),
        )
    except RobinhoodStorageNotReady as e:
        return RobinhoodConnectResponse(
            is_connected=False,
            last_synced_at=None,
            profile=None,
            positions_count=0,
            orders_count=0,
            setup_required=True,
            success=False,
            positions_synced=0,
            approval_required=False,
            message=str(e),
        )
    except Exception as e:
        message = str(e)
        approval_markers = [
            "approve",
            "confirm",
            "device",
            "challenge",
            "login request",
            "verification",
            "suspicious",
        ]
        if any(marker in message.lower() for marker in approval_markers):
            return RobinhoodConnectResponse(
                is_connected=False,
                last_synced_at=None,
                profile=None,
                positions_count=0,
                orders_count=0,
                success=False,
                positions_synced=0,
                approval_required=True,
                message='Robinhood is waiting for device approval. Tap "Yes, it\'s me" in the Robinhood app, then click Connect Robinhood again.',
            )
        logger.error("Failed to connect Robinhood: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect Robinhood: {str(e)}",
        )


@router.post("/sync", response_model=RobinhoodMessageResponse)
async def sync_robinhood(
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
):
    try:
        positions = await service.sync(current_user_id)
        return RobinhoodMessageResponse(
            message=f"Successfully synced {len(positions)} Robinhood positions",
            success=True,
        )
    except Exception as e:
        logger.error("Failed to sync Robinhood: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync Robinhood: {str(e)}",
        )


@router.get("/profile")
async def get_robinhood_profile(
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
):
    try:
        return await service.get_profile(current_user_id)
    except Exception as e:
        logger.error("Failed to get Robinhood profile: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Failed to get Robinhood profile: {str(e)}",
        )


@router.delete("/disconnect", response_model=RobinhoodMessageResponse)
async def disconnect_robinhood(
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
):
    try:
        await service.disconnect(current_user_id)
        return RobinhoodMessageResponse(
            message="Robinhood disconnected",
            success=True,
        )
    except Exception as e:
        logger.error("Failed to disconnect Robinhood: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disconnect Robinhood: {str(e)}",
        )
