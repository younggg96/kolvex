"""
Conversation Memory
基于 Supabase 的对话记忆管理
负责从数据库加载历史消息并转换为 LangChain 消息格式
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from app.agent.config import MAX_CONTEXT_MESSAGES
from app.core.supabase import get_supabase_service

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
    max_messages: Optional[int] = None,
) -> List[BaseMessage]:
    """
    从 Supabase 加载对话历史：对话摘要（chat_memory）之后的所有消息。

    有摘要时只取 summary_until 之后的消息，摘要本身由 chat_memory.load_memory_note 放进提示词。
    摘要每攒够 SUMMARY_BATCH 条才更新一次，所以这里最多 SUMMARY_TRIGGER 条。
    摘要列不存在（迁移没跑）时退回到最近 MAX_CONTEXT_MESSAGES 条。

    Returns:
        LangChain 消息列表
    """
    from app.agent.chat_memory import SUMMARY_TRIGGER

    try:
        supabase = get_supabase_service()

        until = None
        limit = max_messages or SUMMARY_TRIGGER
        try:
            conv_result = await asyncio.to_thread(
                supabase.table("chat_conversations")
                .select("id, summary_until")
                .eq("id", conversation_id)
                .eq("user_id", user_id)
                .single()
                .execute
            )
            until = (conv_result.data or {}).get("summary_until")
        except Exception as column_error:  # noqa: BLE001 - chat memory migration not applied
            logger.info(f"Conversation summary unavailable, using recent messages: {column_error}")
            limit = max_messages or MAX_CONTEXT_MESSAGES
            conv_result = await asyncio.to_thread(
                supabase.table("chat_conversations")
                .select("id")
                .eq("id", conversation_id)
                .eq("user_id", user_id)
                .single()
                .execute
            )

        if not conv_result.data:
            logger.warning(f"Conversation {conversation_id} not found for user {user_id}")
            return []

        query = (
            supabase.table("chat_messages")
            .select("role, content, created_at")
            .eq("conversation_id", conversation_id)
        )
        if until:
            query = query.gt("created_at", until)
        result = await asyncio.to_thread(query.order("created_at", desc=True).limit(limit).execute)

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
    quote_evidence: Optional[List[Dict[str, Any]]] = None,
    revenue_evidence: Optional[List[Dict[str, Any]]] = None,
    answer_check: Optional[Dict[str, Any]] = None,
    token_usage: Optional[Dict[str, Any]] = None,
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
        conv_result = await asyncio.to_thread(
            supabase.table("chat_conversations")
            .select("id, title")
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .single()
            .execute
        )

        if not conv_result.data:
            logger.error(f"Conversation {conversation_id} not found for user {user_id}")
            return None

        row: Dict[str, Any] = {"conversation_id": conversation_id, "role": role, "content": content}
        if quote_evidence:
            row["quote_evidence"] = quote_evidence
        if revenue_evidence:
            row["revenue_evidence"] = revenue_evidence
        if answer_check:
            row["answer_check"] = answer_check
        if token_usage:
            row["token_usage"] = token_usage

        # 保存消息
        try:
            result = await asyncio.to_thread(supabase.table("chat_messages").insert(row).execute)
        except Exception as error:
            # Before migration 20261121051000_chat_token_usage.sql the column is missing;
            # the answer is still saved, only without its token count.
            if "token_usage" not in row or "token_usage" not in str(error):
                raise
            logger.warning("chat_messages.token_usage is missing; saving the answer without it")
            row.pop("token_usage")
            result = await asyncio.to_thread(supabase.table("chat_messages").insert(row).execute)

        if result.data:
            msg = result.data[0]

            # 如果是第一条用户消息，自动更新对话标题
            conv = conv_result.data
            if conv.get("title") == "New Chat" and role == "user":
                new_title = content[:50] + ("..." if len(content) > 50 else "")
                try:
                    (
                        await asyncio.to_thread(
                            supabase.table("chat_conversations")
                            .update({"title": new_title})
                            .eq("id", conversation_id)
                            .eq("user_id", user_id)
                            .execute
                        )
                    )
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


async def save_user_message_once(
    user_id: str, conversation_id: str, content: str
) -> Optional[Dict[str, Any]]:
    """Save the user's message, unless it is a retry of the last, unanswered one.

    A reply that failed leaves the user's message as the conversation's latest row. Retrying
    resends the same text; inserting it again would show the question twice and feed it to
    the model twice. The latest row is reused only when it is that exact, unanswered question.
    """
    try:
        supabase = get_supabase_service()
        owned = await asyncio.to_thread(
            supabase.table("chat_conversations")
            .select("id")
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .single()
            .execute
        )
        if owned.data:
            latest = await asyncio.to_thread(
                supabase.table("chat_messages")
                .select("*")
                .eq("conversation_id", conversation_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute
            )
            row = (latest.data or [None])[0]
            if row and row.get("role") == "user" and row.get("content") == content:
                logger.info(f"Reusing unanswered user message {row.get('id')} for a retry")
                return row
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Retry check failed, saving the message normally: {e}")
    return await save_message(
        user_id=user_id, conversation_id=conversation_id, role="user", content=content
    )
