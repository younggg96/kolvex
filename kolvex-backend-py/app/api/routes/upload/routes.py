"""
文件上传 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import Optional
import logging
import time
import base64

from app.core.supabase import get_supabase_service
from app.api.dependencies.auth import get_current_user_id
from .schemas import UploadResponse

router = APIRouter()
logger = logging.getLogger(__name__)

# 允许的图片 MIME 类型
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
}

# 最大文件大小 (5MB)
MAX_FILE_SIZE = 5 * 1024 * 1024


@router.post(
    "/avatar",
    response_model=UploadResponse,
    summary="上传用户头像",
)
async def upload_avatar(
    file: UploadFile = File(..., description="头像图片文件"),
    current_user_id: str = Depends(get_current_user_id),
):
    """
    上传用户头像到 Supabase Storage
    
    需要认证：Bearer token
    
    支持的图片格式：JPEG, PNG, GIF, WebP
    最大文件大小：5MB
    """
    try:
        # 验证文件类型
        content_type = file.content_type
        if content_type not in ALLOWED_IMAGE_TYPES:
            return UploadResponse(
                success=False,
                error=f"Invalid file type. Allowed types: JPEG, PNG, GIF, WebP",
            )
        
        # 读取文件内容
        file_content = await file.read()
        
        # 验证文件大小
        if len(file_content) > MAX_FILE_SIZE:
            return UploadResponse(
                success=False,
                error=f"File too large. Maximum size is 5MB",
            )
        
        # 生成文件名
        timestamp = int(time.time() * 1000)
        extension = "jpg" if content_type in ["image/jpeg", "image/jpg"] else content_type.split("/")[1]
        file_name = f"{current_user_id}-{timestamp}.{extension}"
        file_path = f"avatars/{file_name}"
        
        # 上传到 Supabase Storage
        supabase = get_supabase_service()
        
        # 使用 upload 方法
        response = supabase.storage.from_("user-uploads").upload(
            path=file_path,
            file=file_content,
            file_options={
                "cache-control": "3600",
                "upsert": "true",
                "content-type": content_type,
            }
        )
        
        # 获取公开 URL
        public_url_response = supabase.storage.from_("user-uploads").get_public_url(file_path)
        
        return UploadResponse(
            success=True,
            url=public_url_response,
            file_path=file_path,
        )
    
    except Exception as e:
        logger.error(f"Avatar upload error: {e}")
        error_message = str(e)
        
        # 提供更友好的错误消息
        if "Bucket not found" in error_message:
            error_message = "Storage not configured. Please contact administrator."
        elif "row-level security" in error_message.lower():
            error_message = "Permission denied. Please check storage policies."
        
        return UploadResponse(
            success=False,
            error=error_message,
        )


@router.post(
    "/avatar/base64",
    response_model=UploadResponse,
    summary="上传 Base64 编码的用户头像",
)
async def upload_avatar_base64(
    image_data: str = Form(..., description="Base64 编码的图片数据"),
    content_type: str = Form(default="image/jpeg", description="图片 MIME 类型"),
    current_user_id: str = Depends(get_current_user_id),
):
    """
    上传 Base64 编码的用户头像到 Supabase Storage
    
    需要认证：Bearer token
    
    支持的图片格式：JPEG, PNG, GIF, WebP
    最大文件大小：5MB
    """
    try:
        # 验证文件类型
        if content_type not in ALLOWED_IMAGE_TYPES:
            return UploadResponse(
                success=False,
                error=f"Invalid file type. Allowed types: JPEG, PNG, GIF, WebP",
            )
        
        # 解码 Base64 数据
        # 移除可能的 data URL 前缀
        if "," in image_data:
            image_data = image_data.split(",")[1]
        
        try:
            file_content = base64.b64decode(image_data)
        except Exception:
            return UploadResponse(
                success=False,
                error="Invalid base64 data",
            )
        
        # 验证文件大小
        if len(file_content) > MAX_FILE_SIZE:
            return UploadResponse(
                success=False,
                error=f"File too large. Maximum size is 5MB",
            )
        
        # 生成文件名
        timestamp = int(time.time() * 1000)
        extension = "jpg" if content_type in ["image/jpeg", "image/jpg"] else content_type.split("/")[1]
        file_name = f"{current_user_id}-{timestamp}.{extension}"
        file_path = f"avatars/{file_name}"
        
        # 上传到 Supabase Storage
        supabase = get_supabase_service()
        
        response = supabase.storage.from_("user-uploads").upload(
            path=file_path,
            file=file_content,
            file_options={
                "cache-control": "3600",
                "upsert": "true",
                "content-type": content_type,
            }
        )
        
        # 获取公开 URL
        public_url_response = supabase.storage.from_("user-uploads").get_public_url(file_path)
        
        return UploadResponse(
            success=True,
            url=public_url_response,
            file_path=file_path,
        )
    
    except Exception as e:
        logger.error(f"Avatar base64 upload error: {e}")
        error_message = str(e)
        
        if "Bucket not found" in error_message:
            error_message = "Storage not configured. Please contact administrator."
        elif "row-level security" in error_message.lower():
            error_message = "Permission denied. Please check storage policies."
        
        return UploadResponse(
            success=False,
            error=error_message,
        )


@router.delete(
    "/avatar",
    response_model=UploadResponse,
    summary="删除用户头像",
)
async def delete_avatar(
    file_path: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """
    删除用户头像
    
    需要认证：Bearer token
    """
    try:
        # 验证文件路径属于当前用户
        if not file_path.startswith(f"avatars/{current_user_id}-"):
            return UploadResponse(
                success=False,
                error="Permission denied",
            )
        
        supabase = get_supabase_service()
        
        # 删除文件
        supabase.storage.from_("user-uploads").remove([file_path])
        
        return UploadResponse(
            success=True,
        )
    
    except Exception as e:
        logger.error(f"Avatar delete error: {e}")
        return UploadResponse(
            success=False,
            error=str(e),
        )

