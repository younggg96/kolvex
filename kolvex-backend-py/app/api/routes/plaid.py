"""Plaid Investments API routes."""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from starlette import status as http_status

from app.api.dependencies.auth import get_current_user_id
from app.services.plaid import (
    PlaidApiError,
    PlaidConfigurationError,
    PlaidService,
    get_plaid_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/plaid", tags=["Plaid Investments"])


class PlaidExchangeTokenRequest(BaseModel):
    public_token: str
    institution: Optional[Dict[str, Any]] = None
    accounts: List[Dict[str, Any]] = []


def _handle_error(error: Exception) -> HTTPException:
    if isinstance(error, PlaidConfigurationError):
        return HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        )
    if isinstance(error, PlaidApiError):
        return HTTPException(status_code=error.status_code, detail=str(error))
    if isinstance(error, ValueError):
        return HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(error))
    logger.exception("Plaid route failed")
    return HTTPException(
        status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=str(error),
    )


@router.get("/status")
async def status(
    user_id: str = Depends(get_current_user_id),
    service: PlaidService = Depends(get_plaid_service),
):
    try:
        return await service.status(user_id)
    except Exception as error:
        raise _handle_error(error)


@router.post("/link-token")
async def create_link_token(
    user_id: str = Depends(get_current_user_id),
    service: PlaidService = Depends(get_plaid_service),
):
    try:
        return await service.create_link_token(user_id)
    except Exception as error:
        raise _handle_error(error)


@router.post("/exchange-token")
async def exchange_token(
    body: PlaidExchangeTokenRequest,
    user_id: str = Depends(get_current_user_id),
    service: PlaidService = Depends(get_plaid_service),
):
    try:
        return await service.exchange_public_token(
            user_id=user_id,
            public_token=body.public_token,
            institution=body.institution,
            accounts=body.accounts,
        )
    except Exception as error:
        raise _handle_error(error)


@router.post("/sync")
async def sync(
    user_id: str = Depends(get_current_user_id),
    service: PlaidService = Depends(get_plaid_service),
):
    try:
        return await service.sync(user_id)
    except Exception as error:
        raise _handle_error(error)


@router.get("/transactions")
async def transactions(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    symbol: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    service: PlaidService = Depends(get_plaid_service),
):
    try:
        return await service.transactions(
            user_id=user_id,
            limit=limit,
            offset=offset,
            symbol=symbol,
        )
    except Exception as error:
        raise _handle_error(error)


@router.delete("/disconnect")
async def disconnect(
    user_id: str = Depends(get_current_user_id),
    service: PlaidService = Depends(get_plaid_service),
):
    try:
        return await service.disconnect(user_id)
    except Exception as error:
        raise _handle_error(error)
