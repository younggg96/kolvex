"""
Chat API Routes
"""

from fastapi import APIRouter
from app.api.routes.chat.routes import router as chat_router

router = APIRouter(prefix="/chat", tags=["chat"])
router.include_router(chat_router)

__all__ = ["router"]
