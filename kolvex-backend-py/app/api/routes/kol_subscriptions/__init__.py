"""
KOL 订阅 API 模块
提供 KOL 追踪/订阅管理的 RESTful API
"""

from fastapi import APIRouter

from .routes import router as subscriptions_router

# 创建主路由器
router = APIRouter(prefix="/kol-subscriptions", tags=["KOL Subscriptions"])

# 注册子路由
router.include_router(subscriptions_router)

__all__ = ["router"]

