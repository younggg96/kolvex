"""The chat's tool cache: repeat calls are served from memory, failures and other arguments are not."""

import asyncio
import json
import unittest
from unittest.mock import patch

from langchain_core.tools import tool

from app.agent import tool_cache
from app.agent.tools import AGENT_TOOLS

calls = {"n": 0}


@tool
def get_stock_financials(symbol: str) -> str:
    """Stub with the real tool's name."""
    calls["n"] += 1
    if symbol == "BAD":
        return json.dumps({"error": "unavailable"})
    return json.dumps({"symbol": symbol, "n": calls["n"]})


@tool
async def get_valuation(symbol: str) -> str:
    """Async stub with a cached tool's name."""
    calls["n"] += 1
    return json.dumps({"symbol": symbol, "n": calls["n"]})


@tool
def get_market_buzz(ticker: str = "") -> str:
    """A tool that is not cached."""
    calls["n"] += 1
    return json.dumps({"n": calls["n"]})


class ToolCacheTests(unittest.TestCase):
    def setUp(self):
        calls["n"] = 0
        tool_cache.clear()

    def test_repeat_calls_are_cached_per_argument(self):
        cached = tool_cache.cached(get_stock_financials)
        first = cached.invoke({"symbol": "NVDA"})
        self.assertEqual(cached.invoke({"symbol": "NVDA"}), first)
        self.assertNotEqual(cached.invoke({"symbol": "AMD"}), first)
        self.assertEqual(calls["n"], 2)
        # The async path (how the agent calls tools) shares the same entries.
        self.assertEqual(asyncio.run(cached.ainvoke({"symbol": "NVDA"})), first)
        self.assertEqual(calls["n"], 2)

    def test_failures_are_fetched_again(self):
        cached = tool_cache.cached(get_stock_financials)
        cached.invoke({"symbol": "BAD"})
        cached.invoke({"symbol": "BAD"})
        self.assertEqual(calls["n"], 2)

    def test_entries_expire(self):
        cached = tool_cache.cached(get_valuation)
        asyncio.run(cached.ainvoke({"symbol": "AAPL"}))
        with patch.object(
            tool_cache.time, "monotonic", return_value=tool_cache.time.monotonic() + 3601
        ):
            asyncio.run(cached.ainvoke({"symbol": "AAPL"}))
        self.assertEqual(calls["n"], 2)

    def test_unlisted_tools_are_left_alone_and_schemas_are_kept(self):
        self.assertIs(tool_cache.cached(get_market_buzz), get_market_buzz)
        cached = tool_cache.cached(get_stock_financials)
        self.assertEqual(
            (cached.name, cached.args), (get_stock_financials.name, get_stock_financials.args)
        )

    def test_chat_tools_use_the_cache(self):
        by_name = {t.name: t for t in AGENT_TOOLS}
        self.assertEqual(by_name["get_stock_quote"].func.__qualname__.split(".")[0], "cached")
        self.assertNotEqual(
            by_name["get_market_buzz"].coroutine.__qualname__.split(".")[0], "cached"
        )


if __name__ == "__main__":
    unittest.main()
