import asyncio
import json
import unittest
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from langchain_core.messages import HumanMessage

from app.agent.graphs import supervisor
from app.agent.tools import get_tools_for_sources
from app.agent.tools.technical_tools import get_technical_indicators, indicators_payload
from app.services import technical_analysis as ta


def bars(closes, volume=1000):
    start = date(2025, 1, 1)
    return [
        {"date": (start + timedelta(days=i)).isoformat(), "open": c, "high": c + 1, "low": c - 1,
         "close": c, "volume": volume}
        for i, c in enumerate(closes)
    ]  # fmt: skip


def zigzag(count):
    """Rises 0.2 a bar with a 10-point wave so there are swing highs and lows to cluster."""
    return [100 + i * 0.2 + (5 if (i // 10) % 2 else -5) for i in range(count)]


class IndicatorPayloadTests(unittest.TestCase):
    def test_values_match_the_chart_analysis_functions(self):
        history = bars(zigzag(300))
        result = indicators_payload("NVDA", history)
        closes = [b["close"] for b in history]
        self.assertEqual(result["rsi14"], round(ta.rsi(closes), 1))
        self.assertEqual(
            result["moving_averages"]["ema200"]["value"], round(ta.ema(closes, 200)[-1], 2)
        )
        self.assertEqual(result["last_close"], round(closes[-1], 2))
        self.assertEqual(result["range"]["sessions"], 252)
        self.assertEqual(result["last_bar_date"], history[-1]["date"])

    def test_levels_sit_on_the_right_side_of_the_close_nearest_first(self):
        result = indicators_payload("NVDA", bars(zigzag(300)))
        last = result["last_close"]
        supports = [lv["price"] for lv in result["supports"]]
        resistances = [lv["price"] for lv in result["resistances"]]
        self.assertTrue(all(p < last for p in supports))
        self.assertTrue(all(p > last for p in resistances))
        self.assertEqual(supports, sorted(supports, reverse=True))
        self.assertEqual(resistances, sorted(resistances))
        self.assertLessEqual(len(supports), 3)

    def test_short_history_leaves_long_average_empty_not_zero(self):
        result = indicators_payload("NEW", bars(zigzag(60)))
        self.assertIsNone(result["moving_averages"]["ema200"]["value"])
        self.assertIsNone(result["moving_averages"]["ema200"]["close_vs_ema_pct"])
        self.assertIsNotNone(result["moving_averages"]["ema20"]["value"])

    def test_too_few_bars_is_a_no_data_gap(self):
        from langchain_core.messages import ToolMessage

        from app.agent.data_gaps import data_gap

        result = indicators_payload("NEW", bars(zigzag(10)))
        self.assertIn("error", result)
        gap = data_gap(
            ToolMessage(
                content=json.dumps(result), name="get_technical_indicators", tool_call_id="1"
            )
        )
        self.assertEqual(gap["kind"], "no_data")

    def test_bars_with_missing_prices_are_dropped(self):
        history = bars(zigzag(100))
        history[50]["close"] = None
        self.assertEqual(indicators_payload("NVDA", history)["bars_used"], 99)

    def test_relative_volume_compares_with_prior_twenty_sessions(self):
        history = bars(zigzag(100))
        history[-1]["volume"] = 3000
        self.assertEqual(indicators_payload("NVDA", history)["relative_volume"], 3.0)


class ToolTests(unittest.TestCase):
    def test_tool_fetches_two_years_of_daily_bars(self):
        service = Mock()
        service.get_history.return_value = bars(zigzag(300))
        with patch("app.services.yfinance.client.get_yfinance_service", return_value=service):
            result = json.loads(get_technical_indicators.invoke({"symbol": " nvda "}))
        service.get_history.assert_called_once_with("NVDA", period="2y", interval="1d")
        self.assertEqual(result["symbol"], "NVDA")

    def test_provider_failure_is_reported_not_hidden(self):
        service = Mock()
        service.get_history.side_effect = ConnectionError("down")
        with patch("app.services.yfinance.client.get_yfinance_service", return_value=service):
            result = json.loads(get_technical_indicators.invoke({"symbol": "NVDA"}))
        self.assertEqual(result["error"], "technical indicators unavailable")

    def test_registered_under_market_skill(self):
        self.assertIn(
            "get_technical_indicators",
            {t.name for t in get_tools_for_sources(None, "u", skills=["market"])},
        )
        self.assertNotIn(
            "get_technical_indicators",
            {t.name for t in get_tools_for_sources(None, "u", skills=["news"])},
        )


class RouterTests(unittest.TestCase):
    def test_router_only_returns_financial_or_research(self):
        llm = SimpleNamespace(ainvoke=AsyncMock(return_value=SimpleNamespace(content="alert")))
        with patch.object(supervisor, "get_fast_llm", return_value=llm):
            intent = asyncio.run(
                supervisor._classify_intent(
                    [HumanMessage(content="提醒我英伟达跌破 100 美元的时候")]
                )
            )
        self.assertEqual(intent, "financial")


if __name__ == "__main__":
    unittest.main()
