"""Imported editorial briefs are readable by signed-in users; writes stay admin-only."""
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from postgrest.exceptions import APIError
from pydantic import ValidationError
from supabase import Client

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service
from app.services.daily_briefs import list_saved_briefs, read_saved_brief

router = APIRouter(prefix="/briefs", tags=["Briefs"])
logger = logging.getLogger(__name__)


@router.get("")
async def listing(
    page: int = Query(1, ge=1, le=1000000),
    brief_type: Literal["morning", "evening"] | None = Query(None, alias="type"),
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase_service),
):
    try:
        return list_saved_briefs(db, page, brief_type)
    except APIError as exc:
        logger.exception("Brief reader list failed")
        raise HTTPException(503, "Briefs are temporarily unavailable") from exc


@router.get("/{brief_id}")
async def detail(
    brief_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase_service),
):
    try:
        return read_saved_brief(db, brief_id)
    except LookupError as exc:
        raise HTTPException(404, "Brief not found") from exc
    except (APIError, ValidationError) as exc:
        logger.exception("Brief reader detail failed")
        raise HTTPException(503, "Brief is temporarily unavailable") from exc
