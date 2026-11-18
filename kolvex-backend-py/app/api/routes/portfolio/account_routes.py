"""Per-account portfolio routes."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from starlette import status as http_status

from app.api.dependencies.auth import get_current_user_id
from app.services.portfolio.account_removal import (
    AccountNotFound,
    AccountRemovalService,
    AccountRemovalUnavailable,
    get_account_removal_service,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.delete("/accounts/{account_id}")
async def remove_account(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    service: AccountRemovalService = Depends(get_account_removal_service),
):
    """Remove one account and its positions; Plaid syncs will skip it afterwards."""
    try:
        return await service.remove_account(user_id, account_id)
    except AccountNotFound:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Account not found")
    except AccountRemovalUnavailable as error:
        logger.error("Account removal unavailable, migration pending: %s", error)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Removing accounts is not enabled on the server yet (database migration pending)",
        )
    except Exception as error:
        logger.exception("Removing portfolio account failed")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Remove failed: {error}",
        )
