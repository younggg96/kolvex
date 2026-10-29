"""Admin-only briefing CRUD with optimistic concurrency. Identical retries are idempotent."""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header
from pydantic import ValidationError
from postgrest.exceptions import APIError
from supabase import Client
from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
from app.services.daily_briefs import BriefType, Envelope, list_saved_briefs, read_saved_brief

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
            if existing.data and Envelope.model_validate(existing.data["payload"]).model_dump(mode="json") == document:
                return {"id": meta["id"], "already_exists": True}
            raise HTTPException(409, "同一 ID 已有不同内容，未覆盖原简报。") from exc
        logger.exception("Brief save failed")
        raise HTTPException(503, "保存失败，请确认日报数据库迁移已应用后重试。") from exc


@router.get("")
async def listing(page: int = Query(1, ge=1), brief_type: BriefType | None = Query(None, alias="type"), admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    try:
        return list_saved_briefs(db, page, brief_type)
    except APIError as exc:
        logger.exception("Brief list failed")
        raise HTTPException(503, "读取失败，请确认日报数据库迁移已应用后重试。") from exc


@router.get("/{brief_id}")
async def detail(brief_id: str, admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    try:
        return read_saved_brief(db, brief_id)
    except LookupError as exc:
        raise HTTPException(404, "简报不存在") from exc
    except (APIError, ValidationError) as exc:
        logger.exception("Brief read failed")
        raise HTTPException(503, "读取失败，请稍后重试。") from exc


def current_for_write(db, brief_id: str, revision: str):
    result = db.table("daily_briefs").select("revision").eq("id", brief_id).limit(1).execute()
    if not result.data:
        raise HTTPException(404, "简报不存在或已被删除。")
    current = result.data[0].get("revision", 1)
    if str(current) != revision:
        raise HTTPException(409, "简报已被其他管理员修改，请重新读取后再操作。")
    return current


@router.put("/{brief_id}")
async def update(brief_id: str, request: Request, revision: str = Header(..., alias="If-Match"), admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    document = await payload(request)
    meta = document["brief"]
    if meta["id"] != brief_id:
        raise HTTPException(422, "编辑时不能修改 ID、日期或期次；请新增另一份简报。")
    try:
        current = current_for_write(db, brief_id, revision)
        result = (db.table("daily_briefs").update({"title": meta["title"], "headline": meta["headline"], "payload": document, "revision": current + 1})
                  .eq("id", brief_id).eq("revision", current).execute())
        if not result.data:
            raise HTTPException(409, "简报已更新或删除，请重新读取后再操作。")
        return {"id": brief_id, "revision": str(current + 1)}
    except APIError as exc:
        logger.exception("Brief update failed")
        raise HTTPException(503, "更新失败，请稍后重试。") from exc


@router.delete("/{brief_id}")
async def delete(brief_id: str, revision: str = Header(..., alias="If-Match"), admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    try:
        current = current_for_write(db, brief_id, revision)
        result = (db.table("daily_briefs").delete().eq("id", brief_id)
                  .eq("revision", current).execute())
        if not result.data:
            raise HTTPException(409, "简报已更新或删除，请重新读取后再操作。")
        return {"id": brief_id, "deleted": True}
    except APIError as exc:
        logger.exception("Brief delete failed")
        raise HTTPException(503, "删除失败，请稍后重试。") from exc
