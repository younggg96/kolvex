"""
Admin API routes
"""

from fastapi import APIRouter

from app.api.routes.options_activity import admin_router as options_activity_admin_router
from app.api.routes.person_updates import admin_router as person_updates_admin_router
from app.api.routes.x_crawler import admin_router as x_crawler_admin_router
from app.api.routes.xhs_sentiment import admin_router as xhs_sentiment_admin_router
from app.api.routes.youtube_auto_import import admin_router as youtube_auto_import_admin_router

from .routes import router as admin_router

router = APIRouter()
router.include_router(admin_router, tags=["Admin"])
router.include_router(options_activity_admin_router)
router.include_router(youtube_auto_import_admin_router)
router.include_router(person_updates_admin_router)
router.include_router(xhs_sentiment_admin_router)
router.include_router(x_crawler_admin_router)
