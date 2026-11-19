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


INTRADAY = {
    "PANW": [
        {"date": "2026-11-18T09:30:00-05:00", "close": 336.0},
        {"date": "2026-11-18T11:00:00-05:00", "close": 334.0},
        {"date": "2026-11-18T13:00:00-05:00", "close": 338.0},
        {"date": "2026-11-18T14:55:00-05:00", "close": 339.5},
        {"date": "2026-11-18T15:00:00-05:00", "close": 341.0},  # starts after the quote
    ]
}
CALLS = []


def provider(symbol, period, interval):
    CALLS.append((period, interval))
    return (INTRADAY if interval.endswith("m") else BARS).get(symbol, [])


def live(**position):
    return {"price_source": "market", "price_as_of": "2026-11-18T19:55:00+00:00", **position}


def run(positions, period="1M", history=provider):
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
        def boom(symbol, period, interval):
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
        out = asyncio.run(estimate_history(accounts, "1M", provider, now=late))
        self.assertEqual([p["date"] for p in out["data"]][-2:], ["2026-11-17", "2026-11-18"])
        self.assertEqual(out["data"][-1]["value"], 340.0)

    def test_broker_prices_only_end_at_last_close(self):
        out = run([{"symbol": "PANW", "units": 1, "price": 300.0, "price_source": "broker"}])
        self.assertEqual(
            out["data"][-1], {"date": "2026-11-18", "value": 339.0, "pnl": 0.0, "pnl_percent": 0.0}
        )

    def test_one_day_uses_five_minute_bars_and_ends_at_the_quote(self):
        CALLS.clear()
        quote = live(symbol="PANW", units=1, price=340.0, price_as_of="2026-11-18T19:58:00+00:00")
        out = run([quote], period="1D")
        self.assertEqual(CALLS, [("1d", "5m")])
        self.assertEqual(
            [(p["date"], p["value"]) for p in out["data"]],
            [
                ("2026-11-18T09:30:00-05:00", 336.0),
                ("2026-11-18T11:00:00-05:00", 334.0),
                ("2026-11-18T13:00:00-05:00", 338.0),
                ("2026-11-18T14:55:00-05:00", 339.5),
                ("2026-11-18T14:58:00-05:00", 340.0),
            ],
        )

    def test_four_hours_keeps_the_last_four_hours(self):
        CALLS.clear()
        quote = live(symbol="PANW", units=1, price=340.0, price_as_of="2026-11-18T19:58:00+00:00")
        out = run([quote], period="4H")
        self.assertEqual(CALLS, [("1d", "1m")])
        self.assertEqual(out["data"][0]["date"], "2026-11-18T11:00:00-05:00")

    def test_week_uses_fifteen_minute_bars(self):
        CALLS.clear()
        run([live(symbol="PANW", units=1, price=340.0)], period="1W")
        self.assertEqual(CALLS, [("5d", "15m")])

    def test_empty_portfolio(self):
        self.assertEqual(run([])["data"], [])


if __name__ == "__main__":
    unittest.main()
