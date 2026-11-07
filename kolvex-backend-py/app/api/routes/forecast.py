from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response

from app.api.dependencies.auth import get_current_user_id
from app.services.kline_forecast import ForecastNotConfigured, ForecastUnavailable, get_kline_forecast

router = APIRouter(prefix="/market", tags=["Market Data"])


@router.get("/forecast/{symbol}", summary="Kronos K线概率预测（实验）")
async def get_forecast(
    response: Response,
    symbol: str = Path(..., pattern=r"^[A-Za-z][A-Za-z.\-]{0,9}$"),
    interval: Literal["1d", "1wk"] = Query("1d"),
    horizon: int = Query(20, ge=5, le=60),
    _user_id: str = Depends(get_current_user_id),
):
    # Model inference is expensive; signed-in users only, cached per day server-side.
    response.headers["Cache-Control"] = "private, max-age=600"
    try:
        return await get_kline_forecast(symbol, interval, horizon)
    except ForecastNotConfigured:
        raise HTTPException(status_code=503, detail="forecast_not_configured")
    except ForecastUnavailable as exc:
        raise HTTPException(status_code=502, detail=str(exc))
