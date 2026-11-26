"""CNN Fear & Greed history, administrator CSV import and the local worker's sync."""

import hmac
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from starlette.concurrency import run_in_threadpool

from app.api.dependencies.auth import verify_admin
from app.core.config import settings
from app.core.supabase import get_supabase_service
from app.services.fear_greed import (
    MAX_BYTES,
    NEW_YORK,
    InvalidCnnData,
    InvalidCsv,
    Observation,
    latest_status,
    list_observations,
    parse_cnn_graph,
    parse_csv,
    save_observations,
)

WORKER_MAX_BYTES = 2 * 1024 * 1024

router = APIRouter(tags=["Fear & Greed"])
logger = logging.getLogger(__name__)


@router.get("/market/fear-greed", response_model=list[Observation])
def fear_greed_history():
    try:
        return list_observations(get_supabase_service())
    except Exception as exc:
        logger.exception("Fear & Greed history unavailable")
        raise HTTPException(503, detail="Fear & Greed history unavailable") from exc


@router.post("/admin/fear-greed")
async def import_fear_greed(
    request: Request,
    validate: bool = Query(False),
    admin_id: str = Depends(verify_admin),
):
    payload = bytearray()
    async for chunk in request.stream():
        if len(payload) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, detail={"code": "too_large"})
        payload.extend(chunk)
    try:
        rows = await run_in_threadpool(parse_csv, payload, datetime.now(NEW_YORK).date())
    except InvalidCsv as exc:
        raise HTTPException(422, detail={"code": exc.code, "line": exc.line}) from exc

    if not validate:
        try:
            await run_in_threadpool(
                lambda: save_observations(get_supabase_service(), rows, admin_id)
            )
        except Exception as exc:
            logger.exception("Fear & Greed import failed")
            raise HTTPException(503, detail={"code": "unavailable"}) from exc
    return {
        "count": len(rows),
        "first_date": rows[0].date,
        "last_date": rows[-1].date,
    }


def verify_worker(x_worker_token: Optional[str] = Header(default=None)) -> None:
    expected = settings.FEAR_GREED_WORKER_TOKEN
    if not expected:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "worker_not_configured")
    # Compare bytes: compare_digest raises on non-ASCII str, e.g. a mistyped token.
    if not x_worker_token or not hmac.compare_digest(x_worker_token.encode(), expected.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_worker_token")


@router.post("/fear-greed/worker/cnn", dependencies=[Depends(verify_worker)])
async def sync_from_cnn(request: Request):
    """Receives CNN's chart JSON captured by the local Playwright script and upserts it."""
    payload = bytearray()
    async for chunk in request.stream():
        if len(payload) + len(chunk) > WORKER_MAX_BYTES:
            raise HTTPException(413, detail={"code": "too_large"})
        payload.extend(chunk)
    try:
        rows = parse_cnn_graph(json.loads(payload), datetime.now(NEW_YORK))
    except (ValueError, InvalidCnnData) as exc:
        code = str(exc) if isinstance(exc, InvalidCnnData) else "json"
        logger.warning("Rejected Fear & Greed worker payload: %s", code)
        raise HTTPException(422, detail={"code": code}) from exc
    try:
        await run_in_threadpool(lambda: save_observations(get_supabase_service(), rows, None))
    except Exception as exc:
        logger.exception("Fear & Greed worker sync failed")
        raise HTTPException(503, detail={"code": "unavailable"}) from exc
    return {
        "count": len(rows),
        "first_date": rows[0].date,
        "last_date": rows[-1].date,
        "latest_score": rows[-1].score,
    }


@router.get("/admin/fear-greed/status")
def fear_greed_status(admin_id: str = Depends(verify_admin)):
    try:
        latest = latest_status(get_supabase_service())
    except Exception as exc:
        logger.exception("Fear & Greed status unavailable")
        raise HTTPException(503, detail={"code": "unavailable"}) from exc
    return {"worker_configured": bool(settings.FEAR_GREED_WORKER_TOKEN), "latest": latest}
