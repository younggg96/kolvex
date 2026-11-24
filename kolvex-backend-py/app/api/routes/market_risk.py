"""Market Risk Monitor (experimental): latest score, stage, checklist and history."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies.auth import get_current_user_id
from app.services.market_risk import service

router = APIRouter(prefix="/market-risk", tags=["Market Risk"])
logger = logging.getLogger(__name__)


async def _loaded() -> service.Loaded:
    try:
        return await service.get_loaded()
    except service.MarketRiskUnavailable as exc:
        logger.warning("market_risk unavailable: %s", exc)
        raise HTTPException(503, detail={"code": "unavailable"}) from exc


@router.get("/latest")
async def latest(_user_id: str = Depends(get_current_user_id)):
    payload = service.build_latest(await _loaded(), datetime.now(timezone.utc))
    if payload is None:
        raise HTTPException(503, detail={"code": "no_score"})
    return payload


@router.get("/history")
async def history(
    range: str = Query("1Y", pattern="^(1M|3M|6M|1Y|3Y|MAX)$"),
    _user_id: str = Depends(get_current_user_id),
):
    return service.build_history(await _loaded(), range)
