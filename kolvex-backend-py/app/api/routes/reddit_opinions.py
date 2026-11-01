"""Public reader; allowlisted communities cannot select arbitrary upstream URLs."""
from typing import Literal
import httpx
from fastapi import APIRouter, HTTPException, Query
from app.services.reddit_opinions import reddit_opinion_service

router = APIRouter(prefix="/reddit-opinions", tags=["Reddit Opinions"])
Community = Literal["all-stocks", "wallstreetbets", "stocks", "investing", "options"]


@router.get("")
async def ranking(community: Community = Query("all-stocks")):
    try:
        return await reddit_opinion_service.get(community)
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "Reddit ranking is temporarily unavailable") from exc
