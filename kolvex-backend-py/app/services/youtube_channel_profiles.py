"""Cached public channel metadata from the YouTube Data API."""

import asyncio
import os
import re
from collections import OrderedDict
from datetime import datetime, timezone
from time import monotonic
from urllib.parse import quote, urlparse

import httpx

from app.core.config import settings


def public_count(value):
    if isinstance(value, bool) or value is None:
        return None
    if not re.fullmatch(r"\d+", str(value)):
        return None
    return int(value)


def channel_identity(channel_id, handle=None, channel_url=None):
    if re.fullmatch(r"UC[A-Za-z0-9_-]{22}", channel_id or ""):
        return {"id": channel_id}
    candidate = handle or (channel_id if (channel_id or "").startswith("@") else None)
    if not candidate and channel_url:
        parsed = urlparse(channel_url)
        if parsed.hostname in {"youtube.com", "www.youtube.com", "m.youtube.com"} and parsed.path.startswith("/@"):
            candidate = parsed.path.split("/")[1]
    if candidate and re.fullmatch(r"@[^\s/<>?#]+", candidate):
        return {"forHandle": candidate}
    return None


def channel_link(channel_id, handle=None, channel_url=None):
    identity = channel_identity(channel_id, handle, channel_url)
    if not identity:
        return None
    if "id" in identity:
        return f"https://www.youtube.com/channel/{identity['id']}"
    return f"https://www.youtube.com/{quote(identity['forHandle'], safe='@')}"


class YouTubeChannelProfiles:
    def __init__(self, api_key=None):
        self.api_key = api_key if api_key is not None else os.getenv("YOUTUBE_DATA_API_KEY") or settings.GOOGLE_API_KEY
        self._cache = OrderedDict()
        self._lock = asyncio.Lock()
        self._retry_after = 0

    async def get_profile(self, channel_id, handle=None, channel_url=None):
        identity = channel_identity(channel_id, handle, channel_url)
        if not identity:
            return {"profile_status": "invalid_identity"}
        if not self.api_key:
            return {"profile_status": "not_configured"}
        cache_key = tuple(identity.items())
        # Coalesce repeated profile opens; the cache is bounded and never stores credentials.
        async with self._lock:
            now = monotonic()
            cached = self._cache.get(cache_key)
            if cached and cached[0] > now:
                self._cache.move_to_end(cache_key)
                return dict(cached[1])
            if now < self._retry_after:
                return {"profile_status": "unavailable"}
            try:
                async with httpx.AsyncClient(timeout=8) as client:
                    response = await client.get(
                        "https://www.googleapis.com/youtube/v3/channels",
                        params={"part": "snippet,statistics", **identity},
                        headers={"X-Goog-Api-Key": self.api_key},
                    )
                if response.status_code != 200:
                    if response.status_code in {400, 401, 403, 429}:
                        self._retry_after = now + 300
                    result = {"profile_status": "unavailable"}
                else:
                    items = response.json().get("items", [])
                    result = self.normalize(items[0]) if items else {"profile_status": "not_found"}
            except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError):
                result = {"profile_status": "unavailable"}
            ttl = 21600 if result["profile_status"] == "available" else 300
            self._cache[cache_key] = (monotonic() + ttl, result)
            self._cache.move_to_end(cache_key)
            while len(self._cache) > 128:
                self._cache.popitem(last=False)
            return dict(result)

    @staticmethod
    def normalize(channel):
        snippet = channel.get("snippet", {})
        stats = channel.get("statistics", {})
        thumbs = snippet.get("thumbnails", {})
        avatar = next((thumbs[size].get("url") for size in ("high", "medium", "default") if thumbs.get(size)), None)
        hidden = stats.get("hiddenSubscriberCount", False)
        return {
            "youtube_channel_id": channel["id"],
            "channel_title": snippet.get("title"),
            "channel_handle": snippet.get("customUrl"),
            "channel_avatar_url": avatar,
            "channel_url": channel_link(channel["id"]),
            "description": snippet.get("description"),
            "country": snippet.get("country"),
            "channel_published_at": snippet.get("publishedAt"),
            "subscriber_count": None if hidden else public_count(stats.get("subscriberCount")),
            "hidden_subscriber_count": bool(hidden),
            "video_count": public_count(stats.get("videoCount")),
            "view_count": public_count(stats.get("viewCount")),
            "profile_source": "youtube",
            "profile_status": "available",
            "profile_updated_at": datetime.now(timezone.utc).isoformat(),
        }


channel_profiles = YouTubeChannelProfiles()
