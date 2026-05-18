"""User-authored quantitative strategy API routes."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from starlette import status as http_status

from app.api.dependencies.auth import get_current_user_id
from app.services.quant_strategy_service import (
    QuantStrategyStorageNotReady,
    QuantStrategyService,
    get_quant_strategy_service,
)

router = APIRouter(prefix="/quant-strategies", tags=["Quant Strategies"])


class StrategyPayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    dsl: str = Field(min_length=1, max_length=4000)
    is_active: bool = True


class StrategyUpdatePayload(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    dsl: Optional[str] = Field(default=None, min_length=1, max_length=4000)
    is_active: Optional[bool] = None


class AssignmentPayload(BaseModel):
    strategy_id: Optional[str] = None
    stop_loss_pct: Optional[float] = Field(default=None, gt=0, le=100)
    take_profit_pct: Optional[float] = Field(default=None, gt=0, le=1000)
    trailing_stop_pct: Optional[float] = Field(default=None, gt=0, le=100)


class PreviewPayload(BaseModel):
    dsl: str = Field(min_length=1, max_length=4000)
    symbol: str = Field(min_length=1, max_length=20)
    entry_price: float = Field(gt=0)


class BacktestPayload(BaseModel):
    strategy_id: Optional[str] = None
    dsl: str = Field(min_length=1, max_length=4000)
    symbol: str = Field(min_length=1, max_length=20)
    period: str = Field(default="1y", pattern="^(6mo|1y|2y|5y)$")
    initial_capital: float = Field(default=10000, gt=0)


@router.get("")
async def list_strategies(
    user_id: str = Depends(get_current_user_id),
    service: QuantStrategyService = Depends(get_quant_strategy_service),
):
    try:
        return {"strategies": await service.list_strategies(user_id)}
    except QuantStrategyStorageNotReady as error:
        raise HTTPException(status_code=503, detail=str(error))


@router.post("", status_code=http_status.HTTP_201_CREATED)
async def create_strategy(
    payload: StrategyPayload,
    user_id: str = Depends(get_current_user_id),
    service: QuantStrategyService = Depends(get_quant_strategy_service),
):
    try:
        return await service.create_strategy(user_id, payload.model_dump())
    except QuantStrategyStorageNotReady as error:
        raise HTTPException(status_code=503, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.patch("/{strategy_id}")
async def update_strategy(
    payload: StrategyUpdatePayload,
    strategy_id: str = Path(...),
    user_id: str = Depends(get_current_user_id),
    service: QuantStrategyService = Depends(get_quant_strategy_service),
):
    try:
        return await service.update_strategy(
            user_id, strategy_id, payload.model_dump(exclude_none=True)
        )
    except QuantStrategyStorageNotReady as error:
        raise HTTPException(status_code=503, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@router.delete("/{strategy_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_strategy(
    strategy_id: str,
    user_id: str = Depends(get_current_user_id),
    service: QuantStrategyService = Depends(get_quant_strategy_service),
):
    await service.delete_strategy(user_id, strategy_id)


@router.get("/assignments")
async def list_assignments(
    user_id: str = Depends(get_current_user_id),
    service: QuantStrategyService = Depends(get_quant_strategy_service),
):
    try:
        return {"assignments": await service.list_assignments(user_id)}
    except QuantStrategyStorageNotReady as error:
        raise HTTPException(status_code=503, detail=str(error))


@router.put("/assignments/{symbol}")
async def upsert_assignment(
    payload: AssignmentPayload,
    symbol: str,
    user_id: str = Depends(get_current_user_id),
    service: QuantStrategyService = Depends(get_quant_strategy_service),
):
    try:
        return await service.upsert_assignment(user_id, symbol, payload.model_dump())
    except QuantStrategyStorageNotReady as error:
        raise HTTPException(status_code=503, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@router.post("/preview")
async def preview_strategy(
    payload: PreviewPayload,
    service: QuantStrategyService = Depends(get_quant_strategy_service),
    _user_id: str = Depends(get_current_user_id),
):
    try:
        return await service.preview(payload.dsl, payload.symbol, payload.entry_price)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/backtest")
async def run_backtest(
    payload: BacktestPayload,
    user_id: str = Depends(get_current_user_id),
    service: QuantStrategyService = Depends(get_quant_strategy_service),
):
    try:
        return await service.backtest(
            user_id=user_id,
            strategy_id=payload.strategy_id,
            dsl=payload.dsl,
            symbol=payload.symbol,
            period=payload.period,
            initial_capital=payload.initial_capital,
        )
    except QuantStrategyStorageNotReady as error:
        raise HTTPException(status_code=503, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
