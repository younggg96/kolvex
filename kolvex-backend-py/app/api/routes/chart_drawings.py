"""
Per-user price chart drawings, synced across devices.
"""

import math
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, Field, field_validator, model_validator
from supabase import Client

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service
from app.services.chart_drawings import ChartDrawingsService, ChartDrawingsUnavailable

router = APIRouter(prefix="/chart-drawings", tags=["Chart Drawings"])

TickerPath = Path(..., min_length=1, max_length=20, pattern=r"^[A-Za-z0-9.\-^=]+$")


class Anchor(BaseModel):
    time: float
    price: float

    @field_validator("time", "price")
    @classmethod
    def finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("must be finite")
        return value


class Drawing(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    type: Literal["trend", "ray", "hline", "rect", "fib", "measure"]
    points: List[Anchor] = Field(min_length=1, max_length=2)
    color: str = Field(max_length=48, pattern=r"^rgb\([0-9a-z \-()/.%]+\)$")
    label: Optional[str] = Field(default=None, max_length=80)
    source: Optional[Literal["ai"]] = None

    @model_validator(mode="after")
    def point_count(self) -> "Drawing":
        expected = 1 if self.type == "hline" else 2
        if len(self.points) != expected:
            raise ValueError(f"{self.type} needs {expected} point(s)")
        return self


class SaveDrawingsRequest(BaseModel):
    drawings: List[Drawing] = Field(max_length=300)


class DrawingsResponse(BaseModel):
    ticker: str
    drawings: List[Drawing]
    updated_at: Optional[str] = None


def get_service(supabase: Client = Depends(get_supabase_service)) -> ChartDrawingsService:
    return ChartDrawingsService(supabase)


def _unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Chart drawing sync is not configured",
    )


@router.get("/{ticker}", response_model=DrawingsResponse)
async def get_chart_drawings(
    ticker: str = TickerPath,
    user_id: str = Depends(get_current_user_id),
    service: ChartDrawingsService = Depends(get_service),
):
    try:
        return service.get(user_id, ticker.upper())
    except ChartDrawingsUnavailable:
        raise _unavailable()


@router.put("/{ticker}", response_model=DrawingsResponse)
async def save_chart_drawings(
    body: SaveDrawingsRequest,
    ticker: str = TickerPath,
    user_id: str = Depends(get_current_user_id),
    service: ChartDrawingsService = Depends(get_service),
):
    try:
        return service.save(user_id, ticker.upper(), [item.model_dump() for item in body.drawings])
    except ChartDrawingsUnavailable:
        raise _unavailable()
