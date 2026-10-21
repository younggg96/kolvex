from fastapi import APIRouter, HTTPException
from app.services.news_feed import news_feed_service

router = APIRouter(prefix="/news", tags=["News"])


@router.get("/feed")
async def get_news_feed():
    try:
        return await news_feed_service.get_feed()
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail="News temporarily unavailable") from error
