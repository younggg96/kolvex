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
