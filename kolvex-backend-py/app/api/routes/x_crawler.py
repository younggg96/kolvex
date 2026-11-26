"""Admin control of the local X collector: which accounts it scans and per-account limits."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
from app.services.x_content import MAX_CRAWL_BATCH, CrawlTablesMissing, XCrawlerSettings

# Mounted under /admin by app.api.routes.admin.
admin_router = APIRouter(prefix="/x-crawler", tags=["Admin"])
logger = logging.getLogger(__name__)


def get_store(db=Depends(get_supabase_service)) -> XCrawlerSettings:
    return XCrawlerSettings(db)


class SourceInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    username: str = Field(min_length=1, max_length=16)
    enabled: bool = True


class SourcesInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    usernames: list[str] = Field(min_length=1, max_length=MAX_CRAWL_BATCH)


class SettingsInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    max_posts_per_creator: int = Field(ge=1, le=2000)
    max_scrolls_per_creator: int = Field(ge=1, le=300)


async def _run(action):
    try:
        return await run_in_threadpool(action)
    except CrawlTablesMissing as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "tables_missing") from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except Exception as exc:
        logger.exception("X crawler settings request failed")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "unavailable") from exc


@admin_router.get("")
async def get_settings(admin_id: str = Depends(verify_admin), store=Depends(get_store)):
    return await _run(store.get)


@admin_router.put("/settings")
async def save_settings(
    body: SettingsInput, admin_id: str = Depends(verify_admin), store=Depends(get_store)
):
    return await _run(lambda: store.save_settings(body.model_dump()))


@admin_router.post("/sources")
async def save_source(
    body: SourceInput, admin_id: str = Depends(verify_admin), store=Depends(get_store)
):
    return await _run(lambda: store.save_source(body.username, body.enabled))


@admin_router.post("/sources/batch")
async def save_sources(
    body: SourcesInput, admin_id: str = Depends(verify_admin), store=Depends(get_store)
):
    return await _run(lambda: store.save_sources(body.usernames))
