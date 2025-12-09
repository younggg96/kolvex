"""
Stocks API 模块
提供股票趋势、讨论、追踪相关的 REST API

模块结构：
- schemas.py: Pydantic 请求/响应模型
- utils.py: 辅助函数
- trending_routes.py: 趋势股票端点
- tickers_routes.py: 股票代码列表端点
- discussions_routes.py: 股票讨论端点
- tracked_routes.py: 用户追踪股票端点
"""

from fastapi import APIRouter

from .trending_routes import router as trending_router
from .tickers_routes import router as tickers_router
from .discussions_routes import router as discussions_router
from .tracked_routes import router as tracked_router

# 创建主路由器
router = APIRouter(prefix="/stocks", tags=["Stocks"])

# 注册子路由
router.include_router(trending_router)
router.include_router(tickers_router)
router.include_router(discussions_router)
router.include_router(tracked_router)

__all__ = ["router"]

