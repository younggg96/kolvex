import asyncio
import math
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import pandas as pd

from app.services import technical_analysis as ta
from app.services.yfinance.client import _group_session_bars


def make_bars(count=80):
    bars = []
    for index in range(count):
        base = 100 + 10 * math.sin(index / 6) + index * 0.2
        day = pd.Timestamp("2026-01-01") + pd.Timedelta(days=index)
        bars.append({
            "date": day.strftime("%Y-%m-%dT00:00:00-05:00"),
            "open": round(base - 0.5, 2),
            "high": round(base + 1.5, 2),
            "low": round(base - 1.5, 2),
            "close": round(base + 0.5, 2),
            "volume": 1_000_000 + index,
        })
    return bars


class IndicatorTests(unittest.TestCase):
    def test_ema_seeds_with_sma_and_leaves_warmup_empty(self):
        values = ta.ema([1, 2, 3, 4, 5, 6], 3)
        self.assertEqual(values[:2], [None, None])
        self.assertAlmostEqual(values[2], 2)
        self.assertAlmostEqual(values[3], 3)

    def test_rsi_extremes(self):
        self.assertEqual(ta.rsi(list(range(1, 30))), 100.0)
        self.assertLess(ta.rsi(list(range(30, 1, -1))), 1)

    def test_swings_and_levels_cluster_repeated_tests(self):
        bars = make_bars()
        swings = ta.swing_points(bars, 3)
        self.assertTrue(any(point["kind"] == "high" for point in swings))
        self.assertTrue(any(point["kind"] == "low" for point in swings))
        levels = ta.candidate_levels(swings, tolerance=2.0)
        self.assertTrue(all(level["touches"] >= 1 for level in levels))
        self.assertEqual([level["price"] for level in levels], sorted((level["price"] for level in levels), reverse=True))

    def test_compress_keeps_extremes(self):
        bars = make_bars(400)
        merged = ta.compress(bars, 160)
        self.assertLessEqual(len(merged), 160)
        self.assertEqual(max(bar["high"] for bar in merged), max(bar["high"] for bar in bars))
        self.assertEqual(min(bar["low"] for bar in merged), min(bar["low"] for bar in bars))


class SetupTests(unittest.TestCase):
    def bars(self, count=80):
        return [{"date": f"2026-01-{i + 1:02d}", "open": 100 + i * .25, "close": 100 + i * .25,
                 "low": 99 + i * .25, "high": 101 + i * .25, "volume": 1000 + i * 10} for i in range(count)]

    def output(self, setup, bias="bullish", bars=None):
        result = ta.AiAnalysis(trend="uptrend", bias=bias, summary="Evidence", setup=setup)
        return ta.sanitize(result, bars or self.bars(), [], 1)["setup"]

    def setup(self, **overrides):
        return ta.AiSetup(name="Pullback long", direction="bullish", entry_low=115, entry_high=116,
                          invalidation=110, targets=overrides.pop("targets", [122, 120]), reason="Retest support", **overrides)

    def test_targets_ordered_and_score_is_evidence_not_llm_confidence(self):
        setup = self.output(self.setup())
        self.assertEqual(setup["targets"], [120, 122])
        self.assertEqual(setup["risk_reward"], .82)
        self.assertEqual(setup["score"], 80)
        self.assertFalse(setup["checks"]["rsi_momentum"])

    def test_rejects_inverted_or_non_directional_setup(self):
        for patch in [{"entry_low": 117, "entry_high": 116}, {"invalidation": 115.5}, {"targets": [114]}, {"targets": [10000]}, {"direction": "bearish"}]:
            candidate = self.setup().model_copy(update=patch)
            self.assertIsNone(self.output(candidate))
        self.assertIsNone(self.output(self.setup(), bias="neutral"))

    def test_incomplete_inputs_do_not_get_a_complete_score(self):
        bars = self.bars()
        for bar in bars:
            bar["volume"] = None
        setup = self.output(self.setup(), bars=bars)
        self.assertIsNone(setup["score"])
        self.assertIsNone(setup["checks"]["volume_confirmation"])

    def test_valid_short_has_risk_above_entry_and_targets_below(self):
        candidate = ta.AiSetup(name="Retest short", direction="bearish", entry_low=110, entry_high=111,
                               invalidation=116, targets=[103, 105], reason="Resistance")
        setup = self.output(candidate, bias="bearish")
        self.assertEqual(setup["targets"], [105, 103])
        self.assertEqual(setup["risk_reward"], 1)


class FourHourBarTests(unittest.TestCase):
    def test_hourly_bars_merge_within_each_session(self):
        index = pd.DatetimeIndex(
            [f"2026-10-06 {h}:30" for h in range(9, 16)] + [f"2026-10-07 {h}:30" for h in range(9, 16)],
            tz="America/New_York",
        )
        frame = pd.DataFrame(
            {"Open": range(14), "High": [value + 1 for value in range(14)], "Low": range(14),
             "Close": range(14), "Volume": [10] * 14},
            index=index,
        )
        merged = _group_session_bars(frame, 4)
        self.assertEqual([stamp.strftime("%m-%d %H:%M") for stamp in merged.index],
                         ["10-06 09:30", "10-06 13:30", "10-07 09:30", "10-07 13:30"])
        self.assertEqual(str(merged.index.tz), "America/New_York")
        first = merged.iloc[0]
        self.assertEqual((first["Open"], first["High"], first["Close"], first["Volume"]), (0, 4, 3, 40))
        self.assertEqual(merged.iloc[1]["Volume"], 30)


