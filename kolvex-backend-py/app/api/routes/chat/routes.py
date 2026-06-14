"""
聊天相关 API 路由
支持：
1. 原始 CRUD 消息管理
2. Agent 模式 - 发送消息自动获取 AI 回复
3. SSE 流式模式 - 实时流式返回 AI 回复
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from starlette import status as http_status
from typing import Optional

from app.api.dependencies.auth import get_current_user_id
from app.services.chat_service import ChatService, get_chat_service
from app.services.user_api_keys_service import (
    UserApiKeysService,
    get_user_api_keys_service,
)
from app.api.routes.chat.schemas import (
    ConversationSchema,
    ConversationListResponse,
    CreateConversationRequest,
    UpdateConversationRequest,
    AddMessageRequest,
    SendMessageRequest,
    MessageResponse,
    AgentMessageResponse,
    SuccessResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ===== Conversation Routes =====

@router.get("/conversations", response_model=ConversationListResponse, summary="获取对话列表")
async def get_conversations(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    current_user_id: str = Depends(get_current_user_id),
    service: ChatService = Depends(get_chat_service),
):
    """
    获取当前用户的对话列表
    
    需要认证：Bearer token
    """
    result = await service.get_conversations(
        user_id=current_user_id,
        page=page,
        page_size=page_size,
    )
    return ConversationListResponse(**result)


@router.post("/conversations", response_model=ConversationSchema, summary="创建新对话")
async def create_conversation(
    request: CreateConversationRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: ChatService = Depends(get_chat_service),
):
    """
    创建新对话
    
    需要认证：Bearer token
    """
    conversation = await service.create_conversation(
        user_id=current_user_id,
        title=request.title,
    )
    
    if not conversation:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create conversation"
        )
    
    return ConversationSchema(**conversation)


@router.get("/conversations/{conversation_id}", response_model=ConversationSchema, summary="获取对话详情")
async def get_conversation(
    conversation_id: str,
    current_user_id: str = Depends(get_current_user_id),
    service: ChatService = Depends(get_chat_service),
):
    """
    获取单个对话详情
    
    需要认证：Bearer token
    """
    conversation = await service.get_conversation(
        user_id=current_user_id,
        conversation_id=conversation_id,
    )
    
    if not conversation:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    return ConversationSchema(**conversation)


@router.patch("/conversations/{conversation_id}", response_model=SuccessResponse, summary="更新对话标题")
async def update_conversation(
    conversation_id: str,
    request: UpdateConversationRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: ChatService = Depends(get_chat_service),
):
    """
    更新对话标题
    
    需要认证：Bearer token
    """
    success = await service.update_conversation_title(
        user_id=current_user_id,
        conversation_id=conversation_id,
        title=request.title,
    )
    
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    return SuccessResponse(message="Conversation updated successfully")


@router.delete("/conversations/{conversation_id}", response_model=SuccessResponse, summary="删除对话")
async def delete_conversation(
    conversation_id: str,
    current_user_id: str = Depends(get_current_user_id),
    service: ChatService = Depends(get_chat_service),
):
    """
    删除对话
    
    需要认证：Bearer token
    """
    success = await service.delete_conversation(
        user_id=current_user_id,
        conversation_id=conversation_id,
    )
    
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    return SuccessResponse(message="Conversation deleted successfully")


@router.delete("/conversations", response_model=SuccessResponse, summary="删除所有对话")
async def delete_all_conversations(
    current_user_id: str = Depends(get_current_user_id),
    service: ChatService = Depends(get_chat_service),
):
    """
    删除用户所有对话
    
    需要认证：Bearer token
    """
    count = await service.delete_all_conversations(current_user_id)
    return SuccessResponse(message=f"Deleted {count} conversations")


# ===== Message Routes =====

@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, summary="添加消息")
async def add_message(
    conversation_id: str,
    request: AddMessageRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: ChatService = Depends(get_chat_service),
):
    """
    添加消息到对话
    
    需要认证：Bearer token
    """
    message = await service.add_message(
        user_id=current_user_id,
        conversation_id=conversation_id,
        role=request.role,
        content=request.content,
    )
    
    if not message:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    return MessageResponse(**message)


@router.get("/conversations/{conversation_id}/messages", summary="获取对话消息")
async def get_messages(
    conversation_id: str,
    current_user_id: str = Depends(get_current_user_id),
    service: ChatService = Depends(get_chat_service),
):
    """
    获取对话的所有消息
    
    需要认证：Bearer token
    """
    messages = await service.get_messages(
        user_id=current_user_id,
        conversation_id=conversation_id,
    )
    
    return {"messages": messages}


# ===== Agent-Powered Routes =====

@router.post(
    "/conversations/{conversation_id}/send",
    response_model=AgentMessageResponse,
    summary="发送消息并获取 AI 回复",
)
async def send_message(
    conversation_id: str,
    request: SendMessageRequest,
    current_user_id: str = Depends(get_current_user_id),
    service: ChatService = Depends(get_chat_service),
    api_keys_service: UserApiKeysService = Depends(get_user_api_keys_service),
):
    """
    发送用户消息并自动获取 AI Agent 回复。
    
    流程：
    1. 保存用户消息到数据库
    2. 加载对话历史
    3. 加载用户自定义 API keys
    4. 运行 LangGraph Agent 生成回复
    5. 保存 AI 回复到数据库
    6. 返回用户消息和 AI 回复

    需要认证：Bearer token
    """
    from app.agent.memory import load_conversation_history, save_message
    from app.agent.graphs.supervisor import run_agent
    from langchain_core.messages import HumanMessage

    # 1. 保存用户消息
    user_msg = await save_message(
        user_id=current_user_id,
        conversation_id=conversation_id,
        role="user",
        content=request.content,
    )

    if not user_msg:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    # 2. 加载对话历史（不含刚保存的消息，因为 load 会获取到）
    history = await load_conversation_history(
        user_id=current_user_id,
        conversation_id=conversation_id,
    )

    # 3. 加载用户自定义 API keys
    user_api_keys = await api_keys_service.get_keys_dict(current_user_id)

    # 4. 运行 Agent（传入模型、数据源和用户 API keys）
    try:
        ai_response_text = await run_agent(
            messages=history,
            user_id=current_user_id,
            conversation_id=conversation_id,
            model_id=request.model,
            sources=request.sources,
            user_api_keys=user_api_keys or None,
        )
    except Exception as e:
        logger.error(f"Agent failed: {e}", exc_info=True)
        ai_response_text = "I'm sorry, I encountered an error processing your request. Please try again."

    # 4. 保存 AI 回复
    ai_msg = await save_message(
        user_id=current_user_id,
        conversation_id=conversation_id,
        role="assistant",
        content=ai_response_text,
    )

    if not ai_msg:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save AI response",
        )

    # 5. 返回
    return AgentMessageResponse(
        message=MessageResponse(**user_msg),
        response=MessageResponse(**ai_msg),
    )


@router.post(
    "/conversations/{conversation_id}/stream",
    summary="流式发送消息并获取 AI 回复 (SSE)",
)
async def stream_message(
    conversation_id: str,
    request: SendMessageRequest,
    current_user_id: str = Depends(get_current_user_id),
    api_keys_service: UserApiKeysService = Depends(get_user_api_keys_service),
):
    """
    流式发送用户消息并实时获取 AI Agent 回复 (Server-Sent Events)。
    
    流程：
    1. 保存用户消息
    2. 加载历史
    3. 加载用户自定义 API keys
    4. 流式运行 Agent，逐 token 返回
    5. 完成后保存完整 AI 回复

    SSE 事件类型：
    - status: Agent 当前阶段
    - token: AI 回复的文本 token
    - tool_start: Agent 开始调用工具
    - tool_end: Agent 工具调用完成
    - done: 流式完成
    - error: 发生错误

    需要认证：Bearer token
    """
    from app.agent.memory import load_conversation_history, save_message
    from app.agent.graphs.supervisor import stream_agent

    # 1. 保存用户消息
    user_msg = await save_message(
        user_id=current_user_id,
        conversation_id=conversation_id,
        role="user",
        content=request.content,
    )

    if not user_msg:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    # 2. 加载对话历史
    history = await load_conversation_history(
        user_id=current_user_id,
        conversation_id=conversation_id,
    )

    # 3. 加载用户自定义 API keys
    user_api_keys = await api_keys_service.get_keys_dict(current_user_id)

    # 4. SSE 流式生成器
    async def event_generator():
        full_response = ""

        try:
            async for event in stream_agent(
                messages=history,
                user_id=current_user_id,
                conversation_id=conversation_id,
                model_id=request.model,
                sources=request.sources,
                user_api_keys=user_api_keys or None,
            ):
                event_type = event.get("type", "")
                
                if event_type == "token":
                    token = event.get("content", "")
                    full_response += token
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

                elif event_type == "status":
                    yield f"data: {json.dumps({'type': 'status', 'stage': event.get('stage', ''), 'content': event.get('content', '')})}\n\n"

                elif event_type == "tool_start":
                    yield f"data: {json.dumps({'type': 'tool_start', 'tool': event.get('tool', '')})}\n\n"

                elif event_type == "tool_end":
                    yield f"data: {json.dumps({'type': 'tool_end', 'tool': event.get('tool', '')})}\n\n"

                elif event_type == "done":
                    # 保存完整回复
                    if full_response.strip():
                        ai_msg = await save_message(
                            user_id=current_user_id,
                            conversation_id=conversation_id,
                            role="assistant",
                            content=full_response,
                        )
                        yield f"data: {json.dumps({'type': 'done', 'message_id': ai_msg['id'] if ai_msg else None, 'content': full_response, 'created_at': ai_msg.get('created_at') if ai_msg else None})}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'done', 'message_id': None})}\n\n"

                elif event_type == "error":
                    error_msg = event.get("content", "Unknown error")
                    yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
