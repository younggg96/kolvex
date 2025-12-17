"""
认证相关的 Pydantic 模型
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Any


class SignUpRequest(BaseModel):
    """注册请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=6, description="密码（至少6个字符）")
    name: Optional[str] = Field(None, description="用户名称")
    display_name: Optional[str] = Field(None, description="显示名称")
    redirect_url: Optional[str] = Field(None, description="邮件确认后的重定向 URL")


class SignInRequest(BaseModel):
    """登录请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    password: str = Field(..., description="密码")


class ResetPasswordRequest(BaseModel):
    """密码重置请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    redirect_url: Optional[str] = Field(None, description="重置密码页面的 URL")


class UpdatePasswordRequest(BaseModel):
    """更新密码请求"""
    password: str = Field(..., min_length=6, description="新密码（至少6个字符）")


class OAuthRequest(BaseModel):
    """OAuth 请求"""
    provider: str = Field(..., description="OAuth 提供商（如 google）")
    redirect_url: Optional[str] = Field(None, description="OAuth 回调后的重定向 URL")


class AuthResponse(BaseModel):
    """认证响应"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


class SessionResponse(BaseModel):
    """会话响应"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None
    expires_at: Optional[int] = None


class UserResponse(BaseModel):
    """用户信息响应"""
    id: str
    email: Optional[str] = None
    email_confirmed_at: Optional[str] = None
    phone: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    user_metadata: Optional[dict] = None


class SignInResponse(BaseModel):
    """登录响应"""
    success: bool
    user: Optional[UserResponse] = None
    session: Optional[SessionResponse] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


class SignUpResponse(BaseModel):
    """注册响应"""
    success: bool
    user: Optional[UserResponse] = None
    session: Optional[SessionResponse] = None
    message: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


class OAuthUrlResponse(BaseModel):
    """OAuth URL 响应"""
    success: bool
    url: Optional[str] = None
    provider: Optional[str] = None
    error: Optional[str] = None


class MessageResponse(BaseModel):
    """通用消息响应"""
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None

