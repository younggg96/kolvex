"""
YouTube KOL video scraper module.

Usage:
    from app.services.youtube import YouTubeScraper

    scraper = YouTubeScraper()
    scraper.batch_scrape()
"""

from .config import (
    PLATFORM_YOUTUBE,
    YOUTUBE_API_KEY,
    DEFAULT_MAX_VIDEOS_PER_CHANNEL,
    DEFAULT_VIDEO_MAX_AGE_DAYS,
    DEFAULT_YOUTUBE_KOLS,
    ENABLE_AI_ANALYSIS,
)

from .database import (
    get_supabase_client,
    compute_video_hash,
    video_exists,
    insert_video,
    upsert_kol,
    kol_exists,
)

from .transcript import get_transcript

from .analyzer import YouTubeVideoAnalyzer

from .scraper import YouTubeScraper

__all__ = [
    "PLATFORM_YOUTUBE",
    "YOUTUBE_API_KEY",
    "DEFAULT_MAX_VIDEOS_PER_CHANNEL",
    "DEFAULT_VIDEO_MAX_AGE_DAYS",
    "DEFAULT_YOUTUBE_KOLS",
    "ENABLE_AI_ANALYSIS",
    "get_supabase_client",
    "compute_video_hash",
    "video_exists",
    "insert_video",
    "upsert_kol",
    "kol_exists",
    "get_transcript",
    "YouTubeVideoAnalyzer",
    "YouTubeScraper",
]
