"""Daily Xiaohongshu sentiment digest: public reads and administrator JSON import."""

import asyncio
import logging
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from postgrest.exceptions import APIError

from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
from app.schemas.xhs_sentiment import validate_batch
from app.services.xhs_sentiment_store import TABLE, upsert_days
from supabase import Client

router = APIRouter(prefix="/xhs-sentiment", tags=["Xiaohongshu sentiment"])
admin_router = APIRouter(prefix="/xhs-sentiment", tags=["Admin Xiaohongshu sentiment"])
logger = logging.getLogger(__name__)

MAX_BYTES = 4 * 1024 * 1024
LOS_ANGELES = ZoneInfo("America/Los_Angeles")
DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
SUMMARY_COLUMNS = "date_pt,captured_at,sample,sentiment"
DETAIL_COLUMNS = "date_pt,captured_at,sample,sentiment,topics,rumors,limitations"


def _chinese(request: Request) -> bool:
    return not request.headers.get("accept-language", "").lower().startswith("en")


async def _validated(request: Request) -> list[dict]:
    chinese = _chinese(request)
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_BYTES:
            raise HTTPException(
                413,
                "JSON 超过 4 MB，请分批导入。"
                if chinese
                else "JSON exceeds 4 MB. Import fewer days.",
            )
        body.extend(chunk)
    days, errors = validate_batch(bytes(body), datetime.now(LOS_ANGELES).date(), chinese)
    if errors:
        raise HTTPException(422, detail="\n".join(errors))
    return days


def _summary(row: dict) -> dict:
    """Trend rows carry counts only; topics stay on the per-day read."""
    sample = row["sample"]
    return {
        "date_pt": row["date_pt"],
        "captured_at": row["captured_at"],
        "posts_scanned": sample["posts_scanned"],
        "classified_by": sample["classified_by"],
        "latest_window_hours": sample.get("latest_window_hours"),
        "sentiment": {"all": row["sentiment"]["all"], "latest": row["sentiment"].get("latest")},
    }


@admin_router.post("/validate")
async def preview(
    request: Request,
    _admin: str = Depends(verify_admin),
    db: Client = Depends(get_supabase_service),
):
    days = await _validated(request)
    dates = [day["date_pt"] for day in days]
    try:
        existing = await asyncio.to_thread(
            db.table(TABLE).select("date_pt").in_("date_pt", dates).execute
        )
    except APIError as exc:
        logger.exception("Xiaohongshu sentiment lookup failed")
        raise HTTPException(503, detail=exc.message) from exc
    saved = {row["date_pt"] for row in existing.data}
    return {"days": [{"digest": day, "replaces_existing": day["date_pt"] in saved} for day in days]}


@admin_router.post("")
async def save(
    request: Request,
    admin_id: str = Depends(verify_admin),
    db: Client = Depends(get_supabase_service),
):
    days = await _validated(request)
    try:
        await asyncio.to_thread(upsert_days, db, days, admin_id)
    except APIError as exc:
        logger.exception("Xiaohongshu sentiment import failed")
        raise HTTPException(503, detail=exc.message) from exc
    return {
        "dates": [day["date_pt"] for day in days],
        "topics": sum(len(day["topics"]) for day in days),
    }


@router.get("/days")
def days(
    limit: int = Query(30, ge=1, le=90),
    db: Client = Depends(get_supabase_service),
):
    try:
        rows = (
            db.table(TABLE)
            .select(SUMMARY_COLUMNS)
            .order("date_pt", desc=True)
            .limit(limit)
            .execute()
            .data
        )
    except APIError as exc:
        logger.exception("Xiaohongshu sentiment history failed")
        raise HTTPException(503, detail="Xiaohongshu sentiment is temporarily unavailable") from exc
    return {"days": [_summary(row) for row in rows]}


@router.get("/days/{date_pt}")
def day(
    date_pt: str = Path(pattern=DAY_PATTERN),
    db: Client = Depends(get_supabase_service),
):
    try:
        date.fromisoformat(date_pt)
    except ValueError as exc:
        raise HTTPException(422, detail="Use YYYY-MM-DD") from exc
    try:
        rows = db.table(TABLE).select(DETAIL_COLUMNS).eq("date_pt", date_pt).limit(1).execute().data
    except APIError as exc:
        logger.exception("Xiaohongshu sentiment day failed")
        raise HTTPException(503, detail="Xiaohongshu sentiment is temporarily unavailable") from exc
    if not rows:
        raise HTTPException(404, detail="No digest for this date")
    return rows[0]
