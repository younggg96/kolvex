"""Admin-configurable scheduled emails (daily brief, 13F holdings changes) sent through Resend."""
import asyncio
import logging
import os
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

from app.core.supabase import get_supabase_service
from app.services import email_digest

logger = logging.getLogger(__name__)
TABLE = "email_settings"
DRAFTS = "email_drafts"
KINDS = ("daily_brief", "holdings_change")
RESEND_URL = "https://api.resend.com/emails"
BATCH = 100
EDITABLE = {"enabled", "send_time", "timezone", "weekdays", "from_name", "from_email", "reply_to", "subject_template", "content"}


def resend_configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY"))


def validate_settings(values: dict, kind: str = "daily_brief") -> dict:
    """Returns only editable, validated fields; raises ValueError with a user-facing message."""
    clean = {k: v for k, v in values.items() if k in EDITABLE}
    if "send_time" in clean:
        try:
            datetime.strptime(clean["send_time"], "%H:%M")
        except (ValueError, TypeError) as exc:
            raise ValueError("发送时间格式应为 HH:MM") from exc
    if "timezone" in clean:
        try:
            ZoneInfo(clean["timezone"])
        except (ZoneInfoNotFoundError, ValueError, TypeError) as exc:
            raise ValueError("时区无效，请使用 IANA 时区，如 America/New_York") from exc
    if "weekdays" in clean:
        days = clean["weekdays"]
        if not isinstance(days, list) or not all(isinstance(d, int) and 0 <= d <= 6 for d in days):
            raise ValueError("发送日必须是 0-6（周一到周日）")
        clean["weekdays"] = sorted(set(days))
    for key in ("from_name", "from_email", "reply_to", "subject_template"):
        if key in clean:
            clean[key] = str(clean[key]).strip()
    for key in ("from_email", "reply_to"):
        if clean.get(key) and "@" not in clean[key]:
            raise ValueError("邮箱地址格式不正确")
    if "enabled" in clean:
        clean["enabled"] = bool(clean["enabled"])
    if "content" in clean:
        clean["content"] = email_digest.validate_content(kind, clean["content"])
    if clean.get("enabled") and not clean.get("from_email", "x"):
        raise ValueError("启用前请填写发件邮箱")
    return clean


def list_settings(db=None) -> list[dict]:
    db = db or get_supabase_service()
    rows = db.table(TABLE).select("*").order("kind").execute().data or []
    for row in rows:
        row["content"] = email_digest.merge_content(row["kind"], row.get("content"))
    return rows


def update_settings(kind: str, values: dict, db=None) -> dict:
    db = db or get_supabase_service()
    if kind not in KINDS:
        raise ValueError("未知邮件类型")
    clean = validate_settings(values, kind)
    current = db.table(TABLE).select("from_email").eq("kind", kind).single().execute().data
    if clean.get("enabled") and not (clean.get("from_email") or current["from_email"]):
        raise ValueError("启用前请填写发件邮箱")
    clean["updated_at"] = datetime.now(timezone.utc).isoformat()
    return db.table(TABLE).update(clean).eq("kind", kind).execute().data[0]


def is_due(row: dict, now_utc: datetime) -> bool:
    if not row["enabled"]:
        return False
    local = now_utc.astimezone(ZoneInfo(row["timezone"]))
    if local.weekday() not in (row["weekdays"] or []):
        return False
    if row.get("last_sent_on") == local.date().isoformat():
        return False
    return local.strftime("%H:%M") >= row["send_time"]


def recipients(db, delivery: dict | None = None) -> list[str]:
    """Subscribers (users who turned on email notifications), every registered user, or a fixed list."""
    delivery = delivery or {"audience": "subscribers", "emails": []}
    if delivery["audience"] == "custom":
        return sorted(set(delivery["emails"]))
    emails, start = [], 0
    while True:
        query = db.table("user_profiles").select("email").not_.is_("email", "null")
        if delivery["audience"] != "all":
            query = query.eq("email_notifications_enabled", True)
        page = (query.range(start, start + 999).execute().data or [])
        emails += [r["email"] for r in page if r.get("email")]
        if len(page) < 1000:
            return sorted(set(emails))
        start += 1000


