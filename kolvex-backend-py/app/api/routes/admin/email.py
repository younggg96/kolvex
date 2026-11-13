"""Admin-only configuration of scheduled emails."""
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase import Client
from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
from app.services import email_service

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


class TestSend(BaseModel):
    to: str = Field(max_length=200)


@router.get("")
async def read(admin_id: str = Depends(verify_admin), db: Client = Depends(get_supabase_service)):
    return {"settings": await asyncio.to_thread(email_service.list_settings, db),
            "resend_configured": email_service.resend_configured()}


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
    rows = [r for r in await asyncio.to_thread(email_service.list_settings, db) if r["kind"] == kind]
    if not rows:
        raise HTTPException(404, "未知邮件类型")
    if not rows[0]["from_email"]:
        raise HTTPException(422, "请先保存发件邮箱")
    try:
        return await email_service.run_kind(rows[0], test_to=body.to)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"发送失败：{exc}") from exc
