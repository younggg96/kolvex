"""Builds the Market Risk API payloads from stored observations (M2b).

Observations come from ``market_risk_observations`` (written by the worker and the
backfill script). ``MARKET_RISK_DATA_SOURCE=live`` reads the same public Cboe files
directly instead; it exists for local development before the migration is applied.
The evaluation is cached in-process for ``CACHE_SECONDS``.
"""

import asyncio
import os
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from app.services.market_risk import engine, ingest, repository
from app.services.market_risk.calendar import previous_trading_day
from app.services.market_risk.metrics import METRICS
from app.services.market_risk.worker import target_session

CACHE_SECONDS = 15 * 60
LIVE_START = date(2011, 1, 3)
METRIC_ORDER = ("vix", "vvix", "vix9d", "vix3m", "vix9d_vix_ratio", "vix_vix3m_ratio")
RANGES = {"1M": 21, "3M": 63, "6M": 126, "1Y": 252, "3Y": 756, "MAX": None}


class MarketRiskUnavailable(Exception):
    """The observations could not be read; nothing is shown in their place."""


@dataclass
class Loaded:
    series: engine.Series
    evaluation: engine.Evaluation
    data_source: str
    loaded_at: datetime
    source_errors: dict[str, str] = field(default_factory=dict)


_cache: tuple[float, Loaded] | None = None
_lock = asyncio.Lock()


def data_source() -> str:
    return "live" if os.getenv("MARKET_RISK_DATA_SOURCE", "database") == "live" else "database"


def series_from_observations(observations) -> engine.Series:
    series: engine.Series = {}
    for o in observations:
        series.setdefault(o.metric_key, {})[o.trading_date] = (o.value, o.quality_status)
    return series


async def _load() -> Loaded:
    now = datetime.now(timezone.utc)
    errors: dict[str, str] = {}
    if data_source() == "live":
        report = await ingest.collect(now=now, start=LIVE_START)
        series, errors = series_from_observations(report.observations), report.source_errors
    else:
        from app.core.supabase import get_supabase_service

        series = await asyncio.to_thread(repository.load_series, get_supabase_service())
    evaluation = await asyncio.to_thread(engine.evaluate, series)
    return Loaded(series, evaluation, data_source(), now, errors)


async def get_loaded() -> Loaded:
    global _cache
    async with _lock:
        if _cache and time.monotonic() - _cache[0] < CACHE_SECONDS:
            return _cache[1]
        try:
            loaded = await _load()
        except Exception as exc:
            raise MarketRiskUnavailable(str(exc)) from exc
        _cache = (time.monotonic(), loaded)
        return loaded


def freshness(as_of: date, now: datetime) -> str:
    expected = target_session(now)
    if as_of >= expected:
        return "fresh"
    if as_of >= previous_trading_day(expected):
        return "delayed"
    return "stale"


def _previous(rows: dict[date, tuple[float, str]], day: date) -> tuple[date, float] | None:
    earlier = [d for d in rows if d < day]
    if not earlier:
        return None
    prior = max(earlier)
    return prior, rows[prior][0]


def _metric_row(loaded: Loaded, key: str, day: engine.Day) -> dict:
    metric, rows = METRICS[key], loaded.series.get(key, {})
    component = next((c for c in day.components if c["metric_key"] == key), None)
    value = day.values.get(key)
    prior = _previous(rows, day.trading_date)
    return {
        "metric_key": key,
        "name_en": metric.name_en,
        "name_zh": metric.name_zh,
        "unit": metric.unit,
        "value": value,
        "previous_value": prior[1] if prior else None,
        "previous_date": prior[0] if prior else None,
        "status": engine.metric_status(key, value),
        "bands": engine.STATUS_BANDS.get(key),
        "percentile": component["percentile"] if component else None,
        "weight": component["weight"] if component else None,
        "contribution": component["contribution"] if component else None,
        "quality": None if value is None else ("suspect" if key in day.suspect else "valid"),
        "latest_date": max(rows) if rows else None,
        "source": metric.source,
        "source_symbol": metric.source_symbol,
    }


def _event(event: engine.StageEvent) -> dict:
    return {
        "effective_date": event.effective_date,
        "previous_stage": event.previous,
        "new_stage": event.new,
        "risk_score": event.score,
        "rules": event.rules,
    }


def build_latest(loaded: Loaded, now: datetime) -> dict | None:
    evaluation = loaded.evaluation
    day = evaluation.latest
    if day is None:
        return None
    scored = [d for d in evaluation.days if d.score is not None]
    prior = scored[-2] if len(scored) > 1 else None
    newest = evaluation.days[-1]
    return {
        "model_version": engine.MODEL_VERSION,
        "as_of": day.trading_date,
        "freshness": freshness(day.trading_date, now),
        "data_source": loaded.data_source,
        "loaded_at": loaded.loaded_at,
        # A newer session exists but lacks a key input, so it is not scored.
        "unscored_latest_date": newest.trading_date if newest is not day else None,
        "score": {
            "value": day.score,
            "level": day.level,
            "previous_value": prior.score if prior else None,
            "previous_date": prior.trading_date if prior else None,
            "confidence": day.confidence,
            "coverage": day.coverage,
            "components": day.components,
            "history_window": engine.HISTORY_WINDOW,
            "min_history": engine.MIN_HISTORY,
            "inputs_hash": day.inputs_hash,
        },
        "stage": {
            "current": day.stage,
            "since": day.stage_since,
            "pending": day.pending_stage,
            "pending_sessions": day.pending_sessions,
            "sessions_to_confirm": engine.sessions_to_confirm(day.stage, day.pending_stage)
            if day.pending_stage
            else None,
            "stress_conditions": day.stress,
            "recovery_conditions": day.recovery,
            "peak_score": day.peak_score,
            "rules": {
                "build_up_enter": engine.BUILD_UP_ENTER,
                "build_up_exit": engine.BUILD_UP_EXIT,
                "acceleration_enter": engine.ACCELERATION_ENTER,
                "acceleration_hold": engine.ACCELERATION_HOLD,
                "min_stress_conditions": engine.MIN_STRESS_CONDITIONS,
                "peak_window": engine.PEAK_WINDOW,
                "peak_drop": engine.PEAK_DROP,
                "min_recovery_conditions": engine.MIN_RECOVERY_CONDITIONS,
                "confirm_sessions": engine.CONFIRM_SESSIONS,
                "confirm_normalized_to_stable": engine.CONFIRM_NORMALIZED_TO_STABLE,
            },
        },
        "metrics": [_metric_row(loaded, key, day) for key in METRIC_ORDER],
        "checklist": engine.checklist(evaluation),
        "recent_events": [_event(e) for e in evaluation.events[-8:]][::-1],
        "source_errors": loaded.source_errors,
    }


def build_history(loaded: Loaded, range_key: str) -> dict:
    scored = [d for d in loaded.evaluation.days if d.score is not None]
    sessions = RANGES[range_key]
    points = scored[-sessions:] if sessions else scored
    start = points[0].trading_date if points else None
    return {
        "model_version": engine.MODEL_VERSION,
        "range": range_key,
        "points": [
            {
                "date": d.trading_date,
                "score": d.score,
                "stage": d.stage,
                "vix": d.values.get("vix"),
                "vix9d": d.values.get("vix9d"),
                "vix3m": d.values.get("vix3m"),
            }
            for d in points
        ],
        "events": [
            _event(e)
            for e in loaded.evaluation.events
            if start is not None and e.effective_date >= start
        ],
    }
