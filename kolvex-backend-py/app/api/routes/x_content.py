"""Public source content; all writes require the existing administrator permission."""
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
from app.services.x_content import XContentService

router = APIRouter(prefix="/x-content", tags=["X Content"])
logger = logging.getLogger(__name__)


def get_service(db=Depends(get_supabase_service)):
    return XContentService(db)


class CreatorInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    username: str = Field(min_length=1, max_length=16)
    display_name: str = Field(default="", max_length=100)
    bio: str = Field(default="", max_length=1000)


def run(action):
    try:
        return action()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("X content request failed")
        raise HTTPException(status_code=503, detail="X content is unavailable. Check the database migration and retry.") from exc


@router.get("/creators")
def creators(service=Depends(get_service)):
    return run(service.creators)


@router.post("/creators")
def save_creator(payload: CreatorInput, admin=Depends(verify_admin), service=Depends(get_service)):
    return run(lambda: service.save_creator(payload.username, payload.display_name, payload.bio))


@router.get("/posts")
def posts(author: str | None = Query(None, max_length=16), ticker: str | None = Query(None, max_length=16),
          limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0, le=100000),
          service=Depends(get_service)):
    return run(lambda: service.posts(author, ticker, limit, offset))


@router.post("/validate")
def validate(payload: dict[str, Any] | list[dict[str, Any]], admin=Depends(verify_admin), service=Depends(get_service)):
    return run(lambda: service.validate(payload))


@router.post("/upload")
def upload(payload: dict[str, Any] | list[dict[str, Any]], admin=Depends(verify_admin), service=Depends(get_service)):
    return run(lambda: service.upload(payload))
