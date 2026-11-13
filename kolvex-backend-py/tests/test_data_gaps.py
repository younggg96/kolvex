import json
import unittest
from unittest.mock import AsyncMock, patch

from langchain_core.messages import ToolMessage

from app.agent.data_gaps import data_gap, merge_gaps


def msg(content, name="get_reported_revenue", status="success"):
    return ToolMessage(content=json.dumps(content) if not isinstance(content, str) else content,
                       name=name, tool_call_id="t", status=status)


class DataGapTests(unittest.TestCase):
    def test_kinds(self):
        self.assertEqual(data_gap(msg({"error": "x", "gap": "no_data"}))["kind"], "no_data")
        self.assertEqual(data_gap(msg({"error": "Failed to get quote for NVDA: timeout"}, "get_stock_quote"))["kind"],
                         "unavailable")
        self.assertEqual(data_gap(msg({"error": "No options data available"}, "get_options_chain_summary"))["kind"],
                         "no_data")
        self.assertEqual(data_gap(msg({"status": "error", "message": "The news feed is temporarily unavailable."},
                                      "get_news_flash"))["kind"], "unavailable")
        self.assertEqual(data_gap(msg("boom", status="error"))["kind"], "unavailable")
        self.assertIsNone(data_gap(msg([{"value": 1}])))
        self.assertIsNone(data_gap(msg({"symbol": "NVDA", "price": 1})))

    def test_worst_kind_per_tool(self):
        merged = merge_gaps([{"tool": "a", "kind": "no_data"}, {"tool": "a", "kind": "unavailable"},
                             {"tool": "b", "kind": "no_data"}])
        self.assertEqual({g["tool"]: g["kind"] for g in merged}, {"a": "unavailable", "b": "no_data"})


class RevenueGapTests(unittest.IsolatedAsyncioTestCase):
    async def run_tool(self, sec, yahoo):
        from app.agent.tools.stock_tools import get_reported_revenue
        with patch("app.agent.tools.stock_tools.sec_client.financials", sec), \
                patch("app.agent.tools.stock_tools._yahoo_revenue", yahoo):
            result = await get_reported_revenue.ainvoke({
                "type": "tool_call", "name": "get_reported_revenue", "id": "r", "args": {"symbol": "XYZ"}})
        return data_gap(result)["kind"]

    async def test_source_failure_is_unavailable_and_empty_source_is_no_data(self):
        from app.services.sec.client import SecNotFound, SecUnavailable
        self.assertEqual(await self.run_tool(AsyncMock(side_effect=SecUnavailable("down")), lambda *_: []),
                         "unavailable")
        self.assertEqual(await self.run_tool(AsyncMock(side_effect=SecNotFound("XYZ")), lambda *_: []), "no_data")

        def yahoo_down(*_):
            raise RuntimeError("yahoo 429")
        self.assertEqual(await self.run_tool(AsyncMock(side_effect=SecNotFound("XYZ")), yahoo_down), "unavailable")


if __name__ == "__main__":
    unittest.main()
