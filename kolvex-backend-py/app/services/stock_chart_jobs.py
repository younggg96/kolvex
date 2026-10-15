"""Persisted chart jobs, consumed outside the lifetime of an HTTP request."""
import asyncio
import logging
from typing import Any

from app.core.supabase import get_supabase_service
from app.services.technical_analysis import AiNotConfigured, analyze_chart
from app.services.user_api_keys_service import get_user_api_keys_service
from app.services.yfinance.client import get_yfinance_service

logger = logging.getLogger(__name__)
JOB_TIMEOUT_SECONDS = 480
PUBLIC_FIELDS = "id,ticker,operation,status,error_code,result,created_at,started_at,finished_at"


class StockChartJobs:
    def __init__(self, db):
        self.db = db

    @staticmethod
    def public(job: dict[str, Any]):
        return {field: job.get(field) for field in PUBLIC_FIELDS.split(",")}

    def enqueue(self, user_id: str, ticker: str, request: dict):
        job = self.db.rpc("enqueue_stock_chart_job", {
            "p_id": request["request_id"], "p_user_id": user_id,
            "p_ticker": ticker, "p_request": request,
        }).execute().data
        return self.public(job)

    def latest(self, user_id: str, ticker: str):
        self.db.rpc("expire_stock_chart_jobs").execute()
        # Query each operation independently: a prolific analysis history must
        # not hide an in-flight drawing job on a subsequent visit.
        items = []
        for operation in ("analysis", "drawings"):
            rows = (self.db.table("stock_chart_jobs").select(PUBLIC_FIELDS)
                    .eq("user_id", user_id).eq("ticker", ticker).eq("operation", operation)
                    .order("created_at", desc=True).order("id", desc=True).limit(1).execute()).data
            items.extend(rows)
        return {"items": items}

    def get(self, user_id: str, ticker: str, job_id: str):
        self.db.rpc("expire_stock_chart_jobs").execute()
        rows = (self.db.table("stock_chart_jobs").select(PUBLIC_FIELDS)
                .eq("user_id", user_id).eq("ticker", ticker).eq("id", job_id).execute()).data
        return rows[0] if rows else None

    def claim(self):
        return self.db.rpc("claim_stock_chart_job").execute().data

    def complete(self, job_id: str, result: dict, bars: list):
        return self.db.rpc("complete_stock_chart_job", {
            "p_id": job_id, "p_payload": result, "p_bars": bars,
        }).execute().data

    def fail(self, job_id: str, code: str):
        from datetime import datetime, timezone
        return (self.db.table("stock_chart_jobs").update({
            "status": "failed", "error_code": code,
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job_id).eq("status", "running").execute())


async def process_job(jobs: StockChartJobs, job: dict):
    body = job["request"]
    try:
        async with asyncio.timeout(JOB_TIMEOUT_SECONDS):
            history = await asyncio.to_thread(
                get_yfinance_service().get_history, job["ticker"],
                period=body.get("period") or "1y", interval=body["interval"],
                start=body.get("start"), end=body.get("end"),
            )
            history = [bar for bar in history if all(bar.get(key) is not None for key in ("open", "high", "low", "close"))]
            # Read user-configured keys just-in-time, never write keys/tokens to jobs.
            keys = await get_user_api_keys_service().get_keys_dict(job["user_id"])
            result = await analyze_chart(
                job["ticker"], body["interval"], history,
                body.get("view_start"), body.get("view_end"),
                locale=body.get("locale", "zh"), categories=body.get("categories"),
                custom_scenarios=body.get("custom_scenarios"), operation=job["operation"],
                user_api_keys=keys or None, model_id=body.get("model"), user_id=job["user_id"],
            )
        # One transaction saves the immutable version, current pointer and job.
        await asyncio.to_thread(jobs.complete, job["id"], result, history)
    except asyncio.CancelledError:
        # A shutdown is terminal for running jobs; do not automatically bill twice.
        await asyncio.to_thread(jobs.fail, job["id"], "ai_job_interrupted")
        raise
    except Exception as exc:
        code = ("ai_not_configured" if isinstance(exc, AiNotConfigured)
                else "ai_analysis_timeout" if isinstance(exc, TimeoutError)
                else "ai_insufficient_bars" if isinstance(exc, ValueError) and "20 bars" in str(exc)
                else "ai_analysis_failed")
        logger.warning("Chart job %s failed (%s, %s)", job["id"], code, type(exc).__name__)
        await asyncio.to_thread(jobs.fail, job["id"], code)


async def run_worker():
    """Single consumer per process. SKIP LOCKED supports multiple API/worker replicas."""
    delay = 3
    while True:
        try:
            jobs = StockChartJobs(get_supabase_service())
            job = await asyncio.to_thread(jobs.claim)
            delay = 3
            if job:
                await process_job(jobs, job)
                continue
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Chart worker unavailable (%s); retrying", type(exc).__name__)
            delay = min(delay * 2, 30)
        await asyncio.sleep(delay)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
