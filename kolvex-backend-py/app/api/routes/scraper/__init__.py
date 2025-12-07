"""
Scraper API 模块
提供 KOL 推文爬取相关的 REST API

模块结构：
- schemas.py: Pydantic 请求/响应模型
- task_manager.py: 任务状态管理
- background_tasks.py: 后台任务函数
- scrape_routes.py: 爬取 API 端点
- status_routes.py: 状态与统计端点
- tweet_routes.py: 推文管理端点
"""

from fastapi import APIRouter

from .scrape_routes import router as scrape_router
from .status_routes import router as status_router
from .tweet_routes import router as tweet_router

# 创建主路由器
router = APIRouter(prefix="/scraper", tags=["KOL Scraper"])

# 注册子路由
router.include_router(scrape_router)
router.include_router(status_router)
router.include_router(tweet_router)

__all__ = ["router"]

