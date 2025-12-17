"""
通知相关 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from starlette import status as http_status
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.api.dependencies.auth import get_current_user_id
from app.services.notification_service import NotificationService, get_notification_service


router = APIRouter(prefix="/notifications", tags=["notifications"])


# ===== Response Models =====

class NotificationResponse(BaseModel):
    """通知响应"""
    id: str
    user_id: str
    type: str
    title: str
    message: str
    related_user_id: Optional[str] = None
    related_symbol: Optional[str] = None
    related_data: dict = {}
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    """通知列表响应"""
    notifications: list[NotificationResponse]
    total: int
    page: int
    page_size: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    """未读数量响应"""
    unread_count: int


class MessageResponse(BaseModel):
    """通用消息响应"""
    message: str
    success: bool = True


# ===== Routes =====

@router.get("", response_model=NotificationListResponse, summary="获取通知列表")
async def get_notifications(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    unread_only: bool = Query(False, description="是否只返回未读通知"),
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    获取当前用户的通知列表
    
    需要认证：Bearer token
    """
    result = await service.get_user_notifications(
        user_id=current_user_id,
        page=page,
        page_size=page_size,
        unread_only=unread_only,
    )
    return NotificationListResponse(**result)


@router.get("/unread-count", response_model=UnreadCountResponse, summary="获取未读通知数量")
async def get_unread_count(
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    获取当前用户的未读通知数量
    
    需要认证：Bearer token
    """
    count = await service.get_unread_count(current_user_id)
    return UnreadCountResponse(unread_count=count)


@router.post("/{notification_id}/read", response_model=MessageResponse, summary="标记通知为已读")
async def mark_as_read(
    notification_id: str,
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    标记单个通知为已读
    
    需要认证：Bearer token
    """
    success = await service.mark_as_read(current_user_id, notification_id)
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="通知不存在或已被删除"
        )
    return MessageResponse(message="已标记为已读", success=True)


@router.post("/read-all", response_model=MessageResponse, summary="标记所有通知为已读")
async def mark_all_as_read(
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    标记当前用户所有通知为已读
    
    需要认证：Bearer token
    """
    count = await service.mark_all_as_read(current_user_id)
    return MessageResponse(message=f"已标记 {count} 条通知为已读", success=True)


@router.delete("/{notification_id}", response_model=MessageResponse, summary="删除通知")
async def delete_notification(
    notification_id: str,
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    删除单个通知
    
    需要认证：Bearer token
    """
    success = await service.delete_notification(current_user_id, notification_id)
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="通知不存在或已被删除"
        )
    return MessageResponse(message="通知已删除", success=True)


@router.delete("", response_model=MessageResponse, summary="删除所有通知")
async def delete_all_notifications(
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    删除当前用户所有通知
    
    需要认证：Bearer token
    """
    count = await service.delete_all_notifications(current_user_id)
    return MessageResponse(message=f"已删除 {count} 条通知", success=True)

