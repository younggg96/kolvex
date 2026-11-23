"""
Trade OS Scanner API Routes
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies.auth import get_current_user_id
from app.services.trade_os.scanner import (
    get_latest_scanner_run,
    run_opportunity_scanner,
)

router = APIRouter(prefix="/scanner", tags=["Trade OS Scanner"])


class ScannerRunRequest(BaseModel):
    symbols: Optional[List[str]] = None
    save_to_db: bool = True


@router.get("/latest")
async def get_latest_scan() -> Optional[Dict[str, Any]]:
    """Latest Swing V3.0 scan, or null when none has run yet (not an error)."""
    try:
        return get_latest_scanner_run()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run")
async def trigger_scanner_run(
    body: Optional[ScannerRunRequest] = None, _user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Runs the Swing V3.0 scan on the admin universe now."""
    try:
        symbols = body.symbols if body else None
        save = body.save_to_db if body else True
        return await run_opportunity_scanner(symbols=symbols, save_to_db=save)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
