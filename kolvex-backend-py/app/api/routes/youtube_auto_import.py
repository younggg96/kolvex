"""Automatic YouTube opinion import: admin control + local transcript worker API."""

import asyncio
import hmac
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.dependencies.auth import verify_admin
from app.core.config import settings
from app.core.supabase import get_supabase_service
from app.services import youtube_auto_import as auto
from app.services.youtube_stock_opinions import YouTubeStockOpinionService
from supabase import Client

# Mounted under /admin by app.api.routes.admin.
admin_router = APIRouter(prefix="/youtube-auto-import", tags=["Admin"])
worker_router = APIRouter(prefix="/youtube-auto-import/worker", tags=["YouTube Auto Import"])


def get_store(supabase: Client = Depends(get_supabase_service)) -> auto.YouTubeAutoImportStore:
    return auto.YouTubeAutoImportStore(supabase)


def get_opinions(supabase: Client = Depends(get_supabase_service)) -> YouTubeStockOpinionService:
    return YouTubeStockOpinionService(supabase)


def verify_worker(x_worker_token: Optional[str] = Header(default=None)) -> None:
    expected = settings.YOUTUBE_IMPORT_WORKER_TOKEN
    if not expected:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "worker_not_configured")
    if not x_worker_token or not hmac.compare_digest(x_worker_token, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_worker_token")


# ---------------- admin ----------------


@admin_router.get("/status")
async def get_status(
    admin_id: str = Depends(verify_admin),
    store: auto.YouTubeAutoImportStore = Depends(get_store),
) -> Dict[str, Any]:
    try:
        return await asyncio.to_thread(auto.admin_status, store)
    except Exception as e:
        # PostgREST "table not in schema cache": the migration has not been applied.
        if "PGRST205" in str(e):
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "tables_missing") from e
        raise


@admin_router.post("/run")
async def run_now(
    admin_id: str = Depends(verify_admin),
    store: auto.YouTubeAutoImportStore = Depends(get_store),
) -> Dict[str, Any]:
    if not settings.YOUTUBE_IMPORT_WORKER_TOKEN:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "worker_not_configured")
    try:
        run = await asyncio.to_thread(store.create_run, "manual", admin_id)
    except auto.RunConflict:
        raise HTTPException(status.HTTP_409_CONFLICT, "run_in_progress")
    return {"run": run}


# ---------------- worker ----------------


class ClaimBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    hostname: Optional[str] = Field(default=None, max_length=200)
    version: Optional[str] = Field(default=None, max_length=50)


class Progress(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stage: str = Field(max_length=40)
    done: int = Field(default=0, ge=0, le=10_000)
    total: int = Field(default=0, ge=0, le=10_000)
    current: Optional[str] = Field(default=None, max_length=300)


class VideoBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    video_id: str = Field(pattern=r"^[A-Za-z0-9_-]{11}$")
    title: str = Field(min_length=1, max_length=500)
    published_at: str = Field(min_length=10, max_length=40)
    channel_id: str = Field(min_length=1, max_length=100)
    channel_title: str = Field(min_length=1, max_length=200)
    channel_handle: Optional[str] = Field(default=None, max_length=200)
    channel_url: Optional[str] = Field(default=None, max_length=300)
    transcript: str = Field(min_length=20, max_length=400_000)


class TranscriptFailure(BaseModel):
    model_config = ConfigDict(extra="ignore")
    video_id: str = Field(pattern=r"^[A-Za-z0-9_-]{11}$")
    title: Optional[str] = Field(default=None, max_length=500)
    channel_title: Optional[str] = Field(default=None, max_length=200)
    error: Optional[str] = Field(default=None, max_length=500)


class FinishBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    error: Optional[str] = Field(default=None, max_length=1000)
    transcript_failures: List[TranscriptFailure] = Field(default_factory=list, max_length=500)


async def _running_run(store: auto.YouTubeAutoImportStore, run_id: str) -> Dict[str, Any]:
    run = await asyncio.to_thread(store.get_run, run_id)
    if not run:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "run_not_found")
    if run["status"] != "running":
        raise HTTPException(status.HTTP_409_CONFLICT, "run_not_running")
    return run


@worker_router.post("/claim", dependencies=[Depends(verify_worker)])
async def claim(
    body: ClaimBody, store: auto.YouTubeAutoImportStore = Depends(get_store)
) -> Dict[str, Any]:
    run = await asyncio.to_thread(store.claim, auto._now(), body.hostname, body.version)
    return {"run": run}


@worker_router.post("/runs/{run_id}/heartbeat", dependencies=[Depends(verify_worker)])
async def heartbeat(
    run_id: str, body: Progress, store: auto.YouTubeAutoImportStore = Depends(get_store)
) -> Dict[str, Any]:
    if not await asyncio.to_thread(store.heartbeat, run_id, auto._now(), body.model_dump()):
        raise HTTPException(status.HTTP_409_CONFLICT, "run_not_running")
    return {"ok": True}


@worker_router.post("/runs/{run_id}/videos", dependencies=[Depends(verify_worker)])
async def import_video(
    run_id: str,
    body: VideoBody,
    store: auto.YouTubeAutoImportStore = Depends(get_store),
    opinions: YouTubeStockOpinionService = Depends(get_opinions),
) -> Dict[str, Any]:
    run = await _running_run(store, run_id)
    video = body.model_dump(exclude={"transcript"})
    return await auto.import_video(store, opinions, run, video, body.transcript)


@worker_router.post("/runs/{run_id}/finish", dependencies=[Depends(verify_worker)])
async def finish(
    run_id: str, body: FinishBody, store: auto.YouTubeAutoImportStore = Depends(get_store)
) -> Dict[str, Any]:
    run = await _running_run(store, run_id)
    failures = [item.model_dump() for item in body.transcript_failures]
    finished = await asyncio.to_thread(store.finish, run, auto._now(), body.error, failures)
    return {"run": finished}
