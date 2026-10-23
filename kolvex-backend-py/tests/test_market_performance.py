"""Unit tests for the batch recent-performance service and its route (no network)."""

import ast
import asyncio
import logging
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List
from unittest.mock import patch

import httpx
import pandas as pd

from app.services import market_performance
from app.services.market_performance import (
    MAX_SYMBOLS,
    TooManySymbolsError,
    clear_cache,
    get_stock_performance,
    normalize_symbols,
)

END_DATE = "2026-10-23"
FIELDS = ("Open", "High", "Low", "Close", "Volume")
ROUTE_FILE = Path(__file__).resolve().parents[1] / "app/api/routes/market_data.py"

# The retry backoff exists for production Yahoo hiccups; tests do not need to sleep.
market_performance.DOWNLOAD_RETRY_DELAY_SECONDS = 0.0

# Expected download failures are logged at warning level; keep test output clean.
logging.getLogger("app.services.market_performance").addHandler(logging.NullHandler())


def bdates(periods: int, end: str = END_DATE) -> pd.DatetimeIndex:
    return pd.bdate_range(end=end, periods=periods)


def flat_frame(closes) -> pd.DataFrame:
    """A single-ticker yfinance frame with flat column names."""
    closes = [float(value) for value in closes]
    return pd.DataFrame(
        {
            "Open": [value + 1 for value in closes],
            "High": [value + 2 for value in closes],
            "Low": [value - 1 for value in closes],
            "Close": closes,
            "Volume": [1_000_000] * len(closes),
        },
        index=bdates(len(closes)),
    )


def multi_frame(series_by_symbol) -> pd.DataFrame:
    """A multi-ticker yfinance frame with (ticker, field) column levels."""
    symbols = list(series_by_symbol)
    index = bdates(len(series_by_symbol[symbols[0]]))
    data = {}
    for symbol in symbols:
        closes = [float(value) for value in series_by_symbol[symbol]]
        for field in FIELDS:
            if field == "Close":
                data[(symbol, field)] = closes
            elif field == "Volume":
                data[(symbol, field)] = [1_000_000] * len(closes)
            else:
                data[(symbol, field)] = [value + 1 for value in closes]
    columns = pd.MultiIndex.from_product([symbols, FIELDS])
    return pd.DataFrame(data, index=index)[columns]


def route_app(provider):
    """Load the real handler from market_data.py with a stubbed service."""
    from fastapi import APIRouter, FastAPI, HTTPException, Query

    source = ast.parse(ROUTE_FILE.read_text())
    handler = next(
        node for node in source.body
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "get_market_performance"
    )
    router = APIRouter()
    scope = {
        "router": router,
        "List": List,
        "Query": Query,
        "HTTPException": HTTPException,
        "asyncio": asyncio,
        "get_stock_performance": provider,
        "TooManySymbolsError": TooManySymbolsError,
        "logger": logging.getLogger("tests.market_performance"),
    }
    exec(compile(ast.Module(body=[handler], type_ignores=[]), str(ROUTE_FILE), "exec"), scope)
    app = FastAPI()
    app.include_router(router)
    return app


class NormalizationTests(unittest.TestCase):
    def test_splits_comma_and_repeated_params_uppercases_trims_and_dedupes(self):
        raw = [" nvda ", "NVDA,MU", "bad$", "", "BRK.B", "^GSPC", "btc-usd", "A" * 21, "=F"]

        self.assertEqual(
            normalize_symbols(raw),
            ["NVDA", "MU", "BRK.B", "^GSPC", "BTC-USD", "=F"],
        )

    def test_empty_input(self):
        self.assertEqual(normalize_symbols([]), [])
        self.assertEqual(normalize_symbols(None), [])


