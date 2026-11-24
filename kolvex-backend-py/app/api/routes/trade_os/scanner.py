"""
Trade OS Scanner API Routes

The scan always runs the same layers and pullback state machine; a *logic* is the set of
numbers it uses. "default" is the built-in Swing V3.1; users can create, edit and delete
their own logics and run a scan with any one of them.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user_id, get_supabase
from app.services.trade_os.scanner import (
    get_latest_scanner_run,
    run_opportunity_scanner,
)
from app.services.trade_os.scanner_logics import LogicNotFound, ScannerLogicService
from app.services.trade_os.scanner_params import PARAM_SPEC, InvalidScannerParams

router = APIRouter(prefix="/scanner", tags=["Trade OS Scanner"])


class ScannerRunRequest(BaseModel):
    symbols: Optional[List[str]] = None
    save_to_db: bool = True
    # "default" (built-in Swing V3.1) or one of the user's logic keys.
    logic: str = Field(default="default", max_length=64)


class ScannerLogicRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    params: Dict[str, Any] = Field(default_factory=dict)


def get_logic_service() -> ScannerLogicService:
    return ScannerLogicService()


def _not_found(key: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail=f"Scanner logic {key} not found"
    )


def _invalid(error: InvalidScannerParams) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={"field": error.field, "message": error.message},
    )


@router.get("/latest")
async def get_latest_scan(
    logic: str = Query(default="default", max_length=64),
    authorization: Optional[str] = Header(None),
) -> Optional[Dict[str, Any]]:
    """
    Latest run of a logic, or null when it has not run yet (not an error). The default is
    public as before; a custom logic's results are only returned to its owner.
    """
    user_id = None
    if logic != "default":
        # Resolved only here, so the public default never needs a token or a Supabase client.
        user_id = await get_current_user_id(authorization, get_supabase())
    try:
        return get_latest_scanner_run(logic_key=logic, user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run")
async def trigger_scanner_run(
    body: Optional[ScannerRunRequest] = None,
    user_id: str = Depends(get_current_user_id),
    service: ScannerLogicService = Depends(get_logic_service),
) -> Dict[str, Any]:
    """Runs a scan on the admin universe now, with the chosen logic."""
    body = body or ScannerRunRequest()
    logic = None
    if body.logic != "default":
        try:
            logic = service.get_logic(user_id, body.logic)
        except LogicNotFound:
            raise _not_found(body.logic)
    try:
        return await run_opportunity_scanner(
            symbols=body.symbols,
            save_to_db=body.save_to_db,
            user_id=user_id if logic else None,
            logic=logic,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logics/spec")
def get_logic_spec() -> Dict[str, Any]:
    """Each editable number with its default and allowed range (fractions for percentages)."""
    return {
        key: {"default": default, "min": low, "max": high, "integer": integer}
        for key, (default, low, high, integer) in PARAM_SPEC.items()
    }


@router.get("/logics")
def list_logics(
    user_id: str = Depends(get_current_user_id),
    service: ScannerLogicService = Depends(get_logic_service),
) -> List[Dict[str, Any]]:
    """The built-in default first, then the user's own logics."""
    return service.list_logics(user_id)


@router.post("/logics", status_code=status.HTTP_201_CREATED)
def create_logic(
    req: ScannerLogicRequest,
    user_id: str = Depends(get_current_user_id),
    service: ScannerLogicService = Depends(get_logic_service),
) -> Dict[str, Any]:
    try:
        return service.create_logic(user_id, req.name.strip(), req.params, req.description)
    except InvalidScannerParams as e:
        raise _invalid(e)


@router.put("/logics/{key}")
def update_logic(
    key: str,
    req: ScannerLogicRequest,
    user_id: str = Depends(get_current_user_id),
    service: ScannerLogicService = Depends(get_logic_service),
) -> Dict[str, Any]:
    """Saves the edit as the logic's next version."""
    try:
        return service.update_logic(user_id, key, req.name.strip(), req.params, req.description)
    except LogicNotFound:
        raise _not_found(key)
    except InvalidScannerParams as e:
        raise _invalid(e)


@router.delete("/logics/{key}")
def delete_logic(
    key: str,
    user_id: str = Depends(get_current_user_id),
    service: ScannerLogicService = Depends(get_logic_service),
) -> Dict[str, Any]:
    """Retires the logic (200 with a body: the web proxy and client expect JSON)."""
    try:
        service.delete_logic(user_id, key)
    except LogicNotFound:
        raise _not_found(key)
    return {"deleted": key}
