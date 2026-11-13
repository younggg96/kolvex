from datetime import date
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.api.dependencies.auth import get_current_user_id, verify_admin
from app.core.supabase import get_supabase_service
from app.services.options_activity import store
from app.services.options_activity.selection import parse_manual
from app.core.config import settings
from app.services.options_activity.service import analysis_state, manual_state, options_activity_service, start_analysis, start_manual_run

router = APIRouter(prefix="/market/options-activity", tags=["Market Data"])
admin_router = APIRouter(prefix="/options-activity", tags=["Admin"])


def _private(response: Response) -> None:
    # Free-tier quotes are licensed for signed-in users only; never cache publicly.
    response.headers["Cache-Control"] = "private, no-store"


@router.get("/runs")
async def list_runs(
    response: Response,
    day: Optional[date] = Query(default=None, alias="date"),
    user_id: str = Depends(get_current_user_id),
):
    """Runs of one day (defaults to the latest day with data) plus recent days for the date picker."""
    _private(response)
    db = get_supabase_service()
    dates = await store.recent_dates(db)
    target = day.isoformat() if day else (dates[0] if dates else None)
    runs = await store.runs_for_date(db, target) if target else []
    return {"date": target, "dates": dates, "runs": runs}


async def _run_response(run: Optional[dict]) -> dict:
    if not run:
        raise HTTPException(status_code=404, detail="no_runs")
    day_runs = await store.runs_for_date(get_supabase_service(), run["trade_date"])
    return {**run, "day_runs": day_runs}


@router.get("/runs/latest")
async def latest_run(response: Response, user_id: str = Depends(get_current_user_id)):
    _private(response)
    return await _run_response(await store.get_run(get_supabase_service()))


@router.get("/runs/{run_id}")
async def get_run(run_id: UUID, response: Response, user_id: str = Depends(get_current_user_id)):
    _private(response)
    return await _run_response(await store.get_run(get_supabase_service(), str(run_id)))


@admin_router.get("/status")
async def admin_status(response: Response, limit: int = Query(default=20, ge=1, le=100), admin_id: str = Depends(verify_admin)):
    """Data-source and worker state, the current manual run and recent runs of every status (including skipped)."""
    _private(response)
    db = get_supabase_service()
    return {
        "configured": options_activity_service.collector.configured,
        "worker_enabled": settings.OPTIONS_ACTIVITY_WORKER_ENABLED,
        "manual": manual_state,
        "analysis": analysis_state,
        "latest": await store.latest_candidates(db),
        "runs": await store.list_all(db, limit),
    }


@admin_router.post("/run", status_code=202)
async def trigger_run(
    session: Literal["pre", "intraday", "post"] = Query(...),
    symbols: Optional[str] = Query(default=None, max_length=300, description="Extra symbols for this run, comma or space separated"),
    admin_id: str = Depends(verify_admin),
):
    try:
        extra = parse_manual(symbols)
    except ValueError:
        raise HTTPException(status_code=422, detail="invalid_symbols")
    if not options_activity_service.collector.configured:
        raise HTTPException(status_code=503, detail="options_data_not_configured")
    if not start_manual_run(session, symbols=extra):
        raise HTTPException(status_code=409, detail="run_in_progress")
    return {"started": True, "session": session, "symbols": extra}


@admin_router.post("/analyze", status_code=202)
async def trigger_analysis(admin_id: str = Depends(verify_admin)):
    """Regenerates the AI candidates of the newest saved run in the background."""
    if not await store.latest_candidates(get_supabase_service()):
        raise HTTPException(status_code=404, detail="no_runs")
    if not start_analysis():
        raise HTTPException(status_code=409, detail="run_in_progress")
    return {"started": True}
