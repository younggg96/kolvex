"""
API 路由
"""

from fastapi import APIRouter
from app.api.routes import health, users, ai, news, market_data
from app.api.routes.scraper import router as scraper_router
from app.api.routes.stocks import router as stocks_router
from app.api.routes.kol_tweets import router as kol_tweets_router

# 创建 API 路由器
api_router = APIRouter()

# 注册各个模块的路由
api_router.include_router(health.router)
api_router.include_router(users.router)
api_router.include_router(kol_tweets_router)
api_router.include_router(scraper_router)
api_router.include_router(ai.router)
api_router.include_router(stocks_router)
api_router.include_router(news.router)
api_router.include_router(market_data.router)

__all__ = ["api_router"]
