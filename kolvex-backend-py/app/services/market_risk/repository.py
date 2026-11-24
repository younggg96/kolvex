"""Persistence for market-risk observations and ingestion runs (service-role client).

``plan_observation_rows`` is pure: it decides which rows to insert so that unchanged
values are skipped and provider corrections become new revisions instead of overwrites.
"""

from datetime import date, datetime, timezone

from app.services.market_risk.metrics import MARKET
from app.services.market_risk.quality import DECIMALS, Observation
from supabase import Client

OBSERVATIONS = "market_risk_observations"
RUNS = "market_risk_ingestion_runs"
PAGE = 1000
BATCH = 500

Key = tuple[str, str, date]  # (metric_key, source, trading_date)


def revision_label(retrieved_at: datetime) -> str:
    return "r" + retrieved_at.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def plan_observation_rows(
    observations: list[Observation],
    latest: dict[Key, float],
    retrieved_at: datetime,
    run_id: str | None,
) -> list[dict]:
    """Rows to insert. ``latest`` maps each stored key to its latest stored value."""
    rows = []
    for o in observations:
        key = (o.metric_key, o.source, o.trading_date)
        stored = latest.get(key)
        if stored is not None and round(stored, DECIMALS) == round(o.value, DECIMALS):
            continue
        rows.append(
            {
                "market": MARKET,
                "metric_key": o.metric_key,
                "value": o.value,
                "trading_date": o.trading_date.isoformat(),
                "observation_time": o.observation_time.isoformat(),
                "retrieved_at": retrieved_at.isoformat(),
                "source": o.source,
                "source_symbol": o.source_symbol,
                "source_revision": "initial" if stored is None else revision_label(retrieved_at),
                "quality_status": o.quality_status,
                "quality_flags": list(o.quality_flags),
                "is_estimated": False,
                "ingestion_run_id": run_id,
            }
        )
    return rows


def load_latest_values(db: Client, metric_keys: list[str], since: date | None) -> dict[Key, float]:
    """Latest stored value per (metric, source, date); later revisions win."""
    latest: dict[Key, tuple[str, float]] = {}
    offset = 0
    while True:
        query = (
            db.table(OBSERVATIONS)
            .select("metric_key,source,trading_date,value,retrieved_at")
            .eq("market", MARKET)
            .in_("metric_key", metric_keys)
        )
        if since:
            query = query.gte("trading_date", since.isoformat())
        rows = query.order("id").range(offset, offset + PAGE - 1).execute().data
        for row in rows:
            key = (row["metric_key"], row["source"], date.fromisoformat(row["trading_date"]))
            if key not in latest or row["retrieved_at"] > latest[key][0]:
                latest[key] = (row["retrieved_at"], float(row["value"]))
        if len(rows) < PAGE:
            break
        offset += PAGE
    return {key: value for key, (_, value) in latest.items()}


def insert_observations(db: Client, rows: list[dict]) -> int:
    for start in range(0, len(rows), BATCH):
        db.table(OBSERVATIONS).insert(rows[start : start + BATCH], returning="minimal").execute()
    return len(rows)


def start_run(db: Client, data_source: str, job_type: str) -> str:
    row = {"data_source": data_source, "job_type": job_type, "status": "running"}
    return db.table(RUNS).insert(row).execute().data[0]["id"]


def finish_run(db: Client, run_id: str, **fields) -> None:
    fields["finished_at"] = datetime.now(timezone.utc).isoformat()
    db.table(RUNS).update(fields).eq("id", run_id).execute()


def load_series(db: Client) -> dict[str, dict[date, tuple[float, str]]]:
    """Every metric's latest-revision value and quality per trading date."""
    from app.services.market_risk.metrics import METRICS

    latest: dict[tuple[str, date], tuple[str, float, str]] = {}
    offset = 0
    while True:
        rows = (
            db.table(OBSERVATIONS)
            .select("metric_key,source,trading_date,value,quality_status,retrieved_at")
            .eq("market", MARKET)
            .in_("metric_key", list(METRICS))
            .order("id")
            .range(offset, offset + PAGE - 1)
            .execute()
            .data
        )
        for row in rows:
            if METRICS[row["metric_key"]].source != row["source"]:
                continue
            key = (row["metric_key"], date.fromisoformat(row["trading_date"]))
            if key not in latest or row["retrieved_at"] > latest[key][0]:
                latest[key] = (row["retrieved_at"], float(row["value"]), row["quality_status"])
        if len(rows) < PAGE:
            break
        offset += PAGE
    series: dict[str, dict[date, tuple[float, str]]] = {}
    for (metric_key, day), (_, value, quality) in latest.items():
        series.setdefault(metric_key, {})[day] = (value, quality)
    return series


SNAPSHOTS = "market_risk_snapshots"
SIGNALS = "market_risk_signals"
REGIME_EVENTS = "market_risk_regime_events"


def plan_snapshot(day, existing: list[dict], freshness: str) -> dict | None:
    """Snapshot row for ``day``, or None when one with the same inputs is stored.

    Published snapshots are never edited: changed inputs get the next revision.
    """
    from app.services.market_risk.engine import MODEL_VERSION

    if any(row["inputs_hash"] == day.inputs_hash for row in existing):
        return None
    revision = max((row["snapshot_revision"] for row in existing), default=0) + 1
    return {
        "market": MARKET,
        "trading_date": day.trading_date.isoformat(),
        "snapshot_revision": revision,
        "model_version": MODEL_VERSION,
        "risk_score": day.score,
        "risk_level": day.level,
        "regime": day.stage,
        "score_components_json": {"components": day.components},
        "data_coverage": day.coverage,
        "confidence_status": day.confidence,
        "quality_status": freshness,
        "is_complete": day.confidence == "complete",
        "inputs_hash": day.inputs_hash,
    }


def store_snapshot(db: Client, evaluation, freshness: str) -> str | None:
    """Insert the latest scored day's snapshot, its checklist and any stage change."""
    from app.services.market_risk import engine

    day = evaluation.latest
    if day is None:
        return None
    existing = (
        db.table(SNAPSHOTS)
        .select("id,snapshot_revision,inputs_hash")
        .eq("market", MARKET)
        .eq("trading_date", day.trading_date.isoformat())
        .eq("model_version", engine.MODEL_VERSION)
        .execute()
        .data
    )
    row = plan_snapshot(day, existing, freshness)
    if row is None:
        return None
    snapshot_id = db.table(SNAPSHOTS).insert(row).execute().data[0]["id"]
    signals = [
        {
            "snapshot_id": snapshot_id,
            "rule_key": item["rule_key"],
            "rule_version": engine.MODEL_VERSION,
            "rule_type": item["rule_type"],
            "status": item["status"],
            "observed_values_json": {k: day.values.get(k) for k in engine.KEY_METRICS},
        }
        for item in engine.checklist(evaluation)
    ]
    if signals:
        db.table(SIGNALS).insert(signals, returning="minimal").execute()
    for event in evaluation.events:
        if event.effective_date == day.trading_date:
            db.table(REGIME_EVENTS).insert(
                {
                    "market": MARKET,
                    "previous_regime": event.previous,
                    "new_regime": event.new,
                    "effective_date": event.effective_date.isoformat(),
                    "effective_at": datetime.now(timezone.utc).isoformat(),
                    "risk_score": event.score,
                    "model_version": engine.MODEL_VERSION,
                    "snapshot_id": snapshot_id,
                    "triggered_rules_json": event.rules,
                },
                returning="minimal",
            ).execute()
    return snapshot_id
