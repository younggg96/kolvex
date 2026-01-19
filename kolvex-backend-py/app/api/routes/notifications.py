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
    read_only: bool = Query(False, description="是否只返回已读通知"),
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
        read_only=read_only,
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


# ===== Test Email API =====

class SendEmailRequest(BaseModel):
    """发送邮件请求"""
    notification_ids: Optional[list[str]] = None  # 指定通知ID列表，为空则发送所有未读通知
    send_all_unread: bool = False  # 是否发送所有未读通知


class SendEmailResponse(BaseModel):
    """发送邮件响应"""
    success: bool
    message: str
    emails_sent: int
    notifications_processed: int
    errors: list[str] = []


@router.post("/test-send-email", response_model=SendEmailResponse, summary="测试发送通知邮件")
async def test_send_notification_email(
    request: SendEmailRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    测试发送通知邮件
    
    此 API 用于测试邮件通知功能，会立即为指定的通知或所有未读通知发送邮件。
    
    需要认证：Bearer token
    
    请求参数:
    - notification_ids: 指定要发送邮件的通知ID列表（可选）
    - send_all_unread: 是否发送所有未读通知的邮件（默认 false）
    
    注意：至少需要指定 notification_ids 或将 send_all_unread 设为 true
    """
    from app.services.email_service import get_email_service
    
    email_service = get_email_service()
    errors = []
    emails_sent = 0
    notifications_processed = 0
    
    try:
        # 获取用户信息
        user_result = (
            service.supabase.table("user_profiles")
            .select("email, username")
            .eq("id", current_user_id)
            .single()
            .execute()
        )
        
        if not user_result.data:
            return SendEmailResponse(
                success=False,
                message="用户信息不存在",
                emails_sent=0,
                notifications_processed=0,
                errors=["User profile not found"]
            )
        
        user_email = user_result.data.get("email")
        username = user_result.data.get("username") or "there"
        
        if not user_email:
            return SendEmailResponse(
                success=False,
                message="用户邮箱不存在",
                emails_sent=0,
                notifications_processed=0,
                errors=["User email not found"]
            )
        
        # 获取通知列表
        if request.notification_ids:
            # 获取指定的通知
            notif_result = (
                service.supabase.table("notifications")
                .select("*")
                .eq("user_id", current_user_id)
                .in_("id", request.notification_ids)
                .execute()
            )
        elif request.send_all_unread:
            # 获取所有未读通知
            notif_result = (
                service.supabase.table("notifications")
                .select("*")
                .eq("user_id", current_user_id)
                .eq("is_read", False)
                .order("created_at", desc=True)
                .limit(50)  # 限制最多50条，避免发送过多邮件
                .execute()
            )
        else:
            return SendEmailResponse(
                success=False,
                message="请指定 notification_ids 或将 send_all_unread 设为 true",
                emails_sent=0,
                notifications_processed=0,
                errors=["Must specify notification_ids or set send_all_unread to true"]
            )
        
        notifications = notif_result.data or []
        
        if not notifications:
            return SendEmailResponse(
                success=True,
                message="没有找到需要发送的通知",
                emails_sent=0,
                notifications_processed=0
            )
        
        # 为每个通知发送邮件
        for notif in notifications:
            notifications_processed += 1
            try:
                html_content = email_service.generate_notification_email_html(
                    username=username,
                    notification_type=notif.get("type", "SYSTEM"),
                    title=notif.get("title", "Notification"),
                    message=notif.get("message", ""),
                    related_symbol=notif.get("related_symbol"),
                    related_data=notif.get("related_data"),
                )
                
                text_content = email_service.generate_notification_email_text(
                    username=username,
                    notification_type=notif.get("type", "SYSTEM"),
                    title=notif.get("title", "Notification"),
                    message=notif.get("message", ""),
                    related_symbol=notif.get("related_symbol"),
                )
                
                success = await email_service.send_email(
                    to=user_email,
                    subject=f"🔔 {notif.get('title', 'Notification')}",
                    html_content=html_content,
                    text_content=text_content,
                )
                
                if success:
                    emails_sent += 1
                else:
                    errors.append(f"Failed to send email for notification {notif.get('id')}")
                    
            except Exception as e:
                errors.append(f"Error processing notification {notif.get('id')}: {str(e)}")
        
        return SendEmailResponse(
            success=emails_sent > 0,
            message=f"成功发送 {emails_sent}/{notifications_processed} 封邮件到 {user_email}",
            emails_sent=emails_sent,
            notifications_processed=notifications_processed,
            errors=errors
        )
        
    except Exception as e:
        return SendEmailResponse(
            success=False,
            message=f"发送邮件失败: {str(e)}",
            emails_sent=emails_sent,
            notifications_processed=notifications_processed,
            errors=[str(e)]
        )

