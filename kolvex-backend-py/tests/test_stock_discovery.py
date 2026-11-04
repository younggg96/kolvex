"""Discovery eligibility, dated ranking, cache recovery and HTTP contract."""
import ast
import logging
import time
import unittest
from concurrent.futures import Future
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi import APIRouter, FastAPI, HTTPException

from app.services import stock_discovery as service

NOW = time.time()


def quote(symbol="PLTR", **patches):
    return {"symbol": symbol, "shortName": symbol + " Inc", "quoteType": "EQUITY",
            "currency": "USD", "regularMarketPrice": 25, "regularMarketChangePercent": 8,
            "regularMarketVolume": 12_000_000, "averageDailyVolume3Month": 4_000_000,
            "marketCap": 5_000_000_000, "regularMarketTime": int(NOW), **patches}


def future(value=None, error=None):
    result = Future()
    if error:
        result.set_exception(error)
    else:
        result.set_result(value)
    return result


class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        service._cache.clear()
        service._pending.clear()
        logging.getLogger(service.__name__).addHandler(logging.NullHandler())

    def tearDown(self):
        service._cache.clear()
        service._pending.clear()

    def seed(self, screen, rows, age=0):
        service._cache[screen] = (time.monotonic() - age, rows, "2026-11-04T15:00:00+00:00")

    def test_normalization_preserves_source_time_and_real_volume_basis(self):
        item = service._normalize(quote(), NOW)
        self.assertEqual(item["volumeMultiple"], 3)
        self.assertEqual(item["marketTime"], int(NOW))
        self.assertIsNone(service._normalize(quote(averageDailyVolume3Month=0), NOW)["volumeMultiple"])
        self.assertIsNone(service._normalize(quote(averageDailyVolume3Month=float("nan")), NOW)["averageVolume"])

    def test_rejects_unsafe_stale_missing_and_ineligible_rows(self):
        patches = [{"symbol": "../SPY"}, {"symbol": "000660.KS"}, {"quoteType": "ETF"},
                   {"currency": "CAD"}, {"regularMarketPrice": 4.99}, {"marketCap": 1e9},
                   {"regularMarketVolume": 19999}, {"regularMarketPrice": float("nan")},
                   {"regularMarketChangePercent": None}, {"regularMarketTime": NOW + 301},
                   {"regularMarketTime": NOW - 8 * 86400}, {"regularMarketPrice": True}]
        for changes in patches:
            with self.subTest(changes=changes):
                self.assertIsNone(service._normalize(quote(**changes), NOW))
        self.assertIsNone(service._normalize(None, NOW))

    def test_market_movers_include_outside_curated_list_and_both_directions(self):
        self.seed("day_gainers", [quote("PLTR", regularMarketChangePercent=8), quote("HOOD", regularMarketChangePercent=5)])
        self.seed("day_losers", [quote("DOX", regularMarketChangePercent=-30), quote("PLTR", regularMarketChangePercent=7, regularMarketTime=NOW-60)])
        board = service._board(service.SCREENS[:2], NOW, time.monotonic())
        self.assertEqual([item["symbol"] for item in board["items"]], ["DOX", "PLTR", "HOOD"])
        self.assertEqual(board["items"][1]["changePercent"], 8)
        self.assertFalse(board["partial"])

    def test_only_latest_session_is_ranked_including_weekend_previous_close(self):
        self.seed("day_gainers", [quote("PLTR"), quote("HALT", regularMarketTime=NOW - 86400)])
        board = service._board(service.SCREENS[:2], NOW + 2 * 86400, time.monotonic())
        self.assertEqual([item["symbol"] for item in board["items"]], ["PLTR"])
        self.assertTrue(board["partial"])

    def test_volume_surge_requires_real_average_and_ranks_multiple(self):
        self.seed("most_actives", [quote("PLTR"), quote("HOOD", averageDailyVolume3Month=2e6),
                                   quote("LOW", regularMarketVolume=4e6), quote("GAP", averageDailyVolume3Month=None)])
        board = service._board(["most_actives"], NOW, time.monotonic(), active=True)
        self.assertEqual([item["symbol"] for item in board["items"]], ["HOOD", "PLTR"])

    def test_empty_volume_results_are_success_not_fabricated_entries(self):
        self.seed("most_actives", [quote(regularMarketVolume=1e6)])
        board = service._board(["most_actives"], NOW, time.monotonic(), active=True)
        self.assertEqual(board["items"], [])
        self.assertIsNotNone(board["sessionDate"])
        self.assertFalse(board["unavailable"])

    def test_fresh_cached_snapshots_do_not_hit_upstream_or_share_mutable_output(self):
        for name in service.SCREENS:
            self.seed(name, [quote()])
        with patch.object(service._executor, "submit") as submit:
            first = service.get_stock_discovery()
            first["movers"]["items"].clear()
            self.assertEqual(len(service.get_stock_discovery()["movers"]["items"]), 1)
            submit.assert_not_called()

    def test_partial_failure_and_stale_fallback_are_explicit(self):
        self.seed("day_gainers", [quote()], age=120)
        responses = {"day_gainers": future(error=ValueError()), "day_losers": future(error=ValueError()),
                     "most_actives": future([quote("HOOD")])}
        with patch.object(service._executor, "submit", side_effect=lambda fn, name: responses[name]):
            data = service.get_stock_discovery()
        self.assertTrue(data["movers"]["partial"])
        self.assertTrue(data["movers"]["stale"])
        self.assertFalse(data["active"]["stale"])

    def test_total_failure_never_becomes_successful_empty_ranking(self):
        with patch.object(service._executor, "submit", side_effect=lambda *args: future(error=ValueError())):
            with self.assertRaises(service.DiscoveryUnavailable):
                service.get_stock_discovery()

    def test_expired_fallback_is_not_used(self):
        for name in service.SCREENS:
            self.seed(name, [quote()], age=service.MAX_AGE + 1)
        with patch.object(service._executor, "submit", side_effect=lambda *args: future(error=ValueError())):
            with self.assertRaises(service.DiscoveryUnavailable):
                service.get_stock_discovery()

    def test_slow_requests_reuse_inflight_future_instead_of_queuing_work(self):
        pending = Future()
        self.seed("day_gainers", [quote()], age=120)
        self.seed("day_losers", [])
        self.seed("most_actives", [])
        service._pending["day_gainers"] = pending
        with patch.object(service, "TIMEOUT", 0), patch.object(service._executor, "submit") as submit:
            self.assertTrue(service.get_stock_discovery()["movers"]["stale"])
            submit.assert_not_called()
            pending.set_result([quote("HOOD")])
            data = service.get_stock_discovery()
            self.assertFalse(data["movers"]["stale"])
            self.assertEqual(data["movers"]["items"][0]["symbol"], "HOOD")

    def test_malformed_upstream_is_failure_while_valid_empty_list_is_allowed(self):
        for payload in [None, {}, {"quotes": None}, {"quotes": {}}]:
            with patch.object(service.yf, "screen", return_value=payload):
                with self.assertRaises(service.DiscoveryUnavailable):
                    service._fetch("day_gainers")
        with patch.object(service.yf, "screen", return_value={"quotes": []}) as screen:
            self.assertEqual(service._fetch("day_gainers"), [])
            screen.assert_called_once_with("day_gainers", count=100)


