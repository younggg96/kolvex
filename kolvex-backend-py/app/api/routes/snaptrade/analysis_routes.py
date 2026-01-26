"""
Portfolio AI Analysis API Routes
Provides AI-powered analysis endpoints for portfolio holdings
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.api.dependencies.auth import get_current_user_id
from app.services.snaptrade import SnapTradeService, get_snaptrade_service
from app.services.portfolio_analyzer import analyze_portfolio, analyze_stock

router = APIRouter()


# ============================================================
# Request/Response Models
# ============================================================

class PortfolioAnalysisRequest(BaseModel):
    """Request for portfolio analysis"""
    user_context: Optional[str] = Field(
        None, 
        description="Optional user-provided context for analysis (e.g., investment goals, risk tolerance)"
    )


class StockAnalysisRequest(BaseModel):
    """Request for single stock analysis"""
    symbol: str = Field(..., description="Stock ticker symbol")
    position_data: Dict[str, Any] = Field(..., description="Position data")
    include_portfolio_context: bool = Field(
        True, 
        description="Whether to include overall portfolio context"
    )


class KeyMetrics(BaseModel):
    """Key portfolio metrics"""
    concentration_risk: Optional[str] = None
    sector_balance: Optional[str] = None
    growth_potential: Optional[str] = None


class OverallAnalysis(BaseModel):
    """Overall portfolio analysis"""
    summary: str
    risk_level: str
    diversification_score: int
    portfolio_style: Optional[str] = None
    strengths: List[str] = []
    weaknesses: List[str] = []
    key_metrics: Optional[KeyMetrics] = None


class StockAnalysis(BaseModel):
    """Individual stock analysis"""
    symbol: str
    name: Optional[str] = None
    current_weight: Optional[float] = None
    sentiment: str
    analysis: Optional[str] = None
    recommendation: str
    confidence: float
    key_points: List[str] = []


class PortfolioSuggestions(BaseModel):
    """Portfolio improvement suggestions"""
    rebalancing: List[str] = []
    risk_management: List[str] = []
    opportunities: List[str] = []
    tax_considerations: List[str] = []


class PortfolioAnalysisResponse(BaseModel):
    """Full portfolio analysis response"""
    overall_analysis: OverallAnalysis
    stock_analyses: List[StockAnalysis]
    portfolio_suggestions: PortfolioSuggestions
    analyzed_at: str
    model: str
    positions_analyzed: int


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
    request: PortfolioAnalysisRequest = None,
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Analyze the current user's portfolio using AI.
    
    Provides:
    - Overall portfolio health assessment
    - Individual stock analyses
    - Rebalancing and improvement suggestions
    
    Requires authentication: Bearer token
    """
    try:
        # Get user's holdings
        holdings = await service.get_user_holdings(current_user_id)
        
        if not holdings or not holdings.get("accounts"):
            raise HTTPException(
                status_code=404, 
                detail="No portfolio data found. Please sync your portfolio first."
            )
        
        # Perform AI analysis
        user_context = request.user_context if request else None
        analysis = await analyze_portfolio(holdings, user_context)
        
        if not analysis.get("overall_analysis"):
            raise HTTPException(
                status_code=500,
                detail="AI analysis failed. Please try again later."
            )
        
        # Build response
        overall = analysis.get("overall_analysis", {})
        
        return PortfolioAnalysisResponse(
            overall_analysis=OverallAnalysis(
                summary=overall.get("summary", ""),
                risk_level=overall.get("risk_level", "unknown"),
                diversification_score=overall.get("diversification_score", 0),
                portfolio_style=overall.get("portfolio_style"),
                strengths=overall.get("strengths", []),
                weaknesses=overall.get("weaknesses", []),
                key_metrics=KeyMetrics(**overall.get("key_metrics", {})) if overall.get("key_metrics") else None,
            ),
            stock_analyses=[
                StockAnalysis(
                    symbol=s.get("symbol", ""),
                    name=s.get("name"),
                    current_weight=s.get("current_weight"),
                    sentiment=s.get("sentiment", "neutral"),
                    analysis=s.get("analysis"),
                    recommendation=s.get("recommendation", "hold"),
                    confidence=s.get("confidence", 0.5),
                    key_points=s.get("key_points", []),
                )
                for s in analysis.get("stock_analyses", [])
            ],
            portfolio_suggestions=PortfolioSuggestions(
                **analysis.get("portfolio_suggestions", {})
            ),
            analyzed_at=analysis.get("analyzed_at", ""),
            model=analysis.get("model", "unknown"),
            positions_analyzed=analysis.get("positions_analyzed", 0),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Portfolio analysis error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze portfolio: {str(e)}"
        )


@router.post("/analysis/stock", response_model=SingleStockAnalysisResponse, summary="Analyze Single Stock")
async def analyze_single_stock_position(
    request: StockAnalysisRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
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
                    for pos in account.get("snaptrade_positions", []):
                        price = pos.get("price", 0) or 0
                        units = pos.get("units", 0) or 0
                        multiplier = 100 if pos.get("position_type") == "option" else 1
                        total_value += price * units * multiplier
                
                portfolio_context = {
                    "total_value": total_value,
                    "positions_count": sum(
                        len(a.get("snaptrade_positions", [])) 
                        for a in holdings.get("accounts", [])
                    ),
                }
        
        # Perform AI analysis
        analysis = await analyze_stock(
            request.symbol,
            request.position_data,
            portfolio_context
        )
        
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
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze stock: {str(e)}"
        )


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
