import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.youtube_opinions import get_service, router
from app.services import opinion_backtest as bt
from app.services import opinion_outcomes as oo


def bar(day, o, c=None):
    return {"date": f"2026-11-{day:02d}", "open": o, "close": o if c is None else c}


# Sessions 11-02..11-06 and 11-09..11-10
STOCK = [
    bar(2, 95),
    bar(3, 100, 102),
    bar(4, 102),
    bar(5, 105),
    bar(6, 107),
    bar(9, 108, 110),
    bar(10, 111, 130),
]
SPY = [
    bar(2, 500),
    bar(3, 500),
    bar(4, 502),
    bar(5, 503),
    bar(6, 503),
    bar(9, 504, 510),
    bar(10, 511, 520),
]
NOW = datetime(2026, 11, 10, 15, 0, tzinfo=timezone.utc)  # Tue 10:00 New York: 11-10 still trading


def row(id_="o1", **kw):
    return {"id": id_, "channel_id": "c1", "ticker": "NVDA", "sentiment": "bullish",
            "video_published_at": "2026-11-02T23:00:00+00:00", **kw}  # fmt: skip


def download(symbol, start, end):
    return {"NVDA": STOCK, "SPY": SPY}.get(symbol, [])


class OutcomeTests(unittest.TestCase):
    def setUp(self):
        oo.clear_cache()

    def test_outcome_uses_only_completed_sessions(self):
        result = oo.stock_outcomes("nvda", [row()], NOW, download)
        self.assertEqual(
            (result["ticker"], result["benchmark"], result["horizons"]), ("NVDA", "SPY", [5, 20])
        )
        self.assertEqual(result["as_of"], "2026-11-09")  # today's moving bar is excluded
        outcome = result["outcomes"]["o1"]
        self.assertEqual(
            (outcome["status"], outcome["entry_date"], outcome["entry_price"]),
            ("scored", "2026-11-03", 100.0),
        )
        five = outcome["horizons"]["5"]
        self.assertEqual(
            (five["exit_date"], five["return_pct"], five["benchmark_return_pct"]),
            ("2026-11-09", 10.0, 2.0),
        )
        self.assertEqual(five["excess_return_pct"], 8.0)
        self.assertNotIn("signed_excess_pct", five)  # facts only, no verdict
        self.assertEqual(outcome["horizons"]["20"]["status"], "pending")
        self.assertIsNone(outcome["horizons"]["20"]["return_pct"])
        # status is what the client checks before showing the figure
        self.assertEqual(outcome["latest"], {"sessions": 5, "status": "scored", "exit_date": "2026-11-09", "return_pct": 10.0,
                                             "benchmark_return_pct": 2.0, "excess_return_pct": 8.0})  # fmt: skip

    def test_young_opinion_has_a_to_date_move_before_any_horizon(self):
        young = row(video_published_at="2026-11-05T23:00:00+00:00")  # enters 11-06 open 107
        outcome = oo.stock_outcomes("NVDA", [young], NOW, download)["outcomes"]["o1"]
        self.assertEqual(outcome["horizons"]["5"]["status"], "pending")
        self.assertEqual(
            (outcome["latest"]["sessions"], outcome["latest"]["exit_date"]), (2, "2026-11-09")
        )
        self.assertEqual(outcome["latest"]["return_pct"], 2.8037)
        self.assertEqual(outcome["latest"]["benchmark_return_pct"], 1.3917)
        not_started = row(video_published_at="2026-11-09T23:00:00+00:00")
        self.assertIsNone(
            oo.stock_outcomes("NVDA", [not_started], NOW, download)["outcomes"]["o1"]["latest"]
        )

    def test_today_counts_after_the_session_settles(self):
        after_close = datetime(2026, 11, 10, 22, 0, tzinfo=timezone.utc)  # 17:00 New York
        self.assertEqual(
            oo.stock_outcomes("NVDA", [row()], after_close, download)["as_of"], "2026-11-10"
        )
        self.assertEqual(
            len(bt.completed_bars(STOCK, datetime(2026, 11, 10, 21, 0, tzinfo=timezone.utc))), 6
        )

    def test_unknown_ticker_and_missing_publish_time_are_not_zero(self):
        result = oo.stock_outcomes("9984.T", [row(ticker="9984.T")], NOW, download)
        self.assertEqual(result["outcomes"]["o1"]["status"], "no_price_data")
        self.assertIsNone(result["as_of"])
        calls = Mock(side_effect=download)
        result = oo.stock_outcomes("NVDA", [row(video_published_at=None)], NOW, calls)
        self.assertEqual(result["outcomes"]["o1"]["status"], "no_publish_time")
        calls.assert_not_called()

    def test_download_failure_raises_and_is_not_cached(self):
        failing = Mock(side_effect=RuntimeError("rate limited"))
        with self.assertRaises(oo.PricesUnavailable):
            oo.stock_outcomes("NVDA", [row()], NOW, failing)
        self.assertEqual(
            oo.stock_outcomes("NVDA", [row()], NOW, download)["outcomes"]["o1"]["status"], "scored"
        )

    def test_missing_benchmark_is_unavailable_not_raw_return(self):
        with self.assertRaises(oo.PricesUnavailable):
            oo.stock_outcomes("NVDA", [row()], NOW, lambda s, a, b: STOCK if s == "NVDA" else [])

    def test_cache_reused_until_an_earlier_start_is_needed(self):
        calls = Mock(side_effect=download)
        oo.stock_outcomes("NVDA", [row()], NOW, calls)
        oo.stock_outcomes("NVDA", [row()], NOW, calls)
        self.assertEqual(calls.call_count, 2)  # NVDA + SPY once each
        oo.stock_outcomes("NVDA", [row(video_published_at="2026-10-01T23:00:00+00:00")], NOW, calls)
        self.assertEqual(calls.call_count, 4)


class RouteTests(unittest.TestCase):
    def setUp(self):
        oo.clear_cache()
        app = FastAPI()
        app.include_router(router)
        self.service = Mock()
        self.service.ticker_rows.return_value = [row()]
        app.dependency_overrides[get_service] = lambda: self.service
        self.client = TestClient(app)

    def test_returns_outcomes(self):
        with patch.object(
            oo, "stock_outcomes", return_value={"ticker": "NVDA", "outcomes": {}}
        ) as scored:
            response = self.client.get("/youtube-opinions/stocks/nvda/outcomes")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["ticker"], "NVDA")
        scored.assert_called_once_with("nvda", [row()])
        self.service.ticker_rows.assert_called_once_with("nvda")

    def test_price_failure_is_503_without_provider_detail(self):
        with patch.object(oo, "stock_outcomes", side_effect=oo.PricesUnavailable("NVDA: secret")):
            response = self.client.get("/youtube-opinions/stocks/NVDA/outcomes")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("secret", response.text)


if __name__ == "__main__":
    unittest.main()
