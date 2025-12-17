"""
API Routes
"""

from fastapi import APIRouter
from app.api.routes import health, users, ai, news, market_data, notifications
from app.api.routes.auth import router as auth_router
from app.api.routes.upload import router as upload_router
from app.api.routes.scraper import router as scraper_router
from app.api.routes.stocks import router as stocks_router
from app.api.routes.kol_tweets import router as kol_tweets_router
from app.api.routes.kol_subscriptions import router as kol_subscriptions_router
from app.api.routes.snaptrade import router as snaptrade_router

# Create API router
api_router = APIRouter()

# Register module routes
api_router.include_router(health.router)
api_router.include_router(auth_router)
api_router.include_router(upload_router)
api_router.include_router(users.router)
api_router.include_router(kol_tweets_router)
api_router.include_router(kol_subscriptions_router)
api_router.include_router(scraper_router)
api_router.include_router(ai.router)
api_router.include_router(stocks_router)
api_router.include_router(news.router)
api_router.include_router(market_data.router)
api_router.include_router(snaptrade_router)
api_router.include_router(notifications.router)

__all__ = ["api_router"]
