"""
认证 API 模块
提供用户认证相关的 RESTful API
"""

from fastapi import APIRouter

from .routes import router as auth_router

# 创建主路由器
router = APIRouter(prefix="/auth", tags=["Authentication"])

# 注册子路由
router.include_router(auth_router)

__all__ = ["router"]

