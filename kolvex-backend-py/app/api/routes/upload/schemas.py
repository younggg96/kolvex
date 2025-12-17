"""
文件上传相关的 Pydantic 模型
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal


UploadType = Literal["avatar", "document", "image"]


class UploadResponse(BaseModel):
    """上传响应"""
    success: bool
    url: Optional[str] = None
    file_path: Optional[str] = None
    error: Optional[str] = None


class MessageResponse(BaseModel):
    """通用消息响应"""
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None

