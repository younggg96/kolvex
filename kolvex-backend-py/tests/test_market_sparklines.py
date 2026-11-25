"""Batch sparkline closes: one request for a whole holdings list (no network)."""

import asyncio
import logging
import threading
import unittest

from app.services import market_sparklines
from app.services.market_sparklines import MAX_SYMBOLS, TooManySymbolsError, get_sparklines

logging.getLogger("app.services.market_sparklines").addHandler(logging.NullHandler())
logging.getLogger("app.services.market_sparklines").propagate = False


def bars(*closes):
    return [
        {"date": f"2026-11-24T14:{index:02d}:00", "close": close}
        for index, close in enumerate(closes)
    ]


class SparklineTests(unittest.IsolatedAsyncioTestCase):
    async def test_returns_closes_per_normalised_symbol(self):
        calls = []

        def fetch(symbol, interval):
            calls.append((symbol, interval))
            return bars(1.0, 2.5)

        data = await get_sparklines([" nvda,AAPL", "nvda"], "5m", fetch)

        self.assertEqual(data, {"NVDA": [1.0, 2.5], "AAPL": [1.0, 2.5]})
        self.assertEqual(sorted(calls), [("AAPL", "5m"), ("NVDA", "5m")])

    async def test_failed_or_empty_symbols_are_left_out_not_zero_filled(self):
        def fetch(symbol, interval):
            if symbol == "BAD":
                raise RuntimeError("yahoo down")
            if symbol == "EMPTY":
                return bars(None, float("nan"), 0)
            return bars(10.0, None, 11.0)

        data = await get_sparklines(["MU", "BAD", "EMPTY"], "5m", fetch)

        self.assertEqual(data, {"MU": [10.0, 11.0]})

    async def test_too_many_symbols_is_rejected_before_fetching(self):
        def fetch(symbol, interval):  # pragma: no cover — must not run
            raise AssertionError("fetched")

        symbols = [f"S{index:03d}" for index in range(MAX_SYMBOLS + 1)]
        with self.assertRaises(TooManySymbolsError):
            await get_sparklines(symbols, "5m", fetch)

    async def test_history_calls_run_off_the_event_loop_with_bounded_concurrency(self):
        active = peak = 0
        lock = threading.Lock()
        loop_thread = threading.get_ident()

        def fetch(symbol, interval):
            nonlocal active, peak
            self.assertNotEqual(threading.get_ident(), loop_thread)
            with lock:
                active += 1
                peak = max(peak, active)
            threading.Event().wait(0.02)
            with lock:
                active -= 1
            return bars(1.0)

        symbols = [f"S{index:02d}" for index in range(20)]
        ticks = 0

        async def ticker():
            nonlocal ticks
            while True:
                ticks += 1
                await asyncio.sleep(0.005)

        beat = asyncio.create_task(ticker())
        try:
            data = await get_sparklines(symbols, "5m", fetch)
        finally:
            beat.cancel()

        self.assertEqual(len(data), 20)
        self.assertLessEqual(peak, market_sparklines.CONCURRENCY)
        self.assertGreater(ticks, 2, "the event loop keeps serving while history loads")


class RouteRegistrationTests(unittest.TestCase):
    def test_sparklines_route_is_registered_and_publicly_cached(self):
        from pathlib import Path

        root = Path(__file__).resolve().parents[1]
        route = (root / "app/api/routes/market_data.py").read_text()
        cache = (root / "app/core/public_read_cache.py").read_text()
        self.assertIn('"/sparklines"', route)
        self.assertIn("market/sparklines", cache)


if __name__ == "__main__":
    unittest.main()
