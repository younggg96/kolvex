from fastapi import APIRouter, HTTPException

from app.core.redis import get_redis
from app.services.content_translation import enrich_headlines
from app.services.news_feed import news_feed_service

router = APIRouter(prefix="/news", tags=["News"])


@router.get("/feed")
async def get_news_feed():
    try:
        feed = await news_feed_service.get_feed()
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail="News temporarily unavailable") from error
    return {**feed, "articles": await enrich_headlines(get_redis(), feed["articles"])}
