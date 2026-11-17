"""Automatic YouTube stock-opinion import.

A local worker (side-projects/youtube-notes/auto_import.py) polls this backend,
fetches transcripts of the creators' untracked videos, and posts each transcript
here. The backend analyzes it with DeepSeek, then imports the result through the
same validation and upsert path as the admin JSON upload.

Runs are created by an admin ("run now") or once per day at the configured local
time; the worker creates the scheduled run on its first poll after that time.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import httpx

from app.core.config import settings
from app.services.youtube_stock_opinions import YouTubeStockOpinionService
from supabase import Client

logger = logging.getLogger(__name__)

RUNS = "youtube_auto_import_runs"
WORKER = "youtube_auto_import_worker"
# A running run with no worker heartbeat for this long is marked failed (worker died or Mac slept).
STALE_AFTER = timedelta(minutes=30)
# The worker polls every minute; older than this it is shown as offline.
WORKER_ONLINE_WITHIN = timedelta(minutes=3)
MAX_TRANSCRIPT_CHARS = 150_000
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"

_TEMPLATE = {
    "channel": {
        "id": "CHANNEL_ID",
        "title": "CREATOR_NAME",
        "handle": "@creator",
        "url": "https://www.youtube.com/@creator",
    },
    "video": {
        "id": "VIDEO_ID",
        "title": "VIDEO_TITLE",
        "url": "https://www.youtube.com/watch?v=VIDEO_ID",
        "published_at": "2026-10-06T15:00:00Z",
        "analyzed_at": "2026-10-06T16:00:00Z",
    },
    "model": "MODEL",
    "summary": "VIDEO_OR_MACRO_ANALYSIS",
    "opinions": [
        {
            "ticker": "NVDA",
            "company_name": "NVIDIA",
            "sentiment": "bullish",
            "direction_score": 60,
            "confidence": 0.85,
            "time_horizon": "3-6 months",
            "summary": "CREATOR_VIEW",
            "thesis": "REASONING",
            "key_points": ["KEY_POINT"],
            "risks": ["RISK"],
            "price_targets": [{"label": "base", "value": 165}],
        }
    ],
}

# Same contract as the admin page's Gemini prompt, adapted to a transcript with supplied metadata.
SYSTEM_PROMPT = (
    "Analyze the supplied YouTube video transcript and extract only stock opinions explicitly expressed by its creator. "
    "Return a single JSON object matching the template below, with no Markdown fences. "
    "The channel and video metadata are supplied by the user message and are authoritative; copy them exactly and never invent missing facts. "
    "The transcript comes from automatic captions or speech recognition, so company names and tickers may be misrecognized; "
    "only output a ticker when you are confident which listed stock the creator means. "
    "Use one opinions entry per stock ticker and combine repeated mentions in the same video. "
    "sentiment must be bullish, bearish, neutral or mixed. direction_score uses -100 to 100 (bearish negative, bullish positive); confidence uses 0 to 1. "
    "Do not infer a directional view from a mere stock mention. "
    "Optional facts that are not stated should be omitted; use empty arrays for missing key_points, risks and price_targets. "
    "Summaries and reasoning should be in Chinese. Price targets require a positive numeric value. "
    "Return no stock opinions that are not present in the video. "
    "Include a Chinese video-level summary in summary, covering macroeconomic or market views when present. "
    "For videos without explicit stock opinions, return opinions: [] and keep the video analysis in summary. "
    "Never invent stock opinions to fill the array.\n\n"
    + json.dumps(_TEMPLATE, ensure_ascii=False, indent=2)
)


class AnalysisError(Exception):
    """The model call failed or returned something that is not an import payload."""


class RunConflict(Exception):
    """Another run is already queued or running."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def _parse_time(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _unique_violation(error: Exception) -> bool:
    return getattr(error, "code", None) == "23505" or "23505" in str(error)


def schedule_clock() -> tuple[time, ZoneInfo]:
    hour, minute = (int(part) for part in settings.YOUTUBE_IMPORT_SCHEDULE_TIME.split(":", 1))
    return time(hour, minute), ZoneInfo(settings.YOUTUBE_IMPORT_TIMEZONE)


def schedule_due(now: datetime) -> Optional[date]:
    """Local date whose scheduled run is due at ``now``, or None before today's run time."""
    at, zone = schedule_clock()
    local = now.astimezone(zone)
    return local.date() if local.time() >= at else None


def next_scheduled_at(now: datetime) -> datetime:
    at, zone = schedule_clock()
    local = now.astimezone(zone)
    candidate = datetime.combine(local.date(), at, tzinfo=zone)
    if candidate <= local:
        candidate = datetime.combine(local.date() + timedelta(days=1), at, tzinfo=zone)
    return candidate


