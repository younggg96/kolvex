"""Runs and schedules the options-activity report.

Three runs per US trading day (ET): pre-market 09:00 (prior session's volume
plus refreshed open interest), intraday 12:30 and after close 16:20.
"""

import asyncio
import logging
from collections import Counter
from datetime import datetime, time, timedelta, timezone
from typing import Optional
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.core.redis import get_redis
from app.core.supabase import get_supabase_service
from app.services.options_activity import store
from app.services.options_activity.aggregate import build_report, candidate_pool
from app.services.options_activity.candidates import generate_candidates
from app.services.options_activity.collector import OptionsActivityCollector
from app.services.options_activity.summary import summarize

logger = logging.getLogger(__name__)
NY = ZoneInfo("America/New_York")
SESSIONS: dict[str, time] = {"pre": time(9, 0), "intraday": time(12, 30), "post": time(16, 20)}
LEASE_KEY = "options_activity:run"
LEASE_TTL = 15 * 60
RETRY_AFTER = timedelta(minutes=15)
MAX_ATTEMPTS = 3
POLL_SECONDS = 60


def due_session(now: datetime) -> Optional[str]:
    """The latest session whose start time has passed today (ET), on weekdays."""
    local = now.astimezone(NY)
    if local.weekday() >= 5:
        return None
    due = [name for name, start in SESSIONS.items() if local.time() >= start]
    return due[-1] if due else None


def _data_date(scans: list[dict]) -> Optional[str]:
    dates = Counter(s["stock"].get("bar_date") for s in scans if s["stock"].get("bar_date"))
    return dates.most_common(1)[0][0] if dates else None


class OptionsActivityService:
    def __init__(self, collector: Optional[OptionsActivityCollector] = None, db_factory=get_supabase_service, llm=None, candidates_llm=None):
        self.collector = collector or OptionsActivityCollector()
        self._db_factory = db_factory
        self._llm = llm
        self._candidates_llm = candidates_llm
        self._lock = asyncio.Lock()

    async def run(self, session: str, now: Optional[datetime] = None, force: bool = False) -> dict:
        """Scan, aggregate, summarize and save one run. Returns {status, ...}."""
        if session not in SESSIONS:
            raise ValueError(f"unknown session {session}")
        now = now or datetime.now(timezone.utc)
        today = now.astimezone(NY).date()
        db = self._db_factory()

        scans, failed = await self.collector.scan(today)
        if not scans:
            raise RuntimeError(f"options activity scan returned no data ({len(failed)} symbols failed)")
        data_date = _data_date(scans)
        base = {"trade_date": today.isoformat(), "session": session, "run_at": now.isoformat(), "data_date": data_date,
                "universe_size": len(scans), "failed_symbols": failed}

        # Holidays: intraday/after-close runs see no bar for today; a pre-market run repeats the last session.
        holiday = data_date != today.isoformat() if session != "pre" else await store.has_data_date(db, "pre", data_date)
        if holiday and not force:
            await store.save(db, {**base, "status": "skipped", "payload": {}, "summary": None})
            logger.info("Options activity %s %s skipped: market closed (data_date=%s)", today, session, data_date)
            return {"status": "skipped", "data_date": data_date}

        history = await store.recent_payloads(db, session, today)
        report = build_report(scans, history, today)
        summary, candidates = await asyncio.gather(
            summarize(report, session, data_date, llm=self._llm),
            generate_candidates(report, session, data_date, llm=self._candidates_llm),
        )
        saved = await store.save(db, {
            **base,
            "status": "ok",
            "payload": report,
            "summary": {**summary, "candidates": candidates},
            "model_id": summary.get("model_id"),
            "prompt_version": summary.get("prompt_version"),
        })
        logger.info("Options activity %s %s saved: %d symbols, %d failed", today, session, len(scans), len(failed))
        return {"status": "ok", "id": saved.get("id"), "data_date": data_date, "failed_symbols": failed}

    async def analyze_latest(self) -> dict:
        """Regenerates the AI candidates of the newest saved run. A failed attempt keeps a good earlier list."""
        db = self._db_factory()
        run = await store.get_run(db)
        if not run:
            raise LookupError("no_runs")
        report = run["payload"]
        if "candidate_contracts" not in report:  # Saved before the pool existed.
            report = {**report, "candidate_contracts": candidate_pool(report.get("contracts") or [])}
        fresh = await generate_candidates(report, run["session"], run.get("data_date"), llm=self._candidates_llm)
        summary = run.get("summary") or {}
        if fresh["status"] == "ok" or (summary.get("candidates") or {}).get("status") != "ok":
            await store.update_summary(db, run["id"], {**summary, "candidates": fresh})
        return {"status": fresh["status"], "reason": fresh.get("reason"), "count": len(fresh["items"])}

    async def tick(self, now: Optional[datetime] = None) -> Optional[dict]:
        """One scheduler step: run the due session once, retrying failures a bounded number of times."""
        if not self.collector.configured:
            return None
        now = now or datetime.now(timezone.utc)
        session = due_session(now)
        if session is None:
            return None
        today = now.astimezone(NY).date()
        if self._lock.locked():
            return None
        async with self._lock:
            if await store.existing(self._db_factory(), today, session):
                return None
            redis = get_redis()
            attempts_key = f"options_activity:attempts:{today.isoformat()}:{session}"
            attempts = await redis.get_json(attempts_key) or {"count": 0, "retry_at": None}
            if attempts["count"] >= MAX_ATTEMPTS or (attempts["retry_at"] and now.isoformat() < attempts["retry_at"]):
                return None
            token = uuid4().hex
            if redis.is_connected and not await redis.acquire_lock(LEASE_KEY, token, ttl=LEASE_TTL):
                return None
            try:
                return await self.run(session, now)
            except Exception as exc:
                attempts = {"count": attempts["count"] + 1, "retry_at": (now + RETRY_AFTER).isoformat()}
                await redis.set_json(attempts_key, attempts, ttl=24 * 3600)
                logger.warning("Options activity %s %s failed (attempt %d): %s", today, session, attempts["count"], exc)
                return {"status": "failed", "error": str(exc)}
            finally:
                if redis.is_connected:
                    await redis.release_lock(LEASE_KEY, token)


