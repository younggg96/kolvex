"""
YouTube channel scraper using YouTube Data API v3.
"""

import logging
from typing import Dict, List, Optional

from .config import (
    YOUTUBE_API_KEY,
    DEFAULT_MAX_VIDEOS_PER_CHANNEL,
    DEFAULT_VIDEO_MAX_AGE_DAYS,
    DEFAULT_YOUTUBE_KOLS,
)
from .transcript import get_transcript
from .database import (
    get_supabase_client,
    upsert_kol,
    insert_video,
    video_exists,
)

logger = logging.getLogger(__name__)


class YouTubeScraper:
    """
    Fetches channel info and recent videos via YouTube Data API v3,
    extracts transcripts, runs AI analysis, and stores results.
    """

    def __init__(
        self,
        api_key: str = "",
        max_videos: int = DEFAULT_MAX_VIDEOS_PER_CHANNEL,
        max_age_days: int = DEFAULT_VIDEO_MAX_AGE_DAYS,
        enable_ai: Optional[bool] = None,
    ):
        self.api_key = api_key or YOUTUBE_API_KEY
        self.max_videos = max_videos
        self.max_age_days = max_age_days
        self.enable_ai = enable_ai
        self._service = None
        self.stats: Dict[str, int] = {
            "channels_processed": 0,
            "videos_found": 0,
            "videos_new": 0,
            "videos_skipped": 0,
            "errors": 0,
        }

    @property
    def service(self):
        if self._service is None:
            from googleapiclient.discovery import build
            self._service = build("youtube", "v3", developerKey=self.api_key)
        return self._service

    # -----------------------------------------------------------------
    # Channel info
    # -----------------------------------------------------------------

    def get_channel_info(self, channel_id: str) -> Optional[Dict]:
        """Fetch channel metadata."""
        try:
            resp = (
                self.service.channels()
                .list(part="snippet,statistics", id=channel_id)
                .execute()
            )
            items = resp.get("items", [])
            if not items:
                return None

            item = items[0]
            snippet = item.get("snippet", {})
            stats = item.get("statistics", {})

            return {
                "channel_id": channel_id,
                "title": snippet.get("title", ""),
                "handle": snippet.get("customUrl", ""),
                "description": snippet.get("description", ""),
                "thumbnail_url": snippet.get("thumbnails", {}).get("high", {}).get("url"),
                "subscriber_count": int(stats.get("subscriberCount", 0)),
                "video_count": int(stats.get("videoCount", 0)),
                "channel_url": f"https://www.youtube.com/channel/{channel_id}",
            }
        except Exception as e:
            logger.error(f"get_channel_info failed for {channel_id}: {e}")
            self.stats["errors"] += 1
            return None

    # -----------------------------------------------------------------
    # Recent videos via search
    # -----------------------------------------------------------------

    def get_recent_videos(self, channel_id: str, max_results: int = 0) -> List[Dict]:
        """
        Fetch the most recent videos from a channel using search.list
        then enrich with statistics via videos.list.
        """
        max_results = max_results or self.max_videos
        try:
            search_resp = (
                self.service.search()
                .list(
                    part="snippet",
                    channelId=channel_id,
                    order="date",
                    maxResults=max_results,
                    type="video",
                )
                .execute()
            )
            items = search_resp.get("items", [])
            if not items:
                return []

            video_ids = [it["id"]["videoId"] for it in items if it.get("id", {}).get("videoId")]
            if not video_ids:
                return []

            # Batch fetch statistics
            stats_resp = (
                self.service.videos()
                .list(part="statistics,contentDetails,snippet", id=",".join(video_ids))
                .execute()
            )
            stats_map: Dict[str, Dict] = {}
            for v in stats_resp.get("items", []):
                stats_map[v["id"]] = v

            videos: List[Dict] = []
            for vid in video_ids:
                full = stats_map.get(vid)
                if not full:
                    continue
                snip = full.get("snippet", {})
                st = full.get("statistics", {})
                cd = full.get("contentDetails", {})

                videos.append({
                    "video_id": vid,
                    "title": snip.get("title", ""),
                    "description": snip.get("description", ""),
                    "channel_id": channel_id,
                    "channel_title": snip.get("channelTitle", ""),
                    "published_at": snip.get("publishedAt"),
                    "thumbnail_url": (
                        snip.get("thumbnails", {}).get("maxres", {}).get("url")
                        or snip.get("thumbnails", {}).get("high", {}).get("url")
                        or snip.get("thumbnails", {}).get("medium", {}).get("url")
                    ),
                    "view_count": int(st.get("viewCount", 0)),
                    "like_count": int(st.get("likeCount", 0)),
                    "comment_count": int(st.get("commentCount", 0)),
                    "duration": cd.get("duration", ""),
                    "video_url": f"https://www.youtube.com/watch?v={vid}",
                })
            return videos

        except Exception as e:
            logger.error(f"get_recent_videos failed for {channel_id}: {e}")
            self.stats["errors"] += 1
            return []

    # -----------------------------------------------------------------
    # Scrape single channel
    # -----------------------------------------------------------------

    def scrape_channel(self, channel_id: str, handle: str = "", display_name: str = "") -> Dict:
        """
        Full pipeline for one channel:
        1. Fetch & upsert channel info
        2. Fetch recent videos
        3. For each new video: get transcript -> AI analysis -> insert
        """
        supabase = get_supabase_client()
        if not supabase:
            logger.error("Supabase unavailable — aborting scrape")
            return self.stats

        logger.info(f"Scraping YouTube channel: {display_name or channel_id}")

        # 1. Channel info
        channel_info = self.get_channel_info(channel_id)
        if channel_info:
            if handle:
                channel_info["handle"] = handle
            upsert_kol(supabase, channel_info)
        else:
            logger.warning(f"Could not fetch channel info for {channel_id}")

        self.stats["channels_processed"] += 1

        # 2. Videos
        videos = self.get_recent_videos(channel_id)
        self.stats["videos_found"] += len(videos)
        logger.info(f"   Found {len(videos)} recent videos")

        # 3. Process each video
        for video in videos:
            vid = video["video_id"]
            if video_exists(supabase, vid):
                self.stats["videos_skipped"] += 1
                continue

            logger.info(f"   Processing: {video['title'][:60]}...")

            transcript = get_transcript(vid)
            inserted, post_id = insert_video(
                client=supabase,
                video_data=video,
                transcript=transcript,
                max_age_days=self.max_age_days,
                enable_ai_analysis=self.enable_ai,
            )
            if inserted:
                self.stats["videos_new"] += 1
                logger.info(f"   Inserted video {vid} (id={post_id})")
            else:
                self.stats["videos_skipped"] += 1

        return self.stats

    # -----------------------------------------------------------------
    # Batch scrape
    # -----------------------------------------------------------------

    def batch_scrape(
        self,
        kols: Optional[List[Dict]] = None,
    ) -> Dict:
        """
        Scrape multiple channels.

        Args:
            kols: list of dicts with keys channel_id, handle (optional),
                  display_name (optional).  Falls back to DEFAULT_YOUTUBE_KOLS.
        """
        if kols is None:
            kols = [
                {"channel_id": cid, "handle": h, "display_name": dn}
                for cid, h, dn in DEFAULT_YOUTUBE_KOLS
            ]

        logger.info(f"YouTube batch scrape: {len(kols)} channels")
        for kol in kols:
            try:
                self.scrape_channel(
                    channel_id=kol["channel_id"],
                    handle=kol.get("handle", ""),
                    display_name=kol.get("display_name", ""),
                )
            except Exception as e:
                logger.error(f"Channel {kol.get('channel_id')} scrape error: {e}")
                self.stats["errors"] += 1

        logger.info(
            f"YouTube batch complete — "
            f"channels: {self.stats['channels_processed']}, "
            f"new: {self.stats['videos_new']}, "
            f"skipped: {self.stats['videos_skipped']}, "
            f"errors: {self.stats['errors']}"
        )
        return self.stats

    # -----------------------------------------------------------------
    # Ensure default KOLs exist in DB
    # -----------------------------------------------------------------

    @staticmethod
    def seed_default_kols():
        """Insert default YouTube KOL profiles if they don't already exist."""
        supabase = get_supabase_client()
        if not supabase:
            return

        for channel_id, handle, display_name in DEFAULT_YOUTUBE_KOLS:
            from .database import kol_exists
            if not kol_exists(supabase, channel_id):
                upsert_kol(supabase, {
                    "channel_id": channel_id,
                    "handle": handle,
                    "title": display_name,
                    "channel_url": f"https://www.youtube.com/channel/{channel_id}",
                })
                logger.info(f"Seeded YouTube KOL: {display_name}")
