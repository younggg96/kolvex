"""Broker-neutral portfolio API."""

from fastapi import APIRouter

from .connection_routes import router as connection_router
from .holdings_routes import router as holdings_router
from .history_routes import router as history_router
from .analysis_routes import router as analysis_router

# Create main router
router = APIRouter(prefix="/portfolio", tags=["Portfolio"])

# Register sub-routers
router.include_router(connection_router)
router.include_router(holdings_router)
router.include_router(history_router)
router.include_router(analysis_router)

__all__ = ["router"]
