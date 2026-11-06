from datetime import date
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response

from app.api.dependencies.auth import get_current_user_id
from app.services.options_chain import ExpirationNotFound, options_chain_service
from app.services.options_chain.alpaca_client import AlpacaNotConfigured

router = APIRouter(prefix="/market", tags=["Market Data"])


# Separate from the yfinance-backed /market/options/{symbol} in market_data.py.
@router.get("/options-chain/{symbol}")
async def get_options_chain(
    response: Response,
    symbol: str = Path(..., pattern=r"^[A-Za-z][A-Za-z.]{0,9}$"),
    expiration: Optional[date] = Query(default=None, description="YYYY-MM-DD; defaults to the nearest expiration"),
    user_id: str = Depends(get_current_user_id),
):
    # Free-tier quotes are licensed for the signed-in user only; never cache publicly.
    response.headers["Cache-Control"] = "private, no-store"
    try:
        return await options_chain_service.get_chain(symbol, expiration.isoformat() if expiration else None)
    except AlpacaNotConfigured:
        raise HTTPException(status_code=503, detail="options_data_not_configured")
    except ExpirationNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        raise HTTPException(status_code=429 if status == 429 else 502, detail="options_provider_error")
