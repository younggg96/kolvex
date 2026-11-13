"""Admin-configurable scheduled emails (daily brief, 13F holdings changes) sent through Resend."""
import asyncio
import html
import logging
import os
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)
TABLE = "email_settings"
KINDS = ("daily_brief", "holdings_change")
RESEND_URL = "https://api.resend.com/emails"
BATCH = 100
EDITABLE = {"enabled", "send_time", "timezone", "weekdays", "from_name", "from_email", "reply_to", "subject_template"}


def resend_configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY"))


def validate_settings(values: dict) -> dict:
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
    if clean.get("enabled") and not clean.get("from_email", "x"):
        raise ValueError("启用前请填写发件邮箱")
    return clean


def list_settings(db=None) -> list[dict]:
    db = db or get_supabase_service()
    return db.table(TABLE).select("*").order("kind").execute().data or []


def update_settings(kind: str, values: dict, db=None) -> dict:
    db = db or get_supabase_service()
    if kind not in KINDS:
        raise ValueError("未知邮件类型")
    clean = validate_settings(values)
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


def recipients(db) -> list[str]:
    emails, start = [], 0
    while True:
        page = (db.table("user_profiles").select("email").eq("email_notifications_enabled", True)
                .not_.is_("email", "null").range(start, start + 999).execute().data or [])
        emails += [r["email"] for r in page if r.get("email")]
        if len(page) < 1000:
            return sorted(set(emails))
        start += 1000


def build_daily_brief(db, today: date, template: str):
    rows = (db.table("daily_briefs").select("id,brief_date,title,headline,payload")
            .eq("brief_date", today.isoformat()).order("created_at", desc=True).limit(1).execute().data)
    if not rows:
        return None
    brief = rows[0]
    parts = [f"<h2>{html.escape(brief['title'])}</h2><p>{html.escape(brief['headline'])}</p>"]
    for section in (brief["payload"].get("sections") or [])[:8]:
        parts.append(f"<h3>{html.escape(str(section.get('title') or section.get('section_id', '')))}</h3>")
        for item in (section.get("items") or [])[:5]:
            if isinstance(item, dict) and item.get("title"):
                parts.append(f"<p><b>{html.escape(item['title'])}</b><br>{html.escape(item.get('summary', ''))}</p>")
    site = os.getenv("FRONTEND_URL", "").rstrip("/")
    if site:
        parts.append(f'<p><a href="{html.escape(site)}/dashboard">在 Kolvex 查看完整内容</a></p>')
    subject = (template or "[Kolvex] {title}").format(title=brief["title"], date=today.isoformat())
    return subject, "".join(parts)


def build_holdings_change(db, today: date, template: str, since: str | None):
    query = db.table("institution_13f_filings").select("manager_name,period,filed,summary").eq("complete", True)
    if since:
        query = query.gte("synced_at", since)
    else:
        query = query.gte("filed", today.replace(day=1).isoformat())
    rows = query.order("filed", desc=True).limit(50).execute().data or []
    if not rows:
        return None
    lines = "".join(f"<li><b>{html.escape(r['manager_name'])}</b> · 报告期 {html.escape(str(r['period']))} · 提交 {html.escape(str(r['filed']))}</li>" for r in rows)
    return (template or "[Kolvex] 机构持仓更新 {date}").format(title="", date=today.isoformat()), f"<h2>机构 13F 持仓更新</h2><ul>{lines}</ul>"


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


async def run_kind(row: dict, test_to: str | None = None) -> dict:
    """Builds and sends one kind. With test_to, sends only to that address and records nothing."""
    db = get_supabase_service()
    if not resend_configured():
        raise RuntimeError("未配置 RESEND_API_KEY")
    local_today = datetime.now(ZoneInfo(row["timezone"])).date()
    if row["kind"] == "daily_brief":
        built = await asyncio.to_thread(build_daily_brief, db, local_today, row["subject_template"])
    else:
        built = await asyncio.to_thread(build_holdings_change, db, local_today, row["subject_template"], row.get("last_run_at"))
    if not built:
        return {"sent": 0, "skipped": "没有可发送的内容"}
    subject, body = built
    to = [test_to] if test_to else await asyncio.to_thread(recipients, db)
    if to:
        async with httpx.AsyncClient(timeout=30) as client:
            await send_batch(client, row, ("[测试] " if test_to else "") + subject, body, to)
    return {"sent": len(to), "skipped": None}


async def process_due(now_utc: datetime | None = None):
    db = get_supabase_service()
    now_utc = now_utc or datetime.now(timezone.utc)
    for row in await asyncio.to_thread(list_settings, db):
        if not is_due(row, now_utc):
            continue
        today = now_utc.astimezone(ZoneInfo(row["timezone"])).date().isoformat()
        update = {"last_run_at": now_utc.isoformat()}
        try:
            result = await run_kind(row)
            if result["skipped"]:
                # Nothing to send yet (e.g. brief not published); retry on the next tick.
                update.update(last_status="skipped", last_error=result["skipped"])
            else:
                update.update(last_sent_on=today, last_status="sent", last_error=None, last_recipient_count=result["sent"])
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
