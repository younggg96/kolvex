"""
API 路由
"""

from fastapi import APIRouter
from app.api.routes import health, users, kol_tweets, ai, stocks, tracked_stocks, news, market_data
from app.api.routes.scraper import router as scraper_router

# 创建 API 路由器
api_router = APIRouter()

# 注册各个模块的路由
api_router.include_router(health.router)
api_router.include_router(users.router)
api_router.include_router(kol_tweets.router)
api_router.include_router(scraper_router)
api_router.include_router(ai.router)
api_router.include_router(stocks.router)
api_router.include_router(tracked_stocks.router)
api_router.include_router(news.router)
api_router.include_router(market_data.router)

__all__ = ["api_router"]
