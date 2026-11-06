import asyncio
from datetime import date
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.services.options_chain import metrics
from app.services.options_chain.alpaca_client import AlpacaNotConfigured, AlpacaOptionsClient
from app.services.options_chain.service import ExpirationNotFound, OptionsChainService

TODAY = date(2026, 11, 6)
EXP = "2026-11-13"


def row(kind, strike, oi=0, volume=0, bid=None, ask=None, iv=None):
    return {"type": kind, "strike": strike, "open_interest": oi, "volume": volume, "bid": bid, "ask": ask, "last": None, "iv": iv}


class MetricsTests(unittest.TestCase):
    def test_parse_occ_symbol(self):
        self.assertEqual(
            metrics.parse_occ_symbol("NVDA261113C00187500"),
            {"root": "NVDA", "expiration": "2026-11-13", "type": "call", "strike": 187.5},
        )
        self.assertIsNone(metrics.parse_occ_symbol("not-an-option"))

    def test_put_call_ratios_and_zero_calls(self):
        result = metrics.put_call_ratios([row("call", 100, oi=200, volume=50), row("put", 100, oi=100, volume=75)])
        self.assertEqual(result["oi_put_call_ratio"], 0.5)
        self.assertEqual(result["volume_put_call_ratio"], 1.5)
        self.assertIsNone(metrics.put_call_ratios([row("put", 100, oi=5)])["oi_put_call_ratio"])

    def test_max_pain_hand_computed(self):
        # settle 100: calls 0, puts 10*(110-100)=100   -> 100
        # settle 110: calls 10*(110-100)=100, puts 0   -> 100
        # settle 120: calls 10*20 + 5*10 = 250         -> 250
        # Tie breaks to the lower strike.
        rows = [row("call", 100, oi=10), row("call", 110, oi=5), row("put", 110, oi=10), row("put", 120, oi=0)]
        self.assertEqual(metrics.max_pain(rows), {"strike": 100, "holder_value": 10000.0})
        self.assertIsNone(metrics.max_pain([row("call", 100)]))

    def test_expected_move_uses_atm_straddle_then_iv_fallback(self):
        rows = [
            row("call", 185, bid=6.0, ask=6.4, iv=0.6), row("put", 185, bid=3.0, ask=3.2, iv=0.58),
            row("call", 190, bid=3.9, ask=4.1, iv=0.55), row("put", 190, bid=5.9, ask=6.1, iv=0.57),
        ]
        move = metrics.expected_move(rows, 188.34, EXP, TODAY)
        self.assertEqual((move["method"], move["strike"], move["value"]), ("atm_straddle", 190, 10.0))

        no_quotes = [row("call", 190, iv=0.5), row("put", 190, iv=0.5)]
        move = metrics.expected_move(no_quotes, 200.0, EXP, TODAY)
        self.assertEqual(move["method"], "iv")
        self.assertAlmostEqual(move["value"], 200 * 0.5 * (7 / 365) ** 0.5, places=2)

    def test_crossed_or_missing_quote_falls_back_to_last(self):
        self.assertEqual(metrics.mid_price({"bid": 2.0, "ask": 1.0, "last": 1.7}), 1.7)
        self.assertEqual(metrics.mid_price({"bid": 1.0, "ask": 1.2, "last": None}), 1.1)


def alpaca_transport():
    def handler(request: httpx.Request):
        assert request.headers["APCA-API-KEY-ID"] == "k"
        path, params = request.url.path, request.url.params
        if path == "/v2/stocks/NVDA/snapshot":
            return httpx.Response(200, json={"latestTrade": {"p": 188.0}})
        if path == "/v2/options/contracts":
            contracts = [
                {"symbol": "NVDA261113C00185000", "type": "call", "strike_price": "185", "expiration_date": EXP, "open_interest": "1000"},
                {"symbol": "NVDA261113P00185000", "type": "put", "strike_price": "185", "expiration_date": EXP, "open_interest": "800"},
                {"symbol": "NVDA261120C00200000", "type": "call", "strike_price": "200", "expiration_date": "2026-11-20", "open_interest": "5"},
            ]
            if params.get("expiration_date"):
                contracts = [c for c in contracts if c["expiration_date"] == params["expiration_date"]]
            return httpx.Response(200, json={"option_contracts": contracts, "next_page_token": None})
        if path == "/v1beta1/options/snapshots/NVDA":
            assert params["feed"] == "indicative"
            if "page_token" not in params:
                return httpx.Response(200, json={"snapshots": {"NVDA261113C00185000": {
                    "latestQuote": {"bp": 5.0, "ap": 5.2}, "dailyBar": {"v": 300},
                    "greeks": {"delta": 0.55}, "impliedVolatility": 0.6}}, "next_page_token": "p2"})
            return httpx.Response(200, json={"snapshots": {"NVDA261113P00185000": {
                "latestQuote": {"bp": 2.0, "ap": 2.2}, "dailyBar": {"v": 600}, "impliedVolatility": 0.62}}})
        return httpx.Response(404)
    return httpx.MockTransport(handler)


class FakeRedis:
    def __init__(self):
        self.store = {}

    async def get_json(self, key):
        return self.store.get(key)

    async def set_json(self, key, value, ttl=None):
        self.store[key] = value
        return True


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.redis = FakeRedis()
        patcher = patch("app.services.options_chain.service.get_redis", return_value=self.redis)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.service = OptionsChainService(AlpacaOptionsClient("k", "s", "indicative", transport=alpaca_transport()))
        self.service._today = staticmethod(lambda: TODAY)

    def test_chain_merges_paginated_snapshots_with_open_interest(self):
        result = asyncio.run(self.service.get_chain("nvda"))
        self.assertEqual(result["expiration"], EXP)
        self.assertEqual(result["expirations"], [EXP, "2026-11-20"])
        self.assertEqual(result["underlying_price"], 188.0)
        self.assertEqual([c["symbol"] for c in result["contracts"]], ["NVDA261113C00185000", "NVDA261113P00185000"])
        m = result["metrics"]
        self.assertEqual((m["call_oi"], m["put_oi"], m["oi_put_call_ratio"]), (1000, 800, 0.8))
        self.assertEqual(m["volume_put_call_ratio"], 2.0)
        self.assertEqual(m["expected_move"]["value"], 7.2)  # call mid 5.1 + put mid 2.1
        self.assertEqual(m["max_pain"]["strike"], 185)
        self.assertEqual(m["atm_iv"], 0.61)
        self.assertIn(f"options:chain:v1:NVDA:{EXP}", self.redis.store)

    def test_unknown_expiration_and_missing_keys(self):
        with self.assertRaises(ExpirationNotFound):
            asyncio.run(self.service.get_chain("NVDA", "2026-11-14"))
        with self.assertRaises(AlpacaNotConfigured):
            asyncio.run(OptionsChainService(AlpacaOptionsClient("", "")).client.get_contracts("NVDA"))


if __name__ == "__main__":
    unittest.main()
