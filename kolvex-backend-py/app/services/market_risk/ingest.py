"""Daily market-risk ingestion: fetch → parse → validate → align → derive → store.

Used by the backfill script now and by the scheduled worker (M1b) later. A failed
source never blocks the others; it is reported, and nothing is filled in for it.
"""

import asyncio
import logging
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

import httpx

from app.services.market_risk import repository, sources
from app.services.market_risk.calendar import latest_completed_trading_day
from app.services.market_risk.metrics import FRED_CROSS_CHECK, OBSERVED, MetricDefinition
from app.services.market_risk.quality import (
    Issue,
    Observation,
    SeriesResult,
    cross_check,
    derive_ratios,
    validate_series,
)

logger = logging.getLogger(__name__)
DATA_SOURCE = "cboe"
SAMPLE_LIMIT = 20


@dataclass
class IngestReport:
    expected_through: date
    retrieved_at: datetime
    series: dict[str, SeriesResult] = field(default_factory=dict)
    source_errors: dict[str, str] = field(default_factory=dict)
    cross_check_errors: dict[str, str] = field(default_factory=dict)
    cross_check_issues: list[Issue] = field(default_factory=list)
    observations: list[Observation] = field(default_factory=list)
    rows_written: int = 0

    @property
    def status(self) -> str:
        if len(self.source_errors) == len(OBSERVED):
            return "failed"
        latest_missing = any(
            self.expected_through in result.missing_days for result in self.series.values()
        )
        return "partial" if self.source_errors or latest_missing else "succeeded"

    def summary(self) -> dict:
        """Compact, JSON-safe summary for ``issues_json`` and script output."""
        metrics = {}
        for key, result in self.series.items():
            rejected = Counter(issue.code for issue in result.rejected)
            metrics[key] = {
                "fetched": result.fetched,
                "accepted": len(result.accepted),
                "suspect": sum(o.quality_status == "suspect" for o in result.accepted),
                "skipped_non_trading_day": len(result.skipped),
                "rejected": dict(rejected),
                "rejected_samples": [
                    {"date": str(i.trading_date), "code": i.code, "detail": i.detail}
                    for i in result.rejected[:SAMPLE_LIMIT]
                ],
                "missing_days": len(result.missing_days),
                "missing_samples": [str(d) for d in result.missing_days[-SAMPLE_LIMIT:]],
                "first_date": str(result.accepted[0].trading_date) if result.accepted else None,
                "last_date": str(result.accepted[-1].trading_date) if result.accepted else None,
            }
        return {
            "status": self.status,
            "expected_through": str(self.expected_through),
            "metrics": metrics,
            "source_errors": self.source_errors,
            "cross_check_errors": self.cross_check_errors,
            "cross_check_mismatches": [
                {"metric": i.metric_key, "date": str(i.trading_date), "detail": i.detail}
                for i in self.cross_check_issues[:SAMPLE_LIMIT]
            ],
            "cross_check_mismatch_count": len(self.cross_check_issues),
        }


async def _fetch_metric(client: httpx.AsyncClient, metric: MetricDefinition):
    return await sources.fetch_cboe_history(client, metric.source_symbol)


async def _fetch_reference(client: httpx.AsyncClient, series_id: str):
    return await sources.fetch_fred_series(client, series_id)


async def collect(
    now: datetime | None = None,
    start: date | None = None,
    client: httpx.AsyncClient | None = None,
) -> IngestReport:
    """Fetch and validate every V1 metric; no database access."""
    now = now or datetime.now(timezone.utc)
    report = IngestReport(expected_through=latest_completed_trading_day(now), retrieved_at=now)
    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=sources.TIMEOUT)
    try:
        primary = await asyncio.gather(
            *(_fetch_metric(client, m) for m in OBSERVED), return_exceptions=True
        )
        references = await asyncio.gather(
            *(_fetch_reference(client, sid) for sid in FRED_CROSS_CHECK.values()),
            return_exceptions=True,
        )
    finally:
        if owns_client:
            await client.aclose()

    reference_by_metric = dict(zip(FRED_CROSS_CHECK, references))
    observed: dict[str, list[Observation]] = {}
    for metric, points in zip(OBSERVED, primary):
        if isinstance(points, BaseException):
            logger.warning("market_risk fetch failed for %s: %s", metric.key, points)
            report.source_errors[metric.key] = f"{type(points).__name__}: {points}"[:300]
            continue
        result = validate_series(metric, points, report.expected_through, start)
        reference = reference_by_metric.get(metric.key)
        if isinstance(reference, BaseException):
            report.cross_check_errors[metric.key] = f"{type(reference).__name__}: {reference}"[:300]
        elif reference is not None:
            result.accepted, issues = cross_check(result.accepted, reference, "fred")
            report.cross_check_issues.extend(issues)
        report.series[metric.key] = result
        observed[metric.key] = result.accepted

    derived = derive_ratios(observed)
    report.observations = [o for rows in observed.values() for o in rows]
    report.observations += [o for rows in derived.values() for o in rows]
    return report


def store(db, report: IngestReport, job_type: str, since: date | None) -> IngestReport:
    """Insert new and corrected observations and record the ingestion run."""
    run_id = repository.start_run(db, DATA_SOURCE, job_type)
    try:
        keys = sorted({o.metric_key for o in report.observations})
        latest = repository.load_latest_values(db, keys, since) if keys else {}
        rows = repository.plan_observation_rows(
            report.observations, latest, report.retrieved_at, run_id
        )
        report.rows_written = repository.insert_observations(db, rows)
    except Exception as exc:
        repository.finish_run(db, run_id, status="failed", error_message=str(exc)[:1000])
        raise
    accepted = sum(len(r.accepted) for r in report.series.values())
    rejected = sum(len(r.rejected) for r in report.series.values())
    repository.finish_run(
        db,
        run_id,
        status=report.status,
        records_fetched=sum(r.fetched for r in report.series.values()),
        records_valid=accepted,
        records_rejected=rejected,
        records_written=report.rows_written,
        issues_json=report.summary(),
        error_message="; ".join(f"{k}: {v}" for k, v in report.source_errors.items()) or None,
    )
    return report
