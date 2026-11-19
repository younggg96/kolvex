"""
Portfolio AI Analysis API Routes
Provides AI-powered analysis endpoints for portfolio holdings
"""

import asyncio
import logging
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, ConfigDict, Field

from app.api.dependencies.auth import get_current_user_id
from app.services.portfolio import PortfolioService, get_portfolio_service
from app.services.portfolio_ai_analysis import (
    AiKeyRejected,
    AiRateLimited,
    NoPositions,
    OverallAnalysis,
    PortfolioAnalysisInvalid,
    PortfolioAnalysisRuns,
    PortfolioSuggestions,
    StockAnalysis,
    get_portfolio_analysis_runs,
    run_portfolio_analysis,
    save_quietly,
)
from app.services.portfolio_analyzer import analyze_stock
from app.services.technical_analysis import AiNotConfigured
from app.services.user_api_keys_service import UserApiKeysService, get_user_api_keys_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Request/Response Models
# ============================================================


class PortfolioAnalysisRequest(BaseModel):
    """Request for portfolio analysis"""

    model: Optional[str] = Field(
        None, description="Model ID from the shared model list; runs on the user's own API key"
    )
    locale: Literal["zh", "en"] = Field("zh", description="Language of the written analysis")
    user_context: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional user-provided context for analysis (e.g., investment goals, risk tolerance)",
    )


class StockAnalysisRequest(BaseModel):
    """Request for single stock analysis"""

    symbol: str = Field(..., description="Stock ticker symbol")
    position_data: Dict[str, Any] = Field(..., description="Position data")
    include_portfolio_context: bool = Field(
        True, description="Whether to include overall portfolio context"
    )


class PortfolioAnalysisResponse(BaseModel):
    """Full portfolio analysis response"""

    overall_analysis: OverallAnalysis
    stock_analyses: List[StockAnalysis]
    portfolio_suggestions: PortfolioSuggestions
    analyzed_at: str
    model: str
    positions_analyzed: int
    id: Optional[str] = Field(None, description="Saved run id; null when saving failed")
    saved: bool = False
    created_at: Optional[str] = None
    locale: Optional[str] = None


class PortfolioAnalysisRunItem(BaseModel):
    """One saved analysis in the history list"""

    model_config = ConfigDict(protected_namespaces=())

    id: str
    created_at: str
    model_id: str
    locale: Optional[str] = None
    summary: str
    risk_level: Optional[str] = None
    positions_analyzed: int


class PortfolioAnalysisRunList(BaseModel):
    items: List[PortfolioAnalysisRunItem]


class SingleStockAnalysisResponse(BaseModel):
    """Single stock analysis response"""

    symbol: str
    sentiment: str
    sentiment_confidence: float
    short_term_outlook: Optional[str] = None
    long_term_outlook: Optional[str] = None
    analysis_summary: str
    key_factors: List[str] = []
    risk_factors: List[str] = []
    recommendation: str
    target_weight: Optional[float] = None
    rationale: str
    analyzed_at: str
    model: str


# ============================================================
# API Endpoints
# ============================================================


@router.post("/analysis", response_model=PortfolioAnalysisResponse, summary="Analyze Portfolio")
async def analyze_user_portfolio(
    request: PortfolioAnalysisRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: PortfolioService = Depends(get_portfolio_service),
    api_keys: UserApiKeysService = Depends(get_user_api_keys_service),
    runs: PortfolioAnalysisRuns = Depends(get_portfolio_analysis_runs),
):
    """
    Analyze the current user's portfolio with the model they picked, on their own API key.
    Each successful run is saved to the user's analysis history.

    Errors use stable codes: ai_not_configured, ai_key_rejected, ai_rate_limited,
    ai_analysis_invalid, ai_analysis_timeout, ai_unavailable, no_positions.
    """
    holdings = await service.get_user_holdings(current_user_id)
    if not holdings or not holdings.get("accounts"):
        raise HTTPException(status_code=404, detail="no_positions")
    try:
        analysis = await run_portfolio_analysis(
            holdings,
            model_id=request.model,
            user_api_keys=await api_keys.get_keys_dict(current_user_id),
            locale=request.locale,
            user_context=request.user_context,
        )
    except AiNotConfigured as exc:
        raise HTTPException(503, "ai_not_configured") from exc
    except NoPositions as exc:
        raise HTTPException(404, "no_positions") from exc
    except AiKeyRejected as exc:
        raise HTTPException(400, "ai_key_rejected") from exc
    except AiRateLimited as exc:
        raise HTTPException(429, "ai_rate_limited") from exc
    except PortfolioAnalysisInvalid as exc:
        raise HTTPException(502, "ai_analysis_invalid") from exc
    except asyncio.TimeoutError as exc:
        raise HTTPException(504, "ai_analysis_timeout") from exc
    except Exception as exc:
        # Provider errors can echo request details; clients get a stable code.
        logger.warning("Portfolio AI analysis unavailable (%s)", type(exc).__name__)
        raise HTTPException(503, "ai_unavailable") from exc

    row = await asyncio.to_thread(
        save_quietly, lambda: runs.save(current_user_id, analysis, request.locale)
    )
    return PortfolioAnalysisResponse(
        **analysis,
        id=row["id"] if row else None,
        saved=bool(row),
        created_at=row["created_at"] if row else None,
        locale=request.locale,
    )


