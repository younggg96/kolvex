"""Write validated xhs-daily.v2 days. Shared by the admin import and the local collector."""

from datetime import datetime, timezone

TABLE = "xhs_daily_sentiment"
RECORD_KEYS = ("date_pt", "captured_at", "sample", "sentiment", "topics", "rumors", "limitations")


def records_for(days: list[dict], imported_by: str | None) -> list[dict]:
    """imported_by is the admin's user id, or None for the automatic collector."""
    imported_at = datetime.now(timezone.utc).isoformat()
    return [
        {
            **{key: day[key] for key in RECORD_KEYS},
            "imported_by": imported_by,
            "imported_at": imported_at,
        }
        for day in days
    ]


def upsert_days(db, days: list[dict], imported_by: str | None) -> None:
    """One upsert statement: Postgres writes every day or none."""
    db.table(TABLE).upsert(
        records_for(days, imported_by), on_conflict="date_pt", returning="minimal"
    ).execute()
