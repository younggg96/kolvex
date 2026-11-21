"""
认证相关依赖
"""

import asyncio
import base64
import hashlib
import json
import threading
import time
from collections import OrderedDict
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from app.core.supabase import SupabaseClient, get_supabase_service
from app.services.free_llm_quota import bill_to
from supabase import Client

# Verifying a token used to create a fresh Supabase client (new TLS connection)
# and call Auth for every authenticated request. Verified tokens are now reused
# briefly, bounded by the token's own expiry, through one shared client.
# A revoked session can therefore keep working for at most TOKEN_CACHE_SECONDS.
TOKEN_CACHE_SECONDS = 60.0
TOKEN_CACHE_MAX = 2048
_token_cache: "OrderedDict[bytes, tuple]" = OrderedDict()
_token_lock = threading.Lock()
_verifier: Optional[Client] = None


def get_supabase() -> Client:
    """Shared client used only to verify tokens: get_user(jwt) keeps no session."""
    global _verifier
    if _verifier is None:
        _verifier = SupabaseClient.get_client()
    return _verifier


def _token_expiry(token: str) -> Optional[float]:
    """Unverified `exp` claim, used only to shorten the cache lifetime."""
    try:
        payload = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return float(claims["exp"])
    except Exception:
        return None


async def _verified_user(token: str, supabase: Client):
    key = hashlib.sha256(token.encode()).digest()
    now = time.monotonic()
    with _token_lock:
        hit = _token_cache.get(key)
        if hit is not None:
            if hit[1] > now:
                _token_cache.move_to_end(key)
                return hit[0]
            _token_cache.pop(key, None)
    user_response = await asyncio.to_thread(supabase.auth.get_user, token)
    user = user_response.user if user_response else None
    if user is not None:
        ttl = TOKEN_CACHE_SECONDS
        expiry = _token_expiry(token)
        if expiry is not None:
            ttl = min(ttl, expiry - time.time())
        if ttl > 0:
            with _token_lock:
                _token_cache[key] = (user, time.monotonic() + ttl)
                while len(_token_cache) > TOKEN_CACHE_MAX:
                    _token_cache.popitem(last=False)
    return user


def clear_token_cache() -> None:
    with _token_lock:
        _token_cache.clear()


async def get_current_user_id(
    authorization: Optional[str] = Header(None),
    supabase: Client = Depends(get_supabase),
) -> str:
    """
    从请求头中获取 JWT token 并验证，返回当前用户 ID

    Args:
        authorization: Authorization header (Bearer token)
        supabase: Supabase 客户端

    Returns:
        str: 用户 ID

    Raises:
        HTTPException: 401 如果 token 无效或用户未认证
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 提取 token
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication scheme",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 验证 token
    try:
        # 使用 Supabase 验证 JWT token
        user = await _verified_user(token, supabase)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Model calls on server keys while serving this user count against their free allowance.
        bill_to(user.id)
        return user.id

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user_id(
    authorization: Optional[str] = Header(None),
    supabase: Client = Depends(get_supabase),
) -> Optional[str]:
    """
    可选的用户认证，如果有 token 则验证，没有则返回 None

    Args:
        authorization: Authorization header (Bearer token)
        supabase: Supabase 客户端

    Returns:
        Optional[str]: 用户 ID 或 None
    """
    if not authorization:
        return None

    try:
        return await get_current_user_id(authorization, supabase)
    except HTTPException:
        return None


async def get_current_user_email(
    authorization: Optional[str] = Header(None),
    supabase: Client = Depends(get_supabase),
) -> str:
    """
    获取当前用户的邮箱

    Args:
        authorization: Authorization header (Bearer token)
        supabase: Supabase 客户端

    Returns:
        str: 用户邮箱

    Raises:
        HTTPException: 401 如果 token 无效或用户未认证
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication scheme",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user = await _verified_user(token, supabase)

        if not user or not user.email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to get user information",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user.email

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def verify_admin(
    current_user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service),
) -> str:
    """
    验证当前用户是否为管理员

    Args:
        current_user_id: 当前用户 ID
        supabase: Supabase 客户端

    Returns:
        str: 用户 ID（如果是管理员）

    Raises:
        HTTPException: 403 如果用户不是管理员
    """
    try:
        query = (
            supabase.table("user_profiles").select("is_admin").eq("id", current_user_id).single()
        )
        response = await asyncio.to_thread(query.execute)

        if not response.data or not response.data.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )

        return current_user_id

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify admin status: {str(e)}",
        )
