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
