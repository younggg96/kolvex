"""
Admin API routes
"""

from fastapi import APIRouter
from .routes import router as admin_router
from app.api.routes.options_activity import admin_router as options_activity_admin_router

router = APIRouter()
router.include_router(admin_router, tags=["Admin"])
router.include_router(options_activity_admin_router)
