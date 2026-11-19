import asyncio
import unittest

from app.services.portfolio.live_prices import mark_to_market, normalize_quote, quote_symbol

QUOTE = {
    "currency": "USD",
    "quote_type": "EQUITY",
    "current_price": 330.0,
    "market_time": 1700000000,
}


def account(*positions, synced_at="2026-11-17T22:00:00+00:00"):
    return {"synced_at": synced_at, "portfolio_positions": list(positions)}


def run(accounts, provider):
    asyncio.run(mark_to_market(accounts, provider))
    return accounts


class LivePricesTest(unittest.TestCase):
    def test_reprices_equity_and_moves_open_pnl(self):
        pos = {"symbol": "PANW", "units": 10, "price": 320.0, "open_pnl": 1000.0, "currency": "USD"}
        run([account(pos)], lambda s: QUOTE)
        self.assertEqual(pos["price"], 330.0)
        self.assertEqual(pos["broker_price"], 320.0)
        self.assertEqual(pos["open_pnl"], 1100.0)
        self.assertEqual(pos["price_source"], "market")
        self.assertTrue(pos["price_as_of"].startswith("2023-11-14"))

    def test_open_pnl_from_average_when_broker_has_none(self):
        pos = {"symbol": "PANW", "units": 2, "price": None, "average_purchase_price": 300.0}
        run([account(pos)], lambda s: QUOTE)
        self.assertEqual(pos["open_pnl"], 60.0)

    def test_failed_quote_keeps_broker_price_labelled(self):
        pos = {"symbol": "PANW", "units": 1, "price": 320.0, "open_pnl": 5.0}

        def boom(symbol):
            raise RuntimeError("down")

        run([account(pos)], boom)
        self.assertEqual(pos["price"], 320.0)
        self.assertEqual(pos["open_pnl"], 5.0)
        self.assertEqual(pos["price_source"], "broker")
        self.assertEqual(pos["price_as_of"], "2026-11-17T22:00:00+00:00")

    def test_unpriced_without_quote_has_no_source(self):
        pos = {"symbol": "PANW", "units": 1, "price": None}
        run([account(pos)], lambda s: {})
        self.assertIsNone(pos["price"])
        self.assertIsNone(pos["price_source"])

    def test_options_and_foreign_are_never_quoted(self):
        calls = []
        option = {"symbol": "PANW", "units": 1, "price": 5.0, "position_type": "option"}
        foreign = {"symbol": "SHOP", "units": 1, "price": 90.0, "currency": "CAD"}
        cusip = {"symbol": "697435105", "units": 1, "price": 1.0}
        run([account(option, foreign, cusip)], lambda s: calls.append(s) or QUOTE)
        self.assertEqual(calls, [])
        self.assertEqual(option["price_source"], "broker")

    def test_class_share_symbol_maps_to_yahoo(self):
        self.assertEqual(quote_symbol({"symbol": "BRK.B"}), "BRK-B")

    def test_rejects_untimed_or_non_usd_quotes(self):
        self.assertIsNone(normalize_quote({**QUOTE, "market_time": None}))
        self.assertIsNone(normalize_quote({**QUOTE, "currency": "CAD"}))
        self.assertIsNone(normalize_quote({**QUOTE, "quote_type": "MUTUALFUND"}))
        self.assertIsNone(normalize_quote({**QUOTE, "current_price": 0}))

    def test_one_quote_per_symbol(self):
        calls = []
        a = {"symbol": "PANW", "units": 1, "price": 320.0}
        b = {"symbol": "PANW", "units": 2, "price": 320.0}
        run([account(a), account(b)], lambda s: calls.append(s) or QUOTE)
        self.assertEqual(calls, ["PANW"])
        self.assertEqual(b["price"], 330.0)


if __name__ == "__main__":
    unittest.main()
