"""Immutable, user-owned analysis snapshots and an atomic current pointer."""
from typing import Any
from supabase import Client


class StockAnalysisHistory:
    def __init__(self, db: Client):
        self.db = db

    def list(self, user_id: str, ticker: str, kind: str, limit: int, offset: int):
        head = (self.db.table("stock_analysis_heads").select("version_id")
                .eq("user_id", user_id).eq("ticker", ticker).eq("kind", kind).execute())
        rows = (self.db.table("stock_analysis_versions")
                .select("id,kind,ticker,created_at,payload,request", count="exact")
                .eq("user_id", user_id).eq("ticker", ticker).eq("kind", kind)
                .order("created_at", desc=True).order("id", desc=True)
                .range(offset, offset + limit - 1).execute())
        current_id = head.data[0]["version_id"] if head.data else None
        current = None
        if current_id:
            data = (self.db.table("stock_analysis_versions").select("*")
                    .eq("user_id", user_id).eq("id", current_id).execute()).data
            current = data[0] if data else None
        return {"items": rows.data, "total": rows.count or 0,
                "current": current, "limit": limit, "offset": offset}

    def save(self, user_id: str, ticker: str, payload: dict[str, Any], request: dict, bars: list, kind: str = "technical"):
        params = {
            "p_user_id": user_id, "p_ticker": ticker, "p_payload": payload,
            "p_request": request, "p_bars": bars,
        }
        if kind == "drawings":
            params["p_kind"] = kind
            return self.db.rpc("save_stock_chart_result", params).execute().data
        return self.db.rpc("save_stock_technical_analysis", params).execute().data

    def get(self, user_id: str, ticker: str, version_id: str):
        rows = (self.db.table("stock_analysis_versions").select("*")
                .eq("user_id", user_id).eq("ticker", ticker).eq("id", version_id).execute()).data
        return rows[0] if rows else None

    def activate(self, user_id: str, ticker: str, version_id: str, expected_id: str | None):
        return self.db.rpc("activate_stock_analysis", {
            "p_user_id": user_id, "p_ticker": ticker,
            "p_version_id": version_id, "p_expected_id": expected_id,
        }).execute().data
