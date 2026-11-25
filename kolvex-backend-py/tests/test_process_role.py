"""PROCESS_ROLE splits the API and the background jobs into separate processes (no network)."""

import asyncio
import os
import unittest
from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch

import main

JOBS = {
    "app.services.stock_chart_jobs.run_worker": "chart",
    "app.services.economic_indicators.run_economic_indicators_worker": "indicators",
    "app.services.paper_trading.service.run_worker": "paper",
    "app.services.sec.holdings_store.institution_store.run_worker": "holdings",
    "app.services.sec.performance.performance_store.run_worker": "performance",
    "app.services.options_activity.service.run_options_activity_worker": "options",
    "app.services.agent_signal_evaluation.run_signal_evaluation_worker": "signals",
    "app.services.congress_trades.run_congress_trades_worker": "congress",
    "app.services.email_service.run_email_worker": "email",
    "app.services.plaid_snapshot_worker.run_plaid_snapshot_worker": "plaid",
    "app.services.trade_os.daily_job.run_trade_os_daily_worker": "trade_os",
    "app.services.content_translation.run_content_translation_worker": "translation",
    "app.services.market_risk.worker.run_market_risk_worker": "market_risk",
}
ALWAYS = {
    "main.run_traffic_reporter": "traffic",
    "app.services.sec.managers.manager_registry.run_refresher": "managers",
}
FLAGS = {
    "app.services.plaid_snapshot_worker.worker_enabled": True,
    "app.services.trade_os.daily_job.worker_enabled": True,
    "app.services.market_risk.worker.worker_enabled": True,
}
ENV = {
    "CONGRESS_TRADES_SYNC_ENABLED": "true",
    "CONTENT_TRANSLATION_WORKER_ENABLED": "true",
}


async def run_lifespan(role):
    started, cleanups = [], []

    def job(name):
        async def loop(*_args, **_kwargs):
            started.append(name)
            await asyncio.Event().wait()

        return loop

    analysis = MagicMock()
    analysis.cleanup_stale_analyses.side_effect = lambda: cleanups.append("analyses")
    with ExitStack() as stack:
        stack.enter_context(patch.dict(os.environ, {**ENV, "PROCESS_ROLE": role}))
        stack.enter_context(patch.object(main.settings, "ECONOMIC_INDICATORS_WORKER_ENABLED", True))
        stack.enter_context(patch.object(main.settings, "OPTIONS_ACTIVITY_WORKER_ENABLED", True))
        stack.enter_context(patch("main.init_redis", AsyncMock()))
        stack.enter_context(patch("main.close_redis", AsyncMock()))
        stack.enter_context(
            patch(
                "app.services.trading_analysis_service.get_trading_analysis_service",
                return_value=analysis,
            )
        )
        stack.enter_context(patch("app.core.supabase.get_supabase_service", return_value=None))
        stack.enter_context(
            patch(
                "app.services.research_workspace.fail_stale_runs",
                side_effect=lambda _db: cleanups.append("research"),
            )
        )
        for target, name in {**JOBS, **ALWAYS}.items():
            stack.enter_context(patch(target, job(name)))
        for target, value in FLAGS.items():
            stack.enter_context(patch(target, return_value=value))

        async with main.lifespan(main.app):
            for _ in range(5):
                await asyncio.sleep(0)
    return set(started), cleanups


class ProcessRoleTests(unittest.IsolatedAsyncioTestCase):
    async def test_default_runs_api_cleanups_and_every_job_like_before(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("PROCESS_ROLE", None)
            self.assertEqual(main.process_role(), "all")
        started, cleanups = await run_lifespan("all")
        self.assertEqual(started, set(JOBS.values()) | set(ALWAYS.values()))
        self.assertEqual(cleanups, ["analyses", "research"])

    async def test_web_role_serves_without_background_jobs(self):
        started, cleanups = await run_lifespan("web")
        self.assertEqual(started, set(ALWAYS.values()))
        self.assertEqual(cleanups, ["analyses", "research"])

    async def test_worker_role_never_fails_the_web_process_in_flight_analyses(self):
        started, cleanups = await run_lifespan("worker")
        self.assertEqual(started, set(JOBS.values()) | set(ALWAYS.values()))
        self.assertEqual(cleanups, [])

    def test_unknown_role_falls_back_to_all(self):
        with patch.dict(os.environ, {"PROCESS_ROLE": "both"}):
            self.assertEqual(main.process_role(), "all")


if __name__ == "__main__":
    unittest.main()
