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


def parse_youtube_time(value):
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if len(text) == 10:
        text = f"{text}T00:00:00+00:00"
    else:
        text = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


_SKIPPED_UPLOAD_TITLES = {"private video", "deleted video"}


def uploads_from_playlist(payload, limit):
    """Public uploads, newest first. Private and deleted entries are omitted."""
    videos = []
    seen = set()
    for item in (payload or {}).get("items") or []:
        if not isinstance(item, dict):
            continue
        snippet = item.get("snippet") if isinstance(item.get("snippet"), dict) else {}
        details = item.get("contentDetails") if isinstance(item.get("contentDetails"), dict) else {}
        resource = snippet.get("resourceId") if isinstance(snippet.get("resourceId"), dict) else {}
        if resource.get("kind") not in {None, "youtube#video"}:
            continue
        video_id = details.get("videoId") or resource.get("videoId")
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id or "") or video_id in seen:
            continue
        title = snippet.get("title") if isinstance(snippet.get("title"), str) else None
        if (title or "").strip().lower() in _SKIPPED_UPLOAD_TITLES:
            continue
        published = details.get("videoPublishedAt") or snippet.get("publishedAt")
        seen.add(video_id)
        videos.append({
            "video_id": video_id,
            "title": title,
            "published_at": published if isinstance(published, str) else None,
        })
        if len(videos) >= limit:
            break
    return videos


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

    async def channel_id_for_video(self, video_id):
        """Resolve a public channel id from a YouTube video when the import id is not usable."""
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id or ""):
            return None
        if not self.api_key:
            return None
        cache_key = ("video", video_id)
        async with self._lock:
            now = monotonic()
            cached = self._cache.get(cache_key)
            if cached and cached[0] > now:
                self._cache.move_to_end(cache_key)
                return cached[1].get("youtube_channel_id")
            if now < self._retry_after:
                return None
            channel_id = None
            try:
                async with httpx.AsyncClient(timeout=8) as client:
                    response = await client.get(
                        "https://www.googleapis.com/youtube/v3/videos",
                        params={"part": "snippet", "id": video_id},
                        headers={"X-Goog-Api-Key": self.api_key},
                    )
                if response.status_code != 200:
                    if response.status_code in {400, 401, 403, 429}:
                        self._retry_after = now + 300
                else:
                    items = response.json().get("items", [])
                    candidate = items[0].get("snippet", {}).get("channelId") if items else None
                    if re.fullmatch(r"UC[A-Za-z0-9_-]{22}", candidate or ""):
                        channel_id = candidate
            except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError):
                channel_id = None
            self._cache[cache_key] = (monotonic() + (21600 if channel_id else 300), {"youtube_channel_id": channel_id})
            self._cache.move_to_end(cache_key)
            while len(self._cache) > 128:
                self._cache.popitem(last=False)
            return channel_id

    async def latest_uploads(self, cutoffs, page_size=50, max_pages=2):
        """Uploads published after each channel's cutoff, newest first.

        ``cutoffs`` maps a channel id to the last tracked publish time.
        Scanning stops at that time, or after ``max_pages`` playlist pages.
        """
        page_size = max(1, min(int(page_size), 50))
        max_pages = max(1, min(int(max_pages), 3))
        pending = []
        results = {}
        async with self._lock:
            backing_off = monotonic() < self._retry_after
            for channel_id, cutoff in dict(cutoffs).items():
                cache_key = ("uploads-since", channel_id, cutoff, page_size, max_pages)
                if not re.fullmatch(r"UC[A-Za-z0-9_-]{22}", channel_id or ""):
                    results[channel_id] = {"status": "invalid_identity", "videos": [], "reached_cutoff": False}
                    continue
                if not self.api_key:
                    results[channel_id] = {"status": "not_configured", "videos": [], "reached_cutoff": False}
                    continue
                if backing_off:
                    results[channel_id] = {"status": "unavailable", "videos": [], "reached_cutoff": False}
                    continue
                cached = self._cache.get(cache_key)
                if cached and cached[0] > monotonic():
                    self._cache.move_to_end(cache_key)
                    results[channel_id] = {
                        "status": cached[1]["status"],
                        "videos": [dict(video) for video in cached[1]["videos"]],
                        "reached_cutoff": cached[1]["reached_cutoff"],
                    }
                else:
                    pending.append((channel_id, cutoff, cache_key))
        if not pending:
            return results

        fetched = {
            channel_id: {"status": "unavailable", "videos": [], "reached_cutoff": False, "cache_key": cache_key}
            for channel_id, cutoff, cache_key in pending
        }
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                playlists = {}
                quota_hit = False
                ids = [channel_id for channel_id, _, _ in pending]
                for start in range(0, len(ids), 50):
                    chunk = ids[start:start + 50]
                    response = await client.get(
                        "https://www.googleapis.com/youtube/v3/channels",
                        params={"part": "contentDetails", "id": ",".join(chunk)},
                        headers={"X-Goog-Api-Key": self.api_key},
                    )
                    if response.status_code != 200:
                        if response.status_code in {400, 401, 403, 429}:
                            quota_hit = True
                        break
                    for item in response.json().get("items", []):
                        playlist_id = (item.get("contentDetails") or {}).get("relatedPlaylists", {}).get("uploads")
                        if item.get("id") and isinstance(playlist_id, str) and playlist_id:
                            playlists[item["id"]] = playlist_id
                    for channel_id in chunk:
                        if channel_id not in playlists:
                            fetched[channel_id]["status"] = "not_found"
                if not quota_hit:
                    semaphore = asyncio.Semaphore(4)
                    by_id = {channel_id: cutoff for channel_id, cutoff, _ in pending}

                    async def load_playlist(channel_id, playlist_id):
                        videos = []
                        token = None
                        reached = False
                        cutoff = parse_youtube_time(by_id.get(channel_id))
                        async with semaphore:
                            for _ in range(max_pages):
                                params = {
                                    "part": "snippet,contentDetails",
                                    "playlistId": playlist_id,
                                    "maxResults": str(page_size),
                                }
                                if token:
                                    params["pageToken"] = token
                                response = await client.get(
                                    "https://www.googleapis.com/youtube/v3/playlistItems",
                                    params=params,
                                    headers={"X-Goog-Api-Key": self.api_key},
                                )
                                if response.status_code != 200:
                                    if response.status_code in {400, 401, 403, 429}:
                                        return channel_id, "quota", [], False
                                    return channel_id, "unavailable", [], False
                                payload = response.json()
                                for video in uploads_from_playlist(payload, page_size):
                                    published = parse_youtube_time(video.get("published_at"))
                                    if cutoff and published and published <= cutoff:
                                        reached = True
                                        break
                                    videos.append(video)
                                if reached or not payload.get("nextPageToken"):
                                    reached = True
                                    break
                                token = payload.get("nextPageToken")
                        return channel_id, "available", videos, reached

                    loaded = await asyncio.gather(*(
                        load_playlist(channel_id, playlist_id) for channel_id, playlist_id in playlists.items()
                    ))
                    for channel_id, state, videos, reached in loaded:
                        if state == "quota":
                            quota_hit = True
                            break
                        fetched[channel_id]["status"] = state
                        fetched[channel_id]["videos"] = videos or []
                        fetched[channel_id]["reached_cutoff"] = reached
                if quota_hit:
                    async with self._lock:
                        self._retry_after = monotonic() + 300
                    for channel_id in fetched:
                        if fetched[channel_id]["status"] not in {"available", "not_found"}:
                            fetched[channel_id] = {
                                **fetched[channel_id],
                                "status": "unavailable",
                                "videos": [],
                                "reached_cutoff": False,
                            }
        except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError):
            pass

        async with self._lock:
            for channel_id, result in fetched.items():
                stored = {
                    "status": result["status"],
                    "videos": result["videos"],
                    "reached_cutoff": result["reached_cutoff"],
                }
                ttl = 900 if result["status"] == "available" else 300
                self._cache[result["cache_key"]] = (monotonic() + ttl, stored)
                self._cache.move_to_end(result["cache_key"])
                while len(self._cache) > 128:
                    self._cache.popitem(last=False)
                results[channel_id] = {
                    "status": stored["status"],
                    "videos": [dict(video) for video in stored["videos"]],
                    "reached_cutoff": stored["reached_cutoff"],
                }
        return results

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
