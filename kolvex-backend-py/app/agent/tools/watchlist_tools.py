"""
Watchlist Tools
让 Agent 读取当前认证用户的自选股 (public.user_watchlist)
"""

import json
import logging

from langchain_core.tools import tool

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)

_MAX_TICKERS = 100


def _fetch_watchlist(user_id: str) -> str:
    try:
        result = (
            get_supabase_service()
            .table("user_watchlist")
            .select("ticker, created_at")
            .eq("user_id", user_id)
            .order("created_at")
            .limit(_MAX_TICKERS)
            .execute()
        )
    except Exception as e:
        logger.error(f"Error getting watchlist for user {user_id}: {e}", exc_info=True)
        return json.dumps({
            "status": "error",
            "message": "A temporary error occurred while loading the watchlist. "
                       "Apologize and suggest the user try again later.",
        })

    tickers = [row["ticker"] for row in (result.data or [])]
    if not tickers:
        return json.dumps({
            "status": "empty",
            "message": "The user's watchlist is empty. Suggest adding stocks from the Watchlist page "
                       "or asking about specific tickers.",
            "tickers": [],
        })
    return json.dumps({"status": "success", "count": len(tickers), "tickers": tickers})


def create_watchlist_tool_for_user(user_id: str):
    """创建绑定了 user_id 的自选股工具"""

    @tool
    def get_user_watchlist() -> str:
        """Get the tickers in the current user's watchlist (自选股).

        Uses the authenticated user's identity automatically — no arguments needed.
        Call this whenever the user refers to their watchlist / 自选股 / followed or saved stocks,
        then use quote, history and fundamentals tools on the returned tickers to analyze them.

        Returns:
            JSON with status and a list of ticker symbols in the order they were added.
        """
        return _fetch_watchlist(user_id)

    return get_user_watchlist
