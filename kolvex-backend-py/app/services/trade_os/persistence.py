"""Small write helper shared by the market regime and scanner stores."""

import logging
from typing import Any, Dict, Iterable, Optional

logger = logging.getLogger(__name__)


def save_row(
    table: str,
    row: Dict[str, Any],
    legacy_keys: Iterable[str],
    on_conflict: Optional[str] = None,
) -> bool:
    """
    Writes ``row``. With ``on_conflict`` an existing row for the same key is kept
    untouched (history is never overwritten). If the newer columns don't exist yet
    (migration not applied), falls back to the original columns. Returns success.
    """
    from app.core.supabase import get_supabase_service

    client = get_supabase_service()
    if not client:
        return False
    try:
        if on_conflict:
            client.table(table).upsert(
                row, on_conflict=on_conflict, ignore_duplicates=True
            ).execute()
        else:
            client.table(table).insert(row).execute()
        return True
    except Exception as err:  # noqa: BLE001
        logger.warning("Full write to %s failed (%s); retrying with original columns", table, err)
    try:
        client.table(table).insert({k: row[k] for k in legacy_keys if k in row}).execute()
        return True
    except Exception as err:  # noqa: BLE001
        logger.warning("Could not persist to %s: %s", table, err)
        return False