def parse_model_json(content: str) -> Dict[str, Any]:
    text = (content or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise AnalysisError("模型没有返回 JSON 对象。")
    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError as e:
        raise AnalysisError(f"模型返回的 JSON 无法解析：{e.msg}") from e
    if not isinstance(parsed, dict):
        raise AnalysisError("模型返回的不是 JSON 对象。")
    return parsed


def build_payload(
    video: Dict[str, Any], analysis: Dict[str, Any], model: str, analyzed_at: datetime
) -> Dict[str, Any]:
    """Keep the model's analysis but take every identity field from the worker's metadata."""
    channel = {"id": video["channel_id"], "title": video["channel_title"]}
    if video.get("channel_handle"):
        channel["handle"] = video["channel_handle"]
    if video.get("channel_url"):
        channel["url"] = video["channel_url"]
    opinions = analysis.get("opinions")
    if opinions is None:
        opinions = []
    return {
        "channel": channel,
        "video": {
            "id": video["video_id"],
            "title": video["title"],
            "url": f"https://www.youtube.com/watch?v={video['video_id']}",
            "published_at": video["published_at"],
            "analyzed_at": _iso(analyzed_at),
        },
        "model": model,
        "summary": analysis.get("summary") if isinstance(analysis.get("summary"), str) else None,
        "opinions": opinions,
    }


async def analyze_transcript(video: Dict[str, Any], transcript: str, model: str) -> Dict[str, Any]:
    if not settings.DEEPSEEK_API_KEY:
        raise AnalysisError("后端没有配置 DEEPSEEK_API_KEY。")
    metadata = {
        "channel": {
            "id": video["channel_id"],
            "title": video["channel_title"],
            "handle": video.get("channel_handle"),
            "url": video.get("channel_url"),
        },
        "video": {
            "id": video["video_id"],
            "title": video["title"],
            "url": f"https://www.youtube.com/watch?v={video['video_id']}",
            "published_at": video["published_at"],
        },
        "model": model,
    }
    user = (
        "Video metadata (authoritative):\n"
        + json.dumps(metadata, ensure_ascii=False, indent=2)
        + "\n\nTranscript:\n"
        + transcript[:MAX_TRANSCRIPT_CHARS]
    )
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(600, connect=20)) as client:
            response = await client.post(
                DEEPSEEK_URL,
                headers={"Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user},
                    ],
                    "stream": False,
                },
            )
    except httpx.HTTPError as e:
        raise AnalysisError(f"DeepSeek 请求失败：{type(e).__name__}") from e
    if response.status_code != 200:
        try:
            detail = response.json().get("error", {}).get("message") or ""
        except ValueError:
            detail = ""
        raise AnalysisError(
            f"DeepSeek 返回 {response.status_code}{'：' + detail[:200] if detail else ''}"
        )
    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as e:
        raise AnalysisError("DeepSeek 响应格式无法识别。") from e
    return parse_model_json(content)


