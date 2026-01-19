"""
通知服务 - 处理用户通知相关业务逻辑
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
from supabase import Client

from app.core.supabase import get_supabase_service
from app.services.email_service import EmailService, get_email_service

logger = logging.getLogger(__name__)


class NotificationType(str, Enum):
    """通知类型枚举"""

    POSITION_BUY = "POSITION_BUY"  # 买入股票
    POSITION_SELL = "POSITION_SELL"  # 卖出股票
    POSITION_INCREASE = "POSITION_INCREASE"  # 加仓
    POSITION_DECREASE = "POSITION_DECREASE"  # 减仓
    NEW_FOLLOWER = "NEW_FOLLOWER"  # 新粉丝
    SYSTEM = "SYSTEM"  # 系统通知


class NotificationService:
    """通知服务类"""

    def __init__(
        self, 
        supabase: Optional[Client] = None,
        email_service: Optional[EmailService] = None,
    ):
        self.supabase = supabase or get_supabase_service()
        self.email_service = email_service or get_email_service()

    async def create_notification(
        self,
        user_id: str,
        notification_type: NotificationType,
        title: str,
        message: str,
        related_user_id: Optional[str] = None,
        related_symbol: Optional[str] = None,
        related_data: Optional[Dict[str, Any]] = None,
        send_email: bool = False,
        user_email: Optional[str] = None,
        user_username: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        创建单个通知

        Args:
            user_id: 接收通知的用户ID
            notification_type: 通知类型
            title: 标题
            message: 消息内容
            related_user_id: 关联用户ID
            related_symbol: 关联股票代码
            related_data: 额外数据
            send_email: 是否同时发送邮件
            user_email: 用户邮箱（发送邮件时需要）
            user_username: 用户名（发送邮件时用于个性化）

        Returns:
            创建的通知记录
        """
        try:
            notification_data = {
                "user_id": user_id,
                "type": notification_type.value,
                "title": title,
                "message": message,
                "related_user_id": related_user_id,
                "related_symbol": related_symbol,
                "related_data": related_data or {},
            }

            result = (
                self.supabase.table("notifications").insert(notification_data).execute()
            )

            if result.data:
                # 如果需要发送邮件且有用户邮箱
                if send_email and user_email:
                    await self._send_notification_email(
                        to_email=user_email,
                        username=user_username,
                        notification_type=notification_type.value,
                        title=title,
                        message=message,
                        related_symbol=related_symbol,
                        related_data=related_data,
                    )
                return result.data[0]
            return None

        except Exception as e:
            logger.error(f"创建通知失败: {e}")
            return None

    async def _send_notification_email(
        self,
        to_email: str,
        username: Optional[str],
        notification_type: str,
        title: str,
        message: str,
        related_symbol: Optional[str] = None,
        related_data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        发送通知邮件

        Args:
            to_email: 收件人邮箱
            username: 用户名
            notification_type: 通知类型
            title: 标题
            message: 消息内容
            related_symbol: 关联股票代码
            related_data: 额外数据

        Returns:
            是否发送成功
        """
        try:
            html_content = self.email_service.generate_notification_email_html(
                username=username or "there",
                notification_type=notification_type,
                title=title,
                message=message,
                related_symbol=related_symbol,
                related_data=related_data,
            )
            
            text_content = self.email_service.generate_notification_email_text(
                username=username or "there",
                notification_type=notification_type,
                title=title,
                message=message,
                related_symbol=related_symbol,
            )
            
            return await self.email_service.send_email(
                to=to_email,
                subject=f"🔔 {title}",
                html_content=html_content,
                text_content=text_content,
            )
        except Exception as e:
            logger.error(f"发送通知邮件失败: {e}")
            return False

    async def create_bulk_notifications(
        self, notifications: List[Dict[str, Any]]
    ) -> int:
        """
        批量创建通知

        Args:
            notifications: 通知数据列表

        Returns:
            成功创建的数量
        """
        if not notifications:
            return 0

        try:
            result = (
                self.supabase.table("notifications").insert(notifications).execute()
            )
            return len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"批量创建通知失败: {e}")
            return 0

    async def _get_followers_with_email_preference(
        self, user_id: str
    ) -> List[Dict[str, Any]]:
        """
        获取用户的粉丝及其邮件偏好设置

        Args:
            user_id: 被关注用户的ID

        Returns:
            粉丝列表，包含 follower_id, email, username, email_notifications_enabled
        """
        try:
            # 查询关注关系并联合查询用户资料
            result = (
                self.supabase.table("user_follows")
                .select(
                    "follower_id, "
                    "user_profiles!user_follows_follower_id_fkey("
                    "id, email, username, email_notifications_enabled"
                    ")"
                )
                .eq("following_id", user_id)
                .execute()
            )

            if not result.data:
                return []

            followers = []
            for item in result.data:
                profile = item.get("user_profiles")
                if profile:
                    followers.append({
                        "follower_id": item["follower_id"],
                        "email": profile.get("email"),
                        "username": profile.get("username"),
                        "email_notifications_enabled": profile.get("email_notifications_enabled", True),
                    })
                else:
                    # 如果没有获取到 profile，只保留 follower_id
                    followers.append({
                        "follower_id": item["follower_id"],
                        "email": None,
                        "username": None,
                        "email_notifications_enabled": False,
                    })

            return followers

        except Exception as e:
            logger.error(f"获取粉丝邮件偏好失败: {e}")
            # 回退到简单查询
            try:
                simple_result = (
                    self.supabase.table("user_follows")
                    .select("follower_id")
                    .eq("following_id", user_id)
                    .execute()
                )
                return [
                    {
                        "follower_id": f["follower_id"],
                        "email": None,
                        "username": None,
                        "email_notifications_enabled": False,
                    }
                    for f in (simple_result.data or [])
                ]
            except Exception as e2:
                logger.error(f"回退查询也失败: {e2}")
                return []

    async def notify_followers_of_position_changes(
        self,
        user_id: str,
        username: str,
        changes: List[Dict[str, Any]],
    ) -> int:
        """
        通知关注者用户的持仓变化

        Args:
            user_id: 发生变化的用户ID
            username: 用户名（用于显示）
            changes: 持仓变化列表，每项包含:
                - type: 'buy' | 'sell' | 'increase' | 'decrease'
                - symbol: 股票代码
                - units_change: 变化数量
                - current_units: 当前持有数量
                - price: 当前价格

        Returns:
            发送的通知数量
        """
        if not changes:
            return 0

        try:
            # 获取该用户的所有粉丝及其邮件偏好
            followers = await self._get_followers_with_email_preference(user_id)

            if not followers:
                logger.info(f"用户 {user_id} 没有粉丝，跳过通知")
                return 0

            logger.info(f"用户 {user_id} 有 {len(followers)} 个粉丝需要通知")

            # 为每个粉丝创建通知
            notifications = []
            email_notifications = []  # 需要发送邮件的通知
            display_name = username or "Someone you follow"

            for change in changes:
                change_type = change.get("type")
                symbol = change.get("symbol", "Unknown")
                units_change = abs(change.get("units_change", 0))

                # 根据变化类型设置通知内容
                if change_type == "buy":
                    notif_type = NotificationType.POSITION_BUY
                    title = f"Position Buy: {display_name} bought {symbol}"
                    message = f"{display_name} opened a new position in {symbol}"
                elif change_type == "sell":
                    notif_type = NotificationType.POSITION_SELL
                    title = f"Position Sell: {display_name} sold {symbol}"
                    message = f"{display_name} closed their position in {symbol}"
                elif change_type == "increase":
                    notif_type = NotificationType.POSITION_INCREASE
                    title = f"Position Increase: {display_name} added to {symbol}"
                    message = f"{display_name} increased their position in {symbol}"
                elif change_type == "decrease":
                    notif_type = NotificationType.POSITION_DECREASE
                    title = f"Position Decrease: {display_name} reduced {symbol}"
                    message = f"{display_name} decreased their position in {symbol}"
                else:
                    continue

                related_data = {
                    "change_type": change_type,
                    "units_change": units_change,
                    "current_units": change.get("current_units"),
                    "price": change.get("price"),
                }

                # 为每个粉丝创建通知
                for follower in followers:
                    follower_id = follower["follower_id"]
                    
                    notifications.append(
                        {
                            "user_id": follower_id,
                            "type": notif_type.value,
                            "title": title,
                            "message": message,
                            "related_user_id": user_id,
                            "related_symbol": symbol,
                            "related_data": related_data,
                        }
                    )

                    # 如果用户开启了邮件通知，添加到邮件队列
                    if (
                        follower.get("email_notifications_enabled", True)
                        and follower.get("email")
                    ):
                        email_notifications.append({
                            "to": follower["email"],
                            "subject": f"🔔 {title}",
                            "html_content": self.email_service.generate_notification_email_html(
                                username=follower.get("username") or "there",
                                notification_type=notif_type.value,
                                title=title,
                                message=message,
                                related_symbol=symbol,
                                related_data=related_data,
                            ),
                            "text_content": self.email_service.generate_notification_email_text(
                                username=follower.get("username") or "there",
                                notification_type=notif_type.value,
                                title=title,
                                message=message,
                                related_symbol=symbol,
                            ),
                        })

            # 批量插入通知
            notification_count = 0
            if notifications:
                notification_count = await self.create_bulk_notifications(notifications)
                logger.info(f"成功创建 {notification_count} 条通知")

            # 批量发送邮件
            email_count = 0
            if email_notifications:
                email_count = await self.email_service.send_bulk_emails(email_notifications)
                logger.info(f"成功发送 {email_count} 封邮件通知")

            return notification_count

        except Exception as e:
            logger.error(f"通知粉丝持仓变化失败: {e}")
            return 0

    async def get_user_notifications(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 20,
        unread_only: bool = False,
        read_only: bool = False,
    ) -> Dict[str, Any]:
        """
        获取用户的通知列表

        Args:
            user_id: 用户ID
            page: 页码
            page_size: 每页数量
            unread_only: 是否只返回未读通知
            read_only: 是否只返回已读通知

        Returns:
            通知列表和分页信息
        """
        try:
            offset = (page - 1) * page_size

            query = (
                self.supabase.table("notifications")
                .select("*", count="exact")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
            )

            if unread_only:
                query = query.eq("is_read", False)
            elif read_only:
                query = query.eq("is_read", True)

            result = query.range(offset, offset + page_size - 1).execute()

            return {
                "notifications": result.data or [],
                "total": result.count or 0,
                "page": page,
                "page_size": page_size,
                "unread_count": await self.get_unread_count(user_id),
            }

        except Exception as e:
            logger.error(f"获取用户通知失败: {e}")
            return {
                "notifications": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "unread_count": 0,
            }

    async def get_unread_count(self, user_id: str) -> int:
        """获取用户未读通知数量"""
        try:
            result = (
                self.supabase.table("notifications")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .eq("is_read", False)
                .execute()
            )
            return result.count or 0
        except Exception as e:
            logger.error(f"获取未读通知数量失败: {e}")
            return 0

    async def mark_as_read(self, user_id: str, notification_id: str) -> bool:
        """标记单个通知为已读"""
        try:
            result = (
                self.supabase.table("notifications")
                .update({"is_read": True, "read_at": datetime.utcnow().isoformat()})
                .eq("id", notification_id)
                .eq("user_id", user_id)
                .execute()
            )
            return bool(result.data)
        except Exception as e:
            logger.error(f"标记通知已读失败: {e}")
            return False

    async def mark_all_as_read(self, user_id: str) -> int:
        """标记所有通知为已读"""
        try:
            result = (
                self.supabase.table("notifications")
                .update({"is_read": True, "read_at": datetime.utcnow().isoformat()})
                .eq("user_id", user_id)
                .eq("is_read", False)
                .execute()
            )
            return len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"标记所有通知已读失败: {e}")
            return 0

    async def delete_notification(self, user_id: str, notification_id: str) -> bool:
        """删除单个通知"""
        try:
            result = (
                self.supabase.table("notifications")
                .delete()
                .eq("id", notification_id)
                .eq("user_id", user_id)
                .execute()
            )
            return bool(result.data)
        except Exception as e:
            logger.error(f"删除通知失败: {e}")
            return False

    async def delete_all_notifications(self, user_id: str) -> int:
        """删除用户所有通知"""
        try:
            result = (
                self.supabase.table("notifications")
                .delete()
                .eq("user_id", user_id)
                .execute()
            )
            return len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"删除所有通知失败: {e}")
            return 0


def get_notification_service() -> NotificationService:
    """获取通知服务实例（用于 FastAPI 依赖注入）"""
    return NotificationService()
