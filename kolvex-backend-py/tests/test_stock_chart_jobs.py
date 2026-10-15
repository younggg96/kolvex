import asyncio
import unittest
from unittest.mock import AsyncMock, Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.dependencies.auth import get_current_user_id
from app.api.routes import market_data
from app.services import stock_chart_jobs as worker
from app.services.technical_analysis import AiNotConfigured

JOB_ID = "12345678-1234-1234-1234-123456789abc"
JOB = {"id": JOB_ID, "user_id": "user-1", "ticker": "NVDA", "operation": "drawings",
       "request": {"interval": "1d", "period": "3mo", "model": "test-model",
                   "view_start": "2026-07-01", "view_end": "2026-10-01", "categories": ["levels"]}}


class JobWorkerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.jobs = Mock()
        self.market = Mock()
        self.bars = [{"date": "2026-08-01", "open": 10, "high": 12, "low": 9, "close": 11}]
        self.market.get_history.return_value = self.bars + [{"date": "invalid", "close": None}]
        self.keys = Mock()
        self.keys.get_keys_dict = AsyncMock(return_value={"test": "secret"})
        self.analyze = AsyncMock(return_value={"summary": "result"})
        for patcher in (
            patch.object(worker, "get_yfinance_service", return_value=self.market),
            patch.object(worker, "get_user_api_keys_service", return_value=self.keys),
            patch.object(worker, "analyze_chart", self.analyze),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    async def test_saves_valid_result_and_original_bars_once(self):
        await worker.process_job(self.jobs, JOB)
        self.jobs.complete.assert_called_once_with(JOB_ID, {"summary": "result"}, self.bars)
        self.jobs.fail.assert_not_called()
        self.keys.get_keys_dict.assert_awaited_once_with("user-1")
        self.assertEqual(self.analyze.call_args.kwargs["operation"], "drawings")
        self.assertEqual(self.analyze.call_args.kwargs["categories"], ["levels"])

    async def test_failures_are_terminal_and_never_persist_provider_secrets(self):
        for exc, code in ((AiNotConfigured("secret"), "ai_not_configured"),
                          (TimeoutError(), "ai_analysis_timeout"),
                          (ValueError("Need at least 20 bars"), "ai_insufficient_bars"),
                          (RuntimeError("provider key=secret"), "ai_analysis_failed")):
            self.jobs.reset_mock()
            self.analyze.side_effect = exc
            await worker.process_job(self.jobs, JOB)
            self.jobs.fail.assert_called_once_with(JOB_ID, code)
            self.jobs.complete.assert_not_called()

    async def test_save_failure_is_not_reported_as_success(self):
        self.jobs.complete.side_effect = RuntimeError("database unavailable")
        await worker.process_job(self.jobs, JOB)
        self.jobs.fail.assert_called_once_with(JOB_ID, "ai_analysis_failed")

    async def test_generation_deadline_stops_a_stalled_provider(self):
        async def stalled(*args, **kwargs):
            await asyncio.Event().wait()
        self.analyze.side_effect = stalled
        with patch.object(worker, "JOB_TIMEOUT_SECONDS", 0.02):
            await worker.process_job(self.jobs, JOB)
        self.jobs.fail.assert_called_once_with(JOB_ID, "ai_analysis_timeout")
        self.jobs.complete.assert_not_called()

    async def test_shutdown_does_not_silently_retry_paid_generation(self):
        self.analyze.side_effect = asyncio.CancelledError()
        with self.assertRaises(asyncio.CancelledError):
            await worker.process_job(self.jobs, JOB)
        self.jobs.fail.assert_called_once_with(JOB_ID, "ai_job_interrupted")


class JobRoutesTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(market_data.router)
        app.dependency_overrides[get_current_user_id] = lambda: "user-1"
        keys = Mock(); keys.get_keys_dict = AsyncMock(return_value={})
        app.dependency_overrides[market_data.get_user_api_keys_service] = lambda: keys
        self.client = TestClient(app)
        for patcher in (patch.object(market_data, "StockChartJobs"),
                        patch.object(market_data, "get_supabase_service", return_value=Mock()),
                        patch("app.services.technical_analysis._choose_user_model", return_value=("test", "test"))):
            mocked = patcher.start()
            if patcher.attribute == "StockChartJobs": self.jobs = mocked.return_value
            self.addCleanup(patcher.stop)

    def test_submit_returns_accepted_without_calling_the_model(self):
        self.jobs.enqueue.return_value = {"id": JOB_ID, "status": "queued"}
        with patch.object(market_data, "analyze_chart", AsyncMock()) as analyze:
            response = self.client.post("/market/chart-jobs/nvda", json={"request_id": JOB_ID, "model": "test-model", "operation": "drawings"})
            self.assertEqual(response.status_code, 202)
            analyze.assert_not_called()
        user, ticker, body = self.jobs.enqueue.call_args.args
        self.assertEqual((user, ticker), ("user-1", "NVDA"))
        self.assertEqual(body["request_id"], JOB_ID)
        self.assertNotIn("api_keys", body)

    def test_reads_enforce_user_and_ticker_ownership(self):
        self.jobs.get.return_value = None
        self.assertEqual(self.client.get(f"/market/chart-jobs/nvda/{JOB_ID}").status_code, 404)
        self.jobs.get.assert_called_once_with("user-1", "NVDA", JOB_ID)
        self.jobs.latest.return_value = {"items": []}
        self.assertEqual(self.client.get("/market/chart-jobs/nvda").status_code, 200)
        self.jobs.latest.assert_called_once_with("user-1", "NVDA")

    def test_invalid_jobs_and_queue_failures_are_explicit(self):
        self.assertEqual(self.client.post("/market/chart-jobs/NVDA", json={"model": "test"}).status_code, 422)
        for error, status in (("ai_job_limit", 429), ("database offline", 503)):
            self.jobs.enqueue.side_effect = RuntimeError(error)
            response = self.client.post("/market/chart-jobs/NVDA", json={"request_id": JOB_ID, "model": "test"})
            self.assertEqual(response.status_code, status)


if __name__ == "__main__":
    unittest.main()
