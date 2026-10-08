"""
Per-user price chart drawings, stored one row per (user, ticker).
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import Client

logger = logging.getLogger(__name__)

TABLE_NAME = "user_chart_drawings"


class ChartDrawingsUnavailable(RuntimeError):
    """The storage table is missing or unreachable; clients fall back to local storage."""


def _is_missing_table(error: Exception) -> bool:
    text = str(error)
    return "PGRST205" in text or "42P01" in text or (TABLE_NAME in text and "does not exist" in text)


class ChartDrawingsService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    def get(self, user_id: str, ticker: str) -> Dict[str, Any]:
        try:
            result = (
                self.supabase.table(TABLE_NAME)
                .select("drawings, updated_at")
                .eq("user_id", user_id)
                .eq("ticker", ticker)
                .limit(1)
                .execute()
            )
        except Exception as e:
            if _is_missing_table(e):
                raise ChartDrawingsUnavailable(str(e)) from e
            raise
        row: Optional[Dict[str, Any]] = (result.data or [None])[0]
        return {
            "ticker": ticker,
            "drawings": (row or {}).get("drawings") or [],
            "updated_at": (row or {}).get("updated_at"),
        }

    def save(self, user_id: str, ticker: str, drawings: List[Dict[str, Any]]) -> Dict[str, Any]:
        updated_at = datetime.now(timezone.utc).isoformat()
        try:
            (
                self.supabase.table(TABLE_NAME)
                .upsert(
                    {"user_id": user_id, "ticker": ticker, "drawings": drawings, "updated_at": updated_at},
                    on_conflict="user_id,ticker",
                )
                .execute()
            )
        except Exception as e:
            if _is_missing_table(e):
                raise ChartDrawingsUnavailable(str(e)) from e
            raise
        return {"ticker": ticker, "drawings": drawings, "updated_at": updated_at}
