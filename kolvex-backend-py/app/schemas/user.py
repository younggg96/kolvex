"""
用户相关 Pydantic Schemas
"""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime
from enum import Enum


class MembershipEnum(str, Enum):
    """会员类型枚举"""

    FREE = "FREE"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"


class ThemeEnum(str, Enum):
    """主题枚举"""

    LIGHT = "LIGHT"
    DARK = "DARK"
    SYSTEM = "SYSTEM"


class NotificationMethodEnum(str, Enum):
    """通知方式枚举"""

    EMAIL = "EMAIL"
    MESSAGE = "MESSAGE"


# ===== 请求 Schemas =====


class UserProfileCreate(BaseModel):
    """创建用户资料（注册后自动创建）"""

    email: EmailStr
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserProfileUpdate(BaseModel):
    """更新用户资料"""

    username: Optional[str] = Field(None, max_length=50)
    full_name: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = None
    phone_e164: Optional[str] = Field(None, max_length=20)
    theme: Optional[ThemeEnum] = None
    is_subscribe_newsletter: Optional[bool] = None
    notification_method: Optional[NotificationMethodEnum] = None

    model_config = ConfigDict(use_enum_values=True)


class UserThemeUpdate(BaseModel):
    """更新用户主题"""

    theme: ThemeEnum

    model_config = ConfigDict(use_enum_values=True)


class UserNotificationUpdate(BaseModel):
    """更新用户通知设置"""

    is_subscribe_newsletter: Optional[bool] = None
    notification_method: Optional[NotificationMethodEnum] = None

    model_config = ConfigDict(use_enum_values=True)


# ===== 响应 Schemas =====


class UserProfileResponse(BaseModel):
    """用户资料响应"""

    id: str
    email: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone_e164: Optional[str] = None
    membership: MembershipEnum
    theme: Optional[ThemeEnum] = None
    is_subscribe_newsletter: bool
    notification_method: Optional[NotificationMethodEnum] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "email": "user@example.com",
                "username": "john_doe",
                "full_name": "John Doe",
                "avatar_url": "https://example.com/avatar.jpg",
                "phone_e164": "+1234567890",
                "membership": "FREE",
                "theme": "SYSTEM",
                "is_subscribe_newsletter": True,
                "notification_method": "EMAIL",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            }
        },
    )


class UserProfileListResponse(BaseModel):
    """用户资料列表响应"""

    users: list[UserProfileResponse]
    total: int
    page: int
    page_size: int


# ===== 通用响应 Schemas =====


class MessageResponse(BaseModel):
    """通用消息响应"""

    message: str
    success: bool = True

    model_config = ConfigDict(
        json_schema_extra={"example": {"message": "操作成功", "success": True}}
    )


class ErrorResponse(BaseModel):
    """错误响应"""

    detail: str
    success: bool = False
    error_code: Optional[str] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "detail": "用户未找到",
                "success": False,
                "error_code": "USER_NOT_FOUND",
            }
        }
    )
