"""
News Flash Tools
让 Agent 搜索站内「快讯」(FinancialJuice RSS，最近约 100 条，60 秒缓存)
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from langchain_core.tools import tool

from app.services.news_feed import news_feed_service

logger = logging.getLogger(__name__)


@tool
async def search_news_flashes(
    query: Optional[str] = None,
    ticker: Optional[str] = None,
    limit: int = 30,
) -> str:
    """Search Kolvex's live news-flash feed (快讯): the ~100 most recent market headlines
    (macro data releases, central banks, geopolitics, company news), delayed by a few minutes.

    Call this for "latest news / 快讯 / what just happened / any news on X" questions.
    Headlines are in English, so pass English keywords (e.g. "CPI", "Fed", "Hormuz", "Siemens").
    Omit query and ticker to get the newest headlines.

    Args:
        query: Space-separated English keywords; a headline matches if it contains ANY of them (case-insensitive).
        ticker: Stock symbol; matches headlines that mention $TICKER or the bare symbol.
        limit: Max headlines to return (1-100, default 30).
    """
    try:
        feed = await news_feed_service.get_feed()
    except RuntimeError:
        return json.dumps({"status": "error", "message": "The news feed is temporarily unavailable."})

    articles = feed.get("articles", [])
    if ticker:
        sym = ticker.strip().upper().lstrip("$")
        pattern = re.compile(rf"(?<![A-Za-z0-9]){re.escape(sym)}(?![A-Za-z0-9])")
        articles = [a for a in articles if sym in a.get("symbols", []) or pattern.search(a["title"])]
    if query:
        words = [w.lower() for w in query.split() if w.strip()]
        articles = [a for a in articles if any(w in a["title"].lower() for w in words)]

    limit = max(1, min(int(limit or 30), 100))
    items = []
    for a in articles[:limit]:
        ts = a.get("publish_time")
        items.append({
            "time_utc": datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d %H:%M") if ts else None,
            "title": a["title"],
            "symbols": a.get("symbols", []),
            "link": a.get("link"),
        })
    return json.dumps({
        "status": "success" if items else "empty",
        "source": "FinancialJuice (delayed)",
        "fetched_at": feed.get("fetched_at"),
        "stale": feed.get("stale", False),
        "match_count": len(articles),
        "headlines": items,
    }, ensure_ascii=False)
