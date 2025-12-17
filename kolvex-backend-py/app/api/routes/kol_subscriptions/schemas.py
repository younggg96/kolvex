"""
KOL 订阅相关的 Pydantic 模型
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# Platform 类型
Platform = Literal["TWITTER", "REDDIT", "YOUTUBE", "REDNOTE"]


class KOLSubscriptionCreate(BaseModel):
    """创建 KOL 订阅请求"""
    kol_id: str = Field(..., description="KOL 的用户名/ID")
    platform: Platform = Field(..., description="平台类型")
    notify: bool = Field(default=True, description="是否开启通知")


class KOLSubscriptionUpdate(BaseModel):
    """更新 KOL 订阅请求"""
    notify: Optional[bool] = Field(None, description="是否开启通知")


class KOLProfile(BaseModel):
    """KOL 详细信息"""
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    username: Optional[str] = None
    is_verified: bool = False
    bio: Optional[str] = None
    followers_count: int = 0
    posts_count: int = 0


class KOLSubscriptionResponse(BaseModel):
    """KOL 订阅响应"""
    id: str
    user_id: str
    kol_id: str
    platform: Platform
    notify: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    # KOL 详细信息
    kol_name: Optional[str] = None
    kol_avatar_url: Optional[str] = None
    kol_username: Optional[str] = None
    kol_verified: bool = False
    kol_bio: Optional[str] = None
    kol_followers_count: int = 0
    kol_category: Optional[str] = None
    kol_influence_score: float = 0
    kol_trending_score: float = 0


class KOLSubscriptionsListResponse(BaseModel):
    """KOL 订阅列表响应"""
    count: int
    tracked_kols: list[KOLSubscriptionResponse]


class KOLTrackedCheckResponse(BaseModel):
    """检查 KOL 是否已追踪的响应"""
    kol_id: str
    platform: Platform
    is_tracked: bool
    subscription_id: Optional[str] = None


class MessageResponse(BaseModel):
    """通用消息响应"""
    message: str
    success: bool = True

