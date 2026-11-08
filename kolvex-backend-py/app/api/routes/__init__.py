"""
API Routes
"""

from fastapi import APIRouter
from app.api.routes import health, users, market_data
from app.api.routes.news_feed import router as news_feed_router
from app.api.routes.market_observations import router as market_observations_router
from app.api.routes.reddit_opinions import router as reddit_opinions_router
from app.api.routes.auth import router as auth_router
from app.api.routes.upload import router as upload_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.chat import router as chat_router
from app.api.routes.admin import router as admin_router
from app.api.routes.user_api_keys import router as user_api_keys_router
from app.api.routes.trading_analysis import router as trading_analysis_router
from app.api.routes.plaid import router as plaid_router
from app.api.routes.youtube_opinions import router as youtube_opinions_router
from app.api.routes.x_content import router as x_content_router
from app.api.routes.chart_drawings import router as chart_drawings_router
from app.api.routes.paper_trading import router as paper_trading_router
from app.api.routes.research_workspaces import router as research_workspaces_router
from app.api.routes.briefs import router as briefs_router
from app.api.routes.market_events import router as market_events_router
from app.api.routes.economic_indicators import router as economic_indicators_router
from app.api.routes.free_research import router as free_research_router
from app.api.routes.valuation import router as valuation_router
from app.api.routes.options import router as options_router
from app.api.routes.options_activity import router as options_activity_router
from app.api.routes.forecast import router as forecast_router

# Create API router
api_router = APIRouter()

# Register module routes
api_router.include_router(health.router)
api_router.include_router(news_feed_router)
api_router.include_router(reddit_opinions_router)
api_router.include_router(auth_router)
api_router.include_router(upload_router)
api_router.include_router(users.router)
api_router.include_router(market_data.router)
api_router.include_router(economic_indicators_router)
api_router.include_router(free_research_router)
api_router.include_router(valuation_router)
api_router.include_router(options_router)
api_router.include_router(options_activity_router)
api_router.include_router(forecast_router)
api_router.include_router(portfolio_router)
api_router.include_router(chat_router)
api_router.include_router(admin_router, prefix="/admin", tags=["Admin"])
api_router.include_router(user_api_keys_router)
api_router.include_router(trading_analysis_router)
api_router.include_router(plaid_router)
api_router.include_router(youtube_opinions_router)
api_router.include_router(x_content_router)
api_router.include_router(chart_drawings_router)
api_router.include_router(paper_trading_router)
api_router.include_router(research_workspaces_router)
api_router.include_router(briefs_router)
api_router.include_router(market_events_router)
api_router.include_router(market_observations_router)

__all__ = ["api_router"]
