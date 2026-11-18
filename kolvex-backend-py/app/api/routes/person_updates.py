"""Public timeline and admin-only manual import for key-person updates."""

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from postgrest.exceptions import APIError

from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
from app.schemas.person_updates import validate_import
from supabase import Client

router = APIRouter(prefix="/person-updates", tags=["Person updates"])
admin_router = APIRouter(prefix="/person-updates", tags=["Admin person updates"])
logger = logging.getLogger(__name__)
MAX_BYTES = 2 * 1024 * 1024
READ_BATCH = 500


async def validated_items(request: Request) -> list[dict]:
    chinese = not request.headers.get("accept-language", "").lower().startswith("en")
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_BYTES:
            raise HTTPException(
                413,
                "JSON 超过 2 MB，请缩小后重试。" if chinese else "JSON exceeds 2 MB.",
            )
        body.extend(chunk)
    items, errors = validate_import(bytes(body), chinese)
    if errors:
        raise HTTPException(422, detail="\n".join(errors))
    return items


@admin_router.post("/validate")
async def preview(request: Request, _admin: str = Depends(verify_admin)):
    items = await validated_items(request)
    items.sort(
        key=lambda item: (datetime.fromisoformat(item["published_at"]), item["id"]), reverse=True
    )
    return {"items": items}


@admin_router.post("")
async def save(
    request: Request,
    _admin: str = Depends(verify_admin),
    db: Client = Depends(get_supabase_service),
):
    items = await validated_items(request)
    try:
        await asyncio.to_thread(db.table("person_updates").upsert(items, on_conflict="id").execute)
    except APIError as exc:
        logger.exception("Person updates import failed")
        raise HTTPException(503, detail=exc.message) from exc
    return {"count": len(items), "ids": [item["id"] for item in items]}


@router.get("")
def timeline(db: Client = Depends(get_supabase_service)):
    items = []
    offset = 0
    try:
        while True:
            response = (
                db.table("person_updates")
                .select(
                    "id,person,person_cn,published_at,title,summary,source_url,impact,tags,tickers,avatar_url,image_url,image_alt"
                )
                .order("published_at", desc=True)
                .order("id", desc=True)
                .range(offset, offset + READ_BATCH - 1)
                .execute()
            )
            items.extend(response.data)
            if len(response.data) < READ_BATCH:
                return {"items": items}
            offset += READ_BATCH
    except APIError as exc:
        logger.exception("Person updates timeline failed")
        raise HTTPException(503, detail="Person updates are temporarily unavailable") from exc
