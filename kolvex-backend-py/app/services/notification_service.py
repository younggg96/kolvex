"""
通知服务 - 处理用户通知相关业务逻辑
"""
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
from supabase import Client

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)


class NotificationType(str, Enum):
    """通知类型枚举"""
    POSITION_BUY = "POSITION_BUY"          # 买入股票
    POSITION_SELL = "POSITION_SELL"        # 卖出股票
    POSITION_INCREASE = "POSITION_INCREASE" # 加仓
    POSITION_DECREASE = "POSITION_DECREASE" # 减仓
    NEW_FOLLOWER = "NEW_FOLLOWER"          # 新粉丝
    SYSTEM = "SYSTEM"                       # 系统通知


class NotificationService:
    """通知服务类"""
    
    def __init__(self, supabase: Optional[Client] = None):
        self.supabase = supabase or get_supabase_service()
    
    async def create_notification(
        self,
        user_id: str,
        notification_type: NotificationType,
        title: str,
        message: str,
        related_user_id: Optional[str] = None,
        related_symbol: Optional[str] = None,
        related_data: Optional[Dict[str, Any]] = None,
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
            
            result = self.supabase.table("notifications").insert(notification_data).execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"创建通知失败: {e}")
            return None
    
    async def create_bulk_notifications(
        self,
        notifications: List[Dict[str, Any]]
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
            result = self.supabase.table("notifications").insert(notifications).execute()
            return len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"批量创建通知失败: {e}")
            return 0
    
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
            # 获取该用户的所有粉丝
            followers_result = (
                self.supabase.table("user_follows")
                .select("follower_id")
                .eq("following_id", user_id)
                .execute()
            )
            
            if not followers_result.data:
                logger.info(f"用户 {user_id} 没有粉丝，跳过通知")
                return 0
            
            follower_ids = [f["follower_id"] for f in followers_result.data]
            logger.info(f"用户 {user_id} 有 {len(follower_ids)} 个粉丝需要通知")
            
            # 为每个粉丝创建通知
            notifications = []
            display_name = username or "Someone you follow"
            
            for change in changes:
                change_type = change.get("type")
                symbol = change.get("symbol", "Unknown")
                units_change = abs(change.get("units_change", 0))
                
                # 根据变化类型设置通知内容
                if change_type == "buy":
                    notif_type = NotificationType.POSITION_BUY
                    title = f"🛒 {display_name} bought {symbol}"
                    message = f"{display_name} opened a new position in {symbol}"
                elif change_type == "sell":
                    notif_type = NotificationType.POSITION_SELL
                    title = f"💰 {display_name} sold {symbol}"
                    message = f"{display_name} closed their position in {symbol}"
                elif change_type == "increase":
                    notif_type = NotificationType.POSITION_INCREASE
                    title = f"📈 {display_name} added to {symbol}"
                    message = f"{display_name} increased their position in {symbol}"
                elif change_type == "decrease":
                    notif_type = NotificationType.POSITION_DECREASE
                    title = f"📉 {display_name} reduced {symbol}"
                    message = f"{display_name} decreased their position in {symbol}"
                else:
                    continue
                
                # 为每个粉丝创建通知
                for follower_id in follower_ids:
                    notifications.append({
                        "user_id": follower_id,
                        "type": notif_type.value,
                        "title": title,
                        "message": message,
                        "related_user_id": user_id,
                        "related_symbol": symbol,
                        "related_data": {
                            "change_type": change_type,
                            "units_change": units_change,
                            "current_units": change.get("current_units"),
                            "price": change.get("price"),
                        },
                    })
            
            # 批量插入通知
            if notifications:
                count = await self.create_bulk_notifications(notifications)
                logger.info(f"成功创建 {count} 条通知")
                return count
            
            return 0
            
        except Exception as e:
            logger.error(f"通知粉丝持仓变化失败: {e}")
            return 0
    
    async def get_user_notifications(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 20,
        unread_only: bool = False,
    ) -> Dict[str, Any]:
        """
        获取用户的通知列表
        
        Args:
            user_id: 用户ID
            page: 页码
            page_size: 每页数量
            unread_only: 是否只返回未读通知
            
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

