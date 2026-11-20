"""CNN Fear & Greed history and administrator CSV import."""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from starlette.concurrency import run_in_threadpool

from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
from app.services.fear_greed import (
    MAX_BYTES,
    NEW_YORK,
    InvalidCsv,
    Observation,
    list_observations,
    parse_csv,
    save_observations,
)

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
