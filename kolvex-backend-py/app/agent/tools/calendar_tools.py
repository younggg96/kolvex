"""Market calendar tool: Kolvex's editorial calendar of earnings, Fed and economic releases."""

import json
import logging
from typing import Optional

from langchain_core.tools import tool

from app.core.supabase import get_supabase_service
from app.services.market_events import list_events

logger = logging.getLogger(__name__)

CATEGORIES = ("earnings", "fed", "economic", "other")
MAX_EVENTS = 40


def _text(value, limit: int) -> str:
    text = " ".join(str(value or "").split())
    return text[:limit] + ("…" if len(text) > limit else "")


def market_events_payload(category: Optional[str] = None, ticker: Optional[str] = None) -> dict:
    data = list_events(get_supabase_service())
    wanted = ticker.strip().upper() if ticker and ticker.strip() else None
    events = [
        e for e in data.get("events") or []
        if e.get("status", "published") == "published"
        and (not category or e.get("category") == category)
        and (not wanted or wanted in (e.get("tickers") or []))
    ]  # fmt: skip
    return {
        "today": data.get("today"),
        "timezone": "America/New_York",
        # The calendar is curated: only published high-importance or hot events in this window.
        "coverage": {
            "from": data.get("start_date"),
            "to_exclusive": data.get("end_date_exclusive"),
            "scope": "editorially published high-importance or hot events only; not a complete earnings calendar",
        },
        "category": category,
        "ticker": wanted,
        "event_count": len(events),
        "events": [
            {
                "date": e.get("event_date"),
                "timing": e.get("timing"),
                "starts_at": e.get("starts_at"),
                "category": e.get("category"),
                "title": e.get("title"),
                "title_en": e.get("title_en") or None,
                "tickers": e.get("tickers") or [],
                "summary": _text(e.get("summary") or e.get("summary_en"), 300),
                "source_name": e.get("source_name") or None,
                "source_url": e.get("source_url"),
            }
            for e in events[:MAX_EVENTS]
        ],
        "truncated": len(events) > MAX_EVENTS,
    }


@tool
def get_market_events(category: Optional[str] = None, ticker: Optional[str] = None) -> str:
    """Kolvex's market calendar: earnings dates, Fed meetings and economic releases (CPI, jobs, GDP).

    Covers last week through the next two weeks, New York dates. timing is before_open,
    after_close, scheduled (see starts_at), all_day or tbd. The calendar is curated and holds only
    important events, so a stock missing from it does not prove it has no earnings in the window:
    say the calendar has no entry rather than that there is no event.

    Args:
        category: Optional filter: "earnings", "fed", "economic" or "other".
        ticker: Optional ticker to keep only events that list it, e.g. "NVDA".
    """
    if category and category not in CATEGORIES:
        category = None
    try:
        payload = market_events_payload(category, ticker)
    except Exception as error:  # noqa: BLE001
        logger.warning("get_market_events failed: %s", error)
        payload = {"gap": "unavailable", "error": "market calendar unavailable"}
    return json.dumps(payload, ensure_ascii=False, default=str)
