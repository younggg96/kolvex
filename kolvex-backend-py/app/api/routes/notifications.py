"""
Notification API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette import status as http_status
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.api.dependencies.auth import get_current_user_id
from app.services.notification_service import (
    NotificationService,
    get_notification_service,
)


router = APIRouter(prefix="/notifications", tags=["notifications"])


# ===== Response Models =====


class NotificationResponse(BaseModel):
    """Notification response"""

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
    """Notification list response"""

    notifications: list[NotificationResponse]
    total: int
    page: int
    page_size: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    """Unread count response"""

    unread_count: int


class MessageResponse(BaseModel):
    """Generic message response"""

    message: str
    success: bool = True


# ===== Routes =====


@router.get(
    "", response_model=NotificationListResponse, summary="Get notification list"
)
async def get_notifications(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    unread_only: bool = Query(False, description="Return only unread notifications"),
    read_only: bool = Query(False, description="Return only read notifications"),
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    Get the current user's notification list

    Requires authentication: Bearer token
    """
    result = await service.get_user_notifications(
        user_id=current_user_id,
        page=page,
        page_size=page_size,
        unread_only=unread_only,
        read_only=read_only,
    )
    return NotificationListResponse(**result)


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread notification count",
)
async def get_unread_count(
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    Get the current user's unread notification count

    Requires authentication: Bearer token
    """
    count = await service.get_unread_count(current_user_id)
    return UnreadCountResponse(unread_count=count)


@router.post(
    "/{notification_id}/read",
    response_model=MessageResponse,
    summary="Mark notification as read",
)
async def mark_as_read(
    notification_id: str,
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    Mark a single notification as read

    Requires authentication: Bearer token
    """
    success = await service.mark_as_read(current_user_id, notification_id)
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Notification not found or already deleted",
        )
    return MessageResponse(message="Marked as read", success=True)


@router.post(
    "/read-all",
    response_model=MessageResponse,
    summary="Mark all notifications as read",
)
async def mark_all_as_read(
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    Mark all notifications as read for the current user

    Requires authentication: Bearer token
    """
    count = await service.mark_all_as_read(current_user_id)
    return MessageResponse(
        message=f"Marked {count} notifications as read", success=True
    )


@router.delete(
    "/{notification_id}", response_model=MessageResponse, summary="Delete notification"
)
async def delete_notification(
    notification_id: str,
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    Delete a single notification

    Requires authentication: Bearer token
    """
    success = await service.delete_notification(current_user_id, notification_id)
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Notification not found or already deleted",
        )
    return MessageResponse(message="Notification deleted", success=True)