options_activity_service = OptionsActivityService()
_manual_runs: set[asyncio.Task] = set()
# Last admin-triggered run in this process, shown on the admin tab.
manual_state: dict = {"session": None, "status": "idle", "started_at": None, "finished_at": None, "error": None, "result": None}
analysis_state: dict = {"status": "idle", "started_at": None, "finished_at": None, "error": None, "result": None}


def manual_run_in_progress() -> bool:
    return any(not task.done() for task in _manual_runs)


def start_manual_run(session: str, force: bool = True) -> bool:
    """Admin trigger. Returns False when a run is already in progress in this process."""
    if manual_run_in_progress():
        return False
    manual_state.update(session=session, status="running", started_at=datetime.now(timezone.utc).isoformat(),
                        finished_at=None, error=None, result=None)

    async def runner():
        try:
            result = await options_activity_service.run(session, force=force)
            manual_state.update(status="done", result=result)
        except Exception as exc:
            logger.exception("Manual options activity run failed")
            manual_state.update(status="failed", error=str(exc)[:500])
        finally:
            manual_state["finished_at"] = datetime.now(timezone.utc).isoformat()

    task = asyncio.create_task(runner())
    _manual_runs.add(task)
    task.add_done_callback(_manual_runs.discard)
    return True


def start_analysis() -> bool:
    """Admin trigger. Shares the manual-run slot so a new report cannot replace the one being analyzed."""
    if manual_run_in_progress():
        return False
    analysis_state.update(status="running", started_at=datetime.now(timezone.utc).isoformat(),
                          finished_at=None, error=None, result=None)

    async def runner():
        try:
            analysis_state.update(status="done", result=await options_activity_service.analyze_latest())
        except Exception as exc:
            logger.exception("Options activity AI analysis failed")
            analysis_state.update(status="failed", error=str(exc)[:500])
        finally:
            analysis_state["finished_at"] = datetime.now(timezone.utc).isoformat()

    task = asyncio.create_task(runner())
    _manual_runs.add(task)
    task.add_done_callback(_manual_runs.discard)
    return True


async def run_options_activity_worker() -> None:
    while True:
        try:
            await options_activity_service.tick()
        except Exception:
            logger.warning("Options activity worker tick failed", exc_info=True)
        await asyncio.sleep(POLL_SECONDS)
