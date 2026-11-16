"""Market buzz tool: today's movers and volume spikes, Reddit mention ranking and X cashtag heat.

Each source is read on its own; one failing does not hide the others. Rankings are snapshots
with their own timestamps, and attention is not an opinion: the payload keeps them apart.
"""

import asyncio
import json
import logging
from typing import Optional

from langchain_core.tools import tool

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)

TOP = 10
X_POSTS = 5


def _mover(item: dict) -> dict:
    return {
        "symbol": item.get("symbol"),
        "name": item.get("name"),
        "price": item.get("price"),
        "change_pct": round(item["changePercent"], 2)
        if item.get("changePercent") is not None
        else None,
        "volume_multiple_of_3m_avg": round(item["volumeMultiple"], 2)
        if item.get("volumeMultiple") is not None
        else None,
    }


def _board(board: dict, wanted: Optional[str]) -> dict:
    items = board.get("items") or []
    if wanted:
        items = [i for i in items if i.get("symbol") == wanted]
    return {
        "session_date": board.get("sessionDate"),
        "fetched_at": board.get("fetchedAt"),
        "stale": board.get("stale"),
        "unavailable": board.get("unavailable"),
        "items": [_mover(i) for i in items[:TOP]],
    }


async def _discovery(wanted):
    from app.services.stock_discovery import get_stock_discovery

    data = await asyncio.to_thread(get_stock_discovery)
    return {
        "source": "Yahoo Finance screeners (US stocks, price >= $5, market cap >= $2B; not the whole market)",
        "movers_by_abs_change": _board(data.get("movers") or {}, wanted),
        "volume_spikes": _board(data.get("active") or {}, wanted),
    }


async def _reddit(wanted):
    from app.services.reddit_opinions import reddit_opinion_service

    data = await reddit_opinion_service.get("all-stocks")
    rows = data.get("results") or []
    if wanted:
        rows = [r for r in rows if r.get("ticker") == wanted]
    return {
        "source": "ApeWisdom mention ranking across stock subreddits, last 24 hours",
        "fetched_at": data.get("fetchedAt"),
        "items": [
            {
                "rank": r.get("rank"),
                "ticker": r.get("ticker"),
                "mentions": r.get("mentions"),
                "mentions_24h_ago": r.get("previousMentions"),
                "rank_24h_ago": r.get("previousRank"),
            }
            for r in rows[:TOP]
        ],
    }


async def _x(wanted):
    from app.services.x_content import XContentService

    service = XContentService(get_supabase_service())
    heat = await asyncio.to_thread(service.ticker_heat)
    rows = heat.get("tickers") or []
    if wanted:
        rows = [r for r in rows if r.get("ticker") == wanted]
    out = {
        "source": "posts by X accounts Kolvex tracks, counted by cashtag",
        "window": {"from": heat.get("from"), "to": heat.get("to")},
        "items": [
            {
                "ticker": r.get("ticker"),
                "posts": r.get("posts"),
                "posts_previous_window": r.get("previous"),
                "authors": r.get("authors"),
                "latest": r.get("latest"),
            }
            for r in rows[:TOP]
        ],
    }
    if wanted:
        posts = await asyncio.to_thread(service.posts, None, wanted, X_POSTS, 0)
        out["latest_posts"] = [
            {
                "author": p.get("author_username"),
                "published_at": p.get("published_at"),
                "text": " ".join(str(p.get("text") or "").split())[:280],
                "url": p.get("url"),
            }
            for p in posts.get("posts") or []
        ]
    return out


@tool
async def get_market_buzz(ticker: Optional[str] = None) -> str:
    """What the market is paying attention to: today's biggest movers and volume spikes, the Reddit
    mention ranking and cashtag counts from the X accounts Kolvex tracks. With a ticker, only that
    stock's entries plus its latest tracked X posts.

    Attention is not an opinion and not a signal: report counts and moves with their dates, and keep
    each source separate. A source that failed is listed in "unavailable_sources".

    Args:
        ticker: Optional ticker, e.g. "PLTR".
    """
    wanted = ticker.strip().upper().removeprefix("$") if ticker and ticker.strip() else None
    sources = {"price_and_volume": _discovery, "reddit": _reddit, "x": _x}
    results = await asyncio.gather(*(fn(wanted) for fn in sources.values()), return_exceptions=True)
    payload: dict = {"ticker": wanted}
    failed = []
    for name, result in zip(sources, results):
        if isinstance(result, BaseException):
            logger.warning("get_market_buzz source %s failed: %s", name, result)
            failed.append(name)
        else:
            payload[name] = result
    payload["unavailable_sources"] = failed
    if len(failed) == len(sources):
        payload["gap"] = "unavailable"
    return json.dumps(payload, ensure_ascii=False, default=str)
