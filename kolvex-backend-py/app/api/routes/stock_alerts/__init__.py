"""
股票预警 API 路由模块
"""

from fastapi import APIRouter

from .rules_routes import router as rules_router
from .channels_routes import router as channels_router
from .history_routes import router as history_router

router = APIRouter(prefix="/stock-alerts", tags=["Stock Alerts"])

# 注册子路由
router.include_router(rules_router)
router.include_router(channels_router)
router.include_router(history_router)
