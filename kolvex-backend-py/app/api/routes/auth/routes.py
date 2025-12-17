"""
认证 API 路由
"""

from fastapi import APIRouter, HTTPException, status, Header, Depends
from typing import Optional
import logging

from app.core.supabase import get_supabase, get_supabase_service
from app.api.dependencies.auth import get_current_user_id
from .schemas import (
    SignUpRequest,
    SignInRequest,
    ResetPasswordRequest,
    UpdatePasswordRequest,
    OAuthRequest,
    SignInResponse,
    SignUpResponse,
    OAuthUrlResponse,
    MessageResponse,
    UserResponse,
    SessionResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def get_user_response(user) -> UserResponse:
    """将 Supabase 用户对象转换为响应模型"""
    return UserResponse(
        id=user.id,
        email=user.email,
        email_confirmed_at=str(user.email_confirmed_at) if user.email_confirmed_at else None,
        phone=user.phone,
        created_at=str(user.created_at) if user.created_at else None,
        updated_at=str(user.updated_at) if user.updated_at else None,
        user_metadata=user.user_metadata,
    )


def get_session_response(session) -> Optional[SessionResponse]:
    """将 Supabase 会话对象转换为响应模型"""
    if not session:
        return None
    return SessionResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        token_type="bearer",
        expires_in=session.expires_in,
        expires_at=session.expires_at,
    )


def get_error_message(error) -> tuple[str, str]:
    """从 Supabase 错误中提取用户友好的错误消息"""
    if not error:
        return "An unknown error occurred", "UNKNOWN_ERROR"
    
    message = str(error.message) if hasattr(error, 'message') else str(error)
    code = error.code if hasattr(error, 'code') else "AUTH_ERROR"
    
    # 处理常见的 Supabase 认证错误
    if "Invalid login credentials" in message:
        return "Invalid email or password", "INVALID_CREDENTIALS"
    if "User already registered" in message:
        return "An account with this email already exists", "USER_EXISTS"
    if "Email not confirmed" in message:
        return "Please verify your email address", "EMAIL_NOT_CONFIRMED"
    if "Password should be" in message or "Password" in message and "6" in message:
        return "Password must be at least 6 characters", "WEAK_PASSWORD"
    if "Invalid email" in message:
        return "Please enter a valid email address", "INVALID_EMAIL"
    if "network" in message.lower():
        return "Network error. Please check your connection", "NETWORK_ERROR"
    if "rate limit" in message.lower():
        return "Too many attempts. Please try again later", "RATE_LIMIT"
    
    return message, code


@router.post(
    "/signup",
    response_model=SignUpResponse,
    summary="用户注册",
)
async def sign_up(request: SignUpRequest):
    """
    注册新用户
    
    - **email**: 邮箱地址
    - **password**: 密码（至少6个字符）
    - **name**: 用户名称（可选）
    - **display_name**: 显示名称（可选）
    - **redirect_url**: 邮件确认后的重定向 URL（可选）
    """
    try:
        supabase = get_supabase()
        
        # 构建用户元数据
        user_metadata = {}
        if request.name:
            user_metadata["full_name"] = request.name
            user_metadata["display_name"] = request.name
        if request.display_name:
            user_metadata["display_name"] = request.display_name
        
        # 注册用户
        options = {"data": user_metadata} if user_metadata else {}
        if request.redirect_url:
            options["email_redirect_to"] = request.redirect_url
        
        response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": options,
        })
        
        if response.user:
            return SignUpResponse(
                success=True,
                user=get_user_response(response.user),
                session=get_session_response(response.session),
                message="Registration successful. Please check your email for verification." if not response.session else "Registration successful.",
            )
        else:
            return SignUpResponse(
                success=False,
                error="Registration failed",
                error_code="SIGNUP_FAILED",
            )
    
    except Exception as e:
        error_message, error_code = get_error_message(e)
        logger.error(f"Sign up error: {e}")
        return SignUpResponse(
            success=False,
            error=error_message,
            error_code=error_code,
        )


