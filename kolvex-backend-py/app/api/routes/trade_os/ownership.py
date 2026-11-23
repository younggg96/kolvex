"""Shared ownership checks for Trade OS routes keyed by account or trade group id.

The service-role client bypasses RLS, so every route that takes an id from the
request must confirm the signed-in user owns it before reading or writing.
"""

import asyncio

from fastapi import Depends, HTTPException, status

from app.api.dependencies.auth import get_current_user_id
from app.services.trade_os.account_service import AccountService


def _not_found(what: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found")


async def require_owned_account(
    account_id: str, user_id: str = Depends(get_current_user_id)
) -> str:
    """Path dependency: 404 unless ``account_id`` belongs to the caller. Returns the user id."""
    account = await asyncio.to_thread(AccountService().get_account, user_id, account_id)
    if not account:
        raise _not_found("Account")
    return user_id


async def ensure_owned_trade_group(trade_group_id: str, user_id: str) -> None:
    """404 unless the trade group's account belongs to ``user_id``."""

    def lookup():
        service = AccountService()
        rows = (
            service.supabase.table("trade_groups")
            .select("account_id")
            .eq("id", trade_group_id)
            .limit(1)
            .execute()
            .data
        )
        return bool(rows) and service.get_account(user_id, rows[0]["account_id"]) is not None

    if not await asyncio.to_thread(lookup):
        raise _not_found("Trade group")
