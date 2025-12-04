"""
API 路由
"""

from fastapi import APIRouter
from app.api.routes import health, users, twitter, kol_tweets, scraper, ai

# 创建 API 路由器
api_router = APIRouter()

# 注册各个模块的路由
api_router.include_router(health.router)
api_router.include_router(users.router)
api_router.include_router(twitter.router)
api_router.include_router(kol_tweets.router)
api_router.include_router(scraper.router)
api_router.include_router(ai.router)

__all__ = ["api_router"]
