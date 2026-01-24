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
- ai_routes.py: AI 分析端点
- tracking_requests_routes.py: KOL 追踪请求端点
"""

from fastapi import APIRouter

from .tweets_routes import router as posts_router
from .profiles_routes import router as profiles_router
from .stats_routes import router as stats_router
from .analytics_routes import router as analytics_router
from .ai_routes import router as ai_router
from .tracking_requests_routes import router as tracking_requests_router

# 创建主路由器（保持 API 路径兼容性，可后续改为 /kol-posts）
router = APIRouter(prefix="/kol-posts", tags=["KOL Posts"])

# 注册子路由
router.include_router(posts_router)
router.include_router(profiles_router)
router.include_router(stats_router)
router.include_router(analytics_router, tags=["KOL Analytics"])
router.include_router(ai_router, tags=["KOL Posts AI Analysis"])
router.include_router(tracking_requests_router, tags=["KOL Tracking Requests"])

__all__ = ["router"]






















