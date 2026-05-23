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
    # Background-sync progress, surfaced so the client can poll /status while
    # /connect or /sync run their heavy work asynchronously.
    is_syncing: bool = False
    sync_started_at: Optional[str] = None
    last_sync_error: Optional[str] = None


class RobinhoodConnectResponse(RobinhoodStatusResponse):
    success: bool = True
    positions_synced: int = 0
    approval_required: bool = False
    message: Optional[str] = None


class RobinhoodSyncResponse(BaseModel):
    """Returned by POST /sync. The actual sync runs in the background; the
    client should poll /status until ``is_syncing`` becomes false."""

    success: bool = True
    is_syncing: bool = True
    already_running: bool = False
    sync_started_at: Optional[str] = None
    message: str = "Robinhood sync scheduled in the background"


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


class RobinhoodOptionOrderResponse(BaseModel):
    id: str
    option_order_id: str
    leg_id: str
    chain_symbol: Optional[str] = None
    underlying_symbol: Optional[str] = None
    option_type: Optional[str] = None
    expiration_date: Optional[str] = None
    strike_price: Optional[float] = None
    side: Optional[str] = None
    direction: Optional[str] = None
    opening_strategy: Optional[str] = None
    closing_strategy: Optional[str] = None
    order_type: Optional[str] = None
    quantity: Optional[float] = None
    processed_quantity: Optional[float] = None
    price: Optional[float] = None
    premium: Optional[float] = None
    state: Optional[str] = None
    created_time: Optional[str] = None
    executed_time: Optional[str] = None
    raw_order: Optional[Dict[str, Any]] = None
    raw_leg: Optional[Dict[str, Any]] = None


class RobinhoodOptionOrdersResponse(BaseModel):
    orders: list[RobinhoodOptionOrderResponse]
    total: int
    limit: int
    offset: int
    has_more: bool = False


class RobinhoodAnalyzeOrdersRequest(BaseModel):
    provider: str = Field(default="openai")
    model: str = Field(default="gpt-4o-mini")
    limit: int = Field(default=200, ge=10, le=500)
    order_ids: list[str] = Field(default_factory=list)
    language: str = Field(default="zh", pattern="^(zh|en)$")


class RobinhoodAnalyzeOrdersResponse(BaseModel):
    analysis: str
    provider: str
    model: str
    orders_analyzed: int
    generated_at: str


class RobinhoodSellPerformanceItem(BaseModel):
    order_id: str
    ticker: str
    sell_time: Optional[str] = None
    quantity: float
    sell_price: float
    current_price: Optional[float] = None
    price_change: Optional[float] = None
    price_change_percent: Optional[float] = None
    opportunity_pnl: Optional[float] = None
    realized_pnl: Optional[float] = None
    realized_pnl_percent: Optional[float] = None
    verdict: str
    message: str


class RobinhoodSellPerformanceSummary(BaseModel):
    total_sells: int
    sold_too_early_count: int
    good_sale_count: int
    unknown_count: int
    missed_upside_amount: float
    avoided_downside_amount: float


class RobinhoodSellPerformanceResponse(BaseModel):
    items: list[RobinhoodSellPerformanceItem]
    summary: RobinhoodSellPerformanceSummary
    total: int
    limit: int
    offset: int
    has_more: bool = False
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


@router.post(
    "/sync",
    response_model=RobinhoodSyncResponse,
    status_code=http_status.HTTP_202_ACCEPTED,
)
async def sync_robinhood(
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
):
    """Schedule a Robinhood sync in the background and return immediately.

    Robinhood sync (positions + holdings + 800+ orders) routinely takes longer
    than Vercel's 60s edge-proxy timeout, so we never block the HTTP request
    on it. The client should poll ``GET /status`` until ``is_syncing`` flips
    back to false (typically 30-90s).
    """

    try:
        scheduled = service.schedule_background_sync(current_user_id)
        status_payload = await service.get_status(current_user_id)
        return RobinhoodSyncResponse(
            success=True,
            is_syncing=status_payload.get("is_syncing", scheduled),
            already_running=not scheduled,
            sync_started_at=status_payload.get("sync_started_at"),
            message=(
                "Robinhood sync scheduled"
                if scheduled
                else "Sync already in progress"
            ),
        )
    except RobinhoodSessionExpired as e:
        logger.info("Robinhood session expired for user %s", current_user_id)
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to schedule Robinhood sync")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to schedule Robinhood sync: {str(e)}",
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
    status_filter: str = Query(default="filled", alias="status"),
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
                status_filter=status_filter,
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


@router.get("/option-orders", response_model=RobinhoodOptionOrdersResponse)
async def get_robinhood_option_orders(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    symbol: Optional[str] = Query(default=None),
    status_filter: str = Query(default="filled", alias="status"),
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
):
    try:
        return RobinhoodOptionOrdersResponse(
            **await service.get_option_orders(
                current_user_id,
                limit=limit,
                offset=offset,
                symbol=symbol,
                status_filter=status_filter,
            )
        )
    except RobinhoodStorageNotReady as e:
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to get Robinhood option orders")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Robinhood option orders: {str(e)}",
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


@router.get("/sell-performance", response_model=RobinhoodSellPerformanceResponse)
async def get_robinhood_sell_performance(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    symbol: Optional[str] = Query(default=None),
    current_user_id: str = Depends(get_current_user_id),
    service: RobinhoodService = Depends(get_robinhood_service),
):
    try:
        return RobinhoodSellPerformanceResponse(
            **await service.get_sell_performance(
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
        logger.exception("Failed to get Robinhood sell performance")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Robinhood sell performance: {str(e)}",
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
                order_ids=request.order_ids or None,
                language=request.language,
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