async def send_batch(client: httpx.AsyncClient, row: dict, subject: str, body: str, to: list[str]):
    sender = f"{row['from_name']} <{row['from_email']}>" if row["from_name"] else row["from_email"]
    headers = {"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}"}
    for start in range(0, len(to), BATCH):
        # Resend batch API: one message per recipient so addresses are never shared.
        payload = [{"from": sender, "to": [addr], "subject": subject, "html": body,
                    **({"reply_to": row["reply_to"]} if row["reply_to"] else {})} for addr in to[start:start + BATCH]]
        response = await client.post(f"{RESEND_URL}/batch", json=payload, headers=headers)
        if response.is_error:
            # Resend explains rejections (unverified domain, test-mode recipient) in the body.
            try:
                reason = response.json().get("message") or response.text
            except ValueError:
                reason = response.text
            raise RuntimeError(f"Resend {response.status_code}：{reason[:300]}")


def local_today(row: dict) -> date:
    return datetime.now(ZoneInfo(row["timezone"])).date()


def render(row: dict, content: dict | None = None, db=None):
    """(subject, html) for this kind with the given or saved content, or None when there is nothing to send."""
    db = db or get_supabase_service()
    content = email_digest.validate_content(row["kind"], content) if content is not None else row["content"]
    since = row.get("last_run_at") if row["kind"] == "holdings_change" else None
    return email_digest.build(db, row["kind"], content, row["subject_template"], local_today(row), since)


async def run_kind(row: dict, test_to: str | None = None) -> dict:
    """Test send of the current content to one address; records nothing."""
    if not resend_configured():
        raise RuntimeError("未配置 RESEND_API_KEY")
    built = await asyncio.to_thread(render, row)
    if not built:
        return {"sent": 0, "skipped": "没有可发送的内容"}
    subject, body = built
    async with httpx.AsyncClient(timeout=30) as client:
        await send_batch(client, row, "[测试] " + subject, body, [test_to])
    return {"sent": 1, "skipped": None}


def save_draft(row: dict, db=None) -> dict | None:
    """Builds today's email and stores it for approval, replacing a pending draft for the same day."""
    db = db or get_supabase_service()
    built = render(row, db=db)
    if not built:
        return None
    subject, body = built
    today = local_today(row).isoformat()
    existing = (db.table(DRAFTS).select("id,status").eq("kind", row["kind"]).eq("send_date", today)
                .limit(1).execute().data)
    if existing and existing[0]["status"] == "sent":
        raise ValueError("今天的邮件已经发送过")
    values = {"kind": row["kind"], "send_date": today, "subject": subject, "html": body, "status": "pending",
              "created_at": datetime.now(timezone.utc).isoformat()}
    return db.table(DRAFTS).upsert(values, on_conflict="kind,send_date").execute().data[0]


def latest_draft(kind: str, db=None) -> dict | None:
    db = db or get_supabase_service()
    rows = (db.table(DRAFTS).select("*").eq("kind", kind).order("send_date", desc=True).limit(1).execute().data)
    return rows[0] if rows else None


def audience_counts(db=None) -> dict:
    db = db or get_supabase_service()
    def count(subscribers: bool) -> int:
        query = db.table("user_profiles").select("id", count="exact").not_.is_("email", "null")
        if subscribers:
            query = query.eq("email_notifications_enabled", True)
        return query.limit(1).execute().count or 0
    return {"subscribers": count(True), "all": count(False)}


async def send_now(row: dict, admin_id: str | None) -> dict:
    """Builds today's email from the saved content and sends it at once (one send per kind per day)."""
    db = get_supabase_service()
    draft = await asyncio.to_thread(save_draft, row, db)
    if not draft:
        raise ValueError("今天还没有可发送的内容")
    return await approve_draft(draft["id"], admin_id)


