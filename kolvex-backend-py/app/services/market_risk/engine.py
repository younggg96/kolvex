"""Market Risk Monitor model v1.0: stress score, risk stage machine and checklist (M2).

Everything here is pure and deterministic: the same observations give the same result.
The model is versioned in code; a change to any constant below needs a new
``MODEL_VERSION``. Each day only uses that day's values and earlier history.

Score: each component's value is ranked against its own previous ``HISTORY_WINDOW``
valid sessions (at least ``MIN_HISTORY``); the score is the weighted mean of those
percentiles. v1.0 has no put/call or tail-risk input (see technical-review.md §3), so
the PRD weights for volatility level, vol-of-vol and term structure (25/20/25) are
used as they are and renormalised over 70.
"""

import hashlib
import json
from bisect import bisect_left, bisect_right, insort
from collections import deque
from dataclasses import dataclass, field
from datetime import date

MODEL_VERSION = "v1.0"


@dataclass(frozen=True)
class Component:
    metric_key: str
    dimension: str
    weight: int


COMPONENTS = (
    Component("vix", "volatility_level", 25),
    Component("vvix", "volatility_of_volatility", 20),
    Component("vix_vix3m_ratio", "term_structure", 15),
    Component("vix9d_vix_ratio", "term_structure", 10),
)
TOTAL_WEIGHT = sum(c.weight for c in COMPONENTS)
# A day without every key input gets no score (PRD §7.4).
KEY_METRICS = ("vix", "vvix", "vix9d", "vix3m")
HISTORY_WINDOW = 756
MIN_HISTORY = 252
FULL_COVERAGE = 0.95
PARTIAL_COVERAGE = 0.80

LEVELS = ((40, "low"), (60, "moderate"), (75, "elevated"), (90, "high"))

STABLE = "stable"
BUILD_UP = "stress_build_up"
ACCELERATION = "stress_acceleration"
NORMALIZATION = "post_stress_normalization"
STAGES = (STABLE, BUILD_UP, ACCELERATION, NORMALIZATION)

# Stage rules (PRD §8.1; numbers the PRD left open are set here, see README).
BUILD_UP_ENTER = 60
BUILD_UP_EXIT = 55
ACCELERATION_ENTER = 75
ACCELERATION_HOLD = 70
MIN_STRESS_CONDITIONS = 2
PEAK_WINDOW = 20
PEAK_DROP = 15
MIN_RECOVERY_CONDITIONS = 2
CONFIRM_SESSIONS = 2
CONFIRM_NORMALIZED_TO_STABLE = 5

# (key, metric, comparison, threshold)
STRESS_CONDITIONS = (
    ("vix_above_28", "vix", ">", 28.0),
    ("vvix_above_110", "vvix", ">", 110.0),
    ("vix9d_vix_above_1", "vix9d_vix_ratio", ">", 1.0),
    ("vix_vix3m_above_1", "vix_vix3m_ratio", ">", 1.0),
)
RECOVERY_CONDITIONS = (
    ("vvix_below_110", "vvix", "<", 110.0),
    ("vix_vix3m_below_1", "vix_vix3m_ratio", "<", 1.0),
    ("vix9d_vix_below_1", "vix9d_vix_ratio", "<", 1.0),
)

# Display bands only (PRD §6.3 for VIX / VVIX; ratios set here). Not used in the score.
STATUS_BANDS = {
    "vix": (20.0, 28.0, 35.0),
    "vvix": (100.0, 110.0, 120.0),
    "vix9d_vix_ratio": (0.95, 1.0, 1.1),
    "vix_vix3m_ratio": (0.95, 1.0, 1.1),
}
STATUSES = ("normal", "watch", "elevated", "critical")

Series = dict[str, dict[date, tuple[float, str]]]  # metric -> date -> (value, quality_status)


@dataclass
class Day:
    trading_date: date
    values: dict[str, float]
    suspect: tuple[str, ...]
    score: float | None = None
    level: str | None = None
    confidence: str = "insufficient_coverage"
    coverage: float = 0.0
    components: list[dict] = field(default_factory=list)
    stress: dict[str, bool | None] = field(default_factory=dict)
    recovery: dict[str, bool | None] = field(default_factory=dict)
    peak_score: float | None = None
    stage: str | None = None
    stage_since: date | None = None
    pending_stage: str | None = None
    pending_sessions: int = 0
    inputs_hash: str = ""


@dataclass
class StageEvent:
    effective_date: date
    previous: str | None
    new: str
    score: float | None
    rules: list[str]


