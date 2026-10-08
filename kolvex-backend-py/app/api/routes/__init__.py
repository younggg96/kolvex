"""
API Routes
"""

from fastapi import APIRouter
from app.api.routes import health, users, market_data
from app.api.routes.auth import router as auth_router
from app.api.routes.upload import router as upload_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.chat import router as chat_router
from app.api.routes.admin import router as admin_router
from app.api.routes.user_api_keys import router as user_api_keys_router
from app.api.routes.trading_analysis import router as trading_analysis_router
from app.api.routes.plaid import router as plaid_router
from app.api.routes.youtube_opinions import router as youtube_opinions_router
from app.api.routes.chart_drawings import router as chart_drawings_router

# Create API router
api_router = APIRouter()

# Register module routes
api_router.include_router(health.router)
api_router.include_router(auth_router)
api_router.include_router(upload_router)
api_router.include_router(users.router)
api_router.include_router(market_data.router)
api_router.include_router(portfolio_router)
api_router.include_router(chat_router)
api_router.include_router(admin_router, prefix="/admin", tags=["Admin"])
api_router.include_router(user_api_keys_router)
api_router.include_router(trading_analysis_router)
api_router.include_router(plaid_router)
api_router.include_router(youtube_opinions_router)
api_router.include_router(chart_drawings_router)

__all__ = ["api_router"]
