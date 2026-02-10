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


class SendMessageRequest(BaseModel):
    """发送消息请求（Agent 模式 - 自动生成 AI 回复）"""
    content: str = Field(min_length=1, max_length=100000)
    model: Optional[str] = Field(
        default=None,
        description="Model ID to use (e.g. gpt-4o-mini, deepseek-chat, qwen-plus). If not set, uses server default."
    )
    sources: Optional[List[str]] = Field(
        default=None,
        description="Active data sources: kol, news, web, portfolio. If not set, all sources are available."
    )


class MessageResponse(BaseModel):
    """消息响应"""
    id: str
    conversation_id: str
    role: str
    content: str
    created_at: datetime


class AgentMessageResponse(BaseModel):
    """Agent 消息响应（包含用户消息和 AI 回复）"""
    message: MessageResponse
    response: MessageResponse


class SuccessResponse(BaseModel):
    """成功响应"""
    message: str
    success: bool = True
