"""Creator (KOL) opinion tool: what tracked YouTube creators said about a stock."""
import json
import logging
from datetime import datetime, timedelta, timezone

from langchain_core.tools import tool

logger = logging.getLogger(__name__)

MAX_OPINIONS = 12


def _text(value, limit: int = 400) -> str:
    text = " ".join(str(value or "").split())
    return text[:limit] + ("…" if len(text) > limit else "")


def creator_opinions_payload(ticker: str, days: int = 90) -> dict:
    from app.core.supabase import get_supabase_service
    from app.services.youtube_stock_opinions import YouTubeStockOpinionService

    days = max(7, min(int(days), 365))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    service = YouTubeStockOpinionService(get_supabase_service())
    rows = [r for r in service._fetch_rows(ticker=ticker, date_from=since) if r.get("ticker")]
    summary = service._build_summary(rows)
    return {
        "ticker": ticker.upper(),
        "window_days": days,
        "summary": {k: summary[k] for k in ("total_opinions", "total_creators", "bullish_count",
                                             "bearish_count", "neutral_count", "avg_score", "latest_opinion_at")},
        "opinions": [{
            "creator": r.get("channel_title"),
            "date": r.get("opinion_date") or str(r.get("video_published_at") or "")[:10],
            "sentiment": r.get("sentiment"),
            "confidence": r.get("confidence"),
            "time_horizon": r.get("time_horizon"),
            "thesis": _text(r.get("thesis") or r.get("summary")),
            "risks": _text(r.get("risks"), 200),
            "video_url": r.get("video_url"),
        } for r in rows[:MAX_OPINIONS]],
    }


@tool
def get_creator_opinions(ticker: str, days: int = 90) -> str:
    """Get what tracked YouTube stock creators (KOLs) said about a ticker recently.

    Returns sentiment counts and the latest opinions with creator, date, sentiment,
    thesis, risks and video link. Opinions are third-party views, not facts.

    Args:
        ticker: Stock ticker symbol, e.g. "NVDA".
        days: Look-back window in days (7-365, default 90).
    """
    try:
        return json.dumps(creator_opinions_payload(ticker, days), ensure_ascii=False, default=str)
    except Exception as error:  # noqa: BLE001
        logger.warning("get_creator_opinions failed for %s: %s", ticker, error)
        return json.dumps({"ticker": ticker.upper(), "error": "creator opinions unavailable"})