class PerformanceComputationTests(unittest.TestCase):
    def setUp(self):
        clear_cache()
        self.index = bdates(70)
        self.month_ago_bar = self.index.get_loc(pd.Timestamp("2026-09-23"))

    def _frames(self):
        nvda = [100.0] * 70
        nvda[-1] = 110.0
        nvda[-2] = 104.5
        nvda[-6] = 100.0
        nvda[self.month_ago_bar] = 88.0
        mu = [50.0] * 70
        mu[-1] = 55.0
        mu[-2] = 54.0
        mu[-6] = 52.5
        mu[self.month_ago_bar] = 44.0
        return multi_frame({"NVDA": nvda, "MU": mu})

    def test_one_day_five_day_and_one_month_changes(self):
        frame = self._frames()
        calls = []

        def downloader(tickers):
            calls.append(list(tickers))
            return frame

        stocks = get_stock_performance(["nvda", "MU"], downloader)["stocks"]

        self.assertEqual(calls, [["NVDA", "MU"]])
        self.assertEqual(
            stocks["NVDA"],
            {
                "symbol": "NVDA",
                "as_of": "2026-10-23",
                "price": 110.0,
                "previous_close": 104.5,
                "change_1d_percent": 5.26,
                "change_5d_percent": 10.0,
                "change_1mo_percent": 25.0,
            },
        )
        self.assertEqual(
            stocks["MU"],
            {
                "symbol": "MU",
                "as_of": "2026-10-23",
                "price": 55.0,
                "previous_close": 54.0,
                "change_1d_percent": 1.85,
                "change_5d_percent": 4.76,
                "change_1mo_percent": 25.0,
            },
        )

    def test_single_symbol_multiindex_shape_from_yfinance(self):
        closes = [100.0, 102.0, 105.0]
        stocks = get_stock_performance(
            ["NVDA"], lambda tickers: multi_frame({"NVDA": closes})
        )["stocks"]

        self.assertEqual(stocks["NVDA"]["price"], 105.0)
        self.assertEqual(stocks["NVDA"]["previous_close"], 102.0)
        self.assertEqual(stocks["NVDA"]["change_1d_percent"], 2.94)

    def test_single_symbol_flat_columns_and_short_history(self):
        closes = [100.0, 102.0, 105.0]
        stocks = get_stock_performance(["NVDA"], lambda tickers: flat_frame(closes))["stocks"]

        self.assertEqual(
            stocks["NVDA"],
            {
                "symbol": "NVDA",
                "as_of": "2026-10-23",
                "price": 105.0,
                "previous_close": 102.0,
                "change_1d_percent": 2.94,
                "change_5d_percent": None,
                "change_1mo_percent": None,
            },
        )

    def test_one_bar_history_has_no_previous_close_or_changes(self):
        stocks = get_stock_performance(["NVDA"], lambda tickers: flat_frame([120.0]))["stocks"]

        self.assertEqual(stocks["NVDA"]["price"], 120.0)
        self.assertIsNone(stocks["NVDA"]["previous_close"])
        self.assertIsNone(stocks["NVDA"]["change_1d_percent"])
        self.assertIsNone(stocks["NVDA"]["change_5d_percent"])
        self.assertIsNone(stocks["NVDA"]["change_1mo_percent"])

    def test_nan_closes_are_dropped_before_measuring(self):
        closes = [100.0, 100.0, float("nan"), 100.0, 100.0, 104.5, float("nan")]
        stocks = get_stock_performance(["NVDA"], lambda tickers: multi_frame({"NVDA": closes}))["stocks"]

        entry = stocks["NVDA"]
        self.assertEqual(entry["as_of"], "2026-10-22")
        self.assertEqual(entry["price"], 104.5)
        self.assertEqual(entry["previous_close"], 100.0)
        self.assertEqual(entry["change_1d_percent"], 4.5)
        self.assertIsNone(entry["change_5d_percent"])

    def test_missing_or_all_nan_symbols_get_error_without_failing_the_batch(self):
        nvda = [100.0] * 10
        nvda[-1] = 110.0
        frame = multi_frame({"NVDA": nvda, "BADX": [float("nan")] * 10})
        stocks = get_stock_performance(["NVDA", "BADX", "NOPE"], lambda tickers: frame)["stocks"]

        self.assertEqual(stocks["NVDA"]["price"], 110.0)
        self.assertEqual(stocks["BADX"], {"symbol": "BADX", "error": "No price data"})
        self.assertEqual(stocks["NOPE"], {"symbol": "NOPE", "error": "No price data"})

    def test_empty_download_result_is_retried_then_not_cached(self):
        calls = []

        def downloader(tickers):
            calls.append(list(tickers))
            return pd.DataFrame()

        stocks = get_stock_performance(["NVDA", "MU"], downloader)["stocks"]

        self.assertEqual(stocks["NVDA"], {"symbol": "NVDA", "error": "No price data"})
        self.assertEqual(stocks["MU"], {"symbol": "MU", "error": "No price data"})
        self.assertEqual(calls, [["NVDA", "MU"], ["NVDA", "MU"]])

        # Transient failures are not cached: the next request downloads again.
        get_stock_performance(["NVDA", "MU"], downloader)
        self.assertEqual(len(calls), 4)

    def test_failed_bulk_download_is_retried_once_without_per_symbol_followups(self):
        calls = []

        def downloader(tickers):
            calls.append(list(tickers))
            raise RuntimeError("bulk download exploded")

        stocks = get_stock_performance(["NVDA", "BADX"], downloader)["stocks"]

        # One bounded retry of the same chunk; no per-symbol fallback requests.
        self.assertEqual(calls, [["NVDA", "BADX"], ["NVDA", "BADX"]])
        self.assertEqual(stocks["NVDA"], {"symbol": "NVDA", "error": "No price data"})
        self.assertEqual(stocks["BADX"], {"symbol": "BADX", "error": "No price data"})

    def test_quotes_and_volume_columns_do_not_break_close_extraction(self):
        frame = self._frames()
        frame[("NVDA", "Adj Close")] = frame[("NVDA", "Close")]
        stocks = get_stock_performance(["NVDA"], lambda tickers: frame)["stocks"]

        self.assertEqual(stocks["NVDA"]["price"], 110.0)


