"""Manual portfolio import.

Users paste a JSON snapshot (usually produced by an external assistant from a
broker screenshot or export) and we store it under a ``manual`` portfolio
connection. Each import replaces the previous manual snapshot while keeping
row ids stable, so per-position visibility and hidden-account settings survive.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)

MANUAL_PROVIDER = "manual"
MANUAL_ACCOUNT_PREFIX = "manual:"
MAX_ACCOUNTS = 20
MAX_POSITIONS = 1000
OPTION_MULTIPLIER = 100

_EQUITY_SYMBOL = re.compile(r"^[A-Z0-9][A-Z0-9.\-/]{0,15}$")


class ManualImportUnavailable(RuntimeError):
    """The database does not accept manual connections yet (migration not applied)."""


MIGRATION_HINT = "20261118000000_portfolio_manual_provider.sql"


class ManualPosition(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=40)
    name: Optional[str] = Field(None, max_length=200)
    type: Literal["equity", "option"] = "equity"
    quantity: float
    average_cost: Optional[float] = Field(None, ge=0)
    price: Optional[float] = Field(None, gt=0)
    currency: str = Field("USD", min_length=3, max_length=3)
    underlying: Optional[str] = Field(None, max_length=16)
    option_type: Optional[Literal["call", "put"]] = None
    strike: Optional[float] = Field(None, gt=0)
    expiration: Optional[date] = None

    @field_validator("symbol", "underlying", mode="before")
    @classmethod
    def _upper(cls, value: Any) -> Any:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("currency", mode="before")
    @classmethod
    def _currency(cls, value: Any) -> Any:
        return (value or "USD").strip().upper() if isinstance(value, (str, type(None))) else value

    @field_validator("option_type", mode="before")
    @classmethod
    def _option_type(cls, value: Any) -> Any:
        if isinstance(value, str):
            lowered = value.strip().lower()
            return {"c": "call", "p": "put"}.get(lowered, lowered)
        return value

    @model_validator(mode="after")
    def _check(self) -> "ManualPosition":
        if self.quantity == 0:
            raise ValueError(f"{self.symbol}: quantity must not be 0")
        if self.type == "equity":
            if not _EQUITY_SYMBOL.match(self.symbol):
                raise ValueError(f"{self.symbol}: not a valid ticker")
        else:
            missing = [
                field
                for field in ("underlying", "option_type", "strike", "expiration")
                if getattr(self, field) is None
            ]
            if missing:
                raise ValueError(f"{self.symbol}: option is missing {', '.join(missing)}")
        return self

    @property
    def storage_symbol(self) -> str:
        """Equities keep the ticker; options use an OCC-style contract symbol."""
        if self.type == "equity":
            return self.symbol
        assert self.underlying and self.expiration and self.option_type and self.strike
        side = "C" if self.option_type == "call" else "P"
        strike = int(round(self.strike * 1000))
        return f"{self.underlying}{self.expiration:%y%m%d}{side}{strike:08d}"


class ManualAccount(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    brokerage: Optional[str] = Field(None, max_length=100)
    positions: List[ManualPosition] = Field(..., min_length=1)

    @field_validator("name", mode="before")
    @classmethod
    def _strip(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def _unique_positions(self) -> "ManualAccount":
        seen = set()
        for position in self.positions:
            key = (position.storage_symbol, position.type)
            if key in seen:
                raise ValueError(
                    f"{self.name}: {position.storage_symbol} appears twice; merge lots into one row"
                )
            seen.add(key)
        return self


class ManualImportRequest(BaseModel):
    as_of: Optional[date] = None
    accounts: List[ManualAccount] = Field(..., min_length=1, max_length=MAX_ACCOUNTS)

    @model_validator(mode="after")
    def _limits(self) -> "ManualImportRequest":
        names = [account.name.lower() for account in self.accounts]
        if len(names) != len(set(names)):
            raise ValueError("Account names must be unique")
        total = sum(len(account.positions) for account in self.accounts)
        if total > MAX_POSITIONS:
            raise ValueError(f"At most {MAX_POSITIONS} positions per import")
        return self


def manual_account_key(name: str) -> str:
    digest = hashlib.sha1(name.strip().lower().encode("utf-8")).hexdigest()[:12]
    return f"{MANUAL_ACCOUNT_PREFIX}{digest}"


def position_row(
    account_row_id: str, position: ManualPosition, price: Optional[float]
) -> Dict[str, Any]:
    multiplier = OPTION_MULTIPLIER if position.type == "option" else 1
    open_pnl = (
        round((price - position.average_cost) * position.quantity * multiplier, 4)
        if price is not None and position.average_cost is not None
        else None
    )
    return {
        "account_id": account_row_id,
        "symbol": position.storage_symbol,
        "symbol_id": None,
        "security_name": position.name or position.symbol,
        "units": position.quantity,
        "fractional_units": position.quantity,
        "price": price,
        "open_pnl": open_pnl,
        "average_purchase_price": position.average_cost,
        "currency": position.currency,
        "position_type": position.type,
        "option_type": position.option_type,
        "strike_price": position.strike,
        "expiration_date": position.expiration.isoformat() if position.expiration else None,
        "underlying_symbol": position.underlying,
    }


class ManualImportService:
    def __init__(self, supabase=None, quote_fetcher=None):
        self.supabase = supabase or get_supabase_service()
        self._quote_fetcher = quote_fetcher

    async def _fetch_price(self, symbol: str) -> Optional[float]:
        fetcher = self._quote_fetcher
        if fetcher is None:
            from app.services.finnhub import get_finnhub_client

            fetcher = get_finnhub_client().get_quote
        try:
            quote = await fetcher(symbol)
        except Exception:
            logger.warning("Manual import quote lookup failed for %s", symbol)
            return None
        price = quote.get("current_price") if isinstance(quote, dict) else None
        return float(price) if isinstance(price, (int, float)) and price > 0 else None

    async def _resolve_prices(self, request: ManualImportRequest) -> Dict[str, Optional[float]]:
        """Fill missing equity prices from live quotes; options without a price stay unpriced."""
        missing = sorted(
            {
                position.symbol
                for account in request.accounts
                for position in account.positions
                if position.type == "equity" and position.price is None
            }
        )
        semaphore = asyncio.Semaphore(5)

        async def lookup(symbol: str):
            async with semaphore:
                return symbol, await self._fetch_price(symbol)

        return dict(await asyncio.gather(*(lookup(symbol) for symbol in missing)))

    def _connections(self, user_id: str) -> List[Dict[str, Any]]:
        result = (
            self.supabase.table("portfolio_connections")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return result.data or []

    def _ensure_connection(self, user_id: str, now: str) -> Dict[str, Any]:
        connections = self._connections(user_id)
        manual = next((c for c in connections if c.get("provider") == MANUAL_PROVIDER), None)
        if manual:
            self.supabase.table("portfolio_connections").update(
                {"is_connected": True, "last_synced_at": now, "updated_at": now}
            ).eq("id", manual["id"]).execute()
            return manual
        # Sharing is one setting per user, so a new manual connection inherits it.
        template = connections[0] if connections else {}
        data = {
            "user_id": user_id,
            "provider": MANUAL_PROVIDER,
            "is_connected": True,
            "is_public": bool(template.get("is_public", False)),
            "last_synced_at": now,
        }
        if template.get("privacy_settings"):
            data["privacy_settings"] = template["privacy_settings"]
        try:
            created = self.supabase.table("portfolio_connections").insert(data).execute()
        except Exception as error:
            if getattr(error, "code", None) == "23514":
                raise ManualImportUnavailable(
                    f"portfolio_connections does not allow provider 'manual'; apply {MIGRATION_HINT}"
                ) from error
            raise
        if not created.data:
            raise RuntimeError("Failed to create manual portfolio connection")
        return created.data[0]

    async def import_holdings(self, user_id: str, request: ManualImportRequest) -> Dict[str, Any]:
        prices = await self._resolve_prices(request)
        return await asyncio.to_thread(self._write, user_id, request, prices)

    def _write(
        self,
        user_id: str,
        request: ManualImportRequest,
        prices: Dict[str, Optional[float]],
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        connection = self._ensure_connection(user_id, now)
        table = self.supabase.table
        kept_accounts = set()
        positions_count = 0
        unpriced: List[str] = []

        for account in request.accounts:
            key = manual_account_key(account.name)
            kept_accounts.add(key)
            upserted = (
                table("portfolio_accounts")
                .upsert(
                    {
                        "connection_id": connection["id"],
                        "account_id": key,
                        "brokerage_name": account.brokerage or "Manual import",
                        "account_name": account.name,
                        "account_number": None,
                        "account_type": "manual",
                    },
                    on_conflict="connection_id,account_id",
                )
                .execute()
            )
            if not upserted.data:
                raise RuntimeError(f"Failed to save account {account.name}")
            account_row_id = upserted.data[0]["id"]

            kept_positions = set()
            for position in account.positions:
                price = (
                    position.price if position.price is not None else prices.get(position.symbol)
                )
                if price is None:
                    unpriced.append(position.storage_symbol)
                table("portfolio_positions").upsert(
                    position_row(account_row_id, position, price),
                    on_conflict="account_id,symbol,position_type",
                ).execute()
                kept_positions.add((position.storage_symbol, position.type))
                positions_count += 1

            existing = (
                table("portfolio_positions")
                .select("id,symbol,position_type")
                .eq("account_id", account_row_id)
                .execute()
            )
            for row in existing.data or []:
                if (row.get("symbol"), row.get("position_type") or "equity") not in kept_positions:
                    table("portfolio_positions").delete().eq("id", row["id"]).execute()

        accounts = (
            table("portfolio_accounts")
            .select("id,account_id")
            .eq("connection_id", connection["id"])
            .execute()
        )
        for row in accounts.data or []:
            if row.get("account_id") not in kept_accounts:
                table("portfolio_accounts").delete().eq("id", row["id"]).execute()

        return {
            "success": True,
            "accounts_count": len(request.accounts),
            "positions_count": positions_count,
            "unpriced_symbols": sorted(set(unpriced)),
            "imported_at": now,
        }

    async def clear(self, user_id: str) -> Dict[str, Any]:
        def run() -> int:
            result = (
                self.supabase.table("portfolio_connections")
                .delete()
                .eq("user_id", user_id)
                .eq("provider", MANUAL_PROVIDER)
                .execute()
            )
            return len(result.data or [])

        removed = await asyncio.to_thread(run)
        return {"success": True, "removed": removed > 0}


def get_manual_import_service() -> ManualImportService:
    return ManualImportService()
