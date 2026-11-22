"""Latest congressional trade disclosures: signed-in search, plus a public newest-page read."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service
from supabase import Client

router = APIRouter(prefix="/congress", tags=["Congress"])


def _trades(db: Client, ticker, member, chamber, direction, page, limit) -> dict:
    query = db.table("congress_trades").select("*")
    if ticker:
        query = query.eq("ticker", ticker.upper())
    if member and member.strip():
        # PostgREST accepts '*' as an alias for the SQL LIKE wildcard.
        name = (
            member.strip()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
            .replace("*", "\\*")
        )
        query = query.ilike("member_name", f"%{name}%")
    if chamber:
        query = query.eq("chamber", chamber)
    if direction:
        query = query.eq("direction", direction)
    start = (page - 1) * limit
    rows = (
        query.order("filed_date", desc=True)
        .order("id", desc=True)
        .range(start, start + limit)
        .execute()
        .data
    )
    synced = bool(rows) or bool(
        db.table("congress_trade_sync").select("fetched_at").limit(1).execute().data
    )
    return {"trades": rows[:limit], "has_more": len(rows) > limit and page < 1000, "synced": synced}


@router.get("/trades", dependencies=[Depends(get_current_user_id)])
def congress_trades(
    response: Response,
    ticker: str | None = Query(None, pattern=r"^[A-Za-z0-9.^=-]{1,20}$"),
    member: str | None = Query(None, max_length=100),
    chamber: Literal["house", "senate"] | None = None,
    direction: Literal["buy", "sell", "exchange", "other"] | None = None,
    page: int = Query(1, ge=1, le=1000),
    limit: int = Query(25, ge=1, le=100),
    db: Client = Depends(get_supabase_service),
):
    response.headers["Cache-Control"] = "private, no-store"
    return _trades(db, ticker, member, chamber, direction, page, limit)


@router.get("/public/trades")
def public_congress_trades(
    response: Response,
    ticker: str | None = Query(None, pattern=r"^[A-Za-z0-9.^=-]{1,20}$"),
    limit: int = Query(100, ge=1, le=100),
    db: Client = Depends(get_supabase_service),
):
    """Latest disclosures without sign-in, for the public reading page. They are public filings
    (STOCK Act); only the newest page is served, and shared caches may keep it for ten minutes."""
    response.headers["Cache-Control"] = "public, max-age=600"
    return _trades(db, ticker, None, None, None, 1, limit)
