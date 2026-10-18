"""Admin-only immutable briefing imports. Identical retries are idempotent."""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import ValidationError
from postgrest.exceptions import APIError
from supabase import Client
from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
from app.services.daily_briefs import Envelope

router = APIRouter(prefix="/briefs")
logger = logging.getLogger(__name__)
MAX_BYTES = 2 * 1024 * 1024


async def payload(request: Request):
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_BYTES:
            raise HTTPException(413, "JSON 超过 2 MB，请缩小后重试。")
    try:
        return Envelope.model_validate(json.loads(body)).model_dump(mode="json")
    except (ValidationError, ValueError, TypeError) as exc:
        if isinstance(exc, ValidationError):
            message = "；".join(f"{'.'.join(map(str, e['loc'])) or 'JSON'}: {e['msg']}" for e in exc.errors()[:12])
        else:
            message = "JSON 格式错误，请检查引号、逗号和括号。"
        raise HTTPException(422, message) from exc


@router.post("/validate")
async def validate(request: Request, admin_id: str = Depends(verify_admin)):
    return {"payload": await payload(request)}


@router.post("")
async def save(request: Request, admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    document = await payload(request)
    meta = document["brief"]
    try:
        db.table("daily_briefs").insert({"id": meta["id"], "brief_date": meta["date"], "brief_type": meta["type"], "title": meta["title"], "headline": meta["headline"], "payload": document, "imported_by": admin_id}).execute()
        return {"id": meta["id"], "already_exists": False}
    except APIError as exc:
        if exc.code == "23505":
            existing = db.table("daily_briefs").select("payload").eq("id", meta["id"]).single().execute()
            if existing.data and existing.data["payload"] == document:
                return {"id": meta["id"], "already_exists": True}
            raise HTTPException(409, "同一 ID 已有不同内容，未覆盖原简报。") from exc
        logger.exception("Brief save failed")
        raise HTTPException(503, "保存失败，请确认早晚报数据库迁移已应用后重试。") from exc


@router.get("")
async def listing(page: int = Query(1, ge=1), admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    try:
        result = db.table("daily_briefs").select("id,brief_date,brief_type,title,headline,created_at", count="exact").order("brief_date", desc=True).order("id").range((page - 1) * 10, page * 10 - 1).execute()
        return {"items": result.data, "total": result.count or 0}
    except APIError as exc:
        logger.exception("Brief list failed")
        raise HTTPException(503, "读取失败，请确认早晚报数据库迁移已应用后重试。") from exc


@router.get("/{brief_id}")
async def detail(brief_id: str, admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    try:
        result = db.table("daily_briefs").select("payload").eq("id", brief_id).limit(1).execute()
    except APIError as exc:
        logger.exception("Brief read failed")
        raise HTTPException(503, "读取失败，请稍后重试。") from exc
    if not result.data:
        raise HTTPException(404, "简报不存在")
    return {"payload": result.data[0]["payload"]}
