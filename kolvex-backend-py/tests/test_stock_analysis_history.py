import unittest
from unittest.mock import AsyncMock, Mock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.dependencies.auth import get_current_user_id
from app.api.routes import market_data
from app.services.stock_analysis_history import StockAnalysisHistory

VERSION = "12345678-1234-1234-1234-123456789abc"


class StockHistoryRoutesTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(market_data.router)
        app.dependency_overrides[get_current_user_id] = lambda: "user-1"
        keys = Mock()
        keys.get_keys_dict = AsyncMock(return_value={})
        app.dependency_overrides[market_data.get_user_api_keys_service] = lambda: keys
        self.client = TestClient(app)
        self.patcher = patch.object(market_data, "StockAnalysisHistory")
        self.history = self.patcher.start().return_value
        self.db = patch.object(market_data, "get_supabase_service", return_value=Mock())
        self.db.start()
        self.addCleanup(self.patcher.stop)
        self.addCleanup(self.db.stop)

    def test_history_is_user_scoped_normalized_and_paginated(self):
        self.history.list.return_value = {"items": [], "current": None, "total": 0}
        response = self.client.get("/market/analysis-history/nvda?kind=research&offset=10&limit=10")
        self.assertEqual(response.status_code, 200)
        self.history.list.assert_called_once_with("user-1", "NVDA", "research", 10, 10)
        self.assertEqual(self.client.get("/market/analysis-history/NVDA?limit=500").status_code, 422)
        self.assertEqual(self.client.get("/market/analysis-history/NVDA?kind=other").status_code, 422)

    def test_cannot_read_someone_elses_version(self):
        self.history.get.return_value = None
        response = self.client.get(f"/market/analysis-history/NVDA/{VERSION}")
        self.assertEqual(response.status_code, 404)
        self.history.get.assert_called_once_with("user-1", "NVDA", VERSION)

    def test_activation_conflict_and_not_found_are_recoverable(self):
        for message, expected in (("analysis_conflict", 409), ("analysis_not_found", 404)):
            self.history.activate.side_effect = RuntimeError(message)
            response = self.client.patch(f"/market/analysis-history/nvda/{VERSION}/current", json={"expected_current_id": VERSION})
            self.assertEqual(response.status_code, expected)
            self.history.activate.assert_called_with("user-1", "NVDA", VERSION, VERSION)

    def test_analysis_returns_success_only_after_result_and_original_bars_saved(self):
        bars = [{"date": "2026-10-01", "open": 10, "high": 12, "low": 9, "close": 11}]
        result = {"symbol": "NVDA", "levels": [{"kind": "support", "price": 9}]}
        self.history.save.return_value = {"id": VERSION, "created_at": "2026-10-09T00:00:00Z"}
        market = Mock()
        market.get_history.return_value = bars
        with patch.object(market_data, "get_yfinance_service", return_value=market), patch.object(market_data, "analyze_chart", AsyncMock(return_value=result)):
            response = self.client.post("/market/ai-technical/nvda", json={"period": "3mo", "interval": "1d"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["version_id"], VERSION)
            args = self.history.save.call_args.args
            self.assertEqual(args[:3], ("user-1", "NVDA", result))
            self.assertEqual(args[3]["period"], "3mo")
            self.assertEqual(args[4], bars)
            self.history.save.side_effect = RuntimeError("database offline")
            self.assertEqual(self.client.post("/market/ai-technical/NVDA", json={}).status_code, 503)

    def test_drawing_action_uses_its_own_history_and_operation(self):
        bars = [{"date": "2026-10-01", "open": 10, "high": 12, "low": 9, "close": 11}]
        self.history.save.return_value = {"id": VERSION, "created_at": "2026-10-09T00:00:00Z"}
        market = Mock(); market.get_history.return_value = bars
        with patch.object(market_data, "get_yfinance_service", return_value=market), patch.object(market_data, "analyze_chart", AsyncMock(return_value={"operation": "drawings", "levels": []})) as analyze:
            response = self.client.post("/market/ai-technical/NVDA", json={"operation": "drawings"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(analyze.call_args.kwargs["operation"], "drawings")
            self.assertEqual(self.history.save.call_args.kwargs["kind"], "drawings")
        self.assertEqual(self.client.post("/market/ai-technical/NVDA", json={"operation": "other"}).status_code, 422)
        self.history.list.return_value = {"items": [], "current": None, "total": 0}
        self.assertEqual(self.client.get("/market/analysis-history/NVDA?kind=drawings").status_code, 200)



class StockHistoryServiceTests(unittest.TestCase):
    def test_rpc_takes_owner_from_authenticated_server_not_payload(self):
        db = Mock()
        service = StockAnalysisHistory(db)
        service.save("owner", "NVDA", {"user_id": "attacker"}, {"interval": "1d"}, [])
        self.assertEqual(db.rpc.call_args.args[1]["p_user_id"], "owner")
        service.activate("owner", "NVDA", VERSION, None)
        self.assertEqual(db.rpc.call_args.args[1], {"p_user_id": "owner", "p_ticker": "NVDA", "p_version_id": VERSION, "p_expected_id": None})


class PrivateStockResearchTests(unittest.TestCase):
    def setUp(self):
        from app.api.routes.trading_analysis import routes
        self.routes = routes
        app = FastAPI()
        app.include_router(routes.router)
        app.dependency_overrides[get_current_user_id] = lambda: "user-1"
        self.keys = Mock()
        self.keys.get_keys_dict = AsyncMock(return_value={"deepseek": "test-only-key"})
        app.dependency_overrides[routes.get_user_api_keys_service] = lambda: self.keys
        self.client = TestClient(app)
        self.service = Mock()
        self.service.list_analyses = AsyncMock(return_value={"items": []})
        self.service.start_analysis = AsyncMock(return_value={"id": VERSION, "ticker": "NVDA", "trade_date": "2026-10-09", "status": "running"})

    def test_normal_user_can_generate_with_their_configured_provider(self):
        with patch.object(self.routes, "TRADINGAGENTS_AVAILABLE", True), patch.object(self.routes, "get_trading_analysis_service", return_value=self.service), patch.object(self.routes, "_choose_model", return_value=("deepseek", "deepseek-chat")):
            response = self.client.post("/trading-analysis/start-stock", json={"ticker": "nvda", "trade_date": "2026-10-09"})
        self.assertEqual(response.status_code, 200)
        arguments = self.service.start_analysis.call_args.kwargs
        self.assertEqual(arguments["user_id"], "user-1")
        self.assertEqual(arguments["provider"], "deepseek")
        self.assertEqual(arguments["quick_think_model"], "deepseek-chat")

    def test_running_job_is_resumed_without_duplicate_generation(self):
        self.service.list_analyses.return_value = {"items": [{"id": VERSION, "ticker": "NVDA", "trade_date": "2026-10-09", "status": "running"}]}
        with patch.object(self.routes, "TRADINGAGENTS_AVAILABLE", True), patch.object(self.routes, "get_trading_analysis_service", return_value=self.service), patch.object(self.routes, "_choose_model", return_value=("deepseek", "deepseek-chat")):
            response = self.client.post("/trading-analysis/start-stock", json={"ticker": "NVDA", "trade_date": "2026-10-09"})
        self.assertEqual(response.status_code, 200)
        self.service.start_analysis.assert_not_called()

if __name__ == "__main__":
    unittest.main()
