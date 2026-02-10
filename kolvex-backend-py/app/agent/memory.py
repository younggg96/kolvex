"""
Conversation Memory
基于 Supabase 的对话记忆管理
负责从数据库加载历史消息并转换为 LangChain 消息格式
"""

import logging
from typing import List, Optional, Dict, Any

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage

from app.core.supabase import get_supabase_service
from app.agent.config import MAX_CONTEXT_MESSAGES

logger = logging.getLogger(__name__)


def db_messages_to_langchain(messages: List[Dict[str, Any]]) -> List[BaseMessage]:
    """
    将数据库中的消息记录转换为 LangChain 消息对象

    Args:
        messages: 数据库消息列表 [{"role": "user", "content": "..."}, ...]

    Returns:
        LangChain BaseMessage 列表
    """
    lc_messages = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "user":
            lc_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))
        elif role == "system":
            lc_messages.append(SystemMessage(content=content))

    return lc_messages


async def load_conversation_history(
    user_id: str,
    conversation_id: str,
    max_messages: int = MAX_CONTEXT_MESSAGES,
) -> List[BaseMessage]:
    """
    从 Supabase 加载对话历史

    Args:
        user_id: 用户 ID
        conversation_id: 对话 ID
        max_messages: 最多加载的消息数（上下文窗口）

    Returns:
        LangChain 消息列表
    """
    try:
        supabase = get_supabase_service()

        # 验证对话属于该用户
        conv_result = (
            supabase.table("chat_conversations")
            .select("id")
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if not conv_result.data:
            logger.warning(f"Conversation {conversation_id} not found for user {user_id}")
            return []

        # 获取最近 N 条消息
        result = (
            supabase.table("chat_messages")
            .select("role, content, created_at")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=True)
            .limit(max_messages)
            .execute()
        )

        messages = result.data or []
        # 反转为时间正序
        messages.reverse()

        return db_messages_to_langchain(messages)

    except Exception as e:
        logger.error(f"Failed to load conversation history: {e}")
        return []


async def save_message(
    user_id: str,
    conversation_id: str,
    role: str,
    content: str,
) -> Optional[Dict[str, Any]]:
    """
    保存消息到数据库

    Args:
        user_id: 用户 ID
        conversation_id: 对话 ID
        role: 角色 (user/assistant/system)
        content: 消息内容

    Returns:
        保存的消息记录
    """
    try:
        supabase = get_supabase_service()

        # 验证对话属于该用户
        conv_result = (
            supabase.table("chat_conversations")
            .select("id, title")
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if not conv_result.data:
            logger.error(f"Conversation {conversation_id} not found for user {user_id}")
            return None

        # 保存消息
        result = (
            supabase.table("chat_messages")
            .insert({
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
            })
            .execute()
        )

        if result.data:
            msg = result.data[0]

            # 如果是第一条用户消息，自动更新对话标题
            conv = conv_result.data
            if conv.get("title") == "New Chat" and role == "user":
                new_title = content[:50] + ("..." if len(content) > 50 else "")
                try:
                    supabase.table("chat_conversations").update(
                        {"title": new_title}
                    ).eq("id", conversation_id).eq("user_id", user_id).execute()
                except Exception as title_err:
                    logger.warning(f"Failed to update conversation title: {title_err}")

            return {
                "id": msg["id"],
                "conversation_id": msg["conversation_id"],
                "role": msg["role"],
                "content": msg["content"],
                "created_at": msg["created_at"],
            }

        return None

    except Exception as e:
        logger.error(f"Failed to save message: {e}")
        return None
