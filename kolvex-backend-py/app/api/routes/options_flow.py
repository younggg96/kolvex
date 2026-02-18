"""
Options Flow API Routes
Endpoints for unusual options activity monitoring
"""

from fastapi import APIRouter, Query, HTTPException, Path
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum
import logging

from app.services.options_flow.service import get_options_flow_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/options-flow", tags=["Options Flow"])


# ============================================================
# Pydantic Models
# ============================================================


class OptionTypeFilter(str, Enum):
    CALL = "call"
    PUT = "put"


class UnusualActivityItem(BaseModel):
    """Single unusual options activity record."""
    symbol: str
    company_name: Optional[str] = None
    contract_symbol: str
    option_type: str
    strike: float
    expiration: str
    volume: int
    open_interest: int
    vol_oi_ratio: float
    implied_volatility: float
    last_price: float
    bid: float
    ask: float
    premium: float
    stock_price: float
    in_the_money: bool
    signal_types: List[str]
    signal_strength: int
    detected_at: str


class UnusualActivityResponse(BaseModel):
    """Paginated response for unusual activity."""
    data: List[UnusualActivityItem]
    total: int
    limit: int
    offset: int


class ScanRequest(BaseModel):
    """Request body for manual scan."""
    symbols: Optional[List[str]] = Field(
        None,
        description="Symbols to scan. Uses default list if empty.",
    )
    max_expirations: int = Field(
        4,
        ge=1,
        le=8,
        description="Maximum number of expiration dates to scan per symbol.",
    )
    save: bool = Field(
        True,
        description="Whether to persist results to database.",
    )


class ScanResponse(BaseModel):
    """Response from a scan operation."""
    total_scanned_symbols: int
    total_unusual_found: int
    saved_count: int
    results: List[UnusualActivityItem]


class StatsResponse(BaseModel):
    """Statistics summary."""
    period_hours: int
    total_signals: int
    total_premium: float
    by_type: dict
    top_symbols: list
    top_contracts: list
    avg_vol_oi_ratio: float
    call_put_ratio: float


class LiveScanItem(BaseModel):
    """Single live scan result (not persisted)."""
    symbol: str
    company_name: Optional[str] = None
    contract_symbol: str
    option_type: str
    strike: float
    expiration: str
    volume: int
    open_interest: int
    vol_oi_ratio: float
    implied_volatility: float
    last_price: float
    bid: float
    ask: float
    premium: float
    stock_price: float
    in_the_money: bool
    signal_types: List[str]
    signal_strength: int
    detected_at: str


class LiveScanResponse(BaseModel):
    """Response from a live scan."""
    symbol: str
    total: int
    data: List[LiveScanItem]


# ============================================================
# Routes
# ============================================================


@router.get(
    "/unusual",
    response_model=UnusualActivityResponse,
    summary="Get unusual options activity",
    description="Retrieve recent unusual options activity from the database with filters.",
)
async def get_unusual_activity(
    symbol: Optional[str] = Query(None, description="Filter by stock symbol"),
    option_type: Optional[OptionTypeFilter] = Query(None, description="Filter by option type"),
    min_premium: Optional[float] = Query(None, ge=0, description="Minimum premium ($)"),
    min_vol_oi: Optional[float] = Query(None, ge=0, description="Minimum Vol/OI ratio"),
    limit: int = Query(50, ge=1, le=200, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
):
    """Get recent unusual options activity records."""
    try:
        service = get_options_flow_service()
        result = service.get_recent_activity(
            symbol=symbol,
            option_type=option_type.value if option_type else None,
            min_premium=min_premium,
            min_vol_oi=min_vol_oi,
            limit=limit,
            offset=offset,
        )
        return UnusualActivityResponse(**result)
    except Exception as e:
        logger.error(f"Failed to get unusual activity: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get unusual activity: {str(e)}")


@router.get(
    "/live/{symbol}",
    response_model=LiveScanResponse,
    summary="Live scan for a single symbol",
    description="Perform a real-time scan of a single symbol's options chain.",
)
async def live_scan_symbol(
    symbol: str = Path(..., description="Stock symbol (e.g. TSLA, NVDA)"),
    max_expirations: int = Query(4, ge=1, le=8, description="Max expirations to scan"),
):
    """Scan a single symbol's options chain for unusual activity in real time."""
    try:
        service = get_options_flow_service()
        results = service.scan_symbol(
            symbol=symbol.upper(),
            max_expirations=max_expirations,
        )
        return LiveScanResponse(
            symbol=symbol.upper(),
            total=len(results),
            data=results,
        )
    except Exception as e:
        logger.error(f"Live scan failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")


@router.post(
    "/scan",
    response_model=ScanResponse,
    summary="Scan for unusual options activity",
    description="Trigger a batch scan of multiple symbols and optionally save results.",
)
async def scan_options_flow(body: ScanRequest):
    """
    Batch scan for unusual options activity.
    If symbols is empty, scans the default popular-stock list.
    """
    try:
        service = get_options_flow_service()
        results = service.scan_multiple(
            symbols=body.symbols,
            max_expirations=body.max_expirations,
        )

        saved_count = 0
        if body.save and results:
            saved_count = service.save_results(results)

        from app.services.options_flow.service import DEFAULT_SCAN_SYMBOLS

        scanned_count = len(body.symbols) if body.symbols else len(DEFAULT_SCAN_SYMBOLS)

        return ScanResponse(
            total_scanned_symbols=scanned_count,
            total_unusual_found=len(results),
            saved_count=saved_count,
            results=results,
        )
    except Exception as e:
        logger.error(f"Options flow scan failed: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")


@router.get(
    "/stats",
    response_model=StatsResponse,
    summary="Get options flow statistics",
    description="Get summary statistics for recent unusual options activity.",
)
async def get_stats(
    hours: int = Query(24, ge=1, le=168, description="Time window in hours"),
):
    """Get unusual activity statistics for the specified time window."""
    try:
        service = get_options_flow_service()
        stats = service.get_activity_stats(hours=hours)
        return StatsResponse(**stats)
    except Exception as e:
        logger.error(f"Failed to get options flow stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")
