"""
Service for manually uploaded YouTube KOL stock opinions.

Gemini (or another video analyzer) can produce a JSON payload with video,
channel, and per-ticker opinion data. This service normalizes that payload,
stores one row per video/ticker, and builds dashboard-friendly aggregates.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, date, timezone
from hashlib import sha256
from statistics import mean
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import parse_qs, urlparse

from supabase import Client


TABLE_NAME = "youtube_stock_opinions"
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

    async def upload_payload(
        self,
        payload: Dict[str, Any],
        uploaded_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        rows = self._rows_from_payload(payload, uploaded_by=uploaded_by)
        if not rows:
            raise ValueError("No stock opinions found in payload")

        written_rows: List[Dict[str, Any]] = []
        for row in rows:
            result = (
                self.supabase.table(TABLE_NAME)
                .upsert(row, on_conflict="video_id,ticker")
                .execute()
            )
            if result.data:
                written_rows.extend(result.data)

        self._best_effort_sync_unified_kol_tables(payload, rows)

        return {
            "success": True,
            "inserted_count": len(written_rows),
            "video_id": rows[0]["video_id"],
            "tickers": [row["ticker"] for row in rows],
            "rows": written_rows,
        }

    async def get_dashboard(
        self,
        ticker: Optional[str] = None,
        channel_id: Optional[str] = None,
        sentiment: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 80,
    ) -> Dict[str, Any]:
        rows = self._fetch_rows(
            ticker=ticker,
            channel_id=channel_id,
            sentiment=sentiment,
            date_from=date_from,
            date_to=date_to,
        )

        return {
            "summary": self._build_summary(rows),
            "stocks": self._build_stock_summaries(rows),
            "creators": self._build_creator_summaries(rows),
            "daily": self._build_daily_summaries(rows),
            "changes": self._build_daily_changes(rows),
            "latest": rows[:limit],
            "filters": {
                "tickers": sorted({row["ticker"] for row in rows if row.get("ticker")}),
                "creators": self._creator_filter_options(rows),
            },
        }

    async def get_stock_detail(
        self,
        ticker: str,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        rows = self._fetch_rows(ticker=ticker, date_from=date_from, date_to=date_to)
        return {
            "ticker": ticker.upper(),
            "summary": self._build_summary(rows),
            "creators": self._build_creator_summaries(rows),
            "daily": self._build_daily_summaries(rows),
            "changes": self._build_daily_changes(rows),
            "opinions": rows,
        }

    def _rows_from_payload(
        self,
        payload: Dict[str, Any],
        uploaded_by: Optional[str],
    ) -> List[Dict[str, Any]]:
        channel = _first_dict(payload, "channel", "creator", "kol", "author")
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
        query = (
            self.supabase.table(TABLE_NAME)
            .select("*")
            .order("video_published_at", desc=True, nullsfirst=False)
            .order("created_at", desc=True)
            .limit(5000)
        )

        if ticker:
            query = query.eq("ticker", ticker.upper())
        if channel_id:
            query = query.eq("channel_id", channel_id)
        normalized_sentiment = _normalize_sentiment(sentiment)
        if sentiment and normalized_sentiment:
            query = query.eq("sentiment", normalized_sentiment)
        if date_from:
            query = query.gte("opinion_date", date_from)
        if date_to:
            query = query.lte("opinion_date", date_to)

        result = query.execute()
        return result.data or []

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

    def _best_effort_sync_unified_kol_tables(
        self,
        payload: Dict[str, Any],
        rows: List[Dict[str, Any]],
    ) -> None:
        if not rows:
            return

        first = rows[0]
        try:
            profile = {
                "platform": "youtube",
                "platform_user_id": first["channel_id"],
                "username": first.get("channel_handle") or first["channel_id"],
                "display_name": first.get("channel_title"),
                "avatar_url": first.get("channel_avatar_url"),
                "website": first.get("channel_url"),
                "is_active": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            self.supabase.table("kol_profiles").upsert(
                profile, on_conflict="platform,platform_user_id"
            ).execute()
        except Exception:
            pass

        try:
            avg_score = mean([_score(row) for row in rows])
            tickers = [row["ticker"] for row in rows]
            video = {
                "platform": "youtube",
                "platform_post_id": first["video_id"],
                "author_platform_id": first["channel_id"],
                "username": first.get("channel_title") or first["channel_id"],
                "title": first.get("video_title"),
                "tweet_text": "\n\n".join(
                    row.get("summary") or row.get("thesis") or "" for row in rows
                )[:10000],
                "tweet_hash": _stable_id(
                    "youtube",
                    first.get("video_id"),
                    first.get("video_title"),
                    first.get("channel_id"),
                ),
                "post_type": "video",
                "created_at": first.get("video_published_at"),
                "permalink": first.get("video_url"),
                "cover_url": first.get("thumbnail_url"),
                "video_url": first.get("video_url"),
                "ai_sentiment": _sentiment_from_score(avg_score),
                "ai_sentiment_confidence": _average_confidence(rows),
                "ai_tickers": tickers,
                "ai_tags": ["youtube", "stock-opinion"],
                "ai_summary": _overall_summary(rows),
                "ai_analyzed_at": first.get("analyzed_at"),
                "ai_model": first.get("source_model"),
                "media_urls": {"ticker_analyses": payload.get("opinions", [])},
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            }
            self.supabase.table("kol_tweets").upsert(
                video, on_conflict="platform,platform_post_id"
            ).execute()
        except Exception:
            pass


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
    if -1 <= score <= 1:
        score *= 100
    if sentiment == "bearish" and score > 0:
        score = -score
    if sentiment == "bullish" and score < 0:
        score = abs(score)
    if sentiment in {"neutral", "mixed"} and abs(score) > 35:
        score = 0
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
