"""
认证相关依赖
"""

from fastapi import Depends, HTTPException, status, Header
from typing import Optional
from supabase import Client
from app.core.supabase import get_supabase


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
        user_response = supabase.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user_response.user.id

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
        user_response = supabase.auth.get_user(token)

        if not user_response or not user_response.user or not user_response.user.email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to get user information",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user_response.user.email

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
