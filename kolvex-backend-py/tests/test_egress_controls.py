import asyncio
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.core.egress_metrics import RequestMetricsMiddleware, TrafficMetrics, instrument_postgrest
from app.core.public_read_cache import PublicReadCacheMiddleware
from app.services import stock_chart_jobs as worker


class WorkerPollingTests(unittest.IsolatedAsyncioTestCase):
    async def test_empty_queue_sleeps_60_seconds_and_backlog_drains_without_sleep(self):
        jobs = Mock()
        jobs.claim.side_effect = [{"id": "one"}, {"id": "two"}, None]
        process = AsyncMock()
        sleep = AsyncMock(side_effect=asyncio.CancelledError)
        with patch.object(worker, "get_supabase_service"), patch.object(worker, "StockChartJobs", return_value=jobs), \
             patch.object(worker, "process_job", process), patch.object(worker.asyncio, "sleep", sleep):
            with self.assertRaises(asyncio.CancelledError):
                await worker.run_worker()
        self.assertEqual(jobs.claim.call_count, 3)
        self.assertEqual(process.await_count, 2)
        sleep.assert_awaited_once_with(60)

    async def test_rpc_errors_keep_original_bounded_retry_backoff(self):
        jobs = Mock()
        jobs.claim.side_effect = [RuntimeError(), RuntimeError(), RuntimeError(), RuntimeError(), None]
        sleep = AsyncMock(side_effect=[None, None, None, None, asyncio.CancelledError()])
        with patch.object(worker, "get_supabase_service"), patch.object(worker, "StockChartJobs", return_value=jobs), \
             patch.object(worker.asyncio, "sleep", sleep):
            with self.assertRaises(asyncio.CancelledError):
                await worker.run_worker()
        self.assertEqual([call.args[0] for call in sleep.await_args_list], [6, 12, 24, 30, 60])

    async def test_duplicate_start_and_cancelled_thread_claim_cannot_overlap(self):
        entered, release = threading.Event(), threading.Event()
        def claim():
            entered.set()
            release.wait(5)
            return {"id": "claimed-during-shutdown"}
        jobs = Mock()
        jobs.claim.side_effect = claim
        with patch.object(worker, "get_supabase_service"), patch.object(worker, "StockChartJobs", return_value=jobs):
            first = asyncio.create_task(worker.run_worker())
            try:
                self.assertTrue(await asyncio.to_thread(entered.wait, 2))
                await worker.run_worker()
                first.cancel()
                await asyncio.sleep(0)
                await worker.run_worker()
                self.assertEqual(jobs.claim.call_count, 1)
            finally:
                release.set()
                with self.assertRaises(asyncio.CancelledError):
                    await first
            jobs.fail.assert_called_once_with("claimed-during-shutdown", "ai_job_interrupted")
            self.assertFalse(worker._worker_lock.locked())


class PublicCacheTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.counts = {}
        self.app = FastAPI()
        self.metrics = TrafficMetrics()
        self.patches = [patch("app.core.egress_metrics.traffic_metrics", self.metrics),
                        patch("app.core.public_read_cache.traffic_metrics", self.metrics)]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

        @self.app.api_route("/api/v1/{path:path}", methods=["GET", "POST"])
        async def read(path: str, request: Request):
            self.counts[path] = self.counts.get(path, 0) + 1
            await asyncio.sleep(0.005)
            if request.query_params.get("fail"):
                return Response("unavailable", status_code=503)
            if request.query_params.get("cookie"):
                return Response("session", headers={"set-cookie": "session=private"})
            if request.query_params.get("private"):
                return Response("private", headers={"cache-control": "private, no-store"})
            return {"path": path, "page": request.query_params.get("offset"),
                    "user": request.headers.get("authorization") if "chart-jobs" in path else None}

        self.app.add_middleware(PublicReadCacheMiddleware)
        self.app.add_middleware(RequestMetricsMiddleware)
        self.app.add_middleware(CORSMiddleware, allow_origins=["https://a.test", "https://b.test"])
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://test")
        self.addAsyncCleanup(self.client.aclose)

    async def test_public_parallel_requests_share_one_read_and_measure_hits_and_bytes(self):
        responses = await asyncio.gather(*(self.client.get("/api/v1/x-content/posts?offset=0") for _ in range(20)))
        self.assertEqual(self.counts["x-content/posts"], 1)
        self.assertEqual(sum(r.headers["x-server-cache"] == "HIT" for r in responses), 19)
        rows = self.metrics.snapshot()
        cache = next(row for row in rows if row["source"] == "cache")
        self.assertEqual(cache["cache_hit_ratio"], 0.95)
        api = next(row for row in rows if row["source"] == "api")
        self.assertEqual(api["requests"], 20)
        self.assertEqual(api["response_bytes"], sum(len(r.content) for r in responses))
        await self.client.get("/api/v1/x-content/posts?offset=20")
        self.assertEqual(self.counts["x-content/posts"], 2)

    async def test_private_routes_and_post_always_bypass_cache_between_users(self):
        for path in ("market/chart-jobs/NVDA", "market/analysis-history/NVDA", "portfolio/history", "trading-analysis/public/report"):
            for user in ("a", "b"):
                response = await self.client.get("/api/v1/" + path, headers={"Authorization": user})
                self.assertNotIn("x-server-cache", response.headers)
                if "chart-jobs" in path:
                    self.assertEqual(response.json()["user"], user)
            self.assertEqual(self.counts[path], 2)
        for _ in range(2):
            await self.client.post("/api/v1/x-content/posts")
        self.assertEqual(self.counts["x-content/posts"], 2)

    async def test_cors_headers_are_generated_for_each_request(self):
        for origin in ("https://a.test", "https://b.test"):
            response = await self.client.get("/api/v1/market/news/NVDA", headers={"Origin": origin})
            self.assertEqual(response.headers["access-control-allow-origin"], origin)
        self.assertEqual(self.counts["market/news/NVDA"], 1)

    async def test_errors_cookies_and_private_responses_are_not_cached(self):
        for query in ("fail=1", "cookie=1", "private=1"):
            for _ in range(2):
                response = await self.client.get("/api/v1/market/news/NVDA?" + query)
                self.assertEqual(response.headers["x-server-cache"], "MISS")
        self.assertEqual(self.counts["market/news/NVDA"], 6)

    async def test_successful_public_content_write_invalidates_cached_reads(self):
        await self.client.get("/api/v1/x-content/posts")
        await self.client.post("/api/v1/x-content/upload")
        response = await self.client.get("/api/v1/x-content/posts")
        self.assertEqual(response.headers["x-server-cache"], "MISS")
        self.assertEqual(self.counts["x-content/posts"], 2)

    async def test_ttl_and_capacity_bounds(self):
        with patch.object(PublicReadCacheMiddleware, "MAX_ENTRIES", 1):
            await self.client.get("/api/v1/market/history/AAPL")
            await self.client.get("/api/v1/market/history/NVDA")
            await self.client.get("/api/v1/market/history/AAPL")
            self.assertEqual(self.counts["market/history/AAPL"], 2)
        with patch("app.core.public_read_cache.monotonic", return_value=0):
            await self.client.get("/api/v1/market/news/TSLA")
        with patch("app.core.public_read_cache.monotonic", return_value=61):
            await self.client.get("/api/v1/market/news/TSLA")
        self.assertEqual(self.counts["market/news/TSLA"], 2)
        with patch.object(PublicReadCacheMiddleware, "MAX_BODY", 1):
            for _ in range(2):
                await self.client.get("/api/v1/market/news/GOOG")
        self.assertEqual(self.counts["market/news/GOOG"], 2)


class SupabaseMetricsTests(unittest.TestCase):
    def test_real_httpx_hooks_count_rpc_bytes_without_recording_secrets(self):
        metrics = TrafficMetrics()
        with httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(200, content=b"null"))) as session:
            with patch("app.core.egress_metrics.traffic_metrics", metrics):
                instrument_postgrest(SimpleNamespace(postgrest=SimpleNamespace(session=session)))
                response = session.post("https://example.test/rest/v1/rpc/claim_stock_chart_job?user_id=secret", headers={"Authorization": "secret"})
                self.assertIsNone(response.json())
        self.assertEqual(metrics.snapshot(), [{"source": "supabase", "endpoint": "rpc/claim_stock_chart_job",
                         "requests": 1, "responses": 1, "response_bytes": 4, "errors": 0}])
