"""CUSIP -> ticker mapping for 13F holdings, with OpenFIGI mocked."""
import asyncio
import json
import unittest
from unittest.mock import patch

import httpx

from app.services.sec.tickers import CusipTickers, normalize_ticker, pick_ticker

FIGI = {"037833100": "AAPL", "084670702": "BRK/B", "11271J107": "BN"}


class FakeRedis:
    def __init__(self):
        self.store = {}

    async def get_json(self, key):
        return self.store.get(key)

    async def set_json(self, key, value, ttl=None):
        self.store[key] = json.loads(json.dumps(value))
        return True


def transport(calls):
    def handler(request):
        jobs = json.loads(request.content)
        calls.append([job["idValue"] for job in jobs])
        return httpx.Response(200, json=[
            {"data": [{"ticker": FIGI[j["idValue"]], "marketSector": "Equity"}]} if j["idValue"] in FIGI else {"warning": "No identifier found."}
            for j in jobs])
    return httpx.MockTransport(handler)


class TickerTests(unittest.TestCase):
    def setUp(self):
        self.redis = FakeRedis()
        patcher = patch("app.services.sec.tickers.get_redis", return_value=self.redis)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.calls = []

    def test_normalize_and_pick(self):
        self.assertEqual(normalize_ticker("BRK/B"), "BRK.B")
        self.assertIsNone(normalize_ticker("12 34"))
        self.assertEqual(pick_ticker({"data": [{"ticker": "X", "marketSector": "Corp"}, {"ticker": "GOOGL", "marketSector": "Equity"}]}), "GOOGL")
        self.assertIsNone(pick_ticker({"warning": "No identifier found."}))

    def test_attach_maps_largest_now_and_caches_misses(self):
        service = CusipTickers(key="", transport=transport(self.calls))
        holdings = [{"cusip": "037833100", "value": 3}, {"cusip": "084670702", "value": 2}, {"cusip": "000000000", "value": 1}, {"cusip": "bad", "value": 0}]
        asyncio.run(service.attach(holdings, now=10))
        self.assertEqual([h["ticker"] for h in holdings], ["AAPL", "BRK.B", None, None])
        self.assertEqual(len(self.calls), 1)
        # A second call is served from cache, including the remembered miss.
        asyncio.run(service.attach(holdings, now=10))
        self.assertEqual(len(self.calls), 1)
        self.assertIn("037833100", self.redis.store["sec:cusip-tickers:v1"])

    def test_exhausted_window_skips_instead_of_waiting(self):
        service = CusipTickers(key="", transport=transport(self.calls))
        service.limit = 0
        holdings = [{"cusip": "11271J107", "value": 1}]

        async def run():
            await service.attach(holdings, now=10)
            service._task.cancel()
        asyncio.run(run())
        self.assertEqual(holdings[0]["ticker"], None)
        self.assertEqual(self.calls, [])


if __name__ == "__main__":
    unittest.main()
