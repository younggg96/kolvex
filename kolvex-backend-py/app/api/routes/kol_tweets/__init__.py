"""
KOL Posts API 模块
提供 KOL 帖子数据的 RESTful API

模块结构：
- schemas.py: Pydantic 请求/响应模型
- utils.py: 辅助函数
- tweets_routes.py: 帖子相关端点
- profiles_routes.py: KOL Profile 相关端点
- stats_routes.py: 统计相关端点
- analytics_routes.py: 数据分析端点
"""

from fastapi import APIRouter

from .tweets_routes import router as posts_router
from .profiles_routes import router as profiles_router
from .stats_routes import router as stats_router
from .analytics_routes import router as analytics_router

# 创建主路由器（保持 API 路径兼容性，可后续改为 /kol-posts）
router = APIRouter(prefix="/kol-posts", tags=["KOL Posts"])

# 注册子路由
router.include_router(posts_router)
router.include_router(profiles_router)
router.include_router(stats_router)
router.include_router(analytics_router, tags=["KOL Analytics"])

__all__ = ["router"]






















