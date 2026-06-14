"""
Portfolio Portfolio History Routes
Endpoints for portfolio historical data
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette import status as http_status
from typing import Optional, List
from datetime import date
from pydantic import BaseModel
import logging

from app.api.dependencies.auth import get_current_user_id
from app.services.portfolio_snapshot_service import (
    get_portfolio_snapshot_service,
    PortfolioSnapshotService,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# Schemas
# ============================================================


class SnapshotDataPoint(BaseModel):
    """Portfolio snapshot data point"""

    date: str
    value: float
    pnl: float
    pnl_percent: float
    positions_count: Optional[int] = None


class PortfolioHistoryResponse(BaseModel):
    """Portfolio history response"""

    period: str
    data: List[SnapshotDataPoint]
    first_snapshot_date: Optional[str] = None
    has_real_data: bool = False
    data_points: int = 0


class RecordSnapshotRequest(BaseModel):
    """Request to record a snapshot"""

    total_value: float
    total_cost_basis: float = 0
    unrealized_pnl: float = 0
    positions_count: int = 0
    accounts_count: int = 0


# ============================================================
# Routes
# ============================================================


@router.get("/history", response_model=PortfolioHistoryResponse)
async def get_portfolio_history(
    period: str = Query("1M", description="Period: 1D, 1W, 1M, 3M, YTD, ALL"),
    current_user_id: str = Depends(get_current_user_id),
):
    """
    Get portfolio performance history.

    Returns historical portfolio value data points for the specified period.
    If no historical data exists, returns an empty array with has_real_data=False.
    """
    try:
        service = get_portfolio_snapshot_service()

        # Get snapshots for the period
        snapshots = await service.get_snapshots_by_period(current_user_id, period)

        # Get first snapshot date
        first_date = await service.get_first_snapshot_date(current_user_id)

        # Convert to response format
        data_points = [
            SnapshotDataPoint(
                date=s["snapshot_date"],
                value=float(s["total_value"]),
                pnl=float(s.get("unrealized_pnl", 0)),
                pnl_percent=float(s.get("unrealized_pnl_percent", 0)),
                positions_count=s.get("positions_count"),
            )
            for s in snapshots
        ]

        return PortfolioHistoryResponse(
            period=period,
            data=data_points,
            first_snapshot_date=first_date.isoformat() if first_date else None,
            has_real_data=len(data_points) > 0,
            data_points=len(data_points),
        )
    except Exception as e:
        logger.error(f"Failed to get portfolio history: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get portfolio history: {str(e)}",
        )


@router.post("/history/snapshot")
async def record_portfolio_snapshot(
    request: RecordSnapshotRequest,
    current_user_id: str = Depends(get_current_user_id),
):
    """
    Record a portfolio snapshot for today.

    This endpoint can be called manually or automatically via webhook/sync.
    If a snapshot already exists for today, it will be updated.
    """
    try:
        service = get_portfolio_snapshot_service()

        snapshot = await service.record_snapshot(
            user_id=current_user_id,
            total_value=request.total_value,
            total_cost_basis=request.total_cost_basis,
            unrealized_pnl=request.unrealized_pnl,
            positions_count=request.positions_count,
            accounts_count=request.accounts_count,
        )

        return {
            "success": True,
            "message": "Snapshot recorded successfully",
            "snapshot_date": snapshot.get("snapshot_date"),
        }
    except Exception as e:
        logger.error(f"Failed to record portfolio snapshot: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record snapshot: {str(e)}",
        )


@router.get("/history/status")
async def get_history_status(
    current_user_id: str = Depends(get_current_user_id),
):
    """
    Get the status of portfolio history data.

    Returns information about available historical data.
    """
    try:
        service = get_portfolio_snapshot_service()

        first_date = await service.get_first_snapshot_date(current_user_id)
        latest = await service.get_latest_snapshot(current_user_id)

        # Count total snapshots
        all_snapshots = await service.get_snapshots(current_user_id)

        return {
            "has_data": first_date is not None,
            "first_snapshot_date": first_date.isoformat() if first_date else None,
            "latest_snapshot_date": latest["snapshot_date"] if latest else None,
            "total_snapshots": len(all_snapshots),
            "latest_value": float(latest["total_value"]) if latest else None,
        }
    except Exception as e:
        logger.error(f"Failed to get history status: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get history status: {str(e)}",
        )
