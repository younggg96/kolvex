"""Admin-only configuration of scheduled emails."""
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase import Client
from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
from app.services import email_digest, email_service

router = APIRouter(prefix="/email-settings")


class SettingsUpdate(BaseModel):
    enabled: bool | None = None
    send_time: str | None = None
    timezone: str | None = None
    weekdays: list[int] | None = None
    from_name: str | None = Field(None, max_length=100)
    from_email: str | None = Field(None, max_length=200)
    reply_to: str | None = Field(None, max_length=200)
    subject_template: str | None = Field(None, max_length=200)
    content: dict | None = None


class TestSend(BaseModel):
    to: str = Field(max_length=200)


class Preview(BaseModel):
    content: dict | None = None


async def setting(kind: str, db: Client) -> dict:
    rows = [r for r in await asyncio.to_thread(email_service.list_settings, db) if r["kind"] == kind]
    if not rows:
        raise HTTPException(404, "未知邮件类型")
    return rows[0]


@router.get("")
async def read(admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    return {"settings": await asyncio.to_thread(email_service.list_settings, db),
            "audience_counts": await asyncio.to_thread(email_service.audience_counts, db),
            "resend_configured": email_service.resend_configured()}


@router.get("/creators")
async def creators(admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    return {"creators": await asyncio.to_thread(email_digest.list_creators, db)}


@router.put("/{kind}")
async def save(kind: str, body: SettingsUpdate, admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    try:
        return await asyncio.to_thread(email_service.update_settings, kind, body.model_dump(exclude_none=True), db)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/{kind}/test")
async def test(kind: str, body: TestSend, admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    if "@" not in body.to:
        raise HTTPException(422, "测试收件邮箱格式不正确")
    row = await setting(kind, db)
    if not row["from_email"]:
        raise HTTPException(422, "请先保存发件邮箱")
    try:
        return await email_service.run_kind(row, test_to=body.to)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"发送失败：{exc}") from exc


@router.post("/{kind}/preview")
async def preview(kind: str, body: Preview, admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    """Renders unsaved content so the admin page can show exactly what recipients would get."""
    row = await setting(kind, db)
    try:
        built = await asyncio.to_thread(email_service.render, row, body.content, db)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    if not built:
        return {"subject": None, "html": None, "empty": "今天还没有可发送的内容"}
    return {"subject": built[0], "html": built[1], "empty": None}


@router.get("/{kind}/draft")
async def draft(kind: str, admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    await setting(kind, db)
    return {"draft": await asyncio.to_thread(email_service.latest_draft, kind, db)}


@router.post("/{kind}/draft")
async def regenerate(kind: str, admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    row = await setting(kind, db)
    try:
        saved = await asyncio.to_thread(email_service.save_draft, row, db)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    if not saved:
        raise HTTPException(422, "今天还没有可发送的内容")
    return {"draft": saved}


@router.post("/drafts/{draft_id}/approve")
async def approve(draft_id: str, admin_id: str = Depends(verify_admin)):
    try:
        return await email_service.approve_draft(draft_id, admin_id)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"发送失败：{exc}") from exc


@router.post("/drafts/{draft_id}/reject")
async def reject(draft_id: str, admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    try:
        return await asyncio.to_thread(email_service.reject_draft, draft_id, admin_id, db)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.post("/{kind}/send")
async def send(kind: str, admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    """Sends today's email now with the saved content and audience."""
    row = await setting(kind, db)
    try:
        return await email_service.send_now(row, admin_id)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"发送失败：{exc}") from exc
