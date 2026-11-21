"""
User API Keys Management Routes
Allows users to set their own LLM provider API keys
"""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette import status as http_status

from app.agent.config import DEEPSEEK_API_KEY
from app.api.dependencies.auth import get_current_user_id
from app.services import free_llm_quota
from app.services.user_api_keys_service import (
    VALID_PROVIDERS,
    UserApiKeysService,
    get_user_api_keys_service,
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

    provider: str = Field(description="LLM provider name (e.g. openai, anthropic, deepseek)")
    api_key: str = Field(min_length=1, max_length=500, description="API key value")


class DeleteApiKeyRequest(BaseModel):
    """Request to delete an API key"""

    provider: str = Field(description="LLM provider name to delete")


class SuccessResponse(BaseModel):
    """Simple success response"""

    message: str
    success: bool = True


# ===== Routes =====


class FreeTokensResponse(BaseModel):
    """Real token counts from the ledger for this week's free model calls."""

    input_tokens: int
    cached_input_tokens: int
    output_tokens: int
    model_calls: int


class FreeAllowanceResponse(BaseModel):
    """This week's free model allowance on the server key (app/services/free_llm_quota.py).

    The limit is enforced in yuan, but users are shown only the share used and tokens.
    """

    model: str
    used_percent: int
    exhausted: bool
    resets_at: str
    # None when the ledger cannot be read.
    tokens: Optional[FreeTokensResponse] = None


class AvailableProvidersResponse(BaseModel):
    """Providers with the user's own keys, plus the free model when the server offers one"""

    available_providers: List[str]
    # Models usable without the user's own key; empty when the server has no DeepSeek key.
    free_models: List[str] = []
    # None when free_models is empty or the allowance cannot be read right now.
    free_allowance: Optional[FreeAllowanceResponse] = None


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
    Returns providers with the user's own keys, and the free model with this
    week's allowance. Used by the frontend to enable/disable model selection.
    """
    providers = await service.get_available_providers(current_user_id)
    if not DEEPSEEK_API_KEY:
        return AvailableProvidersResponse(available_providers=providers)
    try:
        allowance = FreeAllowanceResponse(**await free_llm_quota.allowance(current_user_id))
    except free_llm_quota.FreeQuotaUnavailable:
        allowance = None
    return AvailableProvidersResponse(
        available_providers=providers,
        free_models=[free_llm_quota.FREE_MODEL],
        free_allowance=allowance,
    )


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