class DiscoveryRouteTests(unittest.IsolatedAsyncioTestCase):
    def app(self, provider):
        # Exercise the real route without unrelated credential/DB dependencies.
        path = Path(__file__).resolve().parents[1] / "app/api/routes/market_data.py"
        handler = next(node for node in ast.parse(path.read_text()).body
                       if isinstance(node, ast.FunctionDef) and node.name == "get_market_discovery")
        router = APIRouter()
        scope = {"router": router, "HTTPException": HTTPException,
                 "get_stock_discovery": provider, "DiscoveryUnavailable": service.DiscoveryUnavailable}
        exec(compile(ast.Module(body=[handler], type_ignores=[]), str(path), "exec"), scope)
        app = FastAPI()
        app.include_router(router)
        return app

    async def test_http_success_and_explicit_503(self):
        for failure in [False, True]:
            def provider():
                if failure:
                    raise service.DiscoveryUnavailable("Upstream failed")
                return {"source": "Yahoo Finance", "movers": {"items": []}}
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app(provider)), base_url="http://test") as client:
                response = await client.get("/discovery")
            self.assertEqual(response.status_code, 503 if failure else 200)
            self.assertEqual(response.json(), {"detail": "Stock discovery unavailable"} if failure
                             else {"source": "Yahoo Finance", "movers": {"items": []}})


if __name__ == "__main__":
    unittest.main()