class CacheTests(unittest.TestCase):
    def setUp(self):
        clear_cache()

    @staticmethod
    def _downloader():
        data = {"NVDA": 100.0, "MU": 200.0, "SPY": 300.0}
        calls = []

        def downloader(tickers):
            calls.append(list(tickers))
            series = {}
            for symbol in tickers:
                base = data.get(symbol, 50.0)
                values = [base] * 10
                values[-1] = base + 1
                series[symbol] = values
            return multi_frame(series)

        return downloader, calls

    def test_second_call_within_ttl_reuses_cache_and_only_downloads_missing(self):
        downloader, calls = self._downloader()

        first = get_stock_performance(["NVDA", "MU"], downloader)["stocks"]
        self.assertEqual(calls, [["NVDA", "MU"]])

        second = get_stock_performance(["NVDA"], downloader)["stocks"]
        self.assertEqual(calls, [["NVDA", "MU"]])
        self.assertEqual(first["NVDA"], second["NVDA"])

        third = get_stock_performance(["NVDA", "SPY"], downloader)["stocks"]
        self.assertEqual(calls, [["NVDA", "MU"], ["SPY"]])
        self.assertEqual(third["SPY"]["price"], 301.0)

    def test_entries_are_refreshed_after_ttl(self):
        downloader, calls = self._downloader()

        get_stock_performance(["NVDA"], downloader)
        with patch.object(market_performance, "CACHE_TTL_SECONDS", 0.0):
            get_stock_performance(["NVDA"], downloader)

        self.assertEqual(calls, [["NVDA"], ["NVDA"]])

    def test_concurrent_calls_are_thread_safe(self):
        downloader, calls = self._downloader()

        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(
                pool.map(
                    lambda _: get_stock_performance(["NVDA", "MU"], downloader)["stocks"],
                    range(8),
                )
            )

        for stocks in results:
            self.assertEqual(stocks["NVDA"]["price"], 101.0)
            self.assertEqual(stocks["MU"]["price"], 201.0)
        self.assertTrue(calls)