@dataclass
class Evaluation:
    days: list[Day]
    events: list[StageEvent]

    @property
    def latest(self) -> Day | None:
        """Most recent day with a published score."""
        return next((d for d in reversed(self.days) if d.score is not None), None)


def risk_level(score: float) -> str:
    return next((name for bound, name in LEVELS if score < bound), "extreme")


def metric_status(metric_key: str, value: float | None) -> str | None:
    bands = STATUS_BANDS.get(metric_key)
    if bands is None or value is None:
        return None
    return STATUSES[sum(value >= b for b in bands)]


def percentile_rank(value: float, sorted_history: list[float]) -> float:
    below = bisect_left(sorted_history, value)
    equal = bisect_right(sorted_history, value) - below
    return 100.0 * (below + 0.5 * equal) / len(sorted_history)


def _check(values: dict[str, float], metric: str, op: str, threshold: float) -> bool | None:
    value = values.get(metric)
    if value is None:
        return None
    return value > threshold if op == ">" else value < threshold


def _inputs_hash(day: date, values: dict[str, float]) -> str:
    payload = {"model": MODEL_VERSION, "date": day.isoformat()}
    payload.update({k: values.get(k) for k in sorted(KEY_METRICS)})
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def candidate_stage(
    current: str, score: float, stress_count: int, recovery_count: int, peak: float
) -> str:
    """Stage the rules point to today, given the confirmed ``current`` stage."""
    if score >= ACCELERATION_ENTER and stress_count >= MIN_STRESS_CONDITIONS:
        return ACCELERATION
    if (
        current == ACCELERATION
        and score >= ACCELERATION_HOLD
        and stress_count >= MIN_STRESS_CONDITIONS
    ):
        return ACCELERATION
    recovering = peak - score >= PEAK_DROP and recovery_count >= MIN_RECOVERY_CONDITIONS
    if current in (BUILD_UP, ACCELERATION) and recovering:
        return NORMALIZATION
    if current == NORMALIZATION:
        # Stress building again: back to build-up rather than "recovering" at a high score.
        if score >= ACCELERATION_ENTER or (
            recovery_count < MIN_RECOVERY_CONDITIONS and score >= BUILD_UP_ENTER
        ):
            return BUILD_UP
        if recovery_count >= MIN_RECOVERY_CONDITIONS and score < BUILD_UP_ENTER:
            return STABLE
        return NORMALIZATION
    if current == ACCELERATION:
        return BUILD_UP
    if current == BUILD_UP:
        return BUILD_UP if score >= BUILD_UP_EXIT else STABLE
    return BUILD_UP if score >= BUILD_UP_ENTER else STABLE


def sessions_to_confirm(current: str, target: str) -> int:
    if current == NORMALIZATION and target == STABLE:
        return CONFIRM_NORMALIZED_TO_STABLE
    return CONFIRM_SESSIONS


def stage_reasons(day: Day) -> list[str]:
    return [key for key, met in day.stress.items() if met] + [
        key for key, met in day.recovery.items() if met
    ]


def evaluate(series: Series) -> Evaluation:
    """Score every session and run the stage machine over the full history."""
    dates = sorted(set().union(*(series.get(k, {}).keys() for k in KEY_METRICS)))
    windows = {c.metric_key: (deque(), []) for c in COMPONENTS}  # (in order, sorted)
    days: list[Day] = []
    events: list[StageEvent] = []
    recent_scores: deque[float] = deque(maxlen=PEAK_WINDOW)
    stage: str | None = None
    since: date | None = None
    pending: str | None = None
    pending_count = 0

    for day in dates:
        values, suspect = {}, []
        for key, rows in series.items():
            if day in rows:
                values[key] = rows[day][0]
                if rows[day][1] != "valid":
                    suspect.append(key)
        result = Day(day, values, tuple(sorted(suspect)))
        result.inputs_hash = _inputs_hash(day, values)
        result.stress = {k: _check(values, m, op, t) for k, m, op, t in STRESS_CONDITIONS}
        result.recovery = {k: _check(values, m, op, t) for k, m, op, t in RECOVERY_CONDITIONS}

        _score(result, windows)
        # History only gains the day after it was scored: no look-ahead.
        for c in COMPONENTS:
            if c.metric_key in values:
                ordered, ranked = windows[c.metric_key]
                ordered.append(values[c.metric_key])
                insort(ranked, values[c.metric_key])
                if len(ordered) > HISTORY_WINDOW:
                    ranked.pop(bisect_left(ranked, ordered.popleft()))

        if result.score is not None:
            recent_scores.append(result.score)
            result.peak_score = max(recent_scores)
            stress_count = sum(bool(v) for v in result.stress.values())
            recovery_count = sum(bool(v) for v in result.recovery.values())
            if stage is None:
                target = candidate_stage(STABLE, result.score, stress_count, recovery_count, 0)
                stage, since = target, day
                events.append(StageEvent(day, None, target, result.score, stage_reasons(result)))
            else:
                target = candidate_stage(
                    stage, result.score, stress_count, recovery_count, result.peak_score
                )
                if target == stage:
                    pending, pending_count = None, 0
                else:
                    pending_count = pending_count + 1 if target == pending else 1
                    pending = target
                    if pending_count >= sessions_to_confirm(stage, target):
                        events.append(
                            StageEvent(day, stage, target, result.score, stage_reasons(result))
                        )
                        stage, since, pending, pending_count = target, day, None, 0
        else:
            # Missing or unscored data keeps the confirmed stage; confirmation restarts.
            pending, pending_count = None, 0
        result.stage, result.stage_since = stage, since
        result.pending_stage, result.pending_sessions = pending, pending_count
        days.append(result)
    return Evaluation(days, events)


