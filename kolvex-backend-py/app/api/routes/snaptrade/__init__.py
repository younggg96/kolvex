"""
SnapTrade API Module
Provides portfolio sharing functionality via SnapTrade integration

Module structure:
- schemas.py: Pydantic request/response models
- connection_routes.py: Connection management endpoints (status, connect, disconnect)
- sync_routes.py: Data sync endpoints (sync accounts, sync positions)
- holdings_routes.py: Holdings endpoints (get holdings, public holdings, toggle public)
"""

from fastapi import APIRouter

from .connection_routes import router as connection_router
from .sync_routes import router as sync_router
from .holdings_routes import router as holdings_router

# Create main router
router = APIRouter(prefix="/snaptrade", tags=["SnapTrade"])

# Register sub-routers
router.include_router(connection_router)
router.include_router(sync_router)
router.include_router(holdings_router)

__all__ = ["router"]

