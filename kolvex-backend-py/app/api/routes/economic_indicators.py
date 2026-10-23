from fastapi import APIRouter, Depends, Response

from app.api.dependencies.auth import get_current_user_id
from app.services.economic_indicators import economic_indicators_service

router = APIRouter(prefix="/market", tags=["Market Data"])


@router.get("/indicators")
async def get_economic_indicators(response: Response, user_id: str = Depends(get_current_user_id)):
    response.headers["Cache-Control"] = "private, no-store"
    return await economic_indicators_service.get_snapshot()