@router.delete("", response_model=MessageResponse, summary="Delete all notifications")
async def delete_all_notifications(
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    Delete all notifications for the current user

    Requires authentication: Bearer token
    """
    count = await service.delete_all_notifications(current_user_id)
    return MessageResponse(message=f"Deleted {count} notifications", success=True)


# ===== Test Email API =====


class SendEmailRequest(BaseModel):
    """Send email request"""

    notification_ids: Optional[list[str]] = (
        None  # Specific notification IDs, empty to send all unread
    )
    send_all_unread: bool = False  # Whether to send all unread notifications
    send_as_digest: bool = True  # Send all notifications in ONE email (digest mode)


class SendEmailResponse(BaseModel):
    """Send email response"""

    success: bool
    message: str
    emails_sent: int
    notifications_processed: int
    errors: list[str] = []


@router.post(
    "/test-send-email",
    response_model=SendEmailResponse,
    summary="Test send notification email",
)
async def test_send_notification_email(
    request: SendEmailRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: NotificationService = Depends(get_notification_service),
):
    """
    Test send notification email

    This API is used to test the email notification feature.

    Requires authentication: Bearer token

    Request parameters:
    - notification_ids: List of notification IDs to send emails for (optional)
    - send_all_unread: Whether to send emails for all unread notifications (default: false)
    - send_as_digest: Send all notifications in ONE digest email (default: true)

    Note: Must specify notification_ids or set send_all_unread to true
    """
    from app.services.email_service import get_email_service

    email_service = get_email_service()
    errors = []
    emails_sent = 0
    notifications_processed = 0

    try:
        # Get user info
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
                message="User profile not found",
                emails_sent=0,
                notifications_processed=0,
                errors=["User profile not found"],
            )

        user_email = user_result.data.get("email")
        username = user_result.data.get("username") or "there"

        if not user_email:
            return SendEmailResponse(
                success=False,
                message="User email not found",
                emails_sent=0,
                notifications_processed=0,
                errors=["User email not found"],
            )

        # Get notification list
        if request.notification_ids:
            # Get specified notifications
            notif_result = (
                service.supabase.table("notifications")
                .select("*")
                .eq("user_id", current_user_id)
                .in_("id", request.notification_ids)
                .execute()
            )
        elif request.send_all_unread:
            # Get all unread notifications
            notif_result = (
                service.supabase.table("notifications")
                .select("*")
                .eq("user_id", current_user_id)
                .eq("is_read", False)
                .order("created_at", desc=True)
                .limit(50)  # Limit to 50 to avoid too large email
                .execute()
            )
        else:
            return SendEmailResponse(
                success=False,
                message="Must specify notification_ids or set send_all_unread to true",
                emails_sent=0,
                notifications_processed=0,
                errors=["Must specify notification_ids or set send_all_unread to true"],
            )

        notifications = notif_result.data or []

        if not notifications:
            return SendEmailResponse(
                success=True,
                message="No notifications found to send",
                emails_sent=0,
                notifications_processed=0,
            )

        notifications_processed = len(notifications)

        # ===== DIGEST MODE: Send all notifications in ONE email =====
        if request.send_as_digest:
            try:
                html_content = email_service.generate_digest_email_html(
                    username=username,
                    notifications=notifications,
                )
                text_content = email_service.generate_digest_email_text(
                    username=username,
                    notifications=notifications,
                )

                success, error_msg = await email_service.send_email(
                    to=user_email,
                    subject=f"🔔 You have {len(notifications)} new notifications",
                    html_content=html_content,
                    text_content=text_content,
                )

                if success:
                    emails_sent = 1
                    return SendEmailResponse(
                        success=True,
                        message=f"Successfully sent digest email with {notifications_processed} notifications to {user_email}",
                        emails_sent=1,
                        notifications_processed=notifications_processed,
                        errors=[],
                    )
                else:
                    return SendEmailResponse(
                        success=False,
                        message=f"Failed to send digest email: {error_msg}",
                        emails_sent=0,
                        notifications_processed=notifications_processed,
                        errors=[error_msg or "Unknown error"],
                    )

            except Exception as e:
                return SendEmailResponse(
                    success=False,
                    message=f"Error sending digest email: {str(e)}",
                    emails_sent=0,
                    notifications_processed=notifications_processed,
                    errors=[str(e)],
                )

        # ===== INDIVIDUAL MODE: Send separate email for each notification =====
        for notif in notifications:
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

                # Use with_delay=True to avoid Resend rate limiting
                success, error_msg = await email_service.send_email(
                    to=user_email,
                    subject=f"🔔 {notif.get('title', 'Notification')}",
                    html_content=html_content,
                    text_content=text_content,
                    with_delay=True,
                )

                if success:
                    emails_sent += 1
                else:
                    errors.append(
                        f"Notification {notif.get('id')}: {error_msg or 'Unknown error'}"
                    )

            except Exception as e:
                errors.append(
                    f"Error processing notification {notif.get('id')}: {str(e)}"
                )

        return SendEmailResponse(
            success=emails_sent > 0,
            message=f"Successfully sent {emails_sent}/{notifications_processed} emails to {user_email}",
            emails_sent=emails_sent,
            notifications_processed=notifications_processed,
            errors=errors,
        )

    except Exception as e:
        return SendEmailResponse(
            success=False,
            message=f"Failed to send email: {str(e)}",
            emails_sent=emails_sent,
            notifications_processed=notifications_processed,
            errors=[str(e)],
        )
