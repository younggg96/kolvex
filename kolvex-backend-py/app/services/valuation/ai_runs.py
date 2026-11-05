"""Saved AI valuation runs: immutable, private to their owner, written by the server."""
from supabase import Client

FIELDS = "id,ticker,created_at,model_id,prompt_version,snapshot_id,payload,results,financial_snapshot"


def to_response(row):
    snapshot = row.get("financial_snapshot") or {}
    return {**row["payload"], "run_id": row["id"], "saved": True, "generated_at": row["created_at"], "model_id": row["model_id"],
            "prompt_version": row["prompt_version"], "snapshot_id": row["snapshot_id"], "results": row["results"],
            "price_at_generation": snapshot.get("price"), "quote_time_at_generation": snapshot.get("quote_time")}


class ValuationAiRuns:
    def __init__(self, db: Client):
        self.db = db

    def save(self, user_id, ticker, record):
        rows = self.db.table("company_valuation_ai_runs").insert({"user_id": user_id, "ticker": ticker, **record}).execute().data
        return rows[0]

    def list(self, user_id, ticker, limit=20):
        # The service client bypasses RLS, so ownership is filtered here explicitly.
        rows = (self.db.table("company_valuation_ai_runs").select(FIELDS).eq("user_id", user_id).eq("ticker", ticker)
                .order("created_at", desc=True).order("id", desc=True).limit(limit).execute()).data
        return [to_response(row) for row in rows]
