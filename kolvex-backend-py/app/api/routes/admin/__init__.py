"""
Admin API routes
"""

from fastapi import APIRouter
from .routes import router as admin_router

router = APIRouter()
router.include_router(admin_router, tags=["Admin"])