def _score(day: Day, windows) -> None:
    if any(k not in day.values for k in KEY_METRICS):
        day.confidence = "insufficient_coverage"
        return
    available = []
    for c in COMPONENTS:
        ordered, ranked = windows[c.metric_key]
        value = day.values.get(c.metric_key)
        if value is None or len(ranked) < MIN_HISTORY:
            continue
        available.append((c, value, percentile_rank(value, ranked), len(ranked)))
    coverage = sum(c.weight for c, *_ in available) / TOTAL_WEIGHT
    day.coverage = round(coverage, 4)
    if coverage < PARTIAL_COVERAGE:
        day.confidence = "insufficient_history"
        return
    weight = sum(c.weight for c, *_ in available)
    for c, value, pct, size in available:
        day.components.append(
            {
                "metric_key": c.metric_key,
                "dimension": c.dimension,
                "weight": round(c.weight / TOTAL_WEIGHT, 4),
                "value": value,
                "percentile": round(pct, 2),
                "contribution": round(pct * c.weight / weight, 2),
                "history_size": size,
            }
        )
    day.score = round(sum(x["contribution"] for x in day.components), 1)
    day.level = risk_level(day.score)
    day.confidence = "complete" if coverage >= FULL_COVERAGE else "partial"


# Checklist (PRD §9). Each rule reads one scored day; P/C and dealer rules wait for data.
CHECKLIST = (
    ("RISK-001", "escalation", lambda d: _all(d.stress, "vix_above_28", "vvix_above_110")),
    ("RISK-002", "escalation", lambda d: d.stress.get("vix_vix3m_above_1")),
    ("RISK-003", "escalation", lambda d: d.stress.get("vix9d_vix_above_1")),
    ("RISK-004", "escalation", None),
    ("RECOVERY-001", "recovery", lambda d: d.recovery.get("vvix_below_110")),
    ("RECOVERY-002", "recovery", lambda d: d.recovery.get("vix_vix3m_below_1")),
    ("RECOVERY-003", "recovery", lambda d: d.recovery.get("vix9d_vix_below_1")),
    (
        "RECOVERY-004",
        "recovery",
        lambda d: None
        if d.score is None or d.peak_score is None
        else d.peak_score - d.score >= PEAK_DROP,
    ),
)


def _all(values: dict[str, bool | None], *keys: str) -> bool | None:
    flags = [values.get(k) for k in keys]
    return None if any(f is None for f in flags) else all(flags)


def checklist(evaluation: Evaluation) -> list[dict]:
    """Status of each rule on the latest scored day, with when its current run began."""
    scored = [d for d in evaluation.days if d.score is not None]
    if not scored:
        return []
    latest = scored[-1]
    items = []
    for key, rule_type, rule in CHECKLIST:
        item = {"rule_key": key, "rule_type": rule_type, "evaluated_on": latest.trading_date}
        if rule is None:
            items.append({**item, "status": "disabled", "first_triggered_on": None})
            continue
        met = rule(latest)
        if met is None:
            items.append({**item, "status": "insufficient_data", "first_triggered_on": None})
            continue
        if not met:
            items.append({**item, "status": "not_triggered", "first_triggered_on": None})
            continue
        start, run = latest.trading_date, 0
        for d in reversed(scored):
            if not rule(d):
                break
            start, run = d.trading_date, run + 1
        status = "triggered" if run >= CONFIRM_SESSIONS else "pending_confirmation"
        items.append({**item, "status": status, "first_triggered_on": start})
    return items
