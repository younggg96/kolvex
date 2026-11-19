import asyncio
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

from app.services.portfolio.estimated_history import estimate_history

NOW = datetime(2026, 11, 18, 15, 0, tzinfo=ZoneInfo("America/New_York"))
BARS = {
    "PANW": [
        {"date": "2026-11-13", "close": 335.0},
        {"date": "2026-11-16", "close": 330.0},
        {"date": "2026-11-17", "close": 325.0},
        {"date": "2026-11-18", "close": 339.0},  # in-progress bar: replaced by the live price
    ],
    "NEWCO": [{"date": "2026-11-16", "close": 10.0}, {"date": "2026-11-17", "close": 12.0}],
}


def provider(symbol, start, end):
    return BARS.get(symbol, [])


def live(**position):
    return {"price_source": "market", "price_as_of": "2026-11-18T19:55:00+00:00", **position}


def run(positions, period="1W", history=provider):
    accounts = [{"portfolio_positions": positions}]
    return asyncio.run(estimate_history(accounts, period, history, now=NOW))


class EstimatedHistoryTest(unittest.TestCase):
    def test_values_current_units_at_each_close_and_ends_live(self):
        out = run([live(symbol="PANW", units=10, price=340.0, open_pnl=1800.0)])
        self.assertEqual(
            [(p["date"], p["value"]) for p in out["data"]],
            [
                ("2026-11-13", 3350.0),
                ("2026-11-16", 3300.0),
                ("2026-11-17", 3250.0),
                ("2026-11-18", 3400.0),
            ],
        )
        # cost = 3400 - 1800 = 1600
        self.assertEqual(out["data"][0]["pnl"], 1750.0)
        self.assertAlmostEqual(out["data"][-1]["pnl_percent"], 112.5)
        self.assertEqual(out["unpriced_symbols"], [])

    def test_unquotable_positions_held_flat_and_reported(self):
        out = run(
            [
                live(symbol="PANW", units=1, price=340.0),
                {"symbol": "PANW", "units": 2, "price": 5.0, "position_type": "option"},
            ]
        )
        self.assertEqual(out["fixed_value"], 1000.0)
        self.assertEqual(out["data"][0]["value"], 335.0 + 1000.0)
        self.assertEqual(out["unpriced_symbols"], ["PANW"])

    def test_starts_when_every_symbol_has_a_close(self):
        out = run(
            [
                live(symbol="PANW", units=1, price=340.0),
                live(symbol="NEWCO", units=1, price=11.0),
            ]
        )
        self.assertEqual(out["data"][0]["date"], "2026-11-16")
        self.assertEqual(out["data"][0]["value"], 340.0)

    def test_failed_history_falls_back_to_flat(self):
        def boom(symbol, start, end):
            raise RuntimeError("down")

        out = run([{"symbol": "PANW", "units": 1, "price": 340.0}], history=boom)
        self.assertEqual(
            out["data"], [{"date": "2026-11-18", "value": 340.0, "pnl": 0.0, "pnl_percent": 0.0}]
        )
        self.assertEqual(out["unpriced_symbols"], ["PANW"])

    def test_live_point_takes_the_quote_day_not_the_calendar_day(self):
        # After midnight in New York the latest quote still belongs to the 18th.
        late = datetime(2026, 11, 19, 1, 0, tzinfo=ZoneInfo("America/New_York"))
        accounts = [{"portfolio_positions": [live(symbol="PANW", units=1, price=340.0)]}]
        out = asyncio.run(estimate_history(accounts, "1W", provider, now=late))
        self.assertEqual([p["date"] for p in out["data"]][-2:], ["2026-11-17", "2026-11-18"])
        self.assertEqual(out["data"][-1]["value"], 340.0)

    def test_broker_prices_only_end_at_last_close(self):
        out = run([{"symbol": "PANW", "units": 1, "price": 300.0, "price_source": "broker"}])
        self.assertEqual(
            out["data"][-1], {"date": "2026-11-18", "value": 339.0, "pnl": 0.0, "pnl_percent": 0.0}
        )

    def test_empty_portfolio(self):
        self.assertEqual(run([])["data"], [])


if __name__ == "__main__":
    unittest.main()
