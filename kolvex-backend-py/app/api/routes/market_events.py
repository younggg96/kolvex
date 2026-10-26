"""Authenticated calendar reads and administrator-only JSON authoring."""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from supabase import Client
from app.api.dependencies.auth import get_current_user_id, verify_admin
from app.core.supabase import get_supabase_service
from app.services.market_events import Envelope, list_events, save_events

router = APIRouter(tags=["Market calendar"])
logger = logging.getLogger(__name__)

async def payload(request):
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 1024 * 1024:
            raise HTTPException(413, "JSON 超过 1 MB。")
    try:
        return Envelope.model_validate(json.loads(body)).model_dump(mode="json")
    except (ValidationError, ValueError, TypeError) as exc:
        message = "；".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()[:8]) if isinstance(exc, ValidationError) else "JSON 格式错误。"
        raise HTTPException(422, message) from exc

def listing(db, **kwargs):
    try:
        return list_events(db, **kwargs)
    except Exception as exc:
        logger.exception("Market calendar read failed")
        raise HTTPException(503, "事件日历暂不可用，请确认数据库迁移已执行后重试。") from exc

@router.get("/market/events")
def calendar(user_id: str = Depends(get_current_user_id), db: Client = Depends(get_supabase_service)):
    return listing(db)

@router.get("/admin/market-events")
def admin_list(page: int = Query(1, ge=1, le=100000), admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    return listing(db, admin=True, page=page)

@router.post("/admin/market-events/validate")
async def validate(request: Request, admin_id: str = Depends(verify_admin)):
    return {"payload": await payload(request)}

@router.post("/admin/market-events")
async def save(request: Request, admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    document = await payload(request)
    try:
        return await run_in_threadpool(save_events, db, document, admin_id)
    except Exception as exc:
        logger.exception("Market calendar import failed")
        raise HTTPException(503, "保存失败，请确认数据库迁移已执行后重试。") from exc
