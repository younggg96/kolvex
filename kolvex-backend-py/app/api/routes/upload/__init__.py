"""
文件上传 API 模块
提供文件上传相关的 RESTful API
"""

from fastapi import APIRouter

from .routes import router as upload_router

# 创建主路由器
router = APIRouter(prefix="/upload", tags=["Upload"])

# 注册子路由
router.include_router(upload_router)

__all__ = ["router"]

