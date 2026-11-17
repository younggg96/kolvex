"""The Superinvestors coverage list: admin-edited rows in `institution_managers`.

`manager_registry` behaves like the old read-only `MANAGERS` dict ({id: {"cik", "name"}}) over the
enabled rows, so callers iterate and index it unchanged. Each refresh swaps in a new snapshot rather
than mutating one, so a loop over the registry never sees it change mid-iteration. Until the table
has been read once, or whenever it cannot be read, the built-in list below is served.
"""

import asyncio
import logging
import os
import re
from collections.abc import Mapping

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)
TABLE = "institution_managers"
CATEGORIES = ("classic", "chinese", "value", "activist", "growth", "other")
ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,39}$")
FIELDS = (
    "id",
    "cik",
    "name",
    "zh_name",
    "person_en",
    "person_zh",
    "role_en",
    "role_zh",
    "category",
    "enabled",
    "sort_order",
    "created_at",
    "updated_at",
)
REFRESH_INTERVAL = int(os.getenv("INSTITUTION_MANAGERS_REFRESH_SECONDS", "300"))

# Fallback only; the table (seeded with the same rows) is the source of truth.
BUILTIN = {
    "berkshire": {"cik": 1067983, "name": "Berkshire Hathaway"},
    "bridgewater": {"cik": 1350694, "name": "Bridgewater Associates"},
    "pershing": {"cik": 1336528, "name": "Pershing Square"},
    "duquesne": {"cik": 1536411, "name": "Duquesne Family Office"},
    "appaloosa": {"cik": 1656456, "name": "Appaloosa"},
    "baupost": {"cik": 1061768, "name": "Baupost Group"},
    "tiger": {"cik": 1167483, "name": "Tiger Global"},
    "third_point": {"cik": 1040273, "name": "Third Point"},
    "oaktree": {"cik": 949509, "name": "Oaktree Capital"},
    "renaissance": {"cik": 1037389, "name": "Renaissance Technologies"},
    # Managers Chinese-speaking investors follow closely.
    "duan_yongping": {"cik": 1759760, "name": "H&H International Investment"},
    "himalaya": {"cik": 1709323, "name": "Himalaya Capital"},
    "hhlr": {"cik": 1762304, "name": "HHLR Advisors"},
    "greenwoods": {"cik": 1848138, "name": "Greenwoods Asset Management"},
    "temasek": {"cik": 1021944, "name": "Temasek Holdings"},
    # Value investors.
    "pabrai": {"cik": 1549575, "name": "Dalal Street (Pabrai)"},
    "markel": {"cik": 1096343, "name": "Markel Group"},
    "fairfax": {"cik": 915191, "name": "Fairfax Financial"},
    "akre": {"cik": 1112520, "name": "Akre Capital Management"},
    "gardner_russo": {"cik": 860643, "name": "Gardner Russo & Quinn"},
    "ruane": {"cik": 1720792, "name": "Ruane, Cunniff & Goldfarb"},
    "fundsmith": {"cik": 1569205, "name": "Fundsmith"},
    # Activists.
    "icahn": {"cik": 921669, "name": "Carl Icahn"},
    "elliott": {"cik": 1791786, "name": "Elliott Investment Management"},
    "trian": {"cik": 1345471, "name": "Trian Fund Management"},
    "valueact": {"cik": 1418814, "name": "ValueAct Capital"},
    "starboard": {"cik": 1517137, "name": "Starboard Value"},
    # Growth and technology.
    "ark": {"cik": 1697748, "name": "ARK Invest"},
    "coatue": {"cik": 1135730, "name": "Coatue Management"},
    "lone_pine": {"cik": 1061165, "name": "Lone Pine Capital"},
    "altimeter": {"cik": 1541617, "name": "Altimeter Capital"},
    # Other.
    "soros": {"cik": 1029160, "name": "Soros Fund Management"},
    "gates": {"cik": 1166559, "name": "Gates Foundation Trust"},
}


class TablesMissing(Exception):
    """The migration that creates `institution_managers` has not been applied."""


class ManagersRepository:
    """Thin, synchronous Supabase access, kept apart so the registry is testable without a database."""

    def __init__(self, db=None):
        self._db = db

    @property
    def db(self):
        return self._db or get_supabase_service()

    def _run(self, query):
        try:
            return query.execute().data
        except Exception as exc:
            # PostgREST "table not in schema cache".
            if "PGRST205" in str(exc):
                raise TablesMissing() from exc
            raise

    def all(self):
        return self._run(
            self.db.table(TABLE).select(",".join(FIELDS)).order("sort_order").order("id")
        )

    def find(self, manager_id=None, cik=None):
        query = self.db.table(TABLE).select(",".join(FIELDS))
        query = query.eq("id", manager_id) if manager_id is not None else query.eq("cik", cik)
        rows = self._run(query.limit(1))
        return rows[0] if rows else None

    def insert(self, row):
        return self._run(self.db.table(TABLE).insert(row))[0]

    def update(self, manager_id, values):
        rows = self._run(self.db.table(TABLE).update(values).eq("id", manager_id))
        return rows[0] if rows else None


def profile(row):
    """The frontend's InvestorProfile shape, or None when the row has no Chinese name yet."""
    if not row.get("zh_name"):
        return None

    def pair(en, zh):
        return {"en": row.get(en) or row.get(zh) or "", "zh": row.get(zh) or row.get(en) or ""}

    return {
        "zhName": row["zh_name"],
        "person": pair("person_en", "person_zh"),
        "role": pair("role_en", "role_zh"),
    }


class ManagerRegistry(Mapping):
    def __init__(self, repo=None, fallback=BUILTIN):
        self.repo = repo or ManagersRepository()
        self._identities = dict(fallback)
        self._rows = {}
        self.source = "builtin"

    # Mapping over enabled managers: {id: {"cik", "name"}}, in display order.
    def __getitem__(self, manager_id):
        return self._identities[manager_id]

    def __iter__(self):
        return iter(list(self._identities))

    def __len__(self):
        return len(self._identities)

    def public_list(self):
        rows = self._rows
        return [
            {
                "id": key,
                **value,
                "category": rows.get(key, {}).get("category"),
                "profile": profile(rows.get(key, {})),
            }
            for key, value in self._identities.items()
        ]

    def load(self, rows):
        enabled = [r for r in rows if r.get("enabled")]
        self._rows = {r["id"]: r for r in enabled}
        self._identities = {r["id"]: {"cik": int(r["cik"]), "name": r["name"]} for r in enabled}
        self.source = "database"

    def refresh(self):
        """Reads the table; on any failure keeps serving the last good snapshot (or the built-in list)."""
        try:
            self.load(self.repo.all())
            return True
        except Exception:
            logger.warning(
                "Institution managers table unavailable; serving %s list",
                self.source,
                exc_info=True,
            )
            return False

    async def run_refresher(self, interval=REFRESH_INTERVAL):
        while True:
            await asyncio.to_thread(self.refresh)
            await asyncio.sleep(interval)


manager_registry = ManagerRegistry()
