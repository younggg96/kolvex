"""
User API Keys Management Routes
Allows users to set their own LLM provider API keys
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from starlette import status as http_status
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.api.dependencies.auth import get_current_user_id
from app.services.user_api_keys_service import (
    UserApiKeysService,
    get_user_api_keys_service,
    VALID_PROVIDERS,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/user-api-keys", tags=["User API Keys"])


# ===== Schemas =====

class ApiKeyResponse(BaseModel):
    """Single API key response (masked)"""
    id: str
    provider: str
    api_key_masked: str
    created_at: datetime
    updated_at: datetime


class ApiKeysListResponse(BaseModel):
    """List of user API keys"""
    keys: List[ApiKeyResponse]
    supported_providers: List[str]


class UpsertApiKeyRequest(BaseModel):
    """Request to create or update an API key"""
    provider: str = Field(
        description="LLM provider name (e.g. openai, anthropic, deepseek)"
    )
    api_key: str = Field(
        min_length=1,
        max_length=500,
        description="API key value"
    )


class DeleteApiKeyRequest(BaseModel):
    """Request to delete an API key"""
    provider: str = Field(
        description="LLM provider name to delete"
    )


class SuccessResponse(BaseModel):
    """Simple success response"""
    message: str
    success: bool = True


# ===== Routes =====

class AvailableProvidersResponse(BaseModel):
    """List of providers that have usable API keys"""
    available_providers: List[str]


@router.get(
    "/available-providers",
    response_model=AvailableProvidersResponse,
    summary="Get providers with usable API keys",
)
async def get_available_providers(
    current_user_id: str = Depends(get_current_user_id),
    service: UserApiKeysService = Depends(get_user_api_keys_service),
):
    """
    Returns providers that have a usable API key (user-level or server-level).
    Used by the frontend to enable/disable model selection.
    """
    providers = await service.get_available_providers(current_user_id)
    return AvailableProvidersResponse(available_providers=providers)


@router.get("", response_model=ApiKeysListResponse, summary="Get all user API keys")
async def get_api_keys(
    current_user_id: str = Depends(get_current_user_id),
    service: UserApiKeysService = Depends(get_user_api_keys_service),
):
    """
    Get all API keys for the current user (values are masked).
    Also returns the list of supported providers.
    """
    keys = await service.get_all_keys(current_user_id)
    return ApiKeysListResponse(
        keys=[ApiKeyResponse(**k) for k in keys],
        supported_providers=sorted(VALID_PROVIDERS),
    )


@router.put("", response_model=ApiKeyResponse, summary="Set an API key")
async def upsert_api_key(
    request: UpsertApiKeyRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: UserApiKeysService = Depends(get_user_api_keys_service),
):
    """
    Create or update an API key for a provider.
    If a key already exists for this provider, it will be replaced.
    """
    try:
        result = await service.upsert_key(
            user_id=current_user_id,
            provider=request.provider,
            api_key=request.api_key,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if not result:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save API key",
        )

    return ApiKeyResponse(**result)


@router.delete("/{provider}", response_model=SuccessResponse, summary="Delete an API key")
async def delete_api_key(
    provider: str,
    current_user_id: str = Depends(get_current_user_id),
    service: UserApiKeysService = Depends(get_user_api_keys_service),
):
    """
    Delete an API key for a specific provider.
    """
    deleted = await service.delete_key(
        user_id=current_user_id,
        provider=provider,
    )

    if not deleted:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"No API key found for provider '{provider}'",
        )

    return SuccessResponse(message=f"API key for '{provider}' deleted successfully")
