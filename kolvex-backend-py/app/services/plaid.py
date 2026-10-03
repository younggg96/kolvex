"""Plaid Investments integration service."""

import base64
import hashlib
import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from cryptography.fernet import Fernet

from app.core.config import settings
from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)

PLAID_BASE_URLS = {
    "sandbox": "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production": "https://production.plaid.com",
}

PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID", "")
PLAID_SECRET = os.getenv("PLAID_SECRET", "")
PLAID_ENV = os.getenv("PLAID_ENV", "sandbox")
PLAID_CLIENT_NAME = os.getenv("PLAID_CLIENT_NAME", "Kolvex")
PLAID_REDIRECT_URI = os.getenv("PLAID_REDIRECT_URI", "")
PLAID_WEBHOOK_URL = os.getenv("PLAID_WEBHOOK_URL", "")


class PlaidConfigurationError(Exception):
    """Raised when Plaid credentials are missing."""


class PlaidApiError(Exception):
    """Raised when Plaid returns an error response."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


def _safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _first_present(*values: Any) -> Optional[str]:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


class PlaidService:
    def __init__(self, supabase=None):
        self.supabase = supabase or get_supabase_service()
        digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
        self.cipher = Fernet(base64.urlsafe_b64encode(digest))
        self.base_url = PLAID_BASE_URLS.get(PLAID_ENV, PLAID_BASE_URLS["sandbox"])

    def _require_config(self) -> None:
        if not PLAID_CLIENT_ID or not PLAID_SECRET:
            raise PlaidConfigurationError("Plaid credentials are not configured")

    async def _post(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        self._require_config()
        request_payload = {
            "client_id": PLAID_CLIENT_ID,
            "secret": PLAID_SECRET,
            **payload,
        }
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(f"{self.base_url}{endpoint}", json=request_payload)

        data = response.json() if response.content else {}
        if response.status_code >= 400:
            message = (
                data.get("display_message")
                or data.get("error_message")
                or data.get("error_code")
                or "Plaid request failed"
            )
            raise PlaidApiError(message, response.status_code)
        return data

    def _encrypt(self, token: str) -> str:
        return self.cipher.encrypt(token.encode("utf-8")).decode("ascii")

    def _decrypt(self, token: str) -> str:
        return self.cipher.decrypt(token.encode("ascii")).decode("utf-8")

    async def create_link_token(self, user_id: str) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "user": {"client_user_id": user_id},
            "client_name": PLAID_CLIENT_NAME,
            "products": ["investments"],
            "country_codes": ["US"],
            "language": "en",
        }
        if PLAID_REDIRECT_URI:
            payload["redirect_uri"] = PLAID_REDIRECT_URI
        if PLAID_WEBHOOK_URL:
            payload["webhook"] = PLAID_WEBHOOK_URL

        data = await self._post("/link/token/create", payload)
        return {
            "link_token": data["link_token"],
            "expiration": data.get("expiration"),
        }

    async def exchange_public_token(
        self,
        user_id: str,
        public_token: str,
        institution: Optional[Dict[str, Any]] = None,
        accounts: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        data = await self._post(
            "/item/public_token/exchange",
            {"public_token": public_token},
        )
        access_token = data["access_token"]
        item_id = data["item_id"]
        institution_name = (institution or {}).get("name")
        institution_id = (institution or {}).get("institution_id")

        row = {
            "user_id": user_id,
            "item_id": item_id,
            "access_token_encrypted": self._encrypt(access_token),
            "institution_id": institution_id,
            "institution_name": institution_name,
            "accounts": accounts or [],
            "is_connected": True,
            "last_error": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self.supabase.table("plaid_items").upsert(
            row, on_conflict="user_id,item_id"
        ).execute()
        await self._ensure_portfolio_connection(user_id, mark_synced=False)
        return {
            "success": True,
            "institution_name": institution_name,
            "accounts_count": len(accounts or []),
        }

    async def status(self, user_id: str) -> Dict[str, Any]:
        items = (
            self.supabase.table("plaid_items")
            .select("id,institution_name,is_connected,last_synced_at,item_id")
            .eq("user_id", user_id)
            .eq("is_connected", True)
            .execute()
        )
        connection = await self._get_portfolio_connection(user_id)
        accounts_count = 0
        holdings_count = 0
        if connection:
            accounts = (
                self.supabase.table("portfolio_accounts")
                .select("id", count="exact")
                .eq("connection_id", connection["id"])
                .execute()
            )
            accounts_count = accounts.count or 0
            account_ids = [row["id"] for row in (accounts.data or [])]
            if account_ids:
                holdings_count = (
                    self.supabase.table("portfolio_positions")
                    .select("id", count="exact")
                    .in_("account_id", account_ids)
                    .execute()
                    .count
                    or 0
                )

        transactions_count = (
            self.supabase.table("plaid_investment_transactions")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
            .count
            or 0
        )
        first_item = (items.data or [None])[0]
        return {
            "is_connected": bool(items.data),
            "last_synced_at": (connection or {}).get("last_synced_at")
            or (first_item or {}).get("last_synced_at"),
            "accounts_count": accounts_count,
            "holdings_count": holdings_count,
            "transactions_count": transactions_count,
            "institution_name": (first_item or {}).get("institution_name"),
            "item_id": (first_item or {}).get("item_id"),
        }

    async def sync(self, user_id: str) -> Dict[str, Any]:
        items = (
            self.supabase.table("plaid_items")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_connected", True)
            .execute()
        )
        if not items.data:
            raise ValueError("Plaid is not connected")

        connection = await self._ensure_portfolio_connection(user_id, mark_synced=False)
        accounts_count = 0
        holdings_count = 0
        transactions_count = 0
        last_error = None

        for item in items.data:
            try:
                access_token = self._decrypt(item["access_token_encrypted"])
                holdings = await self._post(
                    "/investments/holdings/get",
                    {"access_token": access_token},
                )
                synced_account_ids = await self._sync_holdings(
                    connection["id"], item, holdings
                )
                accounts_count += len(synced_account_ids)
                holdings_count += len(holdings.get("holdings", []))
                tx_count = await self._sync_transactions(user_id, item, access_token)
                transactions_count += tx_count
                now = datetime.now(timezone.utc).isoformat()
                self.supabase.table("plaid_items").update(
                    {"last_synced_at": now, "last_error": None}
                ).eq("id", item["id"]).execute()
            except Exception as error:
                last_error = str(error)
                logger.exception("Failed to sync Plaid item %s", item.get("item_id"))
                self.supabase.table("plaid_items").update(
                    {"last_error": last_error[:1000], "is_connected": False}
                ).eq("id", item["id"]).execute()

        now = datetime.now(timezone.utc).isoformat()
        self.supabase.table("portfolio_connections").update(
            {"is_connected": True, "last_synced_at": now, "updated_at": now}
        ).eq("id", connection["id"]).execute()

        if last_error and accounts_count == 0 and holdings_count == 0:
            raise PlaidApiError(last_error)

        return {
            "success": True,
            "accounts_count": accounts_count,
            "holdings_count": holdings_count,
            "transactions_count": transactions_count,
            "last_synced_at": now,
        }

    async def transactions(
        self,
        user_id: str,
        limit: int = 100,
        offset: int = 0,
        symbol: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = (
            self.supabase.table("plaid_investment_transactions")
            .select("*", count="exact")
            .eq("user_id", user_id)
        )
        if symbol:
            query = query.eq("symbol", symbol.strip().upper())
        result = (
            query.order("date", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        rows = result.data or []
        return {
            "transactions": rows,
            "total": result.count or len(rows),
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < (result.count or len(rows)),
        }

    async def disconnect(self, user_id: str) -> Dict[str, Any]:
        self.supabase.table("plaid_items").delete().eq("user_id", user_id).execute()
        self.supabase.table("plaid_investment_transactions").delete().eq(
            "user_id", user_id
        ).execute()
        connection = await self._get_portfolio_connection(user_id)
        if connection:
            self.supabase.table("portfolio_connections").delete().eq(
                "id", connection["id"]
            ).execute()
        return {"success": True, "message": "Plaid Investments disconnected"}

    async def _get_portfolio_connection(self, user_id: str) -> Optional[Dict[str, Any]]:
        result = (
            self.supabase.table("portfolio_connections")
            .select("*")
            .eq("user_id", user_id)
            .eq("provider", "plaid")
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    async def _ensure_portfolio_connection(
        self, user_id: str, mark_synced: bool = True
    ) -> Dict[str, Any]:
        existing = await self._get_portfolio_connection(user_id)
        now = datetime.now(timezone.utc).isoformat()
        if existing:
            updates = {"is_connected": True, "updated_at": now}
            if mark_synced:
                updates["last_synced_at"] = now
            self.supabase.table("portfolio_connections").update(updates).eq(
                "id", existing["id"]
            ).execute()
            return {**existing, **updates}

        data = {
            "user_id": user_id,
            "provider": "plaid",
            "is_connected": True,
            "is_public": False,
            "last_synced_at": now if mark_synced else None,
        }
        created = self.supabase.table("portfolio_connections").insert(data).execute()
        if not created.data:
            raise Exception("Failed to create Plaid portfolio connection")
        return created.data[0]

    async def _sync_holdings(
        self,
        connection_id: str,
        item: Dict[str, Any],
        payload: Dict[str, Any],
    ) -> List[str]:
        securities = {
            security.get("security_id"): security
            for security in payload.get("securities", [])
            if security.get("security_id")
        }
        holdings_by_account: Dict[str, List[Dict[str, Any]]] = {}
        for holding in payload.get("holdings", []):
            holdings_by_account.setdefault(holding.get("account_id"), []).append(holding)

        synced_account_row_ids: List[str] = []
        for account in payload.get("accounts", []):
            plaid_account_id = account.get("account_id")
            if not plaid_account_id:
                continue
            account_row = self._upsert_account(connection_id, item, account)
            synced_account_row_ids.append(account_row["id"])
            self._sync_account_positions(
                account_row["id"],
                holdings_by_account.get(plaid_account_id, []),
                securities,
            )
        return synced_account_row_ids

    def _upsert_account(
        self,
        connection_id: str,
        item: Dict[str, Any],
        account: Dict[str, Any],
    ) -> Dict[str, Any]:
        data = {
            "connection_id": connection_id,
            "account_id": account["account_id"],
            "brokerage_name": item.get("institution_name") or "Plaid",
            "account_name": account.get("name") or account.get("official_name") or "Investment Account",
            "account_number": account.get("mask"),
            "account_type": account.get("subtype") or account.get("type") or "investment",
        }
        result = (
            self.supabase.table("portfolio_accounts")
            .upsert(data, on_conflict="connection_id,account_id")
            .execute()
        )
        if not result.data:
            raise Exception("Failed to upsert Plaid account")
        return result.data[0]

    def _sync_account_positions(
        self,
        account_row_id: str,
        holdings: List[Dict[str, Any]],
        securities: Dict[str, Dict[str, Any]],
    ) -> None:
        synced_keys = set()
        for holding in holdings:
            security = securities.get(holding.get("security_id"), {})
            symbol = _first_present(
                security.get("ticker_symbol"),
                security.get("cusip"),
                security.get("isin"),
                holding.get("security_id"),
            )
            if not symbol:
                continue
            position_type = (
                "option"
                if str(security.get("type") or "").lower() in {"option", "derivative"}
                else "equity"
            )
            quantity = _safe_float(holding.get("quantity")) or 0
            price = _safe_float(holding.get("institution_price"))
            cost_basis = _safe_float(holding.get("cost_basis"))
            avg_price = cost_basis / quantity if cost_basis is not None and quantity else None
            data = {
                "account_id": account_row_id,
                "symbol": str(symbol).upper(),
                "symbol_id": holding.get("security_id"),
                "security_name": security.get("name") or symbol,
                "units": quantity,
                "price": price,
                "open_pnl": None,
                "fractional_units": quantity,
                "average_purchase_price": avg_price,
                "currency": holding.get("iso_currency_code")
                or holding.get("unofficial_currency_code")
                or "USD",
                "position_type": position_type,
            }
            self.supabase.table("portfolio_positions").upsert(
                data, on_conflict="account_id,symbol,position_type"
            ).execute()
            synced_keys.add(f"{str(symbol).upper()}:{position_type}")

        existing = (
            self.supabase.table("portfolio_positions")
            .select("id,symbol,position_type")
            .eq("account_id", account_row_id)
            .execute()
        )
        for row in existing.data or []:
            key = f"{row.get('symbol')}:{row.get('position_type', 'equity')}"
            if key not in synced_keys:
                self.supabase.table("portfolio_positions").delete().eq(
                    "id", row["id"]
                ).execute()

    async def _sync_transactions(
        self,
        user_id: str,
        item: Dict[str, Any],
        access_token: str,
    ) -> int:
        end_date = date.today()
        start_date = end_date - timedelta(days=730)
        data = await self._post(
            "/investments/transactions/get",
            {
                "access_token": access_token,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "options": {"count": 500, "offset": 0},
            },
        )
        securities = {
            security.get("security_id"): security
            for security in data.get("securities", [])
            if security.get("security_id")
        }
        accounts = {
            account.get("account_id"): account
            for account in data.get("accounts", [])
            if account.get("account_id")
        }
        rows = []
        for tx in data.get("investment_transactions", []):
            security = securities.get(tx.get("security_id"), {})
            account = accounts.get(tx.get("account_id"), {})
            symbol = _first_present(
                security.get("ticker_symbol"),
                security.get("cusip"),
                tx.get("security_id"),
            )
            rows.append(
                {
                    "user_id": user_id,
                    "item_id": item.get("item_id"),
                    "investment_transaction_id": tx.get("investment_transaction_id"),
                    "account_id": tx.get("account_id"),
                    "account_name": account.get("name") or account.get("official_name"),
                    "security_id": tx.get("security_id"),
                    "symbol": str(symbol).upper() if symbol else None,
                    "name": security.get("name") or tx.get("name"),
                    "type": tx.get("type"),
                    "subtype": tx.get("subtype"),
                    "date": tx.get("date"),
                    "quantity": _safe_float(tx.get("quantity")),
                    "price": _safe_float(tx.get("price")),
                    "amount": _safe_float(tx.get("amount")),
                    "fees": _safe_float(tx.get("fees")),
                    "currency": tx.get("iso_currency_code")
                    or tx.get("unofficial_currency_code")
                    or "USD",
                    "raw_transaction": tx,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
        if rows:
            self.supabase.table("plaid_investment_transactions").upsert(
                rows, on_conflict="user_id,investment_transaction_id"
            ).execute()
        return len(rows)


def get_plaid_service() -> PlaidService:
    return PlaidService()
