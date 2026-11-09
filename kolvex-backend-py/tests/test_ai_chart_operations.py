import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services import technical_analysis as ta
from app.services.kline_forecast import ForecastUnavailable
from test_technical_analysis import make_bars

class ChartOperationTests(unittest.TestCase):
    def test_operations_have_distinct_cache_and_drawing_focus_does_not_change_analysis(self):
        ta._cache.clear()
        structured = MagicMock()
        structured.ainvoke = AsyncMock(return_value=ta.AiAnalysis(trend="uptrend", bias="bullish", summary="Evidence"))
        llm = MagicMock(); llm.with_structured_output.return_value = structured
        bars = make_bars()
        with patch.object(ta, "get_user_llm", return_value=llm):
            analysis = asyncio.run(ta.analyze_chart("NVDA", "1d", bars, None, None, model_id="deepseek-flash", user_api_keys={"deepseek": "user-test-key"}, operation="analysis", categories=["trend"], custom_scenarios=["Retest?"]))
            drawings = asyncio.run(ta.analyze_chart("NVDA", "1d", bars, None, None, model_id="deepseek-flash", user_api_keys={"deepseek": "user-test-key"}, operation="drawings", categories=["levels", "structure"], custom_scenarios=["Retest?"]))
            cached = asyncio.run(ta.analyze_chart("NVDA", "1d", bars, None, None, model_id="deepseek-flash", user_api_keys={"deepseek": "user-test-key"}, operation="analysis", categories=["trend"], custom_scenarios=["Retest?"]))
        self.assertEqual(structured.ainvoke.call_count, 2)
        self.assertEqual(analysis, cached)
        self.assertEqual(analysis["operation"], "analysis")
        self.assertEqual(analysis["categories"], ["trend"])
        self.assertEqual(analysis["custom_scenarios"], ["Retest?"])
        self.assertEqual(drawings["operation"], "drawings")
        self.assertEqual(drawings["categories"], ["levels", "structure"])
        self.assertEqual(drawings["custom_scenarios"], [])
        prompt = structured.ainvoke.call_args.args[0][0][1]
        self.assertIn("ONLY for chart drawings", prompt)

class TradePlanTests(unittest.TestCase):
    """The conditional setup is the single execution plan and belongs to written analysis."""

    def setUp(self):
        ta._cache.clear()

    def run_plan(self, categories, setup, bias="bullish", operation="analysis"):
        structured = MagicMock()
        structured.ainvoke = AsyncMock(return_value=ta.AiAnalysis(
            trend="uptrend" if bias == "bullish" else "downtrend", bias=bias,
            summary="Evidence", setup=setup,
            findings=[ta.AiFinding(id="trade_plan", explanation="Unvalidated model prose")],
        ))
        llm = MagicMock()
        llm.with_structured_output.return_value = structured
        with patch.object(ta,"get_user_llm",return_value=llm):
            result = asyncio.run(ta.analyze_chart("NVDA","1d",make_bars(),None,None,
                model_id="deepseek-flash",user_api_keys={"deepseek":"user-test-key"},
                operation=operation,categories=categories))
        return result,structured

    def long(self):
        return ta.AiSetup(name="Retest",direction="bullish",entry_low=105,entry_high=107,
            invalidation=100,targets=[120,115],reason="If support holds")

    def test_analysis_plan_is_validated_and_ratio_uses_nearest_target(self):
        result,call = self.run_plan(["trade_plan"],self.long())
        plan = result["setup"]
        self.assertEqual(plan["targets"],[115,120])
        self.assertEqual(plan["risk_reward"],1.5) # midpoint 106: reward 9 / risk 6
        self.assertEqual(result["findings"][0]["status"],"available")
        self.assertEqual(result["findings"][0]["explanation"],"If support holds")
        self.assertEqual(result["levels"],[])
        self.assertIn("written technical analysis",call.ainvoke.call_args.args[0][0][1])

    def test_drawings_never_return_a_plan(self):
        result,call = self.run_plan(["levels","trade_plan"],self.long(),operation="drawings")
        self.assertIsNone(result["setup"])
        self.assertEqual(result["categories"],["levels"])
        self.assertIn("Do not return a trade setup",call.ainvoke.call_args.args[0][0][1])

    def test_drawing_defaults_have_no_plan_category(self):
        result,_ = self.run_plan(None,None,operation="drawings")
        self.assertIsNone(result["setup"])
        self.assertEqual(result["categories"],["levels","trendlines","fibonacci"])

    def test_wrong_side_stop_and_neutral_bias_do_not_create_plan(self):
        for setup,bias in [(self.long().model_copy(update={"invalidation":108}),"bullish"),
                           (self.long(),"neutral"),(None,"bullish")]:
            with self.subTest(bias=bias,setup=setup):
                ta._cache.clear()
                result,_ = self.run_plan(["trade_plan"],setup,bias)
                self.assertIsNone(result["setup"])
                self.assertEqual(result["findings"][0]["status"],"unavailable")
                self.assertNotIn("Unvalidated",result["findings"][0]["explanation"])

    def test_short_plan_has_stop_above_entry_and_targets_below(self):
        setup=ta.AiSetup(name="Retest short",direction="bearish",entry_low=110,entry_high=112,
            invalidation=116,targets=[100,105],reason="If resistance holds")
        result,_ = self.run_plan(["trade_plan"],setup,"bearish")
        self.assertEqual(result["setup"]["targets"],[105,100])
        self.assertEqual(result["setup"]["risk_reward"],1.2)