@router.post(
    "/signin",
    response_model=SignInResponse,
    summary="用户登录",
)
async def sign_in(request: SignInRequest):
    """
    用户登录
    
    - **email**: 邮箱地址
    - **password**: 密码
    """
    try:
        supabase = get_supabase()
        
        response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })
        
        if response.user and response.session:
            return SignInResponse(
                success=True,
                user=get_user_response(response.user),
                session=get_session_response(response.session),
            )
        else:
            return SignInResponse(
                success=False,
                error="Login failed",
                error_code="SIGNIN_FAILED",
            )
    
    except Exception as e:
        error_message, error_code = get_error_message(e)
        logger.error(f"Sign in error: {e}")
        return SignInResponse(
            success=False,
            error=error_message,
            error_code=error_code,
        )


@router.post(
    "/oauth/url",
    response_model=OAuthUrlResponse,
    summary="获取 OAuth 登录 URL",
)
async def get_oauth_url(request: OAuthRequest):
    """
    获取 OAuth 提供商的登录 URL
    
    - **provider**: OAuth 提供商（如 google）
    - **redirect_url**: OAuth 回调后的重定向 URL（可选）
    """
    try:
        supabase = get_supabase()
        
        options = {}
        if request.redirect_url:
            options["redirect_to"] = request.redirect_url
        
        if request.provider.lower() == "google":
            options["query_params"] = {
                "access_type": "offline",
                "prompt": "consent",
            }
        
        response = supabase.auth.sign_in_with_oauth({
            "provider": request.provider,
            "options": options,
        })
        
        if response.url:
            return OAuthUrlResponse(
                success=True,
                url=response.url,
                provider=request.provider,
            )
        else:
            return OAuthUrlResponse(
                success=False,
                error="Failed to generate OAuth URL",
            )
    
    except Exception as e:
        logger.error(f"OAuth URL error: {e}")
        return OAuthUrlResponse(
            success=False,
            error=str(e),
        )


@router.post(
    "/signout",
    response_model=MessageResponse,
    summary="用户登出",
)
async def sign_out(
    authorization: Optional[str] = Header(None),
):
    """
    用户登出
    
    需要认证：Bearer token
    """
    try:
        if not authorization:
            return MessageResponse(
                success=True,
                message="Signed out successfully",
            )
        
        # 提取 token
        try:
            scheme, token = authorization.split()
            if scheme.lower() != "bearer":
                return MessageResponse(
                    success=True,
                    message="Signed out successfully",
                )
        except ValueError:
            return MessageResponse(
                success=True,
                message="Signed out successfully",
            )
        
        supabase = get_supabase()
        
        # 尝试登出（Supabase 会使 token 失效）
        try:
            supabase.auth.sign_out()
        except Exception:
            # 即使登出失败，我们也返回成功（客户端会清除本地存储）
            pass
        
        return MessageResponse(
            success=True,
            message="Signed out successfully",
        )
    
    except Exception as e:
        logger.error(f"Sign out error: {e}")
        # 即使出错，也返回成功（客户端会清除本地存储）
        return MessageResponse(
            success=True,
            message="Signed out successfully",
        )


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="发送密码重置邮件",
)
async def reset_password(request: ResetPasswordRequest):
    """
    发送密码重置邮件
    
    - **email**: 邮箱地址
    - **redirect_url**: 重置密码页面的 URL（可选）
    """
    try:
        supabase = get_supabase()
        
        options = {}
        if request.redirect_url:
            options["redirect_to"] = request.redirect_url
        
        supabase.auth.reset_password_for_email(
            request.email,
            options=options,
        )
        
        return MessageResponse(
            success=True,
            message="Password reset email sent. Please check your inbox.",
        )
    
    except Exception as e:
        error_message, error_code = get_error_message(e)
        logger.error(f"Reset password error: {e}")
        return MessageResponse(
            success=False,
            error=error_message,
            error_code=error_code,
        )


