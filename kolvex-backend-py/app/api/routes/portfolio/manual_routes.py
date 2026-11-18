"""Manual portfolio import routes."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from starlette import status as http_status

from app.api.dependencies.auth import get_current_user_id
from app.services.portfolio.manual_import import (
    ManualImportRequest,
    ManualImportService,
    ManualImportUnavailable,
    get_manual_import_service,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/manual-import")
async def import_manual_holdings(
    request: ManualImportRequest,
    user_id: str = Depends(get_current_user_id),
    service: ManualImportService = Depends(get_manual_import_service),
):
    """Replace the user's manually imported holdings with this snapshot."""
    try:
        return await service.import_holdings(user_id, request)
    except ManualImportUnavailable as error:
        logger.error("Manual portfolio import unavailable: %s", error)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Manual import is not enabled on the server yet (database migration pending)",
        )
    except Exception as error:
        logger.exception("Manual portfolio import failed")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {error}",
        )


@router.delete("/manual-import")
async def clear_manual_holdings(
    user_id: str = Depends(get_current_user_id),
    service: ManualImportService = Depends(get_manual_import_service),
):
    """Remove every manually imported account and position."""
    try:
        return await service.clear(user_id)
    except Exception as error:
        logger.exception("Clearing manual portfolio failed")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Clear failed: {error}",
        )