class AnalysisForecastTests(unittest.TestCase):
    def setUp(self):
        ta._cache.clear()
        self.bars = make_bars()
        self.forecast = {
            "symbol": "NVDA", "interval": "1d", "horizon": 20, "context_end": self.bars[-1]["date"][:10],
            "points": [{"date": "2030-01-01", "open": 1, "high": 2, "low": 1, "close": 1.5, "close_p10": 1, "close_p90": 2, "volume": 1}],
            "summary": {"median_return": 0.01, "p10_return": -0.05, "p90_return": 0.08, "prob_up": 0.6},
        }

    def analyze(self, fetch, operation="analysis", view_end=None):
        structured = MagicMock()
        structured.ainvoke = AsyncMock(return_value=ta.AiAnalysis(trend="uptrend", bias="bullish", summary="Evidence"))
        llm = MagicMock(); llm.with_structured_output.return_value = structured
        with patch.object(ta, "get_user_llm", return_value=llm), patch.object(ta, "get_kline_forecast", fetch):
            result = asyncio.run(ta.analyze_chart("NVDA", "1d", self.bars, None, view_end, model_id="deepseek-flash", user_api_keys={"deepseek": "user-test-key"}, operation=operation, categories=["levels"]))
        return result, structured.ainvoke.call_args.args[0]

    def test_forecast_is_saved_in_payload_and_given_to_the_model_as_low_weight_evidence(self):
        result, messages = self.analyze(AsyncMock(return_value=self.forecast))
        self.assertEqual(result["forecast"], self.forecast)
        self.assertIn("Do not base trend, bias", messages[0][1])
        self.assertIn('"experimental_model_forecast"', messages[1][1])
        self.assertIn('"median_return": 0.01', messages[1][1])

    def test_forecast_failure_does_not_fail_the_analysis(self):
        result, messages = self.analyze(AsyncMock(side_effect=ForecastUnavailable("forecast_service_error")))
        self.assertNotIn("forecast", result)
        self.assertNotIn("experimental_model_forecast", messages[1][1])

    def test_drawings_never_request_a_forecast(self):
        fetch = AsyncMock(return_value=self.forecast)
        result, _ = self.analyze(fetch, operation="drawings")
        fetch.assert_not_awaited()
        self.assertNotIn("forecast", result)

    def test_view_ending_in_the_past_has_no_forecast(self):
        fetch = AsyncMock(return_value=self.forecast)
        result, _ = self.analyze(fetch, view_end=self.bars[-10]["date"])
        fetch.assert_not_awaited()
        self.assertNotIn("forecast", result)

    def test_forecast_from_a_different_end_date_is_dropped(self):
        result, _ = self.analyze(AsyncMock(return_value={**self.forecast, "context_end": "1999-01-01"}))
        self.assertNotIn("forecast", result)

if __name__ == "__main__":
    unittest.main()
