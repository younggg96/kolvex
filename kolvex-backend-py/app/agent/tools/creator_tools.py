"""Creator (KOL) opinion tool: what tracked YouTube creators said about a stock."""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

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
        "summary": {
            k: summary[k]
            for k in (
                "total_opinions",
                "total_creators",
                "bullish_count",
                "bearish_count",
                "neutral_count",
                "avg_score",
                "latest_opinion_at",
            )
        },
        "opinions": [
            {
                "creator": r.get("channel_title"),
                "date": r.get("opinion_date") or str(r.get("video_published_at") or "")[:10],
                "sentiment": r.get("sentiment"),
                "confidence": r.get("confidence"),
                "time_horizon": r.get("time_horizon"),
                "thesis": _text(r.get("thesis") or r.get("summary")),
                "risks": _text(r.get("risks"), 200),
                "video_url": r.get("video_url"),
            }
            for r in rows[:MAX_OPINIONS]
        ],
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


@tool
def get_creator_record(
    creator: str, ticker: Optional[str] = None, days: Optional[int] = 365
) -> str:
    """How stocks moved after one tracked YouTube creator's opinions: the creator's record.

    Use when the user asks how a creator's calls worked out, whether to trust a creator, or
    how a stock did after a creator talked about it. Returns, for bullish and bearish opinions
    separately, the stock's return minus SPY 5 and 20 trading sessions after each video, plus
    the newest opinions with their own moves and video links.

    Rules for the answer: state these as price facts ("after their bullish videos the stocks
    averaged +1.2% versus SPY over 20 sessions"). Never say a call was right or wrong, never
    give an accuracy, win rate or ranking, and never compare creators. When a group has
    "enough": false, give only its count and say the sample is too small; do not compute an
    average yourself. Mention that past moves do not predict future ones.

    Args:
        creator: Creator name, @handle or channel id, e.g. "美投讲美股".
        ticker: Optional ticker to look only at this creator's opinions on one stock.
        days: Look-back window in days (30-1095, default 365); null for the full history.
    """
    from app.core.supabase import get_supabase_service
    from app.services import creator_record as record
    from app.services.youtube_stock_opinions import YouTubeStockOpinionService

    try:
        window = None if days is None else max(30, min(int(days), 1095))
        rows = YouTubeStockOpinionService(get_supabase_service()).all_rows()
        payload = record.creator_record(rows, creator, ticker=ticker, days=window)
    except record.AmbiguousCreator as error:
        # Not a data gap: the user has to say which creator they mean.
        payload = {"status": "ambiguous", "message": "several creators match; ask which one",
                   "candidates": error.candidates[:10]}  # fmt: skip
    except record.CreatorNotFound:
        payload = {"error": "no tracked creator matches this name", "creator": creator}
    except record.PricesUnavailable:
        payload = {
            "error": "creator record unavailable: price data could not be loaded",
            "creator": creator,
        }
    except Exception as error:  # noqa: BLE001
        logger.warning("get_creator_record failed for %s: %s", creator, error)
        payload = {"error": "creator record unavailable", "creator": creator}
    return json.dumps(payload, ensure_ascii=False, default=str)
