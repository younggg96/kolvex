"""
Trade OS Market Regime API Routes
"""

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

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
async def run_market_evaluation() -> Dict[str, Any]:
    """Force re-evaluates SPY and QQQ and updates current market regime."""
    try:
        return await evaluate_market_regime()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