class TransientFailureTests(unittest.TestCase):
    """Bulk failures must be retried once and must never poison the cache."""

    def setUp(self):
        clear_cache()

    def test_bulk_exception_is_retried_once_and_not_cached(self):
        calls = []

        def downloader(tickers):
            calls.append(list(tickers))
            raise ValueError("No objects to concatenate")

        first = get_stock_performance(["NVDA", "MU"], downloader)["stocks"]
        self.assertEqual(calls, [["NVDA", "MU"], ["NVDA", "MU"]])
        self.assertEqual(first["NVDA"], {"symbol": "NVDA", "error": "No price data"})
        self.assertEqual(first["MU"], {"symbol": "MU", "error": "No price data"})

        second = get_stock_performance(["NVDA", "MU"], downloader)["stocks"]
        self.assertEqual(len(calls), 4)
        self.assertEqual(second["NVDA"], {"symbol": "NVDA", "error": "No price data"})

    def test_degraded_frame_without_any_usable_close_is_not_cached(self):
        calls = []
        degraded = multi_frame({"NVDA": [float("nan")] * 10, "MU": [float("nan")] * 10})

        def downloader(tickers):
            calls.append(list(tickers))
            return degraded

        get_stock_performance(["NVDA", "MU"], downloader)
        self.assertEqual(calls, [["NVDA", "MU"], ["NVDA", "MU"]])

        get_stock_performance(["NVDA", "MU"], downloader)
        self.assertEqual(len(calls), 4)

    def test_partially_degraded_frame_caches_success_but_negative_expires_quickly(self):
        nvda = [100.0] * 10
        nvda[-1] = 110.0
        calls = []
        frame = multi_frame({"NVDA": nvda, "BADX": [float("nan")] * 10})

        def downloader(tickers):
            calls.append(list(tickers))
            return frame

        first = get_stock_performance(["NVDA", "BADX"], downloader)["stocks"]
        self.assertEqual(calls, [["NVDA", "BADX"]])
        self.assertEqual(first["NVDA"]["price"], 110.0)
        self.assertEqual(first["BADX"], {"symbol": "BADX", "error": "No price data"})

        # Still within the 300s success TTL / 60s negative TTL: no download.
        get_stock_performance(["NVDA", "BADX"], downloader)
        self.assertEqual(calls, [["NVDA", "BADX"]])

        # Once the negative TTL elapses only the missing symbol is fetched again;
        # a chunk with no usable Close at all is retried once, hence two calls.
        with patch.object(market_performance, "NEGATIVE_TTL_SECONDS", 0.0):
            get_stock_performance(["NVDA", "BADX"], downloader)
        self.assertEqual(calls, [["NVDA", "BADX"], ["BADX"], ["BADX"]])

    def test_large_failing_chunk_does_not_multiply_downloader_calls(self):
        calls = []
        symbols = [f"S{index:03d}" for index in range(40)]

        def downloader(tickers):
            calls.append(list(tickers))
            raise ValueError("No objects to concatenate")

        get_stock_performance(symbols, downloader)

        self.assertEqual(len(calls), 2)
        self.assertEqual(calls, [symbols, symbols])


class DownloadSerializationTests(unittest.TestCase):
    """The process-wide download lock must keep Yahoo calls strictly serial."""

    def setUp(self):
        clear_cache()

    def test_downloader_never_runs_concurrently_across_threads(self):
        state = {"active": 0, "max_active": 0, "calls": 0}
        state_lock = threading.Lock()
        start = threading.Barrier(2)

        def downloader(tickers):
            with state_lock:
                state["active"] += 1
                state["calls"] += 1
                state["max_active"] = max(state["max_active"], state["active"])
            try:
                time.sleep(0.05)
                return multi_frame({ticker: [100.0] * 10 for ticker in tickers})
            finally:
                with state_lock:
                    state["active"] -= 1

        def request(symbol):
            start.wait(1)
            return get_stock_performance([symbol], downloader)["stocks"]

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(request, ["NVDA", "MU"]))

        self.assertEqual(state["max_active"], 1)
        self.assertEqual(state["calls"], 2)
        for stocks in results:
            self.assertIn("price", next(iter(stocks.values())))

    def test_waiting_request_rechecks_cache_and_skips_filled_symbols(self):
        entered = threading.Event()
        release = threading.Event()
        calls = []
        calls_lock = threading.Lock()
        results = {}

        def downloader(tickers):
            with calls_lock:
                calls.append(list(tickers))
            if list(tickers) == ["NVDA"]:
                entered.set()
                release.wait(2)
            return multi_frame({ticker: [100.0] * 10 for ticker in tickers})

        first = threading.Thread(
            target=lambda: results.update(
                first=get_stock_performance(["NVDA"], downloader)["stocks"]
            )
        )
        late = threading.Thread(
            target=lambda: results.update(
                late=get_stock_performance(["NVDA", "MU"], downloader)["stocks"]
            )
        )

        first.start()
        try:
            self.assertTrue(entered.wait(2), "first download did not start")
            late.start()
            time.sleep(0.05)  # let the late request block on the download lock
        finally:
            release.set()
        first.join(2)
        late.join(2)

        self.assertEqual(calls, [["NVDA"], ["MU"]])
        self.assertEqual(results["first"]["NVDA"]["price"], 100.0)
        self.assertEqual(results["late"]["NVDA"]["price"], 100.0)
        self.assertEqual(results["late"]["MU"]["price"], 100.0)


