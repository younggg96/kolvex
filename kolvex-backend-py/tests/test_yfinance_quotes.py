"""Exercise the real batch implementation with deterministic local quote providers."""
import ast
import asyncio
import concurrent.futures
from pathlib import Path
import threading
import unittest
from typing import Any, Dict, List

SOURCE = Path(__file__).resolve().parents[1] / "app/services/yfinance/client.py"


def batch_service(provider, timeout=0.1):
    source = ast.parse(SOURCE.read_text())
    cls = next(node for node in source.body if isinstance(node, ast.ClassDef) and node.name == "YFinanceService")
    method = next(node for node in cls.body if isinstance(node, ast.FunctionDef) and node.name == "get_multiple_quotes")
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)
    scope = {"List": List, "Dict": Dict, "Any": Any, "wait": concurrent.futures.wait,
             "_QUOTE_EXECUTOR": executor, "_QUOTE_BATCH_TIMEOUT": timeout}
    exec(compile(ast.Module(body=[method], type_ignores=[]), str(SOURCE), "exec"), scope)
    service = type("QuoteFixture", (), {"get_quote": staticmethod(provider), "get_multiple_quotes": scope["get_multiple_quotes"]})()
    return service, executor


class QuoteFallbackTests(unittest.TestCase):
    def test_quote_baseline_matches_regular_price_and_keeps_session_times(self):
        class Ticker:
            info = {"currentPrice": 199, "regularMarketPrice": 203.36,
                    "previousClose": 200, "regularMarketPreviousClose": 206.69,
                    "regularMarketChange": 1, "regularMarketChangePercent": 1,
                    "regularMarketTime": 1793814337, "preMarketPrice": 202,
                    "preMarketTime": 1793800000, "postMarketPrice": 204,
                    "postMarketTime": 1793830000, "marketState": "POST"}

        source = ast.parse(SOURCE.read_text())
        cls = next(node for node in source.body if isinstance(node, ast.ClassDef) and node.name == "YFinanceService")
        method = next(node for node in cls.body if isinstance(node, ast.FunctionDef) and node.name == "get_quote")
        scope = {"Dict": Dict, "Any": Any}
        exec(compile(ast.Module(body=[method], type_ignores=[]), str(SOURCE), "exec"), scope)
        service = type("Fixture", (), {"get_ticker": lambda self, symbol: Ticker(), "get_quote": scope["get_quote"]})()
        quote = service.get_quote("NVDA")
        self.assertEqual(quote["current_price"], 203.36)
        self.assertEqual(quote["previous_close"], 206.69)
        self.assertEqual(quote["change"], -3.33)
        self.assertAlmostEqual(quote["change_percent"], -1.6111)
        self.assertEqual(quote["market_time"], Ticker.info["regularMarketTime"])
        self.assertEqual(quote["pre_market_time"], Ticker.info["preMarketTime"])
        self.assertEqual(quote["post_market_time"], Ticker.info["postMarketTime"])
        self.assertEqual(quote["quote_source"], "Yahoo Finance")
        Ticker.info.pop("regularMarketPrice")
        fallback_quote = service.get_quote("NVDA")
        self.assertEqual(fallback_quote["current_price"], 199)
        self.assertIsNone(fallback_quote["market_time"])

    def test_history_explicitly_uses_unadjusted_regular_session_prices(self):
        calls = []
        class Ticker:
            def history(self, **kwargs):
                calls.append(kwargs)
                return type("Frame", (), {"empty": True})()

        source = ast.parse(SOURCE.read_text())
        cls = next(node for node in source.body if isinstance(node, ast.ClassDef) and node.name == "YFinanceService")
        method = next(node for node in cls.body if isinstance(node, ast.FunctionDef) and node.name == "get_history")
        from typing import Optional
        scope = {"Dict": Dict, "Any": Any, "List": List, "Optional": Optional}
        exec(compile(ast.Module(body=[method], type_ignores=[]), str(SOURCE), "exec"), scope)
        service = type("Fixture", (), {"get_ticker": lambda self, symbol: Ticker(), "get_history": scope["get_history"]})()
        service.get_history("NVDA", period="1d", interval="5m")
        service.get_history("NVDA", start="2026-10-01", end="2026-11-01")
        for call in calls:
            self.assertIs(call["auto_adjust"], False)
            self.assertIs(call["prepost"], False)

    def test_info_failure_still_uses_fast_quote_prices(self):
        class Ticker:
            @property
            def info(self):
                raise RuntimeError("Metadata unavailable")

            fast_info = type("FastInfo", (), {"last_price": 102, "previous_close": 100})()

        source = ast.parse(SOURCE.read_text())
        cls = next(node for node in source.body if isinstance(node, ast.ClassDef) and node.name == "YFinanceService")
        method = next(node for node in cls.body if isinstance(node, ast.FunctionDef) and node.name == "get_quote")
        scope = {"Dict": Dict, "Any": Any}
        exec(compile(ast.Module(body=[method], type_ignores=[]), str(SOURCE), "exec"), scope)
        service = type("Fixture", (), {"get_ticker": lambda self, symbol: Ticker(), "get_quote": scope["get_quote"]})()
        quote = service.get_quote("^GSPC")
        self.assertEqual(quote["current_price"], 102)
        self.assertEqual(quote["previous_close"], 100)
        self.assertEqual(quote["change"], 2)
        self.assertEqual(quote["change_percent"], 2)


