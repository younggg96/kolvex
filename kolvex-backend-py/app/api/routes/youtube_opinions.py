"""
YouTube creator stock opinion API routes.
"""

from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client
from pydantic import BaseModel, ConfigDict, Field, StrictStr

from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
from app.services.youtube_stock_opinions import YouTubeStockOpinionService


router = APIRouter(prefix="/youtube-opinions", tags=["YouTube Opinions"])

ImportBody = Union[Dict[str, Any], List[Dict[str, Any]]]


class CreatorUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    channel_title: Optional[StrictStr] = None
    channel_handle: Optional[StrictStr] = None
    channel_url: Optional[StrictStr] = None
    channel_avatar_url: Optional[StrictStr] = None


class PriceTargetInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: Optional[StrictStr] = None
    value: float


class OpinionWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker: StrictStr
    company_name: Optional[StrictStr] = None
    sentiment: StrictStr
    direction_score: Optional[float] = None
    confidence: Optional[float] = None
    time_horizon: Optional[StrictStr] = None
    thesis: Optional[StrictStr] = None
    summary: StrictStr
    key_points: List[StrictStr] = Field(default_factory=list)
    risks: List[StrictStr] = Field(default_factory=list)
    price_targets: List[PriceTargetInput] = Field(default_factory=list)
    opinion_date: Optional[StrictStr] = None
    video_title: Optional[StrictStr] = None
    video_url: Optional[StrictStr] = None
    video_published_at: Optional[StrictStr] = None


def get_service(
    supabase: Client = Depends(get_supabase_service),
) -> YouTubeStockOpinionService:
    return YouTubeStockOpinionService(supabase)


@router.get("/creators")
async def list_creators(
    admin_id: str = Depends(verify_admin),
    service: YouTubeStockOpinionService = Depends(get_service),
):
    return {"creators": service.list_creators()}


@router.patch("/creators/{channel_id}")
async def update_creator(
    channel_id: str,
    payload: CreatorUpdate,
    admin_id: str = Depends(verify_admin),
    service: YouTubeStockOpinionService = Depends(get_service),
):
    try:
        return service.update_creator(channel_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except LookupError:
        raise HTTPException(status_code=404, detail="Creator not found")


@router.get("/coverage")
async def get_youtube_upload_coverage(
    service: YouTubeStockOpinionService = Depends(get_service),
):
    """Compare imported videos with each creator's latest public YouTube uploads."""
    try:
        return await service.get_upload_coverage()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check YouTube uploads: {str(e)}",
        )


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


@router.get("/creators/{channel_id}/opinions")
async def list_creator_opinions(
    channel_id: str,
    admin_id: str = Depends(verify_admin),
    service: YouTubeStockOpinionService = Depends(get_service),
):
    try:
        return service.list_creator_opinions(channel_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Creator not found")


@router.post("/creators/{channel_id}/opinions")
async def create_creator_opinion(
    channel_id: str,
    payload: OpinionWrite,
    admin_id: str = Depends(verify_admin),
    service: YouTubeStockOpinionService = Depends(get_service),
):
    try:
        return service.create_opinion(channel_id, payload.model_dump(), uploaded_by=admin_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except LookupError:
        raise HTTPException(status_code=404, detail="Creator not found")


@router.patch("/opinions/{opinion_id}")
async def update_opinion(
    opinion_id: str,
    payload: OpinionWrite,
    admin_id: str = Depends(verify_admin),
    service: YouTubeStockOpinionService = Depends(get_service),
):
    try:
        return service.update_opinion(opinion_id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except LookupError:
        raise HTTPException(status_code=404, detail="Opinion not found")


@router.delete("/opinions/{opinion_id}")
async def delete_opinion(
    opinion_id: str,
    admin_id: str = Depends(verify_admin),
    service: YouTubeStockOpinionService = Depends(get_service),
):
    try:
        return service.delete_opinion(opinion_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Opinion not found")


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
