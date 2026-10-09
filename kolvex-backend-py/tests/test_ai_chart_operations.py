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
        with patch.object(ta, "get_llm", return_value=llm):
            analysis = asyncio.run(ta.analyze_chart("NVDA", "1d", bars, None, None, operation="analysis", categories=["trend"], custom_scenarios=["Retest?"]))
            drawings = asyncio.run(ta.analyze_chart("NVDA", "1d", bars, None, None, operation="drawings", categories=["trend"], custom_scenarios=["Retest?"]))
            cached = asyncio.run(ta.analyze_chart("NVDA", "1d", bars, None, None, operation="analysis", categories=["trend"], custom_scenarios=["Retest?"]))
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

if __name__ == "__main__":
    unittest.main()
