"""Public immutable results with owner-managed current pointers."""
import logging
from typing import Any
from supabase import Client


logger = logging.getLogger(__name__)


class StockAnalysisHistory:
    def __init__(self, db: Client):
        self.db = db

    def _decorate(self, rows, user_id):
        ids = list({row["user_id"] for row in rows})
        try:
            profiles = (self.db.table("user_profiles").select("id,username,full_name,avatar_url")
                        .in_("id", ids).execute()).data if ids else []
        except Exception:
            logger.warning("Analysis authors unavailable; using stable author identifiers")
            profiles = []
        authors = {profile["id"]: profile for profile in profiles}
        for row in rows:
            row["is_owner"] = row["user_id"] == user_id
            row["author"] = authors.get(row["user_id"], {"id": row["user_id"]})
        return rows

    def list(self, user_id: str | None, ticker: str, kind: str, limit: int, offset: int, scope: str = "all"):
        head = (self.db.table("stock_analysis_heads").select("version_id")
                .eq("user_id", user_id).eq("ticker", ticker).eq("kind", kind).execute()) if user_id else None
        query = (self.db.table("stock_analysis_versions")
                .select("id,user_id,kind,ticker,created_at,payload,request", count="exact")
                .eq("ticker", ticker).eq("kind", kind))
        if scope == "mine":
            if not user_id:
                return {"items": [], "total": 0, "current": None, "limit": limit, "offset": offset}
            query = query.eq("user_id", user_id)
        rows = (query
                .order("created_at", desc=True).order("id", desc=True)
                .range(offset, offset + limit - 1).execute())
        current_id = head.data[0]["version_id"] if head and head.data else None
        current = None
        if current_id:
            data = (self.db.table("stock_analysis_versions").select("*")
                    .eq("user_id", user_id).eq("id", current_id).execute()).data
            current = data[0] if data else None
        if not current:
            # Prefer one's own latest result even if a current pointer is absent.
            own = (self.db.table("stock_analysis_versions").select("*")
                   .eq("ticker", ticker).eq("kind", kind).eq("user_id", user_id).order("created_at", desc=True)
                   .order("id", desc=True).limit(1).execute()).data if user_id else []
            if own:
                current = own[0]
            elif scope == "all":
                fallback = (self.db.table("stock_analysis_versions").select("*")
                            .eq("ticker", ticker).eq("kind", kind)
                            .order("created_at", desc=True).order("id", desc=True).limit(1).execute()).data
                current = fallback[0] if fallback else None
        self._decorate(rows.data, user_id)
        if current:
            self._decorate([current], user_id)
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

    def get(self, user_id: str | None, ticker: str, version_id: str):
        rows = (self.db.table("stock_analysis_versions").select("*")
                .eq("ticker", ticker).eq("id", version_id).execute()).data
        self._decorate(rows, user_id)
        return rows[0] if rows else None

    def activate(self, user_id: str, ticker: str, version_id: str, expected_id: str | None):
        result = self.db.rpc("activate_stock_analysis", {
            "p_user_id": user_id, "p_ticker": ticker,
            "p_version_id": version_id, "p_expected_id": expected_id,
        }).execute().data
        return self._decorate([result], user_id)[0]