class YouTubeAutoImportStore:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    # ---------- reads ----------
    def recent_runs(self, limit: int = 10) -> List[Dict[str, Any]]:
        result = (
            self.supabase.table(RUNS)
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        result = self.supabase.table(RUNS).select("*").eq("id", run_id).limit(1).execute()
        return (result.data or [None])[0]

    def _first_with_status(self, status: str) -> Optional[Dict[str, Any]]:
        result = (
            self.supabase.table(RUNS)
            .select("*")
            .eq("status", status)
            .order("created_at")
            .limit(1)
            .execute()
        )
        return (result.data or [None])[0]

    def worker(self) -> Optional[Dict[str, Any]]:
        result = self.supabase.table(WORKER).select("*").eq("id", 1).limit(1).execute()
        return (result.data or [None])[0]

    # ---------- writes ----------
    def create_run(
        self, trigger: str, requested_by: Optional[str] = None, scheduled_for: Optional[date] = None
    ) -> Dict[str, Any]:
        row = {"trigger": trigger, "status": "queued", "requested_by": requested_by}
        if scheduled_for:
            row["scheduled_for"] = scheduled_for.isoformat()
        try:
            result = self.supabase.table(RUNS).insert(row).execute()
        except Exception as e:
            if _unique_violation(e):
                raise RunConflict() from e
            raise
        return result.data[0]

    def _update(
        self, run_id: str, values: Dict[str, Any], status: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        query = self.supabase.table(RUNS).update(values).eq("id", run_id)
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return (result.data or [None])[0]

    def touch_worker(self, now: datetime, hostname: Optional[str], version: Optional[str]) -> None:
        self.supabase.table(WORKER).upsert(
            {"id": 1, "last_seen_at": _iso(now), "hostname": hostname, "version": version}
        ).execute()

    def fail_stale(self, now: datetime) -> None:
        running = self._first_with_status("running")
        if not running:
            return
        seen = _parse_time(running.get("heartbeat_at")) or _parse_time(running.get("started_at"))
        if seen and now - seen > STALE_AFTER:
            self._update(
                running["id"],
                {
                    "status": "failed",
                    "finished_at": _iso(now),
                    "error": "本地 worker 超过 30 分钟没有响应（可能已退出或电脑休眠）。",
                },
                status="running",
            )

    def claim(
        self, now: datetime, hostname: Optional[str] = None, version: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Called by every worker poll: record the heartbeat, enqueue the daily run, hand out work.

        A run already running is returned again so a restarted worker resumes it.
        """
        self.touch_worker(now, hostname, version)
        self.fail_stale(now)
        running = self._first_with_status("running")
        if running:
            return running
        due = schedule_due(now)
        if due:
            try:
                self.create_run("schedule", scheduled_for=due)
            except RunConflict:
                pass  # Already scheduled today, or a manual run is queued.
        queued = self._first_with_status("queued")
        if not queued:
            return None
        return self._update(
            queued["id"],
            {
                "status": "running",
                "started_at": _iso(now),
                "heartbeat_at": _iso(now),
                "model": settings.YOUTUBE_IMPORT_MODEL,
            },
            status="queued",
        )

    def heartbeat(
        self, run_id: str, now: datetime, progress: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        return self._update(
            run_id, {"heartbeat_at": _iso(now), "progress": progress}, status="running"
        )

    def append_video(
        self, run: Dict[str, Any], result: Dict[str, Any], now: datetime
    ) -> Optional[Dict[str, Any]]:
        # Only the single worker writes a run, one video at a time, so read-modify-write is safe.
        videos = [
            item for item in run.get("videos") or [] if item.get("video_id") != result["video_id"]
        ]
        return self._update(
            run["id"], {"videos": [*videos, result], "heartbeat_at": _iso(now)}, status="running"
        )

    def finish(
        self,
        run: Dict[str, Any],
        now: datetime,
        worker_error: Optional[str],
        transcript_failures: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        videos = list(run.get("videos") or [])
        known = {item["video_id"] for item in videos}
        videos += [
            {**item, "status": "transcript_failed"}
            for item in transcript_failures
            if item["video_id"] not in known
        ]
        imported = sum(item.get("status") == "imported" for item in videos)
        failed = sum(item.get("status") != "imported" for item in videos)
        if worker_error or failed:
            status = "partial" if imported else "failed"
        else:
            status = "succeeded"
        return self._update(
            run["id"],
            {"status": status, "finished_at": _iso(now), "videos": videos, "error": worker_error},
            status="running",
        )


async def import_video(
    store: YouTubeAutoImportStore,
    opinions: YouTubeStockOpinionService,
    run: Dict[str, Any],
    video: Dict[str, Any],
    transcript: str,
) -> Dict[str, Any]:
    """Analyze one transcript and import it. Failures are recorded on the run, not raised."""
    model = run.get("model") or settings.YOUTUBE_IMPORT_MODEL
    result: Dict[str, Any] = {
        "video_id": video["video_id"],
        "title": video["title"],
        "channel_title": video["channel_title"],
    }
    try:
        analysis = await analyze_transcript(video, transcript, model)
        payload = build_payload(video, analysis, model, _now())
        # The worker's publish time comes from Kolvex's verified upload coverage; it is the
        # fallback when this server cannot reach YouTube to verify the video itself.
        uploaded = await opinions.upload_import(
            payload,
            uploaded_by=run.get("requested_by"),
            known_publications={video["video_id"]: video["published_at"]},
        )
        tickers = uploaded["videos"][0]["tickers"] if uploaded.get("videos") else []
        result.update(status="imported", tickers=tickers)
    except (AnalysisError, ValueError) as e:
        result.update(status="failed", error=str(e)[:500])
    except Exception:
        logger.exception("YouTube auto import failed for %s", video["video_id"])
        result.update(status="failed", error="导入时出现未知错误，详见后端日志。")
    await asyncio.to_thread(store.append_video, run, result, _now())
    return result


def admin_status(store: YouTubeAutoImportStore, now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or _now()
    worker = store.worker()
    seen = _parse_time(worker.get("last_seen_at")) if worker else None
    at, zone = schedule_clock()
    return {
        "configured": bool(settings.YOUTUBE_IMPORT_WORKER_TOKEN and settings.DEEPSEEK_API_KEY),
        "worker_token_configured": bool(settings.YOUTUBE_IMPORT_WORKER_TOKEN),
        "model_configured": bool(settings.DEEPSEEK_API_KEY),
        "model": settings.YOUTUBE_IMPORT_MODEL,
        "schedule": {
            "time": at.strftime("%H:%M"),
            "timezone": zone.key,
            "next_run_at": _iso(next_scheduled_at(now)),
        },
        "worker": {
            "last_seen_at": _iso(seen) if seen else None,
            "online": bool(seen and now - seen <= WORKER_ONLINE_WITHIN),
            "hostname": worker.get("hostname") if worker else None,
        },
        "runs": store.recent_runs(),
    }
