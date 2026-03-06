"""
Options Flow AI Analysis Routes
POST /options-flow/ai/analyze  — run AI analysis and persist
GET  /options-flow/ai/history  — paginated public history
GET  /options-flow/ai/history/{id} — single analysis detail
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from pydantic import BaseModel, Field
from typing import Any, Optional
import logging

from app.api.dependencies.auth import get_current_user_id, get_optional_user_id
from app.services.options_ai_service import get_options_ai_service
from app.services.options_ai_prompt import compute_input_summary
from app.services.user_api_keys_service import (
    UserApiKeysService,
    get_user_api_keys_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/options-flow/ai", tags=["Options Flow AI"])


# ---- Request / Response models ----

class AnalyzeRequest(BaseModel):
    options_data: list[dict[str, Any]] = Field(..., min_length=1)
    risk_profile: str = Field(..., pattern="^(conservative|aggressive|hedging)$")
    locale: str = Field(default="en", pattern="^(en|zh)$")
    model: Optional[str] = Field(
        default=None,
        description="Model ID (e.g. deepseek-chat, gpt-4o-mini). Uses user's API keys.",
    )


class AnalyzeResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None
    symbol: Optional[str] = None
    risk_profile: str
    model: str
    locale: str
    input_summary: dict[str, Any]
    ai_response: dict[str, Any]
    created_at: str


class HistoryResponse(BaseModel):
    data: list[dict[str, Any]]
    total: int
    limit: int
    offset: int


# ---- Endpoints ----

@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    summary="Run AI analysis on options flow data",
)
async def analyze_options_flow(
    body: AnalyzeRequest,
    current_user_id: str = Depends(get_current_user_id),
    api_keys_service: UserApiKeysService = Depends(get_user_api_keys_service),
):
    service = get_options_ai_service()
    user_api_keys = await api_keys_service.get_keys_dict(current_user_id)

    try:
        result = await service.run_analysis(
            options_data=body.options_data,
            risk_profile=body.risk_profile,
            locale=body.locale,
            model=body.model,
            user_api_keys=user_api_keys or None,
        )
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {str(e)}")

    input_summary = compute_input_summary(body.options_data)
    symbols = input_summary.get("top_symbols", [])
    primary_symbol = symbols[0] if len(symbols) == 1 else None

    try:
        saved = service.save_analysis(
            user_id=current_user_id,
            symbol=primary_symbol,
            risk_profile=body.risk_profile,
            model=result["model"],
            locale=body.locale,
            input_summary=input_summary,
            ai_response=result["ai_response"],
        )
    except Exception as e:
        logger.error(f"Failed to persist analysis: {e}")
        raise HTTPException(status_code=500, detail="Failed to save analysis")

    return saved


@router.get(
    "/models",
    summary="List available Ollama models",
)
async def list_models():
    """Return Ollama models from /api/tags for model selector."""
    service = get_options_ai_service()
    try:
        models = service.list_models()
        return {"models": models}
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch models")


@router.get(
    "/history",
    response_model=HistoryResponse,
    summary="Get paginated analysis history",
)
async def get_history(
    symbol: Optional[str] = Query(None, description="Filter by symbol"),
    user_id: Optional[str] = Query(None, description="Filter by user"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _current_user_id: Optional[str] = Depends(get_optional_user_id),
):
    service = get_options_ai_service()
    try:
        return service.get_history(
            symbol=symbol, user_id=user_id, limit=limit, offset=offset
        )
    except Exception as e:
        logger.error(f"Failed to fetch history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch history")


@router.get(
    "/history/{analysis_id}",
    summary="Get single analysis by ID",
)
async def get_analysis(
    analysis_id: str = Path(..., description="Analysis UUID"),
    _current_user_id: Optional[str] = Depends(get_optional_user_id),
):
    service = get_options_ai_service()
    try:
        result = service.get_analysis_by_id(analysis_id)
    except Exception as e:
        logger.error(f"Failed to fetch analysis {analysis_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch analysis")

    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return result
