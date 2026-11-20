"""Short-lived, in-process cache for chat tools whose data changes slowly.

A chat turn, the team researchers of one run and quick follow-ups often ask for the same quote or
financials several times; each call costs a few hundred milliseconds of Yahoo / SEC / database time.
The cache is per process (each worker keeps its own), keyed by tool name and arguments, and never
keeps a failure: a result holding "error" or "gap" is fetched again next time.

TOOL_CACHE_SECONDS lists the time each tool keeps a result; a tool not listed is never cached.
Quotes keep 15 seconds so "current" stays current; the quote's own market time is in the result.
"""

import asyncio
import json
import time
from collections import OrderedDict
from typing import Any

from langchain_core.tools import BaseTool, StructuredTool

TOOL_CACHE_SECONDS: dict[str, float] = {
    "get_stock_quote": 15,
    "get_stock_financials": 6 * 3600,
    "get_analyst_recommendations": 6 * 3600,
    "get_company_info": 24 * 3600,
    "get_reported_revenue": 6 * 3600,
    "get_macro_indicators": 15 * 60,
    "get_valuation": 3600,
    "get_superinvestor_portfolio": 6 * 3600,
    "get_institutional_holders": 6 * 3600,
}
MAX_ENTRIES = 512

_entries: "OrderedDict[str, tuple[float, str]]" = OrderedDict()


def clear() -> None:
    _entries.clear()


def _key(name: str, kwargs: dict) -> str:
    return name + ":" + json.dumps(kwargs, sort_keys=True, ensure_ascii=False, default=str)


def _get(key: str) -> Any:
    hit = _entries.get(key)
    if hit and hit[0] > time.monotonic():
        _entries.move_to_end(key)
        return hit[1]
    _entries.pop(key, None)
    return None


def _keepable(result: Any) -> bool:
    if not isinstance(result, str):
        return False
    try:
        data = json.loads(result)
    except ValueError:
        return False
    return isinstance(data, dict) and "error" not in data and "gap" not in data


def _put(key: str, result: Any, ttl: float) -> None:
    if _keepable(result):
        _entries[key] = (time.monotonic() + ttl, result)
        _entries.move_to_end(key)
        while len(_entries) > MAX_ENTRIES:
            _entries.popitem(last=False)


def cached(tool: BaseTool) -> BaseTool:
    """The same tool (name, description, arguments) reading through the cache; unlisted tools as they are."""
    ttl = TOOL_CACHE_SECONDS.get(tool.name)
    if not ttl or not isinstance(tool, StructuredTool):
        return tool
    func, coroutine = tool.func, tool.coroutine

    def run(**kwargs: Any) -> Any:
        key = _key(tool.name, kwargs)
        hit = _get(key)
        if hit is not None:
            return hit
        result = func(**kwargs) if func else asyncio.run(coroutine(**kwargs))
        _put(key, result, ttl)
        return result

    async def arun(**kwargs: Any) -> Any:
        key = _key(tool.name, kwargs)
        hit = _get(key)
        if hit is not None:
            return hit
        result = await coroutine(**kwargs) if coroutine else await asyncio.to_thread(func, **kwargs)
        _put(key, result, ttl)
        return result

    return StructuredTool.from_function(
        func=run,
        coroutine=arun,
        name=tool.name,
        description=tool.description,
        args_schema=tool.args_schema,
        return_direct=tool.return_direct,
    )
