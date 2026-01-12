"""
聊天相关 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette import status as http_status
from typing import Optional

from app.api.dependencies.auth import get_current_user_id
from app.services.chat_service import ChatService, get_chat_service
from app.api.routes.chat.schemas import (
    ConversationSchema,
    ConversationListResponse,
    CreateConversationRequest,
    UpdateConversationRequest,
    AddMessageRequest,
    MessageResponse,
    SuccessResponse,
)

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
