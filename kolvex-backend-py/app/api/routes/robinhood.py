"""Robinhood broker connection API routes."""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from starlette import status as http_status

from app.api.dependencies.auth import get_current_user_id
from app.services.robinhood.service import (
    RobinhoodLoginApprovalRequired,
    RobinhoodSessionExpired,
    RobinhoodStorageNotReady,
    RobinhoodService,
    get_robinhood_service,
)
from app.services.user_api_keys_service import (
    UserApiKeysService,
    get_user_api_keys_service,
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
    challenge_code: Optional[str] = Field(
        None,
        description="Optional Robinhood SMS/email challenge code",
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


class RobinhoodOrderResponse(BaseModel):
    id: str
    order_id: str
    ticker: str
    side: Optional[str] = None
    order_type: Optional[str] = None
    quantity: Optional[float] = None
    average_price: Optional[float] = None
    total_amount: Optional[float] = None
    state: Optional[str] = None
    created_time: Optional[str] = None
    executed_time: Optional[str] = None
    fees: Optional[float] = None
    raw_order: Optional[Dict[str, Any]] = None
    cost_basis: Optional[float] = None
    realized_pnl: Optional[float] = None
    realized_pnl_percent: Optional[float] = None
    wash_sale_flag: bool = False
    wash_sale_reason: Optional[str] = None


class RobinhoodWashSaleRiskSymbol(BaseModel):
    ticker: str
    last_loss_sale_at: str
    risk_expires_at: str
    days_remaining: int
    loss_amount: float


class RobinhoodOrdersResponse(BaseModel):
    orders: list[RobinhoodOrderResponse]
    total: int
    limit: int
    offset: int
    has_more: bool = False
    wash_sale_risk_symbols: list[RobinhoodWashSaleRiskSymbol] = Field(
        default_factory=list
    )


class RobinhoodAnalyzeOrdersRequest(BaseModel):
    provider: str = Field(default="openai")
    model: str = Field(default="gpt-4o-mini")
    limit: int = Field(default=200, ge=10, le=500)


class RobinhoodAnalyzeOrdersResponse(BaseModel):
    analysis: str
    provider: str
    model: str
    orders_analyzed: int
    generated_at: str


@router.get("/status", response_model=RobinhoodStatusResponse)
async def get_robinhood_status(
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
):
    try:
        return RobinhoodStatusResponse(**await service.get_status(current_user_id))
    except Exception as e:
        logger.exception("Failed to get Robinhood status")
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
            challenge_code=request.challenge_code,
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
                message='Robinhood is waiting for device approval. Open the Robinhood app and tap "Yes, it\'s me" on the most recent push, then click Connect Robinhood again.',
            )
        logger.exception("Failed to connect Robinhood")
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
    except RobinhoodSessionExpired as e:
        logger.info("Robinhood session expired for user %s", current_user_id)
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to sync Robinhood")
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
        logger.exception("Failed to get Robinhood profile")
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Failed to get Robinhood profile: {str(e)}",
        )


@router.get("/orders", response_model=RobinhoodOrdersResponse)
async def get_robinhood_orders(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    symbol: Optional[str] = Query(default=None),
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
):
    try:
        return RobinhoodOrdersResponse(
            **await service.get_orders(
                current_user_id,
                limit=limit,
                offset=offset,
                symbol=symbol,
            )
        )
    except RobinhoodStorageNotReady as e:
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to get Robinhood orders")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Robinhood orders: {str(e)}",
        )


@router.get("/wash-sale-risk")
async def get_robinhood_wash_sale_risk(
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
):
    try:
        return await service.get_wash_sale_risk(current_user_id)
    except Exception as e:
        logger.exception("Failed to get Robinhood wash sale risk")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Robinhood wash sale risk: {str(e)}",
        )


@router.post("/orders/analyze", response_model=RobinhoodAnalyzeOrdersResponse)
async def analyze_robinhood_orders(
    request: RobinhoodAnalyzeOrdersRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
    api_keys_service: UserApiKeysService = Depends(get_user_api_keys_service),
):
    try:
        user_api_keys = await api_keys_service.get_keys_dict(current_user_id)
        if request.provider not in user_api_keys:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Missing user API key for provider '{request.provider}'. "
                    "Add it in Settings before running AI trade analysis."
                ),
            )
        return RobinhoodAnalyzeOrdersResponse(
            **await service.analyze_orders(
                user_id=current_user_id,
                provider=request.provider,
                model=request.model,
                user_api_keys=user_api_keys,
                limit=request.limit,
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to analyze Robinhood orders")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze Robinhood orders: {str(e)}",
        )


@router.post("/reset-auth", response_model=RobinhoodMessageResponse)
async def reset_robinhood_auth(
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
):
    try:
        await service.reset_auth(current_user_id)
        return RobinhoodMessageResponse(
            message="Robinhood auth state reset. Connect again to trigger a fresh approval.",
            success=True,
        )
    except Exception as e:
        logger.exception("Failed to reset Robinhood auth state")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset Robinhood auth state: {str(e)}",
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
        logger.exception("Failed to disconnect Robinhood")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disconnect Robinhood: {str(e)}",
        )