class QuoteBatchTests(unittest.TestCase):
    def test_a_slow_symbol_does_not_discard_ready_quotes(self):
        release = threading.Event()
        def provider(symbol):
            if symbol == "SPCX":
                release.wait(2)
            return {"symbol": symbol, "current_price": 180}
        service, executor = batch_service(provider)
        try:
            result = service.get_multiple_quotes(["SPCX", "MU", "AMD", "TSM"])
            self.assertEqual(result["MU"]["current_price"], 180)
            self.assertEqual(result["AMD"]["current_price"], 180)
            self.assertEqual(result["TSM"]["current_price"], 180)
            self.assertEqual(result["SPCX"], {"error": "Quote timed out"})
        finally:
            release.set()
            executor.shutdown(wait=True)

    def test_one_provider_error_does_not_fail_other_symbols_and_duplicates_are_removed(self):
        calls = []
        def provider(symbol):
            calls.append(symbol)
            if symbol == "SPCX":
                raise ValueError("No quote")
            return {"symbol": symbol, "current_price": 180}
        service, executor = batch_service(provider)
        try:
            result = service.get_multiple_quotes([" mu ", "MU", "SPCX", "AMD"])
            self.assertCountEqual(calls, ["MU", "SPCX", "AMD"])
            self.assertEqual(result["MU"]["symbol"], "MU")
            self.assertEqual(result["SPCX"], {"error": "No quote"})
            self.assertEqual(result["AMD"]["current_price"], 180)
        finally:
            executor.shutdown(wait=True)


class QuoteRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_single_quote_keeps_source_times_without_blocking_other_requests(self):
        from fastapi import APIRouter, FastAPI, HTTPException, Path as ApiPath
        from pydantic import BaseModel
        from typing import Optional
        import httpx

        started, release = threading.Event(), threading.Event()
        raw = {"symbol": "NVDA", "current_price": 203.36, "market_time": 1793814337,
               "pre_market_price": 202, "pre_market_time": 1793800000,
               "post_market_price": 204, "post_market_time": 1793830000,
               "market_state": "POST", "quote_source": "Yahoo Finance"}
        class Provider:
            def get_quote(self, symbol):
                started.set()
                release.wait(1)
                return raw

        route_file = SOURCE.parents[2] / "api/routes/market_data.py"
        source = ast.parse(route_file.read_text())
        nodes = [node for node in source.body if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in {"QuoteResponse", "get_quote"}]
        router = APIRouter()
        scope = {"router": router, "Optional": Optional, "BaseModel": BaseModel,
                 "Path": ApiPath, "HTTPException": HTTPException, "get_yfinance_service": Provider, "__name__": __name__}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), str(route_file), "exec"), scope)
        app = FastAPI()
        app.include_router(router)
        @app.get("/health")
        async def health():
            return {"ok": True}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local") as client:
            pending = asyncio.create_task(client.get("/quote/NVDA"))
            try:
                self.assertTrue(await asyncio.to_thread(started.wait, 0.5))
                self.assertFalse(pending.done())
                self.assertEqual((await asyncio.wait_for(client.get("/health"), 0.5)).json(), {"ok": True})
            finally:
                release.set()
                response = await pending
            self.assertEqual(response.status_code, 200)
            for field, value in raw.items():
                self.assertEqual(response.json()[field], value, field)

    async def test_waiting_for_quotes_does_not_block_other_requests(self):
        from fastapi import APIRouter, FastAPI, HTTPException, Query
        import httpx

        started, release = threading.Event(), threading.Event()
        class Provider:
            def get_multiple_quotes(self, symbols):
                started.set()
                release.wait(1)
                return {symbol: {"symbol": symbol, "current_price": 180} for symbol in symbols}

        route_file = SOURCE.parents[2] / "api/routes/market_data.py"
        source = ast.parse(route_file.read_text())
        handler = next(node for node in source.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "get_multiple_quotes")
        router = APIRouter()
        scope = {"router": router, "List": List, "Query": Query, "HTTPException": HTTPException, "get_yfinance_service": Provider}
        exec(compile(ast.Module(body=[handler], type_ignores=[]), str(route_file), "exec"), scope)
        app = FastAPI()
        app.include_router(router)
        @app.get("/health")
        async def health():
            return {"ok": True}

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local") as client:
            batch = asyncio.create_task(client.post("/quotes?symbols=MU"))
            try:
                self.assertTrue(await asyncio.to_thread(started.wait, 0.5))
                self.assertFalse(batch.done(), "A quote request must yield the event loop while waiting")
                response = await asyncio.wait_for(client.get("/health"), timeout=0.5)
                self.assertEqual(response.json(), {"ok": True})
            finally:
                release.set()
                await batch

    async def test_history_previews_do_not_block_quote_or_health_requests(self):
        from fastapi import APIRouter, FastAPI, HTTPException, Query, Path as ApiPath
        from pydantic import BaseModel
        from enum import Enum
        from typing import Optional
        import httpx

        started, release = threading.Event(), threading.Event()
        class Provider:
            def get_history(self, *args, **kwargs):
                started.set()
                release.wait(1)
                return [{"date": "2026-10-22", "open": 100, "high": 110, "low": 99, "close": 108}]

        route_file = SOURCE.parents[2] / "api/routes/market_data.py"
        source = ast.parse(route_file.read_text())
        names = {"HistoryPeriod", "HistoryInterval", "HistoryDataPoint", "HistoryResponse", "get_history"}
        nodes = [node for node in source.body if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
        router = APIRouter()
        scope = {"router": router, "List": List, "Optional": Optional, "BaseModel": BaseModel, "Enum": Enum,
                 "Query": Query, "Path": ApiPath, "HTTPException": HTTPException, "get_yfinance_service": Provider, "__name__": __name__}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), str(route_file), "exec"), scope)
        app = FastAPI()
        app.include_router(router)
        @app.get("/health")
        async def health():
            return {"ok": True}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local") as client:
            history = asyncio.create_task(client.get("/history/MU?period=1d&interval=5m"))
            try:
                self.assertTrue(await asyncio.to_thread(started.wait, 0.5))
                self.assertFalse(history.done())
                self.assertEqual((await asyncio.wait_for(client.get("/health"), 0.5)).json(), {"ok": True})
            finally:
                release.set()
                response = await history
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["data"][0]["close"], 108)


if __name__ == "__main__":
    unittest.main()
