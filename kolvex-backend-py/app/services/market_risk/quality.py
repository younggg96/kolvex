"""Validation, normalization and alignment of daily metric series.

Every provider row ends up in exactly one bucket: accepted (``valid`` or ``suspect``),
skipped (not a market trading day), or rejected (with a reason). Nothing is filled in.
"""

import math
from collections import defaultdict
from dataclasses import dataclass, field, replace
from datetime import date

from app.services.market_risk.calendar import is_trading_day, session_close_utc, trading_days
from app.services.market_risk.metrics import METRICS, MetricDefinition
from app.services.market_risk.sources import RawPoint

# A one-day move this large (log ratio ≈ 60%) against both neighbours, reverting next day.
SPIKE_LOG_RATIO = math.log(1.6)
# Cboe and FRED publish the same official close; anything beyond rounding is a mismatch.
CROSS_CHECK_TOLERANCE = 0.011
DECIMALS = 6


@dataclass(frozen=True)
class Observation:
    metric_key: str
    source: str
    source_symbol: str
    trading_date: date
    value: float
    observation_time: object  # datetime (UTC)
    quality_status: str = "valid"
    quality_flags: tuple[str, ...] = ()


@dataclass(frozen=True)
class Issue:
    metric_key: str
    code: str
    trading_date: date | None = None
    detail: str = ""


@dataclass
class SeriesResult:
    metric_key: str
    fetched: int = 0
    accepted: list[Observation] = field(default_factory=list)
    skipped: list[Issue] = field(default_factory=list)
    rejected: list[Issue] = field(default_factory=list)
    missing_days: list[date] = field(default_factory=list)


def _flag(observation: Observation, flag: str) -> Observation:
    if flag in observation.quality_flags:
        return observation
    return replace(
        observation, quality_status="suspect", quality_flags=(*observation.quality_flags, flag)
    )


def validate_series(
    metric: MetricDefinition,
    points: list[RawPoint],
    expected_through: date,
    start: date | None = None,
) -> SeriesResult:
    """Validate one provider series.

    ``expected_through`` is the latest trading day whose value should already be
    published; trading days up to it without a value are reported as missing.
    """
    result = SeriesResult(metric.key)
    points = [p for p in points if start is None or p.trading_date >= start]
    result.fetched = len(points)

    by_date: dict[date, list[RawPoint]] = defaultdict(list)
    for point in points:
        by_date[point.trading_date].append(point)

    for day in sorted(by_date):
        rows = by_date[day]
        if day > expected_through:
            result.rejected.append(Issue(metric.key, "not_final", day))
            continue
        if not is_trading_day(day):
            result.skipped.append(Issue(metric.key, "non_trading_day", day))
            continue
        values = {round(p.value, DECIMALS) if p.value is not None else None for p in rows}
        if len(values) > 1:
            result.rejected.append(
                Issue(
                    metric.key, "conflicting_duplicate", day, f"values={sorted(map(str, values))}"
                )
            )
            continue
        value = rows[0].value
        if value is None:
            result.rejected.append(Issue(metric.key, "null_value", day))
            continue
        if not metric.lower_bound <= value <= metric.upper_bound:
            result.rejected.append(
                Issue(
                    metric.key,
                    "out_of_range",
                    day,
                    f"{value} not in [{metric.lower_bound}, {metric.upper_bound}]",
                )
            )
            continue
        result.accepted.append(
            Observation(
                metric_key=metric.key,
                source=metric.source,
                source_symbol=metric.source_symbol,
                trading_date=day,
                value=round(value, DECIMALS),
                observation_time=session_close_utc(day, metric.close_time),
            )
        )

    result.accepted = _flag_spikes(result.accepted)
    if result.accepted:
        present = {o.trading_date for o in result.accepted}
        first = result.accepted[0].trading_date
        result.missing_days = [d for d in trading_days(first, expected_through) if d not in present]
    return result


def _flag_spikes(series: list[Observation]) -> list[Observation]:
    """Flag single-day spikes that move sharply away from both neighbours in the same direction."""
    flagged = list(series)
    for i in range(1, len(series) - 1):
        prev_v, cur_v, next_v = series[i - 1].value, series[i].value, series[i + 1].value
        up, down = math.log(cur_v / prev_v), math.log(cur_v / next_v)
        if abs(up) > SPIKE_LOG_RATIO and abs(down) > SPIKE_LOG_RATIO and (up > 0) == (down > 0):
            flagged[i] = _flag(series[i], "spike")
    return flagged


def cross_check(
    primary: list[Observation], reference: list[RawPoint], reference_name: str
) -> tuple[list[Observation], list[Issue]]:
    """Flag primary values that differ from a second source on the same trading date."""
    ref = {p.trading_date: p.value for p in reference if p.value is not None}
    checked, issues = [], []
    for observation in primary:
        other = ref.get(observation.trading_date)
        if other is not None and abs(other - observation.value) > CROSS_CHECK_TOLERANCE:
            observation = _flag(observation, f"mismatch_{reference_name}")
            issues.append(
                Issue(
                    observation.metric_key,
                    "source_mismatch",
                    observation.trading_date,
                    f"{observation.source}={observation.value} {reference_name}={other}",
                )
            )
        checked.append(observation)
    return checked, issues


def derive_ratios(observed: dict[str, list[Observation]]) -> dict[str, list[Observation]]:
    """Compute ratio metrics only where both inputs exist for the same trading date."""
    derived = {}
    for metric in METRICS.values():
        if not metric.inputs:
            continue
        numerator, denominator = (
            {o.trading_date: o for o in observed.get(key, [])} for key in metric.inputs
        )
        rows = []
        for day in sorted(numerator.keys() & denominator.keys()):
            top, bottom = numerator[day], denominator[day]
            value = round(top.value / bottom.value, DECIMALS)
            flags = tuple(
                f"input_{key}_suspect"
                for key, o in zip(metric.inputs, (top, bottom))
                if o.quality_status != "valid"
            )
            if not metric.lower_bound <= value <= metric.upper_bound:
                flags += ("out_of_range",)
            rows.append(
                Observation(
                    metric_key=metric.key,
                    source=metric.source,
                    source_symbol=metric.source_symbol,
                    trading_date=day,
                    value=value,
                    observation_time=max(top.observation_time, bottom.observation_time),
                    quality_status="suspect" if flags else "valid",
                    quality_flags=flags,
                )
            )
        derived[metric.key] = rows
    return derived