async def approve_draft(draft_id: str, admin_id: str | None) -> dict:
    db = get_supabase_service()
    rows = await asyncio.to_thread(lambda: db.table(DRAFTS).select("*").eq("id", draft_id).limit(1).execute().data)
    if not rows:
        raise LookupError("草稿不存在")
    draft = rows[0]
    if draft["status"] != "pending":
        raise ValueError("这封邮件已处理")
    if not resend_configured():
        raise RuntimeError("未配置 RESEND_API_KEY")
    row = next(r for r in await asyncio.to_thread(list_settings, db) if r["kind"] == draft["kind"])
    if not row["from_email"]:
        raise ValueError("请先保存发件邮箱")
    # Claim the draft first so a double click cannot send twice.
    claimed = await asyncio.to_thread(lambda: db.table(DRAFTS).update({"status": "sent", "decided_at": datetime.now(timezone.utc).isoformat(), "decided_by": admin_id})
                                      .eq("id", draft_id).eq("status", "pending").execute().data)
    if not claimed:
        raise ValueError("这封邮件已处理")
    to = await asyncio.to_thread(recipients, db, row["content"]["delivery"])
    now = datetime.now(timezone.utc).isoformat()
    try:
        if to:
            async with httpx.AsyncClient(timeout=30) as client:
                await send_batch(client, row, draft["subject"], draft["html"], to)
    except Exception as exc:
        await asyncio.to_thread(lambda: db.table(DRAFTS).update({"status": "failed", "error": str(exc)[:500]}).eq("id", draft_id).execute())
        await asyncio.to_thread(lambda: db.table(TABLE).update({"last_run_at": now, "last_status": "failed", "last_error": str(exc)[:500]}).eq("kind", row["kind"]).execute())
        raise
    await asyncio.to_thread(lambda: db.table(DRAFTS).update({"recipient_count": len(to)}).eq("id", draft_id).execute())
    await asyncio.to_thread(lambda: db.table(TABLE).update({"last_run_at": now, "last_sent_on": draft["send_date"], "last_status": "sent",
                                                            "last_error": None, "last_recipient_count": len(to)}).eq("kind", row["kind"]).execute())
    return {"sent": len(to)}


def reject_draft(draft_id: str, admin_id: str, db=None) -> dict:
    db = db or get_supabase_service()
    rows = (db.table(DRAFTS).update({"status": "rejected", "decided_at": datetime.now(timezone.utc).isoformat(), "decided_by": admin_id})
            .eq("id", draft_id).eq("status", "pending").execute().data)
    if not rows:
        raise ValueError("这封邮件已处理")
    return rows[0]


async def process_due(now_utc: datetime | None = None):
    """At the send time, prepares today's email as a draft; an admin approves it before anything is sent."""
    db = get_supabase_service()
    now_utc = now_utc or datetime.now(timezone.utc)
    for row in await asyncio.to_thread(list_settings, db):
        if not is_due(row, now_utc):
            continue
        today = now_utc.astimezone(ZoneInfo(row["timezone"])).date().isoformat()
        drafted = await asyncio.to_thread(lambda: db.table(DRAFTS).select("id").eq("kind", row["kind"]).eq("send_date", today).limit(1).execute().data)
        if drafted:
            continue
        if row["content"]["delivery"]["mode"] == "auto":
            try:
                await send_now(row, None)
            except ValueError as exc:
                # Nothing to send yet (e.g. brief not published); retry on the next tick.
                await asyncio.to_thread(db.table(TABLE).update({"last_run_at": now_utc.isoformat(), "last_status": "skipped",
                                                                "last_error": str(exc)}).eq("kind", row["kind"]).execute)
            except Exception:  # noqa: BLE001 — approve_draft already recorded the failure
                logger.exception("Scheduled email %s failed", row["kind"])
            continue
        update = {"last_run_at": now_utc.isoformat()}
        try:
            draft = await asyncio.to_thread(save_draft, row, db)
            if draft:
                update.update(last_status="awaiting_approval", last_error=None)
            else:
                # Nothing to send yet (e.g. brief not published); retry on the next tick.
                update.update(last_status="skipped", last_error="没有可发送的内容")
        except Exception as exc:  # noqa: BLE001 — record and retry next tick
            logger.exception("Scheduled email %s failed", row["kind"])
            update.update(last_status="failed", last_error=str(exc)[:500])
        await asyncio.to_thread(db.table(TABLE).update(update).eq("kind", row["kind"]).execute)


async def run_email_worker(interval: int = 60):
    await asyncio.sleep(20)
    while True:
        try:
            await process_due()
        except Exception:
            logger.exception("Email worker tick failed")
        await asyncio.sleep(interval)
