"""Public timeline and admin-only import, edit and delete for key-person updates and portraits."""

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Request
from postgrest.exceptions import APIError
from pydantic import ValidationError

from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
from app.schemas.person_updates import ID_PATTERN, PersonAvatar, person_key, validate_import
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


@admin_router.put("/avatars")
async def set_avatar(
    request: Request,
    body: dict = Body(...),
    _admin: str = Depends(verify_admin),
    db: Client = Depends(get_supabase_service),
):
    """Set or clear (avatar_url: null) one person's portrait. Imported updates never touch it."""
    chinese = not request.headers.get("accept-language", "").lower().startswith("en")
    try:
        avatar = PersonAvatar.model_validate(body)
    except ValidationError as exc:
        raise HTTPException(
            422,
            "头像须为不含账号密码的绝对 HTTPS 链接。"
            if chinese and any(error["loc"] == ("avatar_url",) for error in exc.errors())
            else ("人物名不能为空。" if chinese else "Enter a name and an HTTPS image URL."),
        ) from exc
    key = person_key(avatar.person)
    table = db.table("person_avatars")
    query = (
        table.upsert(
            {
                "person_key": key,
                "avatar_url": avatar.avatar_url,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="person_key",
        )
        if avatar.avatar_url
        else table.delete().eq("person_key", key)
    )
    try:
        await asyncio.to_thread(query.execute)
    except APIError as exc:
        logger.exception("Person avatar save failed")
        raise HTTPException(503, detail=exc.message) from exc
    return {"person_key": key, "avatar_url": avatar.avatar_url}


@admin_router.delete("/{item_id}")
async def delete(
    request: Request,
    item_id: str = Path(max_length=128, pattern=ID_PATTERN),
    _admin: str = Depends(verify_admin),
    db: Client = Depends(get_supabase_service),
):
    chinese = not request.headers.get("accept-language", "").lower().startswith("en")
    try:
        response = await asyncio.to_thread(
            db.table("person_updates").delete().eq("id", item_id).execute
        )
    except APIError as exc:
        logger.exception("Person update delete failed")
        raise HTTPException(503, detail=exc.message) from exc
    if not response.data:
        raise HTTPException(404, "这条动态不存在或已删除。" if chinese else "Update not found.")
    return {"id": item_id}


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
                break
            offset += READ_BATCH
    except APIError as exc:
        logger.exception("Person updates timeline failed")
        raise HTTPException(503, detail="Person updates are temporarily unavailable") from exc
    portraits = person_avatars(db)
    for item in items:
        item["profile_avatar_url"] = portraits.get(person_key(item["person"]))
    return {"items": items}


def person_avatars(db: Client) -> dict[str, str]:
    """Admin-set portraits by person key. A failure only costs the portraits, not the timeline."""
    try:
        rows = db.table("person_avatars").select("person_key,avatar_url").execute().data
    except APIError:
        logger.exception("Person avatars unavailable")
        return {}
    return {row["person_key"]: row["avatar_url"] for row in rows}