@router.post(
    "/update-password",
    response_model=MessageResponse,
    summary="更新密码",
)
async def update_password(
    request: UpdatePasswordRequest,
    authorization: Optional[str] = Header(None),
):
    """
    更新用户密码
    
    需要认证：Bearer token（来自密码重置邮件链接或已登录用户）
    
    - **password**: 新密码（至少6个字符）
    """
    try:
        if not authorization:
            return MessageResponse(
                success=False,
                error="Authorization token required",
                error_code="UNAUTHORIZED",
            )
        
        # 提取 token
        try:
            scheme, token = authorization.split()
            if scheme.lower() != "bearer":
                return MessageResponse(
                    success=False,
                    error="Invalid authentication scheme",
                    error_code="INVALID_AUTH_SCHEME",
                )
        except ValueError:
            return MessageResponse(
                success=False,
                error="Invalid authorization format",
                error_code="INVALID_AUTH_FORMAT",
            )
        
        supabase = get_supabase()
        
        # 验证 token 并获取用户
        try:
            user_response = supabase.auth.get_user(token)
            if not user_response or not user_response.user:
                return MessageResponse(
                    success=False,
                    error="Invalid or expired token",
                    error_code="INVALID_TOKEN",
                )
        except Exception:
            return MessageResponse(
                success=False,
                error="Invalid or expired token",
                error_code="INVALID_TOKEN",
            )
        
        # 使用 admin 客户端更新密码
        supabase_admin = get_supabase_service()
        supabase_admin.auth.admin.update_user_by_id(
            user_response.user.id,
            {"password": request.password}
        )
        
        return MessageResponse(
            success=True,
            message="Password updated successfully",
        )
    
    except Exception as e:
        error_message, error_code = get_error_message(e)
        logger.error(f"Update password error: {e}")
        return MessageResponse(
            success=False,
            error=error_message,
            error_code=error_code,
        )


@router.get(
    "/user",
    response_model=dict,
    summary="获取当前用户信息",
)
async def get_current_user(
    authorization: Optional[str] = Header(None),
):
    """
    获取当前已认证用户的信息
    
    需要认证：Bearer token
    """
    try:
        if not authorization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization token required",
            )
        
        # 提取 token
        try:
            scheme, token = authorization.split()
            if scheme.lower() != "bearer":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication scheme",
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization format",
            )
        
        supabase = get_supabase()
        
        user_response = supabase.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        
        user = user_response.user
        return {
            "success": True,
            "user": {
                "id": user.id,
                "email": user.email,
                "email_confirmed_at": str(user.email_confirmed_at) if user.email_confirmed_at else None,
                "phone": user.phone,
                "created_at": str(user.created_at) if user.created_at else None,
                "updated_at": str(user.updated_at) if user.updated_at else None,
                "user_metadata": user.user_metadata,
            },
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post(
    "/refresh",
    response_model=SignInResponse,
    summary="刷新访问令牌",
)
async def refresh_token(
    authorization: Optional[str] = Header(None),
    refresh_token: Optional[str] = Header(None, alias="X-Refresh-Token"),
):
    """
    使用刷新令牌获取新的访问令牌
    
    - **refresh_token**: 刷新令牌（通过 X-Refresh-Token header 或 request body）
    """
    try:
        if not refresh_token:
            return SignInResponse(
                success=False,
                error="Refresh token required",
                error_code="REFRESH_TOKEN_REQUIRED",
            )
        
        supabase = get_supabase()
        
        response = supabase.auth.refresh_session(refresh_token)
        
        if response.user and response.session:
            return SignInResponse(
                success=True,
                user=get_user_response(response.user),
                session=get_session_response(response.session),
            )
        else:
            return SignInResponse(
                success=False,
                error="Failed to refresh token",
                error_code="REFRESH_FAILED",
            )
    
    except Exception as e:
        error_message, error_code = get_error_message(e)
        logger.error(f"Refresh token error: {e}")
        return SignInResponse(
            success=False,
            error=error_message,
            error_code=error_code,
        )

