"""
Service for manually uploaded YouTube creator stock opinions.

Gemini (or another video analyzer) can produce a JSON payload with video,
channel, and per-ticker opinion data. This service normalizes that payload,
stores one row per video/ticker, and builds dashboard-friendly aggregates.
"""

from __future__ import annotations

import asyncio
import logging
import re
from collections import defaultdict
from datetime import datetime, date, timezone
from hashlib import sha256
from math import isfinite
from statistics import mean
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import parse_qs, urlparse

logger = logging.getLogger(__name__)

from supabase import Client
from app.services.youtube_channel_profiles import (
    channel_link,
    channel_profiles,
    parse_youtube_time,
    public_count,
)


TABLE_NAME = "youtube_stock_opinions"
MAX_IMPORT_VIDEOS = 50
SENTIMENT_ALIASES = {
    "bull": "bullish",
    "bullish": "bullish",
    "positive": "bullish",
    "buy": "bullish",
    "long": "bullish",
    "bear": "bearish",
    "bearish": "bearish",
    "negative": "bearish",
    "sell": "bearish",
    "short": "bearish",
    "neutral": "neutral",
    "hold": "neutral",
    "mixed": "mixed",
}


class YouTubeStockOpinionService:
    """Normalize, persist, and aggregate YouTube stock opinion rows."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    def list_creators(self) -> List[Dict[str, Any]]:
        return self._build_creator_summaries(self._fetch_rows())

    def update_creator(self, channel_id: str, values: Dict[str, Any]) -> Dict[str, Any]:
        allowed = {"channel_title", "channel_handle", "channel_url", "channel_avatar_url"}
        if not values or set(values) - allowed:
            raise ValueError("请选择可修改的博主资料字段。")
        cleaned = {}
        for field, value in values.items():
            if value is not None and not isinstance(value, str):
                raise ValueError("博主资料必须是文本。")
            text = value.strip() if isinstance(value, str) else ""
            if len(text) > (200 if field in {"channel_title", "channel_handle"} else 2048):
                raise ValueError("博主资料超出长度限制。")
            if field == "channel_title" and not text:
                raise ValueError("博主名称不能为空。")
            if field == "channel_handle" and text and not re.fullmatch(r"@[^\s/<>?#]+", text):
                raise ValueError("YouTube 账号须以 @ 开头，且不能包含空格。")
            if field in {"channel_url", "channel_avatar_url"} and text:
                try:
                    parsed = urlparse(text)
                    valid = parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password
                except ValueError:
                    valid = False
                if not valid:
                    raise ValueError("链接必须是有效的 HTTPS 地址。")
                if field == "channel_url" and parsed.hostname not in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
                    raise ValueError("频道链接必须指向 YouTube。")
            cleaned[field] = text or None
        result = self.supabase.table(TABLE_NAME).update(cleaned).eq("channel_id", channel_id).execute()
        if not result.data:
            raise LookupError("Creator not found")
        rows = self._fetch_rows(channel_id=channel_id)
        return {"success": True, "creator": self._build_creator_summaries(rows)[0]}

    async def upload_import(
        self,
        body: Any,
        uploaded_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Import one video object or a batch of them.

        The latest import of a video is authoritative: its rows replace every
        row previously stored for that video, including tickers it dropped.
        """
        payloads = _as_payloads(body)
        checked = self.validate_import(payloads)
        if checked["errors"]:
            failed = checked["errors"][0]
            raise ValueError(_prefixed(failed["message"], failed["index"], len(payloads)))
        rows = [
            row
            for video in checked["videos"]
            for row in self._rows_from_payload(payloads[video["index"]], uploaded_by=uploaded_by)
        ]
        corrected_channels = await self.correct_channel_ids(rows)
        await self._fill_missing_avatars(rows)
        result = self.supabase.table(TABLE_NAME).upsert(
            rows, on_conflict="video_id,ticker"
        ).execute()
        written_rows = result.data or []

        tickers_by_video: Dict[str, List[str]] = defaultdict(list)
        for row in rows:
            tickers_by_video[row["video_id"]].append(row["ticker"])
        for video_id, tickers in tickers_by_video.items():
            (
                self.supabase.table(TABLE_NAME)
                .delete()
                .eq("video_id", video_id)
                .not_.in_("ticker", tickers)
                .execute()
            )

        return {
            "success": True,
            "inserted_count": len(written_rows),
            "video_count": len(checked["videos"]),
            "videos": [
                {
                    "video_id": video["video_id"],
                    "video_title": video["video_title"],
                    "channel_title": video["channel_title"],
                    "tickers": [opinion["ticker"] for opinion in video["opinions"]],
                }
                for video in checked["videos"]
            ],
            "corrected_channels": corrected_channels,
            "rows": written_rows,
        }

    async def correct_channel_ids(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Replace imported channel identity with the real owner of each YouTube video.

        AI-generated payloads often invent channel ids and handles, which splits
        one creator into several profiles. Rows whose video cannot be looked up
        keep the imported identity.
        """
        by_video: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for row in rows:
            if _youtube_video_id(row.get("video_id")):
                by_video[row["video_id"]].append(row)
        if not by_video:
            return []

        async def lookup(video_id: str):
            try:
                return video_id, await channel_profiles.channel_id_for_video(video_id)
            except Exception:
                logger.warning("YouTube channel lookup failed for video %s", video_id, exc_info=True)
                return video_id, None

        owners = dict(await asyncio.gather(*(lookup(video_id) for video_id in by_video)))
        profiles: Dict[str, Dict[str, Any]] = {}
        for channel_id in {owner for owner in owners.values() if owner}:
            try:
                profile = await channel_profiles.get_profile(channel_id)
            except Exception:
                profile = {}
            profiles[channel_id] = profile if profile.get("profile_status") == "available" else {}

        corrections = []
        for video_id, video_rows in by_video.items():
            owner = owners.get(video_id)
            if not owner:
                continue
            profile = profiles.get(owner, {})
            changed_id = video_rows[0].get("channel_id") != owner
            if not changed_id and not profile:
                continue
            identity = {"channel_id": owner, "channel_url": channel_link(owner)}
            if profile.get("channel_handle"):
                identity["channel_handle"] = profile["channel_handle"]
            elif changed_id:
                identity["channel_handle"] = None
            if profile.get("channel_title"):
                identity["channel_title"] = profile["channel_title"]
            if _https_url(profile.get("channel_avatar_url")):
                identity["channel_avatar_url"] = profile["channel_avatar_url"]
            elif changed_id:
                identity["channel_avatar_url"] = None
            if changed_id:
                corrections.append({"video_id": video_id, "from": video_rows[0].get("channel_id"), "to": owner})
            for row in video_rows:
                row.update(identity)
                raw = row.get("raw_payload")
                if isinstance(raw, dict):
                    channel = raw.get("channel") if isinstance(raw.get("channel"), dict) else {}
                    row["raw_payload"] = {
                        **raw,
                        "channel": {
                            **channel,
                            "id": owner,
                            "handle": row.get("channel_handle"),
                            "url": identity["channel_url"],
                            "title": row.get("channel_title"),
                        },
                    }
        return corrections

    def validate_import(self, body: Any) -> Dict[str, Any]:
        """Preview an import, reporting every rejected video before any write.

        When a batch repeats a video, the last copy wins and earlier copies
        are listed in ``superseded``.
        """
        payloads = _as_payloads(body)
        latest: Dict[str, Dict[str, Any]] = {}
        superseded: List[Dict[str, int]] = []
        errors: List[Dict[str, Any]] = []
        for index, payload in enumerate(payloads):
            try:
                preview = self.validate_payload(payload)
            except ValueError as e:
                errors.append({"index": index, "message": str(e)})
                continue
            previous = latest.pop(preview["video_id"], None)
            if previous is not None:
                superseded.append({"index": previous["index"], "by": index})
            latest[preview["video_id"]] = {"index": index, **preview}
        videos = sorted(latest.values(), key=lambda video: video["index"])
        return {
            "video_count": len(videos) + len(errors),
            "count": sum(video["count"] for video in videos),
            "videos": videos,
            "superseded": superseded,
            "errors": errors,
        }

    def validate_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Validate the import contract before any database writes."""
        for section, fields in (("channel", ("id", "title")),
                                ("video", ("id", "title", "published_at"))):
            obj = payload.get(section)
            if not isinstance(obj, dict):
                raise ValueError(f"{section} must be an object")
            for field in fields:
                if not isinstance(obj.get(field), str) or not obj[field].strip():
                    raise ValueError(f"{section}.{field} is required")
        published_at = payload["video"]["published_at"]
        try:
            parsed = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError()
        except ValueError:
            raise ValueError("video.published_at must be an ISO timestamp with timezone")
        opinions = payload.get("opinions")
        if not isinstance(opinions, list) or not 1 <= len(opinions) <= 200:
            raise ValueError("opinions must contain 1 to 200 stock opinions")
        seen = set()
        for index, opinion in enumerate(opinions):
            path = f"opinions[{index}]"
            if not isinstance(opinion, dict):
                raise ValueError(f"{path} must be an object")
            ticker = opinion.get("ticker")
            if not isinstance(ticker, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.\-]{0,19}", ticker):
                raise ValueError(f"{path}.ticker must be a stock symbol, e.g. NVDA")
            if ticker.upper() in seen:
                raise ValueError(f"{path}.ticker duplicates {ticker.upper()}")
            seen.add(ticker.upper())
            if opinion.get("sentiment") not in {"bullish", "bearish", "neutral", "mixed"}:
                raise ValueError(f"{path}.sentiment must be bullish, bearish, neutral or mixed")
            if not isinstance(opinion.get("summary"), str) or not opinion["summary"].strip():
                raise ValueError(f"{path}.summary is required")
            for field, low, high in (("direction_score", -100, 100), ("confidence", 0, 1)):
                value = opinion.get(field)
                if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or not low <= value <= high):
                    raise ValueError(f"{path}.{field} must be a number between {low} and {high}")
            for field in ("key_points", "risks"):
                value = opinion.get(field, [])
                if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
                    raise ValueError(f"{path}.{field} must be an array of strings")
            targets = opinion.get("price_targets", [])
            if not isinstance(targets, list) or any(not isinstance(item, dict) or isinstance(item.get("value"), bool) or not isinstance(item.get("value"), (int, float)) or not isfinite(item["value"]) or item["value"] <= 0 for item in targets):
                raise ValueError(f"{path}.price_targets must contain objects with positive numeric value")
            if opinion.get("opinion_date"):
                try:
                    date.fromisoformat(opinion["opinion_date"])
                except (ValueError, TypeError):
                    raise ValueError(f"{path}.opinion_date must be YYYY-MM-DD")
        rows = self._rows_from_payload(payload, uploaded_by=None)
        return {"video_id": rows[0]["video_id"], "video_title": rows[0]["video_title"],
                "channel_title": rows[0]["channel_title"], "count": len(rows),
                "opinions": [{key: row[key] for key in ("ticker", "sentiment", "direction_score", "confidence", "summary", "opinion_date")} for row in rows]}

    async def get_dashboard(
        self,
        ticker: Optional[str] = None,
        channel_id: Optional[str] = None,
        sentiment: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 80,
        offset: int = 0,
    ) -> Dict[str, Any]:
        rows = self._fetch_rows(
            ticker=ticker,
            channel_id=channel_id,
            sentiment=sentiment,
            date_from=date_from,
            date_to=date_to,
        )
        await self._fill_missing_avatars(rows)

        return {
            "summary": self._build_summary(rows),
            "stocks": self._build_stock_summaries(rows),
            "creators": self._build_creator_summaries(rows),
            "daily": self._build_daily_summaries(rows),
            "changes": self._build_daily_changes(rows),
            "latest": rows[offset:offset + limit],
            "pagination": {"offset": offset, "limit": limit, "total": len(rows), "has_more": offset + limit < len(rows)},
            "filters": {
                "tickers": sorted({row["ticker"] for row in rows if row.get("ticker")}),
                "creators": self._creator_filter_options(rows),
            },
        }

    async def get_creator_profile(self, channel_id: str) -> Dict[str, Any]:
        rows = self._fetch_rows(channel_id=channel_id)
        if not rows:
            raise LookupError("Creator not found in imported opinions")
        await self._fill_missing_avatars(rows)
        creator = self._build_creator_summaries(rows)[0]
        remote = await channel_profiles.get_profile(
            channel_id, creator.get("channel_handle"), creator.get("channel_url")
        )
        remote = {key: value for key, value in remote.items() if value is not None or key not in {"channel_title", "channel_handle", "channel_avatar_url", "description"}}
        # The stored identity is editable by administrators. Remote lookups only
        # enrich it with statistics and descriptions, not replace saved fields.
        identity = {key: creator.get(key) for key in ("channel_title", "channel_handle", "channel_url", "channel_avatar_url")}
        return {**creator, **remote, **identity}

    async def get_upload_coverage(self) -> Dict[str, Any]:
        """Count uploads published after each creator's last tracked video."""
        tracked: Dict[str, set] = defaultdict(set)
        tracked_at: Dict[str, datetime] = {}
        sample_video: Dict[str, str] = {}
        for row in self._tracked_video_index():
            channel_id = row.get("channel_id")
            if not isinstance(channel_id, str) or not channel_id:
                continue
            tracked.setdefault(channel_id, set())
            if _youtube_video_id(row.get("video_id")):
                tracked[channel_id].add(row["video_id"])
                sample_video.setdefault(channel_id, row["video_id"])
            published = parse_youtube_time(row.get("video_published_at") or row.get("created_at"))
            if published and (channel_id not in tracked_at or published > tracked_at[channel_id]):
                tracked_at[channel_id] = published

        def empty(channel_id: str, status: str) -> Dict[str, Any]:
            return {
                "channel_id": channel_id,
                "status": status,
                **compare_upload_coverage([], tracked[channel_id], tracked_at.get(channel_id), False),
            }

        if not channel_profiles.api_key:
            return {
                "status": "not_configured",
                "creators": [empty(channel_id, "not_configured") for channel_id in tracked],
            }

        resolved: Dict[str, Optional[str]] = {}
        lookup_ids = []
        for channel_id in tracked:
            if channel_id not in tracked_at:
                resolved[channel_id] = None
            elif re.fullmatch(r"UC[A-Za-z0-9_-]{22}", channel_id):
                resolved[channel_id] = channel_id
            elif channel_id in sample_video:
                lookup_ids.append(channel_id)
            else:
                resolved[channel_id] = None

        async def resolve(channel_id: str):
            try:
                return channel_id, await channel_profiles.channel_id_for_video(sample_video[channel_id])
            except Exception:
                logger.warning("YouTube channel lookup failed for %s", channel_id, exc_info=True)
                return channel_id, None

        for channel_id, youtube_id in await asyncio.gather(*(resolve(channel_id) for channel_id in lookup_ids)):
            resolved[channel_id] = youtube_id

        cutoffs: Dict[str, str] = {}
        for channel_id, youtube_id in resolved.items():
            published = tracked_at.get(channel_id)
            if not youtube_id or not published:
                continue
            cutoff = published.astimezone(timezone.utc).isoformat()
            previous = cutoffs.get(youtube_id)
            if previous is None or cutoff < previous:
                cutoffs[youtube_id] = cutoff
        uploads = await channel_profiles.latest_uploads(cutoffs) if cutoffs else {}
        creators = []
        for channel_id, youtube_id in resolved.items():
            if channel_id not in tracked_at:
                creators.append(empty(channel_id, "available"))
                continue
            remote = uploads.get(youtube_id) if youtube_id else None
            if not remote:
                remote = {"status": "invalid_identity" if not youtube_id else "unavailable", "videos": [], "reached_cutoff": False}
            creators.append({
                "channel_id": channel_id,
                "status": remote.get("status") or "unavailable",
                **compare_upload_coverage(
                    remote.get("videos") or [],
                    tracked[channel_id],
                    tracked_at.get(channel_id),
                    not remote.get("reached_cutoff"),
                ),
            })
        if any(item["status"] == "available" for item in creators):
            status = "available"
        elif not creators or all(item["status"] == "not_configured" for item in creators):
            status = "not_configured"
        elif any(item["status"] == "unavailable" for item in creators):
            status = "unavailable"
        else:
            status = "available"
        return {"status": status, "creators": creators}

    def _tracked_video_index(self) -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        while True:
            result = (
                self.supabase.table(TABLE_NAME)
                .select("channel_id,video_id,video_published_at,created_at")
                .order("id")
                .range(len(rows), len(rows) + 999)
                .execute()
            )
            page = result.data or []
            rows.extend(page)
            if len(page) < 1000:
                break
        return rows

    async def get_stock_detail(
        self,
        ticker: str,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        rows = self._fetch_rows(ticker=ticker, date_from=date_from, date_to=date_to)
        await self._fill_missing_avatars(rows)
        return {
            "ticker": ticker.upper(),
            "summary": self._build_summary(rows),
            "creators": self._build_creator_summaries(rows),
            "daily": self._build_daily_summaries(rows),
            "changes": self._build_daily_changes(rows),
            "opinions": rows,
        }

    async def _fill_missing_avatars(self, rows: List[Dict[str, Any]]) -> None:
        """Look up public YouTube avatars for creators imported without one."""
        samples: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            channel_id = row.get("channel_id")
            if not channel_id or _https_url(row.get("channel_avatar_url")):
                continue
            current = samples.get(channel_id)
            if current is None or (
                not _youtube_video_id(current.get("video_id")) and _youtube_video_id(row.get("video_id"))
            ):
                samples[channel_id] = row
        if not samples:
            return

        async def lookup(channel_id: str, sample: Dict[str, Any]):
            try:
                avatar = await _avatar_from_profile(
                    channel_id, sample.get("channel_handle"), sample.get("channel_url")
                )
                if not avatar:
                    resolved = await channel_profiles.channel_id_for_video(sample.get("video_id"))
                    if resolved and resolved != channel_id:
                        avatar = await _avatar_from_profile(resolved)
            except Exception:
                logger.warning("YouTube avatar lookup failed for %s", channel_id, exc_info=True)
                return channel_id, None
            return channel_id, avatar

        found = {
            channel_id: avatar
            for channel_id, avatar in await asyncio.gather(
                *(lookup(channel_id, sample) for channel_id, sample in samples.items())
            )
            if avatar
        }
        if not found:
            return

        for row in rows:
            channel_id = row.get("channel_id")
            if channel_id in found and not _https_url(row.get("channel_avatar_url")):
                row["channel_avatar_url"] = found[channel_id]

        for channel_id, avatar in found.items():
            try:
                (
                    self.supabase.table(TABLE_NAME)
                    .update({"channel_avatar_url": avatar})
                    .eq("channel_id", channel_id)
                    .execute()
                )
            except Exception:
                logger.warning("Failed to store YouTube avatar for %s", channel_id, exc_info=True)

    def _rows_from_payload(
        self,
        payload: Dict[str, Any],
        uploaded_by: Optional[str],
    ) -> List[Dict[str, Any]]:
        channel = _first_dict(payload, "channel", "creator", "author")
        video = _first_dict(payload, "video", "source")
        opinions = _extract_opinions(payload)

        channel_title = _first_text(
            channel,
            payload,
            "title",
            "name",
            "channel_title",
            "channel_name",
            default="Unknown YouTube creator",
        )
        channel_handle = _first_text(channel, payload, "handle", "username")
        channel_url = _first_text(channel, payload, "url", "channel_url")
        channel_id = _first_text(channel, payload, "id", "channel_id")
        if not channel_id:
            channel_id = channel_handle or _stable_id("channel", channel_url, channel_title)

        video_url = _first_text(video, payload, "url", "video_url", "permalink")
        video_id = _first_text(video, payload, "id", "video_id")
        if not video_id and video_url:
            video_id = _extract_youtube_video_id(video_url)
        video_title = _first_text(video, payload, "title", "video_title")
        if not video_id:
            video_id = _stable_id("video", video_url, video_title, channel_id)

        published_at = _first_text(
            video,
            payload,
            "published_at",
            "publishedAt",
            "created_at",
            "date",
        )
        analyzed_at = _first_text(video, payload, "analyzed_at", "analysis_date")
        opinion_date = _date_from_values(published_at, analyzed_at)

        rows: List[Dict[str, Any]] = []
        for opinion in opinions:
            ticker = _normalize_ticker(_first_text(opinion, payload, "ticker", "symbol"))
            if not ticker:
                continue

            sentiment = _normalize_sentiment(
                _first_text(opinion, payload, "sentiment", "stance", "rating", "action")
            )
            score = _normalize_score(
                _first_number(
                    opinion,
                    "direction_score",
                    "score",
                    "sentiment_score",
                    "conviction_score",
                ),
                sentiment,
            )
            confidence = _normalize_confidence(
                _first_number(opinion, "confidence", "sentiment_confidence")
            )

            rows.append(
                {
                    "video_id": video_id,
                    "video_title": video_title,
                    "video_url": video_url
                    or (f"https://www.youtube.com/watch?v={video_id}" if video_id else None),
                    "thumbnail_url": _first_text(
                        video, payload, "thumbnail_url", "thumbnail", "cover_url"
                    )
                    or (
                        f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
                        if _youtube_video_id(video_id)
                        else None
                    ),
                    "video_published_at": _to_iso_datetime(published_at),
                    "channel_id": channel_id,
                    "channel_title": channel_title,
                    "channel_handle": channel_handle,
                    "channel_url": channel_url,
                    "channel_avatar_url": _first_text(
                        channel,
                        payload,
                        "avatar_url",
                        "thumbnail_url",
                        "profile_image_url",
                    ),
                    "ticker": ticker,
                    "company_name": _first_text(
                        opinion, payload, "company_name", "company", "name"
                    ),
                    "sentiment": sentiment,
                    "direction_score": score,
                    "confidence": confidence,
                    "time_horizon": _first_text(
                        opinion, payload, "time_horizon", "horizon", "timeframe"
                    ),
                    "thesis": _first_text(opinion, payload, "thesis", "reasoning", "rationale"),
                    "summary": _first_text(opinion, payload, "summary", "view", "opinion"),
                    "key_points": _ensure_list(
                        opinion.get("key_points")
                        or opinion.get("points")
                        or opinion.get("drivers")
                        or opinion.get("catalysts")
                    ),
                    "risks": _ensure_list(opinion.get("risks") or opinion.get("risk_factors")),
                    "price_targets": _ensure_list(
                        opinion.get("price_targets") or opinion.get("price_target")
                    ),
                    "opinion_date": opinion.get("opinion_date") or opinion_date,
                    "analyzed_at": _to_iso_datetime(analyzed_at),
                    "source_model": _first_text(
                        payload, video, "model", "source_model", "ai_model"
                    ),
                    "raw_payload": payload,
                    "uploaded_by": uploaded_by,
                }
            )

        return rows

    def _fetch_rows(
        self,
        ticker: Optional[str] = None,
        channel_id: Optional[str] = None,
        sentiment: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        normalized_sentiment = _normalize_sentiment(sentiment)
        # Read every page so older stocks and creators are not silently omitted.
        rows = []
        while True:
            query = (
                self.supabase.table(TABLE_NAME)
                .select("*", count="exact")
                .order("video_published_at", desc=True, nullsfirst=False)
                .order("created_at", desc=True)
                .order("id")
            )
            if ticker:
                query = query.eq("ticker", ticker.upper())
            if channel_id:
                query = query.eq("channel_id", channel_id)
            if sentiment and normalized_sentiment:
                query = query.eq("sentiment", normalized_sentiment)
            if date_from:
                query = query.gte("opinion_date", date_from)
            if date_to:
                query = query.lte("opinion_date", date_to)
            result = query.range(len(rows), len(rows) + 999).execute()
            page = result.data or []
            rows.extend(page)
            if not page or (result.count is not None and len(rows) >= result.count):
                break
            if result.count is None and len(page) < 1000:
                break
        return rows

    def _build_summary(self, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        tickers = {row["ticker"] for row in rows if row.get("ticker")}
        creators = {row["channel_id"] for row in rows if row.get("channel_id")}
        scores = [_score(row) for row in rows]
        return {
            "total_opinions": len(rows),
            "total_stocks": len(tickers),
            "total_creators": len(creators),
            "bullish_count": _sentiment_count(rows, "bullish"),
            "bearish_count": _sentiment_count(rows, "bearish"),
            "neutral_count": _sentiment_count(rows, "neutral") + _sentiment_count(rows, "mixed"),
            "avg_score": round(mean(scores), 2) if scores else 0,
            "latest_opinion_at": _max_text(
                row.get("video_published_at") or row.get("created_at") for row in rows
            ),
        }

    def _build_stock_summaries(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for row in rows:
            grouped[row["ticker"]].append(row)

        summaries = []
        for ticker, stock_rows in grouped.items():
            scores = [_score(row) for row in stock_rows]
            creators = {row["channel_id"] for row in stock_rows if row.get("channel_id")}
            latest = max(
                stock_rows,
                key=lambda row: row.get("video_published_at") or row.get("created_at") or "",
            )
            summaries.append(
                {
                    "ticker": ticker,
                    "company_name": latest.get("company_name"),
                    "total_opinions": len(stock_rows),
                    "creator_count": len(creators),
                    "bullish_count": _sentiment_count(stock_rows, "bullish"),
                    "bearish_count": _sentiment_count(stock_rows, "bearish"),
                    "neutral_count": _sentiment_count(stock_rows, "neutral")
                    + _sentiment_count(stock_rows, "mixed"),
                    "avg_score": round(mean(scores), 2) if scores else 0,
                    "avg_confidence": _average_confidence(stock_rows),
                    "latest_opinion_at": latest.get("video_published_at")
                    or latest.get("created_at"),
                }
            )

        return sorted(
            summaries,
            key=lambda item: (item["total_opinions"], abs(item["avg_score"])),
            reverse=True,
        )

    def _build_creator_summaries(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for row in rows:
            grouped[row["channel_id"]].append(row)

        summaries = []
        for channel_id, creator_rows in grouped.items():
            scores = [_score(row) for row in creator_rows]
            latest = max(
                creator_rows,
                key=lambda row: row.get("video_published_at") or row.get("created_at") or "",
            )
            ticker_counts: Dict[str, int] = defaultdict(int)
            for row in creator_rows:
                ticker_counts[row["ticker"]] += 1
            summaries.append(
                {
                    "channel_id": channel_id,
                    "channel_title": latest.get("channel_title"),
                    "channel_handle": latest.get("channel_handle"),
                    "channel_avatar_url": latest.get("channel_avatar_url"),
                    "channel_url": latest.get("channel_url"),
                    **self._imported_channel_profile(latest),
                    "total_opinions": len(creator_rows),
                    "bullish_count": _sentiment_count(creator_rows, "bullish"),
                    "bearish_count": _sentiment_count(creator_rows, "bearish"),
                    "neutral_count": _sentiment_count(creator_rows, "neutral")
                    + _sentiment_count(creator_rows, "mixed"),
                    "avg_score": round(mean(scores), 2) if scores else 0,
                    "top_tickers": [
                        {"ticker": ticker, "count": count}
                        for ticker, count in sorted(
                            ticker_counts.items(), key=lambda item: item[1], reverse=True
                        )[:6]
                    ],
                    "latest_opinion_at": latest.get("video_published_at")
                    or latest.get("created_at"),
                }
            )

        return sorted(summaries, key=lambda item: item["total_opinions"], reverse=True)

    @staticmethod
    def _imported_channel_profile(row: Dict[str, Any]) -> Dict[str, Any]:
        raw = row.get("raw_payload") or {}
        channel = raw.get("channel", {}) if isinstance(raw, dict) else {}
        if not isinstance(channel, dict):
            channel = {}
        hidden = channel.get("hidden_subscriber_count") is True
        return {
            "description": channel.get("description") if isinstance(channel.get("description"), str) else None,
            "country": channel.get("country") if isinstance(channel.get("country"), str) else None,
            "channel_published_at": channel.get("published_at") if isinstance(channel.get("published_at"), str) else None,
            "subscriber_count": None if hidden else public_count(channel.get("subscriber_count")),
            "hidden_subscriber_count": hidden,
            "video_count": public_count(channel.get("video_count")),
            "view_count": public_count(channel.get("view_count")),
            "channel_url": row.get("channel_url") if _https_url(row.get("channel_url")) else channel_link(row.get("channel_id"), row.get("channel_handle"), row.get("channel_url")),
            "profile_source": "imported",
            "profile_status": "imported",
            "profile_updated_at": None,
        }

    def _build_daily_summaries(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for row in rows:
            day = str(row.get("opinion_date") or "")[:10]
            if day:
                grouped[day].append(row)

        daily = []
        for day, day_rows in grouped.items():
            scores = [_score(row) for row in day_rows]
            daily.append(
                {
                    "date": day,
                    "total": len(day_rows),
                    "bullish_count": _sentiment_count(day_rows, "bullish"),
                    "bearish_count": _sentiment_count(day_rows, "bearish"),
                    "neutral_count": _sentiment_count(day_rows, "neutral")
                    + _sentiment_count(day_rows, "mixed"),
                    "avg_score": round(mean(scores), 2) if scores else 0,
                }
            )

        return sorted(daily, key=lambda item: item["date"])

    def _build_daily_changes(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        grouped: Dict[str, Dict[str, List[float]]] = defaultdict(lambda: defaultdict(list))
        for row in rows:
            day = str(row.get("opinion_date") or "")[:10]
            if day and row.get("ticker"):
                grouped[row["ticker"]][day].append(_score(row))

        changes = []
        for ticker, by_day in grouped.items():
            dates = sorted(by_day)
            if not dates:
                continue
            current_day = dates[-1]
            previous_day = dates[-2] if len(dates) > 1 else None
            current_score = round(mean(by_day[current_day]), 2)
            previous_score = (
                round(mean(by_day[previous_day]), 2) if previous_day else None
            )
            changes.append(
                {
                    "ticker": ticker,
                    "current_date": current_day,
                    "current_score": current_score,
                    "previous_date": previous_day,
                    "previous_score": previous_score,
                    "change": (
                        round(current_score - previous_score, 2)
                        if previous_score is not None
                        else None
                    ),
                    "opinion_count": len(by_day[current_day]),
                }
            )

        return sorted(
            changes,
            key=lambda item: abs(item["change"] or item["current_score"]),
            reverse=True,
        )

    def _creator_filter_options(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            channel_id = row.get("channel_id")
            if not channel_id or channel_id in seen:
                continue
            seen[channel_id] = {
                "channel_id": channel_id,
                "channel_title": row.get("channel_title"),
                "channel_handle": row.get("channel_handle"),
                "channel_avatar_url": row.get("channel_avatar_url"),
            }
        return sorted(
            seen.values(),
            key=lambda item: (item.get("channel_title") or item["channel_id"]).lower(),
        )



def _as_payloads(body: Any) -> List[Dict[str, Any]]:
    """Accept a single video object or an array of them."""
    if isinstance(body, dict):
        payloads = [body]
    elif isinstance(body, list):
        payloads = body
    else:
        raise ValueError("Import must be a video object or an array of video objects")
    if not 1 <= len(payloads) <= MAX_IMPORT_VIDEOS:
        raise ValueError(f"Import must contain 1 to {MAX_IMPORT_VIDEOS} videos")
    if any(not isinstance(payload, dict) for payload in payloads):
        raise ValueError("Each imported video must be an object")
    return payloads


def _prefixed(message: str, index: int, total: int) -> str:
    return message if total == 1 else f"videos[{index}]: {message}"


def _https_url(value: Any) -> bool:
    return isinstance(value, str) and value.startswith("https://")


def _youtube_video_id(value: Any) -> bool:
    return isinstance(value, str) and bool(re.fullmatch(r"[A-Za-z0-9_-]{11}", value))


def compare_upload_coverage(
    videos: List[Dict[str, Any]],
    tracked_ids: set,
    published_after: Optional[datetime],
    truncated: bool,
) -> Dict[str, Any]:
    """Count uploads newer than the last tracked video that are still missing."""
    seen: List[Dict[str, Any]] = []
    known = set()
    for video in videos:
        video_id = video.get("video_id")
        if not _youtube_video_id(video_id) or video_id in known:
            continue
        published = parse_youtube_time(video.get("published_at"))
        if published_after and (published is None or published <= published_after):
            continue
        known.add(video_id)
        seen.append({
            "video_id": video_id,
            "title": video.get("title") if isinstance(video.get("title"), str) else None,
            "published_at": video.get("published_at") if isinstance(video.get("published_at"), str) else None,
        })
    untracked = [video for video in seen if video["video_id"] not in tracked_ids]
    return {
        "since": published_after.astimezone(timezone.utc).isoformat() if published_after else None,
        "checked_count": len(seen),
        "untracked_count": len(untracked),
        "truncated": bool(truncated and untracked),
        "latest_video_id": untracked[0]["video_id"] if untracked else None,
        "latest_published_at": untracked[0]["published_at"] if untracked else None,
        "untracked": untracked,
    }


async def _avatar_from_profile(channel_id: str, handle: Optional[str] = None, channel_url: Optional[str] = None):
    profile = await channel_profiles.get_profile(channel_id, handle, channel_url)
    avatar = profile.get("channel_avatar_url") if isinstance(profile, dict) else None
    return avatar if _https_url(avatar) else None


def _first_dict(payload: Dict[str, Any], *keys: str) -> Dict[str, Any]:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, dict):
            return value
    return {}


def _extract_opinions(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = (
        payload.get("opinions")
        or payload.get("stock_opinions")
        or payload.get("stocks")
        or payload.get("ticker_analyses")
        or payload.get("tickerAnalyses")
    )

    if isinstance(raw, dict):
        return [
            {"ticker": ticker, **value} if isinstance(value, dict) else {"ticker": ticker, "summary": value}
            for ticker, value in raw.items()
        ]
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    if payload.get("ticker") or payload.get("symbol"):
        return [payload]
    return []


def _first_text(*sources: Dict[str, Any], default: Optional[str] = None) -> Optional[str]:
    if not sources:
        return default

    *dicts, keys = sources
    key_names: Iterable[str]
    if isinstance(keys, str):
        dicts = list(sources[:-1])
        key_names = [keys]
    else:
        key_names = []
        dicts = list(sources)

    # The function is intentionally called as _first_text(dict1, dict2, "a", "b").
    dict_sources: List[Dict[str, Any]] = []
    names: List[str] = []
    for source in sources:
        if isinstance(source, dict):
            dict_sources.append(source)
        elif isinstance(source, str):
            names.append(source)

    for name in names or key_names:
        for source in dict_sources:
            value = source.get(name)
            if value is not None and value != "":
                return str(value).strip()
    return default


def _first_number(source: Dict[str, Any], *keys: str) -> Optional[float]:
    for key in keys:
        value = source.get(key)
        if value is None or value == "":
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def _normalize_ticker(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    ticker = value.strip().upper().replace("$", "")
    return ticker[:20] if ticker else None


def _normalize_sentiment(value: Optional[str]) -> str:
    if not value:
        return "neutral"
    return SENTIMENT_ALIASES.get(value.strip().lower(), "neutral")


def _normalize_score(value: Optional[float], sentiment: str) -> float:
    if value is None:
        if sentiment == "bullish":
            return 60
        if sentiment == "bearish":
            return -60
        return 0

    score = value
    if sentiment == "bearish" and score > 0:
        score = -score
    if sentiment == "bullish" and score < 0:
        score = abs(score)
    return round(max(-100, min(100, score)), 2)


def _normalize_confidence(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    if value > 1:
        value = value / 100
    return round(max(0, min(1, value)), 3)


def _ensure_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _extract_youtube_video_id(url: str) -> Optional[str]:
    parsed = urlparse(url)
    if parsed.hostname in {"youtu.be", "www.youtu.be"}:
        return parsed.path.strip("/") or None
    if "youtube.com" in (parsed.hostname or ""):
        query_id = parse_qs(parsed.query).get("v", [None])[0]
        if query_id:
            return query_id
        parts = [part for part in parsed.path.split("/") if part]
        if parts and parts[0] in {"shorts", "embed", "live"} and len(parts) > 1:
            return parts[1]
    return None


def _to_iso_datetime(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        text = str(value).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.isoformat()
    except Exception:
        return str(value)


def _date_from_values(*values: Optional[str]) -> str:
    for value in values:
        if not value:
            continue
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            return parsed.date().isoformat()
        except Exception:
            text = str(value)
            if len(text) >= 10:
                return text[:10]
    return date.today().isoformat()


def _stable_id(prefix: str, *values: Optional[str]) -> str:
    raw = "|".join(str(value or "") for value in values)
    return f"{prefix}_{sha256(raw.encode()).hexdigest()[:16]}"


def _score(row: Dict[str, Any]) -> float:
    try:
        return float(row.get("direction_score") or 0)
    except (TypeError, ValueError):
        return 0


def _sentiment_count(rows: List[Dict[str, Any]], sentiment: str) -> int:
    return sum(1 for row in rows if row.get("sentiment") == sentiment)


def _average_confidence(rows: List[Dict[str, Any]]) -> Optional[float]:
    values = []
    for row in rows:
        value = row.get("confidence")
        if value is None:
            continue
        try:
            values.append(float(value))
        except (TypeError, ValueError):
            continue
    return round(mean(values), 3) if values else None


def _max_text(values: Iterable[Optional[str]]) -> Optional[str]:
    filtered = [value for value in values if value]
    return max(filtered) if filtered else None


def _sentiment_from_score(score: float) -> str:
    if score > 15:
        return "bullish"
    if score < -15:
        return "bearish"
    return "neutral"


def _overall_summary(rows: List[Dict[str, Any]]) -> Optional[str]:
    summaries = [row.get("summary") for row in rows if row.get("summary")]
    if not summaries:
        return None
    return "\n".join(f"{row['ticker']}: {row.get('summary')}" for row in rows if row.get("summary"))[:4000]
