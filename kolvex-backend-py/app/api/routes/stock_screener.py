"""
Stock Screener API Routes
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user_id, get_optional_user_id
from app.core.supabase import get_supabase_service
from app.services.stock_screener.strategies import list_strategies, get_strategy
from app.services.stock_screener.screener_service import StockScreenerService
from app.services.stock_screener.ai_scorer import AIStockScorer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stocks/screener", tags=["Stock Screener"])

_screener = StockScreenerService()
_scorer = AIStockScorer()


# ==================== Request / Response Models ====================

class RangeFilter(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None


class ScreenRequest(BaseModel):
    strategy_id: Optional[str] = None
    filters: Optional[Dict[str, RangeFilter]] = None
    sectors: Optional[List[str]] = None
    sort_by: str = "market_cap"
    sort_direction: str = "desc"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class AIAnalyzeRequest(BaseModel):
    symbols: List[str] = Field(..., max_length=10)


class PresetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    filters: Dict[str, Any] = Field(default_factory=dict)
    sectors: Optional[List[str]] = None
    sort_by: str = "market_cap"
    sort_direction: str = "desc"


# ==================== Routes ====================


@router.get("/strategies")
async def get_strategies():
    """Return all pre-built strategy templates."""
    return list_strategies()


@router.post("/screen")
async def screen_stocks(body: ScreenRequest):
    """Run a screening query with optional strategy or custom filters."""
    filters: Dict[str, Any] = {}

    if body.strategy_id:
        strategy = get_strategy(body.strategy_id)
        if not strategy:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown strategy: {body.strategy_id}",
            )
        filters = strategy["filters"]
        sort_by = body.sort_by if body.sort_by != "market_cap" else strategy.get("sort_by", "market_cap")
        sort_direction = body.sort_direction if body.sort_direction != "desc" else strategy.get("sort_direction", "desc")
    else:
        if body.filters:
            filters = {k: v.model_dump(exclude_none=True) for k, v in body.filters.items()}
        sort_by = body.sort_by
        sort_direction = body.sort_direction

    result = await _screener.screen(
        filters=filters,
        sort_by=sort_by,
        sort_direction=sort_direction,
        page=body.page,
        page_size=body.page_size,
        sectors=body.sectors,
    )
    return result


@router.post("/ai-analyze")
async def ai_analyze(
    body: AIAnalyzeRequest,
    user_id: str = Depends(get_current_user_id),
):
    """AI-score a set of stocks (max 10)."""
    stock_data = []
    for sym in body.symbols:
        from app.core.redis import get_redis
        import json as _json

        redis = get_redis()
        raw = await redis.get(f"screener:stock:{sym.upper()}")
        if raw:
            try:
                stock_data.append(_json.loads(raw))
            except Exception:
                pass

    if not stock_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No cached data found for the given symbols. Run a screen first.",
        )

    result = await _scorer.score_stocks(stock_data)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI analysis unavailable. Please try again later.",
        )
    return result


# ==================== Presets ====================

@router.get("/presets")
async def get_presets(
    user_id: str = Depends(get_current_user_id),
):
    """List the current user's saved screening presets."""
    supabase = get_supabase_service()
    response = (
        supabase.table("screener_presets")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


@router.post("/presets", status_code=status.HTTP_201_CREATED)
async def create_preset(
    body: PresetCreate,
    user_id: str = Depends(get_current_user_id),
):
    """Save a new screening preset."""
    supabase = get_supabase_service()
    data = {
        "user_id": user_id,
        "name": body.name,
        "description": body.description,
        "filters": body.filters,
        "sectors": body.sectors,
        "sort_by": body.sort_by,
        "sort_direction": body.sort_direction,
    }
    response = supabase.table("screener_presets").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to save preset")
    return response.data[0]


@router.delete("/presets/{preset_id}")
async def delete_preset(
    preset_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Delete a user's preset."""
    supabase = get_supabase_service()
    response = (
        supabase.table("screener_presets")
        .delete()
        .eq("id", preset_id)
        .eq("user_id", user_id)
        .execute()
    )
    return {"ok": True}
