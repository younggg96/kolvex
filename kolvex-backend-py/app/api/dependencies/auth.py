"""
认证相关依赖
"""

from fastapi import Depends, HTTPException, status, Header
from typing import Optional
from supabase import Client
from app.core.supabase import get_supabase, get_supabase_service
from app.core.config import settings


async def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
) -> bool:
    """
    验证 API Key (用于 Dify 等外部服务)
    
    Args:
        x_api_key: X-API-Key header
        
    Returns:
        bool: True 如果 API Key 有效
        
    Raises:
        HTTPException: 401 如果 API Key 无效
    """
    if not settings.DIFY_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API Key not configured on server",
        )
    
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key required",
            headers={"WWW-Authenticate": "API-Key"},
        )
    
    if x_api_key != settings.DIFY_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
            headers={"WWW-Authenticate": "API-Key"},
        )
    
    return True


async def get_optional_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
) -> bool:
    """
    可选的 API Key 验证
    
    Returns:
        bool: True 如果 API Key 有效，False 如果没有提供
    """
    if not x_api_key or not settings.DIFY_API_KEY:
        return False
    
    return x_api_key == settings.DIFY_API_KEY


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
        response = (
            supabase.table("user_profiles")
            .select("is_admin")
            .eq("id", current_user_id)
            .single()
            .execute()
        )

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
