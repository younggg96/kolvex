"""Remove a single account from a user's portfolio.

Manual accounts are simply deleted. Plaid accounts are deleted and their Plaid
``account_id`` is remembered on the connection so later syncs skip them; a
disconnect (which deletes the connection) clears that list again.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)

MIGRATION_HINT = "20261118010000_portfolio_removed_accounts.sql"


class AccountNotFound(LookupError):
    """The account does not exist or does not belong to the user."""


class AccountRemovalUnavailable(RuntimeError):
    """The database cannot remember removed accounts yet (migration not applied)."""


class AccountRemovalService:
    def __init__(self, supabase=None):
        self.supabase = supabase or get_supabase_service()

    async def remove_account(self, user_id: str, account_row_id: str) -> Dict[str, Any]:
        return await asyncio.to_thread(self._remove, user_id, account_row_id)

    def _remove(self, user_id: str, account_row_id: str) -> Dict[str, Any]:
        connections = (
            self.supabase.table("portfolio_connections")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        ).data or []
        by_id = {c["id"]: c for c in connections}
        if not by_id:
            raise AccountNotFound(account_row_id)

        account = self._find_account(account_row_id, list(by_id))
        if account is None:
            raise AccountNotFound(account_row_id)
        connection = by_id[account["connection_id"]]

        if connection.get("provider") == "plaid":
            if "removed_account_ids" not in connection:
                raise AccountRemovalUnavailable(MIGRATION_HINT)
            removed = list(connection.get("removed_account_ids") or [])
            if account["account_id"] not in removed:
                removed.append(account["account_id"])
            self.supabase.table("portfolio_connections").update(
                {"removed_account_ids": removed}
            ).eq("id", connection["id"]).execute()
            self.supabase.table("plaid_investment_transactions").delete().eq("user_id", user_id).eq(
                "account_id", account["account_id"]
            ).execute()

        # Positions go with the account (ON DELETE CASCADE).
        self.supabase.table("portfolio_accounts").delete().eq("id", account["id"]).execute()
        self._forget_hidden_account(connections, account["id"])
        return {"success": True, "account_id": account["id"]}

    def _find_account(self, account_row_id: str, connection_ids: list) -> Optional[Dict[str, Any]]:
        result = (
            self.supabase.table("portfolio_accounts")
            .select("id,account_id,connection_id")
            .eq("id", account_row_id)
            .in_("connection_id", connection_ids)
            .limit(1)
            .execute()
        )
        return (result.data or [None])[0]

    def _forget_hidden_account(self, connections: list, account_row_id: str) -> None:
        for connection in connections:
            settings = connection.get("privacy_settings") or {}
            hidden = settings.get("hidden_accounts") or []
            if account_row_id not in hidden:
                continue
            settings = {
                **settings,
                "hidden_accounts": [a for a in hidden if a != account_row_id],
            }
            self.supabase.table("portfolio_connections").update({"privacy_settings": settings}).eq(
                "id", connection["id"]
            ).execute()


def get_account_removal_service() -> AccountRemovalService:
    return AccountRemovalService()
