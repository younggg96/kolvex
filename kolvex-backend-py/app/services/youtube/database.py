"""
YouTube video database operations.
Writes to the unified kol_profiles and kol_tweets tables with platform='youtube'.
"""

import hashlib
import json
import logging
from typing import Dict, Optional, Tuple, List
from datetime import datetime, timedelta, timezone

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from .config import PLATFORM_YOUTUBE, DEFAULT_VIDEO_MAX_AGE_DAYS, ENABLE_AI_ANALYSIS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------

def get_supabase_client() -> Optional[Client]:
    if not SUPABASE_AVAILABLE:
        logger.warning("Supabase SDK not installed")
        return None

    from app.core.config import settings

    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY
    if not url or not key:
        logger.warning("Supabase credentials missing")
        return None

    return create_client(url, key)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def compute_video_hash(video_id: str, title: str) -> str:
    unique = f"youtube:{video_id}:{title[:200]}"
    return hashlib.sha256(unique.encode()).hexdigest()[:16]


def video_exists(client: Client, video_id: str) -> bool:
    try:
        result = (
            client.table("kol_tweets")
            .select("id")
            .eq("platform", PLATFORM_YOUTUBE)
            .eq("platform_post_id", video_id)
            .limit(1)
            .execute()
        )
        return len(result.data) > 0
    except Exception as e:
        logger.error(f"video_exists check failed: {e}")
        return False


def kol_exists(client: Client, channel_id: str) -> bool:
    try:
        result = (
            client.table("kol_profiles")
            .select("id")
            .eq("platform", PLATFORM_YOUTUBE)
            .eq("platform_user_id", channel_id)
            .limit(1)
            .execute()
        )
        return len(result.data) > 0
    except Exception as e:
        logger.error(f"kol_exists check failed: {e}")
        return False


# ---------------------------------------------------------------------------
# KOL upsert
# ---------------------------------------------------------------------------

