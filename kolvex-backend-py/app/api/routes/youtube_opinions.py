"""
YouTube creator stock opinion API routes.
"""

from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
from app.services.youtube_stock_opinions import YouTubeStockOpinionService


router = APIRouter(prefix="/youtube-opinions", tags=["YouTube Opinions"])

ImportBody = Union[Dict[str, Any], List[Dict[str, Any]]]


def get_service(
    supabase: Client = Depends(get_supabase_service),
) -> YouTubeStockOpinionService:
    return YouTubeStockOpinionService(supabase)


@router.get("/dashboard")
async def get_youtube_opinions_dashboard(
    ticker: Optional[str] = Query(default=None, max_length=20),
    channel_id: Optional[str] = Query(default=None),
    sentiment: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    limit: int = Query(default=80, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    service: YouTubeStockOpinionService = Depends(get_service),
):
    """Return dashboard aggregates for YouTube stock opinions."""
    try:
        return await service.get_dashboard(
            ticker=ticker,
            channel_id=channel_id,
            sentiment=sentiment,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load YouTube opinions: {str(e)}",
        )


@router.get("/stocks/{ticker}")
async def get_youtube_stock_detail(
    ticker: str,
    date_from: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    service: YouTubeStockOpinionService = Depends(get_service),
):
    """Return creator and day-level opinion detail for a single ticker."""
    try:
        return await service.get_stock_detail(
            ticker=ticker,
            date_from=date_from,
            date_to=date_to,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load stock opinion detail: {str(e)}",
        )


@router.get("/creators/{channel_id}/profile")
async def get_creator_public_profile(
    channel_id: str,
    service: YouTubeStockOpinionService = Depends(get_service),
):
    try:
        return await service.get_creator_profile(channel_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Creator not found")


@router.post("/validate")
async def validate_youtube_opinion_payload(
    payload: ImportBody,
    admin_id: str = Depends(verify_admin),
    service: YouTubeStockOpinionService = Depends(get_service),
):
    try:
        return service.validate_import(payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/upload")
async def upload_youtube_opinion_payload(
    payload: ImportBody,
    admin_id: str = Depends(verify_admin),
    service: YouTubeStockOpinionService = Depends(get_service),
):
    """
    Admin-only JSON upload for Gemini YouTube stock opinion analysis.

    Accepts one video object or an array of video objects for batch imports.
    """
    try:
        return await service.upload_import(payload, uploaded_by=admin_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload YouTube opinion payload: {str(e)}",
        )
