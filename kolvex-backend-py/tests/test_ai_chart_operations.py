import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services import technical_analysis as ta
from test_technical_analysis import make_bars

class ChartOperationTests(unittest.TestCase):
    def test_operations_have_distinct_cache_and_drawing_focus_does_not_change_analysis(self):
        ta._cache.clear()
        structured = MagicMock()
        structured.ainvoke = AsyncMock(return_value=ta.AiAnalysis(trend="uptrend", bias="bullish", summary="Evidence"))
        llm = MagicMock(); llm.with_structured_output.return_value = structured
        bars = make_bars()
        with patch.object(ta, "get_user_llm", return_value=llm):
            analysis = asyncio.run(ta.analyze_chart("NVDA", "1d", bars, None, None, model_id="deepseek-chat", user_api_keys={"deepseek": "user-test-key"}, operation="analysis", categories=["trend"], custom_scenarios=["Retest?"]))
            drawings = asyncio.run(ta.analyze_chart("NVDA", "1d", bars, None, None, model_id="deepseek-chat", user_api_keys={"deepseek": "user-test-key"}, operation="drawings", categories=["levels", "structure"], custom_scenarios=["Retest?"]))
            cached = asyncio.run(ta.analyze_chart("NVDA", "1d", bars, None, None, model_id="deepseek-chat", user_api_keys={"deepseek": "user-test-key"}, operation="analysis", categories=["trend"], custom_scenarios=["Retest?"]))
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

class DrawingTradePlanTests(unittest.TestCase):
    def setUp(self):
        ta._cache.clear()

    def run_plan(self, categories, setup, bias="bullish"):
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
                model_id="deepseek-chat",user_api_keys={"deepseek":"user-test-key"},
                operation="drawings",categories=categories))
        return result,structured

    def long(self):
        return ta.AiSetup(name="Retest",direction="bullish",entry_low=105,entry_high=107,
            invalidation=100,targets=[120,115],reason="If support holds")

    def test_selected_trade_plan_is_validated_and_ratio_uses_nearest_target(self):
        result,call = self.run_plan(["trade_plan"],self.long())
        plan = result["setup"]
        self.assertEqual(plan["targets"],[115,120])
        self.assertEqual(plan["risk_reward"],1.5) # midpoint 106: reward 9 / risk 6
        self.assertEqual(result["findings"][0]["status"],"available")
        self.assertEqual(result["findings"][0]["explanation"],"If support holds")
        self.assertEqual(result["levels"],[])
        self.assertIn("only when trade_plan is requested",call.ainvoke.call_args.args[0][0][1])

    def test_deselected_plan_is_not_drawn_even_if_model_returns_one(self):
        result,_ = self.run_plan(["levels"],self.long())
        self.assertIsNone(result["setup"])

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

if __name__ == "__main__":
    unittest.main()
