"""Creator (KOL) opinion tool: what tracked YouTube creators said about a stock."""

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from langchain_core.tools import tool

logger = logging.getLogger(__name__)

MAX_OPINIONS = 12
MAX_CREATOR_OPINIONS = 20
MAX_SEARCH_RESULTS = 15
# Fields a topic search reads; a stock's views are in thesis/summary/key points, a video's subject in its title.
SEARCH_FIELDS = (
    "thesis",
    "summary",
    "key_points",
    "risks",
    "video_title",
    "company_name",
    "ticker",
)


def _text(value, limit: int = 400) -> str:
    if isinstance(value, (list, tuple)):
        value = "; ".join(str(item) for item in value if item)
    text = " ".join(str(value or "").split())
    return text[:limit] + ("…" if len(text) > limit else "")


def _opinion_date(row: dict) -> str:
    return str(row.get("opinion_date") or row.get("video_published_at") or "")[:10]


def _opinion_item(row: dict, with_creator: bool = True) -> dict:
    """One opinion as the model sees it. Strength stays in words: the product shows no numeric scores."""
    item = {
        "ticker": row.get("ticker"),
        "date": _opinion_date(row),
        "sentiment": row.get("sentiment"),
        "time_horizon": row.get("time_horizon"),
        "thesis": _text(row.get("thesis") or row.get("summary")),
        "risks": _text(row.get("risks"), 200),
        "video_title": _text(row.get("video_title"), 160),
        "video_url": row.get("video_url"),
    }
    if with_creator:
        item = {"creator": row.get("channel_title"), **item}
    return item


def _since(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()


def _sentiment_counts(rows: list[dict]) -> dict:
    counts = {"bullish": 0, "bearish": 0, "neutral": 0}
    for row in rows:
        key = str(row.get("sentiment") or "").lower()
        if key in counts:
            counts[key] += 1
    return counts


def _search_terms(query: str) -> list[str]:
    return [t for t in re.split(r"[\s,，、;；]+", query.casefold()) if t]


def _matches(row: dict, terms: list[str]) -> bool:
    haystack = " ".join(_text(row.get(field), 4000) for field in SEARCH_FIELDS).casefold()
    return all(term in haystack for term in terms)


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
                "latest_opinion_at",
            )
        },
        # No avg_score or per-opinion confidence: the product shows no numeric creator scores, and
        # agents whose prompts do not repeat that rule copied them into answers ("信心 0.86").
        "opinions": [
            {
                "creator": r.get("channel_title"),
                "date": r.get("opinion_date") or str(r.get("video_published_at") or "")[:10],
                "sentiment": r.get("sentiment"),
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


def creator_recent_payload(creator: str, days: int = 30, ticker: Optional[str] = None) -> dict:
    from app.core.supabase import get_supabase_service
    from app.services import creator_record as record
    from app.services.youtube_stock_opinions import YouTubeStockOpinionService

    days = max(7, min(int(days), 365))
    all_rows = YouTubeStockOpinionService(get_supabase_service()).all_rows()
    channel_id = record.find_channel(all_rows, creator)
    since = _since(days)
    rows = [
        r for r in all_rows
        if r.get("channel_id") == channel_id and r.get("ticker") and _opinion_date(r) >= since
        and (not ticker or str(r.get("ticker")).upper() == ticker.upper())
    ]  # fmt: skip
    title = next(
        (r.get("channel_title") for r in all_rows if r.get("channel_id") == channel_id), None
    )
    payload = {
        "creator": title,
        "window_days": days,
        "ticker": ticker.upper() if ticker else None,
        "total_opinions": len(rows),
        "stocks": len({r.get("ticker") for r in rows}),
        "sentiment_counts": _sentiment_counts(rows),
        "latest_opinion_date": _opinion_date(rows[0]) if rows else None,
        "opinions": [_opinion_item(r, with_creator=False) for r in rows[:MAX_CREATOR_OPINIONS]],
        "truncated": len(rows) > MAX_CREATOR_OPINIONS,
    }
    if not rows:
        payload["gap"] = "no_data"
    return payload


@tool
def get_creator_recent_opinions(creator: str, days: int = 30, ticker: Optional[str] = None) -> str:
    """List what one tracked YouTube creator said recently, newest first, across all stocks.

    Use when the user asks what a creator has been talking about, which stocks they covered,
    or how their view on a stock changed. Returns sentiment counts and opinions with ticker,
    date, sentiment, thesis, risks and video link. Opinions are the creator's views, not facts.
    If the result has "status": "ambiguous", ask the user which of the candidates they mean.

    Args:
        creator: Creator name, @handle or channel id, e.g. "美投讲美股".
        days: Look-back window in days (7-365, default 30).
        ticker: Optional ticker to keep only this creator's opinions on one stock.
    """
    from app.services import creator_record as record

    try:
        payload = creator_recent_payload(creator, days, ticker)
    except record.AmbiguousCreator as error:
        payload = {"status": "ambiguous", "message": "several creators match; ask which one",
                   "candidates": error.candidates[:10]}  # fmt: skip
    except record.CreatorNotFound:
        payload = {"error": "no tracked creator matches this name", "creator": creator}
    except Exception as error:  # noqa: BLE001
        logger.warning("get_creator_recent_opinions failed for %s: %s", creator, error)
        payload = {
            "gap": "unavailable",
            "error": "creator opinions unavailable",
            "creator": creator,
        }
    return json.dumps(payload, ensure_ascii=False, default=str)


def search_opinions_payload(query: str, days: int = 90, ticker: Optional[str] = None) -> dict:
    from app.core.supabase import get_supabase_service
    from app.services.youtube_stock_opinions import YouTubeStockOpinionService

    days = max(7, min(int(days), 1095))
    terms = _search_terms(query)
    since = _since(days)
    rows = [
        r for r in YouTubeStockOpinionService(get_supabase_service()).all_rows()
        if r.get("ticker") and _opinion_date(r) >= since
        and (not ticker or str(r.get("ticker")).upper() == ticker.upper())
        and _matches(r, terms)
    ]  # fmt: skip
    payload = {
        "query": query,
        "match": "keyword (every term must appear; not semantic)",
        "window_days": days,
        "match_count": len(rows),
        "creators": len({r.get("channel_id") for r in rows}),
        "sentiment_counts": _sentiment_counts(rows),
        "opinions": [_opinion_item(r) for r in rows[:MAX_SEARCH_RESULTS]],
        "truncated": len(rows) > MAX_SEARCH_RESULTS,
    }
    if not terms:
        payload["error"] = "empty query"
    return payload


@tool
def search_creator_opinions(query: str, days: int = 90, ticker: Optional[str] = None) -> str:
    """Search tracked YouTube creators' opinions by topic or phrase, e.g. "数据中心", "降息", "tariff".

    Matches keywords in the opinion's thesis, summary, key points, risks, video title and company
    name; every term must appear. Opinions are stored mostly in Chinese, so try a Chinese term and,
    when nothing matches, an English or synonym term. Returns matching opinions newest first with
    creator, ticker, date, sentiment, thesis and video link.

    Args:
        query: One or a few keywords separated by spaces.
        days: Look-back window in days (7-1095, default 90).
        ticker: Optional ticker to search only that stock's opinions.
    """
    try:
        payload = search_opinions_payload(query, days, ticker)
    except Exception as error:  # noqa: BLE001
        logger.warning("search_creator_opinions failed for %r: %s", query, error)
        payload = {
            "gap": "unavailable",
            "error": "creator opinion search unavailable",
            "query": query,
        }
    return json.dumps(payload, ensure_ascii=False, default=str)