@router.get(
    "/analysis/runs",
    response_model=PortfolioAnalysisRunList,
    summary="List Saved Portfolio Analyses",
)
async def list_portfolio_analyses(
    limit: int = Query(default=20, ge=1, le=50),
    current_user_id: str = Depends(get_current_user_id),
    runs: PortfolioAnalysisRuns = Depends(get_portfolio_analysis_runs),
):
    """This user's saved analyses, newest first (summary only)."""
    try:
        items = await asyncio.to_thread(runs.list, current_user_id, limit)
    except Exception as exc:
        logger.warning("Portfolio analysis history unavailable (%s)", type(exc).__name__)
        raise HTTPException(503, "analysis_history_unavailable") from exc
    return {"items": items}


@router.get(
    "/analysis/runs/{run_id}",
    response_model=PortfolioAnalysisResponse,
    summary="Get Saved Portfolio Analysis",
)
async def get_portfolio_analysis(
    run_id: str = Path(..., pattern=r"^[0-9a-fA-F-]{36}$"),
    current_user_id: str = Depends(get_current_user_id),
    runs: PortfolioAnalysisRuns = Depends(get_portfolio_analysis_runs),
):
    """One saved analysis in full. Another user's run is reported as not found."""
    try:
        run = await asyncio.to_thread(runs.get, current_user_id, run_id)
    except Exception as exc:
        logger.warning("Portfolio analysis run unavailable (%s)", type(exc).__name__)
        raise HTTPException(503, "analysis_history_unavailable") from exc
    if not run:
        raise HTTPException(404, "analysis_not_found")
    return run


@router.post(
    "/analysis/stock", response_model=SingleStockAnalysisResponse, summary="Analyze Single Stock"
)
async def analyze_single_stock_position(
    request: StockAnalysisRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: PortfolioService = Depends(get_portfolio_service),
):
    """
    Analyze a single stock position in detail.

    Provides:
    - Detailed sentiment analysis
    - Short and long-term outlook
    - Specific recommendation with rationale

    Requires authentication: Bearer token
    """
    try:
        portfolio_context = None

        if request.include_portfolio_context:
            # Get user's holdings for context
            holdings = await service.get_user_holdings(current_user_id)
            if holdings:
                total_value = 0
                for account in holdings.get("accounts", []):
                    for pos in account.get("portfolio_positions", []):
                        price = pos.get("price", 0) or 0
                        units = pos.get("units", 0) or 0
                        multiplier = 100 if pos.get("position_type") == "option" else 1
                        total_value += price * units * multiplier

                portfolio_context = {
                    "total_value": total_value,
                    "positions_count": sum(
                        len(a.get("portfolio_positions", [])) for a in holdings.get("accounts", [])
                    ),
                }

        # Perform AI analysis
        analysis = await analyze_stock(request.symbol, request.position_data, portfolio_context)

        return SingleStockAnalysisResponse(
            symbol=analysis.get("symbol", request.symbol),
            sentiment=analysis.get("sentiment", "neutral"),
            sentiment_confidence=analysis.get("sentiment_confidence", 0.5),
            short_term_outlook=analysis.get("short_term_outlook"),
            long_term_outlook=analysis.get("long_term_outlook"),
            analysis_summary=analysis.get("analysis_summary", ""),
            key_factors=analysis.get("key_factors", []),
            risk_factors=analysis.get("risk_factors", []),
            recommendation=analysis.get("recommendation", "hold"),
            target_weight=analysis.get("target_weight"),
            rationale=analysis.get("rationale", ""),
            analyzed_at=analysis.get("analyzed_at", ""),
            model=analysis.get("model", "unknown"),
        )

    except Exception as e:
        print(f"Single stock analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze stock: {str(e)}")


@router.get("/analysis/health", summary="Check AI Analysis Health")
async def check_analysis_health():
    """
    Check if the AI analysis service is available.
    """
    try:
        from app.services.ai.client import OllamaClient

        async with OllamaClient() as client:
            is_healthy = await client.health_check()

            return {
                "status": "ok" if is_healthy else "unavailable",
                "ai_available": is_healthy,
                "model": client.model,
            }
    except Exception as e:
        return {
            "status": "error",
            "ai_available": False,
            "error": str(e),
        }
