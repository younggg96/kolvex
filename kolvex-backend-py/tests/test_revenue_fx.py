import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

import pandas as pd

from app.agent.answer_check import check_answer
from app.agent.revenue_evidence import RevenueEvidence
from app.agent.tools import stock_tools

URL = "https://finance.yahoo.com/quote/TSM/financials/"


class FxTests(unittest.TestCase):
    def test_each_period_uses_the_last_rate_on_or_before_its_end(self):
        facts = [RevenueEvidence(symbol="TSM", value=1_000e9, currency="TWD", period_kind="quarterly",
                                 period_end=date(2026, 9, 30), source="yahoo", source_url=URL),
                 RevenueEvidence(symbol="TSM", value=900e9, currency="TWD", period_kind="quarterly",
                                 period_end=date(2025, 9, 30), source="yahoo", source_url=URL)]
        closes = pd.Series([0.033, 0.0335, 0.031],
                           index=pd.to_datetime(["2025-09-29", "2025-10-01", "2026-09-30"]))
        ticker = SimpleNamespace(history=lambda **_kw: {"Close": closes})
        with patch.object(stock_tools, "get_yfinance_service",
                          return_value=SimpleNamespace(get_ticker=lambda _s: ticker)):
            out = stock_tools._with_usd(facts, "TWD")
        self.assertEqual([(f.fx_date, f.fx_rate, f.usd_value) for f in out],
                         [(date(2026, 9, 30), 0.031, 31_000_000_000.0), (date(2025, 9, 29), 0.033, 29_700_000_000.0)])

    def test_dollar_figure_is_checked(self):
        rev = [{"symbol": "TSM", "value": 1_494e9, "period_end": "2026-09-30", "usd_value": 46_915_000_000,
                "fx_date": "2026-09-30"}]
        statuses = {c["text"]: c["status"] for c in check_answer("营收约 469.2 亿美元，或 $46.9B。", [], rev)["claims"]}
        self.assertEqual(statuses, {"469.2 亿": "matched", "$46.9B": "matched"})


if __name__ == "__main__":
    unittest.main()
