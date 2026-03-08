"""
Trading Analysis Routes — TradingAgents multi-agent analysis

POST   /trading-analysis/start              — Start a new analysis
GET    /trading-analysis/history            — List user's analyses
GET    /trading-analysis/published/list     — List all published analyses (public)
GET    /trading-analysis/published/{id}     — Get published analysis detail (public)
GET    /trading-analysis/{id}               — Get analysis detail
GET    /trading-analysis/{id}/stream        — SSE progress stream
PATCH  /trading-analysis/{id}/publish       — Publish an analysis
PATCH  /trading-analysis/{id}/unpublish     — Unpublish an analysis
DELETE /trading-analysis/{id}               — Delete analysis
"""

import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from supabase import Client

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase
from app.services.trading_analysis_service import (
    TRADINGAGENTS_AVAILABLE,
    get_trading_analysis_service,
)
from app.services.user_api_keys_service import (
    UserApiKeysService,
    get_user_api_keys_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trading-analysis", tags=["Trading Analysis"])


class StartAnalysisRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10, description="Stock ticker symbol")
    trade_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Analysis date (YYYY-MM-DD)")
    provider: str = Field(default="openai", description="LLM provider")
    deep_think_model: str = Field(default="gpt-4o", description="Model for complex reasoning")
    quick_think_model: str = Field(default="gpt-4o-mini", description="Model for quick tasks")
    selected_analysts: Optional[list[str]] = Field(
        default=None,
        description="Analyst types: market, social, news, fundamentals",
    )
    max_debate_rounds: int = Field(default=1, ge=1, le=3, description="Investment debate rounds")
    max_risk_discuss_rounds: int = Field(default=1, ge=1, le=3, description="Risk discussion rounds")


class AnalysisResponse(BaseModel):
    id: str
    ticker: str
    trade_date: str
    status: str
    selected_analysts: Optional[list[str]] = None
    llm_provider: Optional[str] = None
    final_decision: Optional[str] = None
    created_at: Optional[str] = None


@router.post("/start", response_model=AnalysisResponse)
async def start_analysis(
    request: StartAnalysisRequest,
    current_user_id: str = Depends(get_current_user_id),
    api_keys_service: UserApiKeysService = Depends(get_user_api_keys_service),
):
    """Start a new TradingAgents multi-agent analysis."""
    if not TRADINGAGENTS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Trading Analysis is temporarily unavailable (tradingagents package not installed)",
        )
    service = get_trading_analysis_service()

    user_api_keys = await api_keys_service.get_keys_dict(current_user_id)

    try:
        record = await service.start_analysis(
            user_id=current_user_id,
            ticker=request.ticker,
            trade_date=request.trade_date,
            provider=request.provider,
            deep_think_model=request.deep_think_model,
            quick_think_model=request.quick_think_model,
            selected_analysts=request.selected_analysts,
            max_debate_rounds=request.max_debate_rounds,
            max_risk_discuss_rounds=request.max_risk_discuss_rounds,
            user_api_keys=user_api_keys or None,
        )
        return record
    except Exception as e:
        logger.error(f"Failed to start analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start analysis: {str(e)}")


@router.get("/history")
async def list_analyses(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    ticker: Optional[str] = Query(default=None),
    current_user_id: str = Depends(get_current_user_id),
):
    """List the current user's trading analyses."""
    service = get_trading_analysis_service()
    return await service.list_analyses(
        user_id=current_user_id,
        limit=limit,
        offset=offset,
        ticker=ticker,
    )


@router.get("/published/list")
async def list_published_analyses(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    ticker: Optional[str] = Query(default=None),
):
    """List all published analyses (public, no auth required)."""
    service = get_trading_analysis_service()
    return await service.list_published_analyses(
        limit=limit,
        offset=offset,
        ticker=ticker,
    )


@router.get("/published/{analysis_id}")
async def get_published_analysis(analysis_id: str):
    """Get a single published analysis (public, no auth required)."""
    service = get_trading_analysis_service()
    record = await service.get_published_analysis(analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found or not published")
    return record


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Get a single analysis with full reports."""
    service = get_trading_analysis_service()
    record = await service.get_analysis(analysis_id, current_user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return record


@router.get("/{analysis_id}/stream")
async def stream_progress(
    analysis_id: str,
    token: Optional[str] = Query(None, description="Bearer token for direct browser SSE connections"),
    authorization: Optional[str] = Header(None),
    supabase: Client = Depends(get_supabase),
):
    """SSE stream of analysis progress events with keepalive.

    Supports auth via Authorization header (proxy) or ?token= query param
    (direct browser EventSource, which cannot set custom headers).
    """
    import asyncio as _asyncio

    auth_token = token
    if not auth_token and authorization:
        try:
            scheme, value = authorization.split()
            if scheme.lower() == "bearer":
                auth_token = value
        except ValueError:
            pass

    if not auth_token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        user_response = supabase.auth.get_user(auth_token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        current_user_id = user_response.user.id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")

    service = get_trading_analysis_service()

    record = await service.get_analysis(analysis_id, current_user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")

    async def event_generator():
        queue: _asyncio.Queue[str | None] = _asyncio.Queue()

        async def _reader():
            try:
                async for event in service.stream_progress(analysis_id):
                    await queue.put(
                        f"data: {json.dumps(event, default=str)}\n\n"
                    )
            finally:
                await queue.put(None)

        reader_task = _asyncio.create_task(_reader())

        try:
            while True:
                try:
                    item = await _asyncio.wait_for(queue.get(), timeout=10)
                except _asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue

                if item is None:
                    break
                yield item
        finally:
            reader_task.cancel()
            try:
                await reader_task
            except (_asyncio.CancelledError, Exception):
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.patch("/{analysis_id}/publish")
async def publish_analysis(
    analysis_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Publish an analysis so all users can view it."""
    service = get_trading_analysis_service()
    record = await service.publish_analysis(analysis_id, current_user_id)
    if not record:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or not completed",
        )
    return record


@router.patch("/{analysis_id}/unpublish")
async def unpublish_analysis(
    analysis_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Unpublish an analysis, making it private again."""
    service = get_trading_analysis_service()
    record = await service.unpublish_analysis(analysis_id, current_user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return record


@router.delete("/{analysis_id}")
async def delete_analysis(
    analysis_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Delete an analysis."""
    service = get_trading_analysis_service()
    deleted = await service.delete_analysis(analysis_id, current_user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"message": "Analysis deleted"}
