"""
Trade OS Account & Equity Service

Handles account lifecycle, equity snapshots, and account-level queries.
Uses get_supabase_service() for backend operations.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.core.supabase import get_supabase_service
from app.services.trade_os.decimal_utils import d

logger = logging.getLogger(__name__)


class AccountService:
    def __init__(self, supabase=None):
        self.supabase = supabase or get_supabase_service()

    def create_account(
        self,
        user_id: str,
        broker: str = "manual",
        account_name: str = "Primary",
        account_type: str = "manual",
        initial_equity: Optional[Decimal] = None,
        execution_capability: str = "manual",
    ) -> Dict[str, Any]:
        """Create a new trading account and record initial equity snapshot if supplied."""
        initial_eq_val = float(d(initial_equity)) if initial_equity is not None else None
        data = {
            "user_id": user_id,
            "broker": broker,
            "account_name": account_name,
            "account_type": account_type,
            "initial_equity": initial_eq_val,
            "connection_status": "active",
            "execution_capability": execution_capability,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        res = self.supabase.table("trading_accounts").insert(data).execute()
        if not res.data:
            raise RuntimeError("Failed to create trading account")

        account = res.data[0]

        # Record initial equity snapshot if given
        if initial_equity is not None:
            self.record_equity_snapshot(
                user_id=user_id,
                account_id=account["id"],
                net_liquidation_value=initial_equity,
                cash_balance=initial_equity,
                source="initial_setup",
                quality_status="confirmed",
            )

        return account

    def get_accounts(self, user_id: str) -> List[Dict[str, Any]]:
        """List all trading accounts for a user."""
        res = (
            self.supabase.table("trading_accounts")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []

    def get_account(self, user_id: str, account_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a specific account owned by the user."""
        res = (
            self.supabase.table("trading_accounts")
            .select("*")
            .eq("id", account_id)
            .eq("user_id", user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def update_account(
        self,
        user_id: str,
        account_id: str,
        updates: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Update trading account settings."""
        allowed_fields = {
            "account_name",
            "connection_status",
            "execution_capability",
            "last_synced_at",
        }
        payload = {k: v for k, v in updates.items() if k in allowed_fields}
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = (
            self.supabase.table("trading_accounts")
            .update(payload)
            .eq("id", account_id)
            .eq("user_id", user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def record_equity_snapshot(
        self,
        user_id: str,
        account_id: str,
        net_liquidation_value: Any,
        cash_balance: Optional[Any] = None,
        securities_value: Optional[Any] = None,
        margin_debit: Optional[Any] = None,
        buying_power: Optional[Any] = None,
        snapshot_at: Optional[datetime] = None,
        source: str = "manual",
        quality_status: str = "unverified",
    ) -> Dict[str, Any]:
        """Record or upsert an equity snapshot."""
        at = snapshot_at or datetime.now(timezone.utc)
        payload = {
            "account_id": account_id,
            "user_id": user_id,
            "snapshot_at": at.isoformat(),
            "net_liquidation_value": float(d(net_liquidation_value)),
            "cash_balance": float(d(cash_balance)) if cash_balance is not None else None,
            "securities_value": float(d(securities_value))
            if securities_value is not None
            else None,
            "margin_debit": float(d(margin_debit)) if margin_debit is not None else 0.0,
            "buying_power": float(d(buying_power)) if buying_power is not None else None,
            "source": source,
            "quality_status": quality_status,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        res = (
            self.supabase.table("equity_snapshots")
            .upsert(payload, on_conflict="account_id,snapshot_at,source")
            .execute()
        )
        return res.data[0] if res.data else payload

    def get_equity_history(
        self,
        user_id: str,
        account_id: str,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Retrieve historical equity snapshots."""
        res = (
            self.supabase.table("equity_snapshots")
            .select("*")
            .eq("account_id", account_id)
            .eq("user_id", user_id)
            .order("snapshot_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []

    def get_latest_equity(
        self,
        user_id: str,
        account_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Retrieve the latest equity snapshot for an account."""
        history = self.get_equity_history(user_id, account_id, limit=1)
        return history[0] if history else None
