"""
用户相关 API 路由
"""
from fastapi import APIRouter, Depends, status, Query
from typing import Optional
from supabase import Client

from app.core.supabase import get_supabase_service
from app.api.dependencies.auth import get_current_user_id, get_current_user_email
from app.services.user_service import UserService
from app.schemas.user import (
    UserProfileCreate,
    UserProfileUpdate,
    UserProfileResponse,
    UserThemeUpdate,
    UserNotificationUpdate,
    MessageResponse,
)

router = APIRouter(prefix="/users", tags=["users"])


def get_user_service(supabase: Client = Depends(get_supabase_service)) -> UserService:
    """获取用户服务实例（使用 service client 绕过 RLS）"""
    return UserService(supabase)


@router.get("/me", response_model=UserProfileResponse, summary="获取当前用户资料")
async def get_current_user_profile(
    current_user_id: str = Depends(get_current_user_id),
    user_service: UserService = Depends(get_user_service),
):
    """
    获取当前登录用户的资料
    
    需要认证：Bearer token
    """
    return await user_service.get_user_profile(current_user_id)


@router.put("/me", response_model=UserProfileResponse, summary="更新当前用户资料")
async def update_current_user_profile(
    profile_update: UserProfileUpdate,
    current_user_id: str = Depends(get_current_user_id),
    user_service: UserService = Depends(get_user_service),
):
    """
    更新当前登录用户的资料
    
    需要认证：Bearer token
    
    可更新字段：
    - username: 用户名
    - full_name: 全名
    - avatar_url: 头像 URL
    - phone_e164: 手机号（E.164 格式）
    - theme: 主题偏好（LIGHT/DARK/SYSTEM）
    - is_subscribe_newsletter: 是否订阅邮件通讯
    - notification_method: 通知方式（EMAIL/MESSAGE）
    """
    return await user_service.update_user_profile(current_user_id, profile_update)


@router.patch("/me/theme", response_model=UserProfileResponse, summary="更新用户主题")
async def update_current_user_theme(
    theme_update: UserThemeUpdate,
    current_user_id: str = Depends(get_current_user_id),
    user_service: UserService = Depends(get_user_service),
):
    """
    更新当前用户的主题偏好
    
    需要认证：Bearer token
    """
    return await user_service.update_user_theme(current_user_id, theme_update)


@router.patch("/me/notifications", response_model=UserProfileResponse, summary="更新通知设置")
async def update_current_user_notifications(
    notification_update: UserNotificationUpdate,
    current_user_id: str = Depends(get_current_user_id),
    user_service: UserService = Depends(get_user_service),
):
    """
    更新当前用户的通知设置
    
    需要认证：Bearer token
    """
    return await user_service.update_user_notification(current_user_id, notification_update)


@router.delete("/me", response_model=MessageResponse, summary="删除当前用户资料")
async def delete_current_user_profile(
    current_user_id: str = Depends(get_current_user_id),
    user_service: UserService = Depends(get_user_service),
):
    """
    删除当前用户的资料
    
    需要认证：Bearer token
    
    注意：这是硬删除操作，将永久删除用户资料
    """
    result = await user_service.delete_user_profile(current_user_id)
    return MessageResponse(
        message=result.get("message", "用户资料已删除"),
        success=True
    )


@router.get("/{user_id}", response_model=UserProfileResponse, summary="获取指定用户资料")
async def get_user_profile_by_id(
    user_id: str,
    user_service: UserService = Depends(get_user_service),
):
    """
    获取指定用户的公开资料
    
    不需要认证
    """
    return await user_service.get_user_profile(user_id)


@router.post(
    "/",
    response_model=UserProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建用户资料"
)
async def create_user_profile(
    profile_data: UserProfileCreate,
    current_user_id: str = Depends(get_current_user_id),
    user_service: UserService = Depends(get_user_service),
):
    """
    创建用户资料
    
    需要认证：Bearer token
    
    注意：通常在用户注册后通过 Supabase trigger 自动创建
    此接口主要用于手动创建或测试
    """
    return await user_service.create_user_profile(current_user_id, profile_data)


# ===== 管理员功能（可选） =====

@router.get(
    "/",
    response_model=dict,
    summary="获取用户列表（管理员）",
    include_in_schema=False  # 暂时不在文档中显示
)
async def list_users(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    current_user_id: str = Depends(get_current_user_id),
    user_service: UserService = Depends(get_user_service),
):
    """
    获取用户列表（管理员功能）
    
    需要认证：Bearer token
    需要权限：管理员
    
    TODO: 添加管理员权限检查
    """
    return await user_service.list_users(page, page_size, search)

