"""
Scanner logics (扫描逻辑): the built-in default plus each user's own.

Stored in `strategy_versions`, which is immutable and already referenced by trade plans:
  * a custom logic is a `strategy_key` of the form ``CUSTOM_<12 hex>``;
  * saving an edit inserts the next version (1, 2, 3 …) instead of changing a row, so a plan
    linked to an older version still points at the exact numbers it was made with;
  * deleting marks every version ``retired`` (the plans' links stay valid).
The built-in default is not stored: it is Swing V3.1 in code and cannot be edited or deleted.
"""

import uuid
from typing import Any, Dict, List, Optional

from app.core.supabase import get_supabase_service
from app.services.trade_os.scanner_params import default_params, validate_params
from app.services.trade_os.setup_detection import STRATEGY_VERSION
from app.services.trade_os.strategy_service import compute_canonical_config_hash

CUSTOM_PREFIX = "CUSTOM_"
RETIRED = "retired"
TABLE = "strategy_versions"


class LogicNotFound(LookupError):
    pass


def builtin_logic() -> Dict[str, Any]:
    return {
        "key": "default",
        "name": "Swing V3.1",
        "description": None,
        "version": STRATEGY_VERSION,
        "version_id": None,
        "params": default_params(),
        "builtin": True,
        "updated_at": None,
    }


def _as_logic(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "key": row["strategy_key"],
        "name": row.get("display_name"),
        "description": row.get("description"),
        "version": row.get("version"),
        "version_id": row.get("id"),
        # Rows saved before a parameter existed read it as the default.
        "params": validate_params(row.get("parameters") or {}),
        "builtin": False,
        "updated_at": row.get("created_at"),
    }


def _version_number(row: Dict[str, Any]) -> int:
    try:
        return int(row.get("version") or 0)
    except (TypeError, ValueError):
        return 0


class ScannerLogicService:
    def __init__(self, supabase=None):
        self.supabase = supabase or get_supabase_service()

    def _rows(self, user_id: str, key: Optional[str] = None) -> List[Dict[str, Any]]:
        query = (
            self.supabase.table(TABLE)
            .select("*")
            .eq("user_id", user_id)
            .like("strategy_key", f"{CUSTOM_PREFIX}%")
        )
        if key is not None:
            query = query.eq("strategy_key", key)
        return query.execute().data or []

    def list_logics(self, user_id: str) -> List[Dict[str, Any]]:
        """The default first, then the user's live logics (latest version each), newest first."""
        latest: Dict[str, Dict[str, Any]] = {}
        for row in self._rows(user_id):
            current = latest.get(row["strategy_key"])
            if current is None or _version_number(row) > _version_number(current):
                latest[row["strategy_key"]] = row
        custom = [
            _as_logic(row)
            for row in sorted(
                latest.values(), key=lambda r: str(r.get("created_at") or ""), reverse=True
            )
            if row.get("status") != RETIRED
        ]
        return [builtin_logic(), *custom]

    def get_logic(self, user_id: str, key: str) -> Dict[str, Any]:
        if key == "default":
            return builtin_logic()
        if not key.startswith(CUSTOM_PREFIX):
            raise LogicNotFound(key)
        rows = self._rows(user_id, key)
        if not rows:
            raise LogicNotFound(key)
        row = max(rows, key=_version_number)
        if row.get("status") == RETIRED:
            raise LogicNotFound(key)
        return _as_logic(row)

    def _insert(
        self,
        user_id: str,
        key: str,
        version: int,
        name: str,
        description: Optional[str],
        params: Dict[str, float],
    ) -> Dict[str, Any]:
        config = {
            "strategy_key": key,
            "version": str(version),
            "parameters": params,
            "entry_rules": [],
            "exit_rules": [],
            "risk_rules": {},
        }
        payload = {
            "user_id": user_id,
            "strategy_key": key,
            "version": str(version),
            "display_name": name,
            "description": description,
            # A user's own numbers are research until they have been backtested.
            "status": "draft",
            "parameters": params,
            "entry_rules": [],
            "exit_rules": [],
            "risk_rules": {},
            "config_hash": compute_canonical_config_hash(config),
        }
        res = self.supabase.table(TABLE).insert(payload).execute()
        if not res.data:
            raise RuntimeError("Failed to save scanner logic")
        return _as_logic(res.data[0])

    def create_logic(
        self,
        user_id: str,
        name: str,
        params: Optional[Dict[str, Any]],
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        key = f"{CUSTOM_PREFIX}{uuid.uuid4().hex[:12].upper()}"
        return self._insert(user_id, key, 1, name, description, validate_params(params))

    def update_logic(
        self,
        user_id: str,
        key: str,
        name: str,
        params: Optional[Dict[str, Any]],
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Saves an edit as the next version; earlier versions stay as they were."""
        current = self.get_logic(user_id, key)
        if current["builtin"]:
            raise LogicNotFound(key)
        clean = validate_params(params)
        return self._insert(user_id, key, int(current["version"]) + 1, name, description, clean)

    def delete_logic(self, user_id: str, key: str) -> None:
        """Retires every version; trade plans linked to one keep their reference."""
        if self.get_logic(user_id, key)["builtin"]:  # unknown / deleted raise here too
            raise LogicNotFound(key)
        (
            self.supabase.table(TABLE)
            .update({"status": RETIRED})
            .eq("user_id", user_id)
            .eq("strategy_key", key)
            .execute()
        )