def upsert_kol(client: Client, channel_data: Dict) -> Tuple[bool, Optional[int]]:
    """
    Insert or update a YouTube channel in kol_profiles.

    channel_data keys:
        channel_id, title, handle, description, thumbnail_url,
        subscriber_count, video_count, channel_url
    """
    channel_id = channel_data.get("channel_id")
    if not channel_id:
        return False, None

    def _s(v, mx: int):
        return str(v)[:mx] if v else None

    data = {
        "platform": PLATFORM_YOUTUBE,
        "platform_user_id": _s(channel_id, 255),
        "username": _s(channel_data.get("handle") or channel_id, 255),
        "display_name": _s(channel_data.get("title"), 255),
        "avatar_url": channel_data.get("thumbnail_url"),
        "bio": (channel_data.get("description") or "")[:2000] or None,
        "followers_count": channel_data.get("subscriber_count", 0),
        "website": channel_data.get("channel_url"),
        "is_active": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        if kol_exists(client, channel_id):
            result = (
                client.table("kol_profiles")
                .update(data)
                .eq("platform", PLATFORM_YOUTUBE)
                .eq("platform_user_id", channel_id)
                .execute()
            )
            kol_id = result.data[0]["id"] if result.data else None
            logger.info(f"Updated YouTube KOL: {channel_data.get('title', channel_id)}")
            return True, kol_id
        else:
            data["created_at"] = datetime.now(timezone.utc).isoformat()
            result = client.table("kol_profiles").insert(data).execute()
            kol_id = result.data[0]["id"] if result.data else None
            logger.info(f"New YouTube KOL: {channel_data.get('title', channel_id)}")
            return True, kol_id
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return False, None
        logger.error(f"upsert_kol failed: {e}")
        return False, None


# ---------------------------------------------------------------------------
# Video insert
# ---------------------------------------------------------------------------

_ai_analyzer = None


def _get_ai_analyzer():
    global _ai_analyzer
    if _ai_analyzer is None:
        try:
            from .analyzer import YouTubeVideoAnalyzer
            from app.core.config import settings

            if not settings.OPENAI_API_KEY:
                logger.warning("OPENAI_API_KEY not set — YouTube AI analysis disabled")
                _ai_analyzer = False
                return None

            _ai_analyzer = YouTubeVideoAnalyzer()
            logger.info("YouTube AI analyzer initialised (OpenAI)")
        except Exception as e:
            logger.error(f"YouTube AI analyzer init failed: {e}")
            _ai_analyzer = False
    return _ai_analyzer if _ai_analyzer else None


def _perform_ai_analysis(
    title: str, description: str, transcript: Optional[str] = None
) -> Optional[Dict]:
    analyzer = _get_ai_analyzer()
    if not analyzer:
        return None

    try:
        analysis = analyzer.analyze(title, description, transcript)
        if analysis is None:
            return None

        sentiment = analysis.get("sentiment", {}).get("sentiment", "neutral")
        tickers = analysis.get("tickers", [])
        logger.info(f"   AI: {sentiment} | tickers: {tickers or 'none'}")
        return analysis
    except Exception as e:
        logger.error(f"YouTube AI analysis error: {e}")
        return None


def insert_video(
    client: Client,
    video_data: Dict,
    transcript: Optional[str] = None,
    max_age_days: int = DEFAULT_VIDEO_MAX_AGE_DAYS,
    enable_ai_analysis: Optional[bool] = None,
) -> Tuple[bool, Optional[int]]:
    """
    Insert a YouTube video into kol_tweets if it doesn't already exist.

    video_data keys:
        video_id, title, description, channel_id, channel_title,
        published_at, thumbnail_url, view_count, like_count,
        comment_count, duration, video_url
    """
    video_id = video_data.get("video_id")
    if not video_id:
        return False, None

    if video_exists(client, video_id):
        return False, None

    # Age filter
    published = video_data.get("published_at")
    if published:
        try:
            if isinstance(published, str):
                pub_dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
            else:
                pub_dt = published
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=timezone.utc)
            cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
            if pub_dt < cutoff:
                logger.info(f"   Skipping old video ({str(published)[:10]}): {video_data.get('title', '')[:40]}")
                return False, None
        except Exception:
            pass

    title = video_data.get("title", "")
    description = video_data.get("description", "")
    video_hash = compute_video_hash(video_id, title)

    # AI analysis
    should_analyze = enable_ai_analysis if enable_ai_analysis is not None else ENABLE_AI_ANALYSIS
    ai_analysis = None
    if should_analyze:
        ai_analysis = _perform_ai_analysis(title, description, transcript)

    try:
        video_url = video_data.get("video_url") or f"https://www.youtube.com/watch?v={video_id}"

        data = {
            "platform": PLATFORM_YOUTUBE,
            "platform_post_id": video_id,
            "author_platform_id": video_data.get("channel_id", ""),
            "username": video_data.get("channel_title", ""),
            "title": title,
            "tweet_text": description[:10000] if description else "",
            "tweet_hash": video_hash,
            "post_type": "video",
            "created_at": published,
            "permalink": video_url,
            "cover_url": video_data.get("thumbnail_url"),
            "video_url": video_url,
            "like_count": video_data.get("like_count", 0),
            "reply_count": video_data.get("comment_count", 0),
            "views_count": video_data.get("view_count", 0),
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }

        if ai_analysis:
            stock_related = ai_analysis.get("is_stock_related", {})
            trading_signal = ai_analysis.get("trading_signal")
            if isinstance(trading_signal, dict):
                trading_signal = trading_signal.get("action")

            # Serialize ticker_analyses into ai_tags alongside regular tags
            ai_tags = ai_analysis.get("tags", [])
            ticker_analyses = ai_analysis.get("ticker_analyses", [])

            data.update({
                "ai_sentiment": str(ai_analysis.get("sentiment", {}).get("sentiment", ""))[:20] or None,
                "ai_sentiment_confidence": ai_analysis.get("sentiment", {}).get("confidence"),
                "ai_sentiment_reasoning": ai_analysis.get("sentiment", {}).get("reasoning"),
                "ai_tickers": ai_analysis.get("tickers", []),
                "ai_tags": ai_tags,
                "ai_summary": ai_analysis.get("summary"),
                "ai_trading_signal": str(trading_signal)[:20] if trading_signal else None,
                "ai_is_stock_related": stock_related.get("is_stock_related", False),
                "ai_stock_related_confidence": stock_related.get("confidence"),
                "ai_stock_related_reason": stock_related.get("reason"),
                "ai_analyzed_at": ai_analysis.get("analyzed_at"),
                "ai_model": str(ai_analysis.get("model", ""))[:50] or None,
            })

            # Store per-ticker analyses in media_urls JSONB as metadata
            if ticker_analyses:
                data["media_urls"] = json.dumps({"ticker_analyses": ticker_analyses})

        result = client.table("kol_tweets").insert(data).execute()
        post_id = result.data[0]["id"] if result.data else None
        return True, post_id

    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return False, None
        logger.error(f"insert_video failed: {e}")
        return False, None
