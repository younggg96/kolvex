from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user_id
from app.services.ibkr import IBKRFlexService, get_ibkr_flex_service
from app.services.user_api_keys_service import (
    UserApiKeysService,
    get_user_api_keys_service,
)

router = APIRouter(prefix="/ibkr", tags=["Interactive Brokers"])


class IBKRConnectRequest(BaseModel):
    flex_token: str = Field(min_length=8)
    flex_query_id: str = Field(min_length=1, max_length=64)


class IBKRAnalyzeRequest(BaseModel):
    provider: str
    model: str
    limit: int = Field(default=300, ge=1, le=500)
    trade_ids: List[str] = Field(default_factory=list)
    language: str = Field(default="zh", pattern="^(zh|en)$")


@router.post("/connect")
async def connect(
    body: IBKRConnectRequest,
    user_id: str = Depends(get_current_user_id),
    service: IBKRFlexService = Depends(get_ibkr_flex_service),
):
    try:
        return await service.connect(user_id, body.flex_token, body.flex_query_id)
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/status")
async def status(
    user_id: str = Depends(get_current_user_id),
    service: IBKRFlexService = Depends(get_ibkr_flex_service),
):
    return await service.status(user_id)


@router.post("/sync")
async def sync(
    user_id: str = Depends(get_current_user_id),
    service: IBKRFlexService = Depends(get_ibkr_flex_service),
):
    try:
        return await service.sync(user_id)
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error))


@router.get("/holdings")
async def holdings(
    user_id: str = Depends(get_current_user_id),
    service: IBKRFlexService = Depends(get_ibkr_flex_service),
):
    try:
        return await service.holdings(user_id)
    except ValueError:
        return {"is_connected": False, "is_public": False, "accounts": []}


@router.get("/trades")
async def trades(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    symbol: Optional[str] = Query(None),
    asset_type: Optional[str] = Query(None, pattern="^(stocks|options)$"),
    user_id: str = Depends(get_current_user_id),
    service: IBKRFlexService = Depends(get_ibkr_flex_service),
):
    return await service.trades(user_id, limit, offset, symbol, asset_type)


@router.get("/orders")
async def orders(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    symbol: Optional[str] = Query(None),
    asset_type: str = Query("stocks", pattern="^(stocks|options)$"),
    user_id: str = Depends(get_current_user_id),
    service: IBKRFlexService = Depends(get_ibkr_flex_service),
):
    return await service.normalized_orders(
        user_id,
        limit=limit,
        offset=offset,
        symbol=symbol,
        asset_type=asset_type,
    )


@router.post("/orders/analyze")
async def analyze_orders(
    body: IBKRAnalyzeRequest,
    user_id: str = Depends(get_current_user_id),
    service: IBKRFlexService = Depends(get_ibkr_flex_service),
    api_keys_service: UserApiKeysService = Depends(get_user_api_keys_service),
):
    user_api_keys = await api_keys_service.get_keys_dict(user_id)
    if body.provider not in user_api_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Missing user API key for provider '{body.provider}'",
        )
    try:
        return await service.analyze_trades(
            user_id=user_id,
            provider=body.provider,
            model=body.model,
            user_api_keys=user_api_keys,
            limit=body.limit,
            trade_ids=body.trade_ids or None,
            language=body.language,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.delete("/disconnect")
async def disconnect(
    user_id: str = Depends(get_current_user_id),
    service: IBKRFlexService = Depends(get_ibkr_flex_service),
):
    await service.disconnect(user_id)
    return {"success": True, "message": "Interactive Brokers disconnected"}
