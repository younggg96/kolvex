"""
Chat API Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class MessageSchema(BaseModel):
    """消息模型"""
    id: str
    role: str
    content: str
    created_at: datetime


class ConversationSchema(BaseModel):
    """对话模型"""
    id: str
    title: str
    messages: List[MessageSchema] = []
    created_at: datetime
    updated_at: datetime


class ConversationListResponse(BaseModel):
    """对话列表响应"""
    conversations: List[ConversationSchema]
    total: int
    page: int
    page_size: int


class CreateConversationRequest(BaseModel):
    """创建对话请求"""
    title: str = Field(default="New Chat", max_length=200)


class UpdateConversationRequest(BaseModel):
    """更新对话请求"""
    title: str = Field(max_length=200)


class AddMessageRequest(BaseModel):
    """添加消息请求"""
    role: str = Field(pattern="^(user|assistant|system)$")
    content: str = Field(min_length=1, max_length=100000)


class MessageResponse(BaseModel):
    """消息响应"""
    id: str
    conversation_id: str
    role: str
    content: str
    created_at: datetime


class SuccessResponse(BaseModel):
    """成功响应"""
    message: str
    success: bool = True