class LimitTests(unittest.TestCase):
    def setUp(self):
        clear_cache()

    def test_more_than_max_after_normalization_raises(self):
        symbols = [f"S{index:03d}" for index in range(MAX_SYMBOLS + 1)]
        downloaded = []

        def downloader(tickers):
            downloaded.append(tickers)
            return pd.DataFrame()

        with self.assertRaises(TooManySymbolsError) as raised:
            get_stock_performance(symbols, downloader)

        self.assertEqual(str(raised.exception), "Too many symbols (max 80)")
        self.assertEqual(downloaded, [])

    def test_invalid_symbols_do_not_count_toward_limit_and_downloads_are_chunked(self):
        symbols = [f"S{index:03d}" for index in range(MAX_SYMBOLS)] + ["BAD$"]
        calls = []

        def downloader(tickers):
            calls.append(list(tickers))
            return multi_frame({ticker: [100.0] * 10 for ticker in tickers})

        stocks = get_stock_performance(symbols, downloader)["stocks"]

        self.assertEqual(len(stocks), MAX_SYMBOLS)
        self.assertEqual(stocks["S000"]["price"], 100.0)
        self.assertEqual(
            calls,
            [
                [f"S{index:03d}" for index in range(50)],
                [f"S{index:03d}" for index in range(50, MAX_SYMBOLS)],
            ],
        )

    def test_no_valid_symbols_returns_empty_stocks(self):
        def downloader(tickers):  # pragma: no cover - must not be called
            raise AssertionError("downloader must not run")

        self.assertEqual(get_stock_performance(["BAD$", ""], downloader), {"stocks": {}})


class PerformanceRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_waiting_for_performance_does_not_block_other_requests(self):
        started, release = threading.Event(), threading.Event()

        def provider(symbols):
            started.set()
            release.wait(1)
            return {"stocks": {symbol: {"symbol": symbol} for symbol in symbols}}

        app = route_app(provider)

        @app.get("/health")
        async def health():
            return {"ok": True}

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local") as client:
            batch = asyncio.create_task(client.get("/performance?symbols=MU"))
            try:
                self.assertTrue(await asyncio.to_thread(started.wait, 0.5))
                self.assertFalse(batch.done(), "Performance request must yield the event loop while waiting")
                self.assertEqual((await asyncio.wait_for(client.get("/health"), 0.5)).json(), {"ok": True})
            finally:
                release.set()
                response = await batch

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"stocks": {"MU": {"symbol": "MU"}}})

    async def test_repeated_symbols_query_params_are_forwarded(self):
        def provider(symbols):
            return {"stocks": {symbol: {"symbol": symbol} for symbol in symbols}}

        app = route_app(provider)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local") as client:
            response = await client.get("/performance?symbols=NVDA&symbols=MU")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(list(response.json()["stocks"]), ["NVDA", "MU"])

    async def test_too_many_symbols_returns_400_with_contract_detail(self):
        def provider(symbols):
            raise TooManySymbolsError("Too many symbols (max 80)")

        app = route_app(provider)
        symbols = ",".join(f"S{index:03d}" for index in range(MAX_SYMBOLS + 1))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local") as client:
            response = await client.get(f"/performance?symbols={symbols}")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "Too many symbols (max 80)"})


class RouteRegistrationTests(unittest.TestCase):
    def test_performance_route_is_registered(self):
        from app.api.routes import market_data

        paths = [
            route.path
            for route in market_data.router.routes
            if "GET" in getattr(route, "methods", ())
        ]

        self.assertIn("/market/performance", paths)


if __name__ == "__main__":
    unittest.main()
