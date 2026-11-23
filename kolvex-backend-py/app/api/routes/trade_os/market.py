"""
Trade OS Market Regime API Routes
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.auth import get_current_user_id
from app.services.trade_os.market_regime import (
    evaluate_market_regime,
    get_latest_market_regime,
)

router = APIRouter(prefix="/market", tags=["Trade OS Market"])


@router.get("/regime")
async def get_market_regime() -> Dict[str, Any]:
    """Returns the current market regime (Risk On / Neutral / Risk Off)."""
    try:
        return get_latest_market_regime()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluate")
async def run_market_evaluation(_user_id: str = Depends(get_current_user_id)) -> Dict[str, Any]:
    """Force re-evaluates SPY and QQQ and updates current market regime (signed-in users)."""
    try:
        return await evaluate_market_regime()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
