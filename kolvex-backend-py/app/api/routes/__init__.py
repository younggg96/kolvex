"""
API 路由
"""
from fastapi import APIRouter
from app.api.routes import health, users

# 创建 API 路由器
api_router = APIRouter()

# 注册各个模块的路由
api_router.include_router(health.router)
api_router.include_router(users.router)

__all__ = ["api_router"]

