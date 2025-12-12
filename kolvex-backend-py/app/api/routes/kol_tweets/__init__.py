"""
KOL Tweets API 模块
提供 KOL 推文数据的 RESTful API

模块结构：
- schemas.py: Pydantic 请求/响应模型
- utils.py: 辅助函数
- tweets_routes.py: 推文相关端点
- profiles_routes.py: KOL Profile 相关端点
- stats_routes.py: 统计相关端点
"""

from fastapi import APIRouter

from .tweets_routes import router as tweets_router
from .profiles_routes import router as profiles_router
from .stats_routes import router as stats_router

# 创建主路由器
router = APIRouter(prefix="/kol-tweets", tags=["KOL Tweets"])

# 注册子路由
router.include_router(tweets_router)
router.include_router(profiles_router)
router.include_router(stats_router)

__all__ = ["router"]





