"""
Trade OS Analytics API Routes
"""

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from app.services.trade_os.analytics_service import get_account_performance_analytics

router = APIRouter(prefix="/analytics", tags=["Trade OS Analytics"])


@router.get("/{account_id}")
async def fetch_analytics(account_id: str) -> Dict[str, Any]:
    """Returns performance analytics, R-Multiple distribution, and plan discipline metrics."""
    try:
        return await get_account_performance_analytics(account_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