class AnalyzeChartTests(unittest.TestCase):
    def setUp(self):
        ta._cache.clear()

    def run_with(self, result, **kwargs):
        kwargs.setdefault("model_id", "deepseek-chat")
        kwargs.setdefault("user_api_keys", {"deepseek": "user-test-key"})
        structured = MagicMock()
        structured.ainvoke = AsyncMock(return_value=result)
        llm = MagicMock()
        llm.with_structured_output.return_value = structured
        with patch.object(ta, "get_user_llm", return_value=llm) as factory:
            bars = make_bars()
            payload = asyncio.run(ta.analyze_chart("NVDA", "1d", bars, bars[20]["date"], None, **kwargs))
        return payload, factory, structured

    def test_invalid_model_output_is_dropped_and_lines_snap_to_bars(self):
        bars = make_bars()
        swings = ta.swing_points(bars[20:], 3)
        low_a, low_b = [point for point in swings if point["kind"] == "low"][:2]
        result = ta.AiAnalysis(
            trend="uptrend",
            bias="bullish",
            summary="  上升趋势。 ",
            levels=[
                ta.AiLevel(kind="support", price=low_a["price"] + 0.01),
                ta.AiLevel(kind="support", price=low_a["price"] + 0.05),
                ta.AiLevel(kind="resistance", price=10_000),
            ],
            trendlines=[
                ta.AiTrendline(kind="support", start_date=low_a["date"][:10], start_price=low_a["price"] - 0.3,
                               end_date=low_b["date"][:10], end_price=low_b["price"] + 0.3),
                ta.AiTrendline(kind="support", start_date="1999-01-01", start_price=100,
                               end_date=low_b["date"], end_price=100),
            ],
            signals=["", "EMA 多头排列"],
        )
        payload, _, structured = self.run_with(result)
        self.assertEqual(payload["summary"], "上升趋势。")
        self.assertEqual(len(payload["levels"]), 1)
        self.assertEqual(len(payload["trendlines"]), 1)
        line = payload["trendlines"][0]
        self.assertEqual(line["start"], {"date": low_a["date"], "price": low_a["price"]})
        self.assertEqual(line["end"], {"date": low_b["date"], "price": low_b["price"]})
        self.assertEqual(payload["signals"], ["EMA 多头排列"])
        self.assertEqual(payload["view"]["start"], bars[20]["date"])
        prompt = structured.ainvoke.call_args.args[0][0][1]
        self.assertIn("Simplified Chinese", prompt)

    def test_uses_a_provider_the_user_has_a_key_for(self):
        result = ta.AiAnalysis(trend="sideways", bias="neutral", summary="x")
        with patch.object(ta, "LLM_PROVIDER", "openai"):
            _, factory, _ = self.run_with(result, user_api_keys={"deepseek": "k"})
        self.assertEqual(factory.call_args.kwargs["provider"], "deepseek")

    def test_auth_failures_become_not_configured(self):
        structured = MagicMock()
        structured.ainvoke = AsyncMock(side_effect=Exception("Error code: 401 - Incorrect API key provided"))
        llm = MagicMock()
        llm.with_structured_output.return_value = structured
        bars = make_bars()
        with patch.object(ta, "get_user_llm", return_value=llm), self.assertRaises(ta.AiNotConfigured):
            asyncio.run(ta.analyze_chart("NVDA", "1d", bars, None, None, model_id="deepseek-chat", user_api_keys={"deepseek": "user-test-key"}))

    def test_falls_back_when_provider_lacks_json_schema(self):
        unsupported = MagicMock()
        unsupported.ainvoke = AsyncMock(side_effect=Exception("Error code: 400 - This response_format type is unavailable now"))
        working = MagicMock()
        working.ainvoke = AsyncMock(return_value={"trend": "sideways", "bias": "neutral", "summary": "横盘"})
        llm = MagicMock()
        llm.with_structured_output.side_effect = lambda schema, method: unsupported if method == "json_schema" else working
        bars = make_bars()
        with patch.object(ta, "get_user_llm", return_value=llm):
            payload = asyncio.run(ta.analyze_chart("NVDA", "1d", bars, None, None, model_id="deepseek-chat", user_api_keys={"deepseek": "user-test-key"}))
        self.assertEqual(payload["summary"], "横盘")
        self.assertEqual(
            [call.kwargs["method"] for call in llm.with_structured_output.call_args_list],
            ["json_schema", "function_calling"],
        )

    def test_other_model_errors_are_not_retried(self):
        structured = MagicMock()
        structured.ainvoke = AsyncMock(side_effect=Exception("Error code: 500 - server overloaded"))
        llm = MagicMock()
        llm.with_structured_output.return_value = structured
        bars = make_bars()
        with patch.object(ta, "get_user_llm", return_value=llm), self.assertRaises(Exception):
            asyncio.run(ta.analyze_chart("NVDA", "1d", bars, None, None, model_id="deepseek-chat", user_api_keys={"deepseek": "user-test-key"}))
        self.assertEqual(llm.with_structured_output.call_count, 1)

    def test_too_few_bars_is_rejected(self):
        with self.assertRaises(ValueError):
            asyncio.run(ta.analyze_chart("NVDA", "1d", make_bars(10), None, None))


if __name__ == "__main__":
    unittest.main()
