"""
聊天服务 - 处理聊天对话相关业务逻辑
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from supabase import Client

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)

MAX_CONVERSATIONS_PER_USER = 100


class ChatService:
    """聊天服务类"""

    def __init__(self, supabase: Optional[Client] = None):
        self.supabase = supabase or get_supabase_service()

    async def get_conversations(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> Dict[str, Any]:
        """
        获取用户的对话列表

        Args:
            user_id: 用户ID
            page: 页码
            page_size: 每页数量

        Returns:
            对话列表和分页信息
        """
        try:
            offset = (page - 1) * page_size

            result = (
                self.supabase.table("chat_conversations")
                .select("*, chat_messages(id, role, content, created_at)", count="exact")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .range(offset, offset + page_size - 1)
                .execute()
            )

            conversations = []
            for conv in result.data or []:
                messages = conv.pop("chat_messages", [])
                # Sort messages by created_at
                messages.sort(key=lambda m: m.get("created_at", ""))
                
                conversations.append({
                    "id": conv["id"],
                    "title": conv["title"],
                    "messages": messages,
                    "created_at": conv["created_at"],
                    "updated_at": conv["updated_at"],
                })

            return {
                "conversations": conversations,
                "total": result.count or 0,
                "page": page,
                "page_size": page_size,
            }

        except Exception as e:
            logger.error(f"获取对话列表失败: {e}")
            return {
                "conversations": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
            }

    async def get_conversation(
        self,
        user_id: str,
        conversation_id: str,
    ) -> Optional[Dict[str, Any]]:
        """
        获取单个对话详情

        Args:
            user_id: 用户ID
            conversation_id: 对话ID

        Returns:
            对话详情
        """
        try:
            result = (
                self.supabase.table("chat_conversations")
                .select("*, chat_messages(id, role, content, created_at)")
                .eq("id", conversation_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            if not result.data:
                return None

            conv = result.data
            messages = conv.pop("chat_messages", [])
            # Sort messages by created_at
            messages.sort(key=lambda m: m.get("created_at", ""))

            return {
                "id": conv["id"],
                "title": conv["title"],
                "messages": messages,
                "created_at": conv["created_at"],
                "updated_at": conv["updated_at"],
            }

        except Exception as e:
            logger.error(f"获取对话详情失败: {e}")
            return None

    async def create_conversation(
        self,
        user_id: str,
        title: str = "New Chat",
    ) -> Optional[Dict[str, Any]]:
        """
        创建新对话

        Args:
            user_id: 用户ID
            title: 对话标题

        Returns:
            创建的对话
        """
        try:
            # Check conversation limit
            count_result = (
                self.supabase.table("chat_conversations")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .execute()
            )
            
            if count_result.count and count_result.count >= MAX_CONVERSATIONS_PER_USER:
                # Delete oldest conversation
                oldest = (
                    self.supabase.table("chat_conversations")
                    .select("id")
                    .eq("user_id", user_id)
                    .order("updated_at", desc=False)
                    .limit(1)
                    .execute()
                )
                if oldest.data:
                    self.supabase.table("chat_conversations").delete().eq(
                        "id", oldest.data[0]["id"]
                    ).execute()

            result = (
                self.supabase.table("chat_conversations")
                .insert({
                    "user_id": user_id,
                    "title": title,
                })
                .execute()
            )

            if result.data:
                conv = result.data[0]
                return {
                    "id": conv["id"],
                    "title": conv["title"],
                    "messages": [],
                    "created_at": conv["created_at"],
                    "updated_at": conv["updated_at"],
                }
            return None

        except Exception as e:
            logger.error(f"创建对话失败: {e}")
            return None

    async def update_conversation_title(
        self,
        user_id: str,
        conversation_id: str,
        title: str,
    ) -> bool:
        """
        更新对话标题

        Args:
            user_id: 用户ID
            conversation_id: 对话ID
            title: 新标题

        Returns:
            是否成功
        """
        try:
            result = (
                self.supabase.table("chat_conversations")
                .update({"title": title})
                .eq("id", conversation_id)
                .eq("user_id", user_id)
                .execute()
            )
            return bool(result.data)
        except Exception as e:
            logger.error(f"更新对话标题失败: {e}")
            return False

    async def delete_conversation(
        self,
        user_id: str,
        conversation_id: str,
    ) -> bool:
        """
        删除对话

        Args:
            user_id: 用户ID
            conversation_id: 对话ID

        Returns:
            是否成功
        """
        try:
            result = (
                self.supabase.table("chat_conversations")
                .delete()
                .eq("id", conversation_id)
                .eq("user_id", user_id)
                .execute()
            )
            return bool(result.data)
        except Exception as e:
            logger.error(f"删除对话失败: {e}")
            return False

    async def delete_all_conversations(self, user_id: str) -> int:
        """
        删除用户所有对话

        Args:
            user_id: 用户ID

        Returns:
            删除的数量
        """
        try:
            result = (
                self.supabase.table("chat_conversations")
                .delete()
                .eq("user_id", user_id)
                .execute()
            )
            return len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"删除所有对话失败: {e}")
            return 0

    async def add_message(
        self,
        user_id: str,
        conversation_id: str,
        role: str,
        content: str,
    ) -> Optional[Dict[str, Any]]:
        """
        添加消息到对话

        Args:
            user_id: 用户ID
            conversation_id: 对话ID
            role: 角色 (user/assistant/system)
            content: 消息内容

        Returns:
            创建的消息
        """
        try:
            # Verify conversation belongs to user
            conv_result = (
                self.supabase.table("chat_conversations")
                .select("id, title")
                .eq("id", conversation_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            
            if not conv_result.data:
                return None

            # Add message
            result = (
                self.supabase.table("chat_messages")
                .insert({
                    "conversation_id": conversation_id,
                    "role": role,
                    "content": content,
                })
                .execute()
            )

            if result.data:
                msg = result.data[0]
                
                # Auto-update title for first user message
                conv = conv_result.data
                if conv["title"] == "New Chat" and role == "user":
                    new_title = content[:50] + ("..." if len(content) > 50 else "")
                    await self.update_conversation_title(user_id, conversation_id, new_title)

                return {
                    "id": msg["id"],
                    "conversation_id": msg["conversation_id"],
                    "role": msg["role"],
                    "content": msg["content"],
                    "created_at": msg["created_at"],
                }
            return None

        except Exception as e:
            logger.error(f"添加消息失败: {e}")
            return None

    async def get_messages(
        self,
        user_id: str,
        conversation_id: str,
    ) -> List[Dict[str, Any]]:
        """
        获取对话的所有消息

        Args:
            user_id: 用户ID
            conversation_id: 对话ID

        Returns:
            消息列表
        """
        try:
            # Verify conversation belongs to user
            conv_result = (
                self.supabase.table("chat_conversations")
                .select("id")
                .eq("id", conversation_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            
            if not conv_result.data:
                return []

            result = (
                self.supabase.table("chat_messages")
                .select("*")
                .eq("conversation_id", conversation_id)
                .order("created_at", desc=False)
                .execute()
            )

            return result.data or []

        except Exception as e:
            logger.error(f"获取消息失败: {e}")
            return []


def get_chat_service() -> ChatService:
    """获取聊天服务实例（用于 FastAPI 依赖注入）"""
    return ChatService()
