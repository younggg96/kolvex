"""Supabase persistence for options-activity runs (service role only)."""

import asyncio
from datetime import date
from typing import Optional

TABLE = "options_activity_runs"
LIST_COLUMNS = "id,trade_date,session,run_at,data_date"
FULL_COLUMNS = "id,trade_date,session,status,run_at,data_date,universe_size,failed_symbols,payload,summary,model_id,prompt_version"


async def _execute(query):
    return (await asyncio.to_thread(query.execute)).data or []


async def recent_payloads(db, session: str, before: date, limit: int = 7) -> list[dict]:
    """Payloads of the latest successful runs in `session` before `before`, newest first (baselines)."""
    rows = await _execute(
        db.table(TABLE).select("payload").eq("status", "ok").eq("session", session)
        .lt("trade_date", before.isoformat()).order("trade_date", desc=True).limit(limit)
    )
    return [r["payload"] for r in rows if isinstance(r.get("payload"), dict)]


async def existing(db, trade_date: date, session: str) -> Optional[dict]:
    rows = await _execute(
        db.table(TABLE).select("id,status,data_date").eq("trade_date", trade_date.isoformat()).eq("session", session).limit(1)
    )
    return rows[0] if rows else None


async def has_data_date(db, session: str, data_date: str) -> bool:
    rows = await _execute(
        db.table(TABLE).select("id").eq("status", "ok").eq("session", session).eq("data_date", data_date).limit(1)
    )
    return bool(rows)


async def save(db, row: dict) -> dict:
    rows = await _execute(db.table(TABLE).upsert(row, on_conflict="trade_date,session"))
    return rows[0] if rows else row


async def runs_for_date(db, trade_date: str) -> list[dict]:
    """Runs of one day with their market totals, oldest first (for the session comparison chart)."""
    return await _execute(
        db.table(TABLE).select(f"{LIST_COLUMNS},market:payload->market").eq("status", "ok")
        .eq("trade_date", trade_date).order("run_at")
    )


async def recent_dates(db, limit: int = 14) -> list[str]:
    rows = await _execute(
        db.table(TABLE).select("trade_date").eq("status", "ok").order("trade_date", desc=True).limit(limit * 3)
    )
    dates: list[str] = []
    for row in rows:
        if row["trade_date"] not in dates:
            dates.append(row["trade_date"])
    return dates[:limit]


async def list_all(db, limit: int = 20) -> list[dict]:
    """Newest runs of every status, for the admin tab."""
    return await _execute(
        db.table(TABLE)
        .select("id,trade_date,session,status,run_at,data_date,universe_size,failed_symbols,model_id,summary_source:summary->>source")
        .order("trade_date", desc=True).order("run_at", desc=True).limit(limit)
    )


async def latest_candidates(db) -> Optional[dict]:
    """The newest successful run's identity and AI candidates, for the admin tab."""
    rows = await _execute(
        db.table(TABLE).select("id,trade_date,session,candidates:summary->candidates").eq("status", "ok")
        .order("trade_date", desc=True).order("run_at", desc=True).limit(1)
    )
    return rows[0] if rows else None


async def update_summary(db, run_id: str, summary: dict) -> None:
    await _execute(db.table(TABLE).update({"summary": summary}).eq("id", run_id))


async def get_run(db, run_id: Optional[str] = None) -> Optional[dict]:
    query = db.table(TABLE).select(FULL_COLUMNS).eq("status", "ok")
    query = query.eq("id", run_id) if run_id else query.order("trade_date", desc=True).order("run_at", desc=True)
    rows = await _execute(query.limit(1))
    return rows[0] if rows else None
