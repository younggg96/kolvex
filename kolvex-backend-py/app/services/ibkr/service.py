"""Interactive Brokers Flex Web Service integration."""

import asyncio
import base64
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from xml.etree import ElementTree

import httpx
from cryptography.fernet import Fernet
from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.llm import get_llm
from app.core.config import settings
from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)

SEND_REQUEST_URL = (
    "https://ndcdyn.interactivebrokers.com/AccountManagement/"
    "FlexWebService/SendRequest"
)


def _number(value: Any) -> float:
    try:
        return float(str(value).replace(",", "") or 0)
    except (TypeError, ValueError):
        return 0.0


def _date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    digits = value.replace("-", "")
    if len(digits) >= 8:
        return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"
    return None


def _timestamp(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = value.replace(";", " ").strip()
    for fmt in (
        "%Y%m%d %H%M%S",
        "%Y%m%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y%m%d",
    ):
        try:
            return datetime.strptime(normalized, fmt).replace(
                tzinfo=timezone.utc
            ).isoformat()
        except ValueError:
            continue
    return None


class IBKRFlexService:
    def __init__(self, supabase=None):
        self.supabase = supabase or get_supabase_service()
        digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
        self.cipher = Fernet(base64.urlsafe_b64encode(digest))

    async def connect(self, user_id: str, token: str, query_id: str) -> Dict[str, Any]:
        encrypted = self.cipher.encrypt(token.strip().encode("utf-8")).decode("ascii")
        self.supabase.table("ibkr_connections").upsert(
            {
                "user_id": user_id,
                "flex_token_encrypted": encrypted,
                "flex_query_id": query_id.strip(),
                "is_connected": False,
                "last_error": None,
            },
            on_conflict="user_id",
        ).execute()
        return await self.sync(user_id)

    async def status(self, user_id: str) -> Dict[str, Any]:
        result = self.supabase.table("ibkr_connections").select(
            "id,is_connected,last_synced_at,last_error"
        ).eq("user_id", user_id).limit(1).execute()
        connection = result.data[0] if result.data else None
        if not connection:
            return {
                "is_connected": False,
                "last_synced_at": None,
                "accounts_count": 0,
                "positions_count": 0,
                "trades_count": 0,
            }
        accounts = self.supabase.table("ibkr_accounts").select(
            "id", count="exact"
        ).eq("connection_id", connection["id"]).execute()
        account_ids = [row["id"] for row in (accounts.data or [])]
        positions_count = 0
        if account_ids:
            positions_count = (
                self.supabase.table("ibkr_positions")
                .select("id", count="exact")
                .in_("account_id", account_ids)
                .execute()
                .count
                or 0
            )
        trades = self.supabase.table("ibkr_trades").select(
            "id", count="exact"
        ).eq("user_id", user_id).execute()
        return {
            "is_connected": bool(connection.get("is_connected")),
            "last_synced_at": connection.get("last_synced_at"),
            "last_error": connection.get("last_error"),
            "accounts_count": accounts.count or 0,
            "positions_count": positions_count,
            "trades_count": trades.count or 0,
        }

    async def sync(self, user_id: str) -> Dict[str, Any]:
        connection = self._connection(user_id)
        token = self.cipher.decrypt(
            connection["flex_token_encrypted"].encode("ascii")
        ).decode("utf-8")
        try:
            xml_text = await self._download_report(
                token, connection["flex_query_id"]
            )
            parsed = self._parse_report(xml_text)
            self._persist(user_id, connection["id"], parsed)
            now = datetime.now(timezone.utc).isoformat()
            self.supabase.table("ibkr_connections").update(
                {"is_connected": True, "last_synced_at": now, "last_error": None}
            ).eq("id", connection["id"]).execute()
            return {
                "success": True,
                "accounts_synced": len(parsed["accounts"]),
                "positions_synced": len(parsed["positions"]),
                "trades_synced": len(parsed["trades"]),
                "last_synced_at": now,
            }
        except Exception as error:
            self.supabase.table("ibkr_connections").update(
                {"is_connected": False, "last_error": str(error)[:1000]}
            ).eq("id", connection["id"]).execute()
            raise

    async def holdings(self, user_id: str) -> Dict[str, Any]:
        connection = self._connection(user_id)
        accounts_result = self.supabase.table("ibkr_accounts").select("*").eq(
            "connection_id", connection["id"]
        ).execute()
        accounts = []
        for account in accounts_result.data or []:
            positions = self.supabase.table("ibkr_positions").select("*").eq(
                "account_id", account["id"]
            ).execute()
            accounts.append(
                {
                    "id": account["id"],
                    "account_id": account["account_id"],
                    "brokerage_name": "Interactive Brokers",
                    "account_name": account.get("account_name") or "IBKR Account",
                    "account_type": "Brokerage",
                    "portfolio_positions": positions.data or [],
                }
            )
        return {
            "is_connected": bool(connection.get("is_connected")),
            "is_public": False,
            "last_synced_at": connection.get("last_synced_at"),
            "accounts": accounts,
        }

    async def trades(
        self,
        user_id: str,
        limit: int = 100,
        offset: int = 0,
        symbol: Optional[str] = None,
        asset_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = (
            self.supabase.table("ibkr_trades")
            .select("*", count="exact")
            .eq("user_id", user_id)
        )
        if symbol:
            query = query.eq("symbol", symbol.strip().upper())
        if asset_type == "options":
            query = query.in_("asset_category", ["OPT", "FOP"])
        elif asset_type == "stocks":
            query = query.not_.in_("asset_category", ["OPT", "FOP"])
        result = (
            query.order("trade_time", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {
            "trades": result.data or [],
            "total": result.count or 0,
            "has_more": offset + limit < (result.count or 0),
        }

    async def normalized_orders(
        self,
        user_id: str,
        limit: int = 100,
        offset: int = 0,
        symbol: Optional[str] = None,
        asset_type: str = "stocks",
    ) -> Dict[str, Any]:
        payload = await self.trades(
            user_id,
            limit=limit,
            offset=offset,
            symbol=symbol,
            asset_type=asset_type,
        )
        normalize = (
            self._normalize_option_trade
            if asset_type == "options"
            else self._normalize_stock_trade
        )
        return {
            "orders": [normalize(row) for row in payload["trades"]],
            "total": payload["total"],
            "limit": limit,
            "offset": offset,
            "has_more": payload["has_more"],
        }

    async def analyze_trades(
        self,
        user_id: str,
        provider: str,
        model: str,
        user_api_keys: Optional[Dict[str, str]] = None,
        limit: int = 300,
        trade_ids: Optional[List[str]] = None,
        language: str = "zh",
    ) -> Dict[str, Any]:
        query = (
            self.supabase.table("ibkr_trades")
            .select(
                "trade_id,trade_time,symbol,asset_category,side,quantity,"
                "trade_price,proceeds,realized_pnl,commission,option_type,"
                "strike_price,expiration_date"
            )
            .eq("user_id", user_id)
            .order("trade_time", desc=True)
        )
        if trade_ids:
            query = query.in_(
                "trade_id",
                [value.removeprefix("ibkr:") for value in trade_ids],
            )
        rows = query.limit(limit).execute().data or []
        if not rows:
            raise ValueError("No Interactive Brokers trades available to analyze")

        realized = [
            _number(row.get("realized_pnl"))
            for row in rows
            if row.get("realized_pnl") is not None
        ]
        summary = {
            "broker": "Interactive Brokers",
            "trades_count": len(rows),
            "realized_pnl": round(sum(realized), 2),
            "winning_closes": len([value for value in realized if value > 0]),
            "losing_closes": len([value for value in realized if value < 0]),
            "options_trades": len(
                [
                    row
                    for row in rows
                    if str(row.get("asset_category") or "").upper() in {"OPT", "FOP"}
                ]
            ),
        }
        llm = get_llm(
            provider=provider,
            model=model,
            temperature=0.2,
            user_api_keys=user_api_keys,
        )
        messages = [
            SystemMessage(
                content=(
                    "You are a disciplined trading journal coach. Analyze the user's "
                    "Interactive Brokers executions. Be specific, practical, and concise. "
                    "Return well-structured GitHub-flavored Markdown. Do not provide "
                    "personalized tax or financial advice."
                )
            ),
            HumanMessage(
                content=(
                    "Analyze these trades with sections: Summary, Best Trades, Worst "
                    "Trades, Options Review, Behavioral Patterns, Risk Controls, and "
                    "Next Actions. "
                    f"Write entirely in {'Chinese' if language == 'zh' else 'English'}.\n\n"
                    f"Summary: {json.dumps(summary, default=str)}\n"
                    f"Trades: {json.dumps(rows, default=str)}"
                )
            ),
        ]
        response = await asyncio.to_thread(llm.invoke, messages)
        return {
            "analysis": getattr(response, "content", str(response)),
            "provider": provider,
            "model": model,
            "orders_analyzed": len(rows),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    async def disconnect(self, user_id: str) -> None:
        self.supabase.table("ibkr_connections").delete().eq(
            "user_id", user_id
        ).execute()

    async def sync_all_connected(self) -> Dict[str, Any]:
        result = (
            self.supabase.table("ibkr_connections")
            .select("user_id")
            .eq("is_connected", True)
            .execute()
        )
        succeeded = 0
        errors: List[Dict[str, str]] = []
        for connection in result.data or []:
            user_id = connection["user_id"]
            try:
                await self.sync(user_id)
                succeeded += 1
            except Exception as error:
                logger.exception("Scheduled IBKR sync failed for user %s", user_id)
                errors.append({"user_id": user_id, "error": str(error)})
        return {
            "total": len(result.data or []),
            "succeeded": succeeded,
            "failed": len(errors),
            "errors": errors,
        }

    def _connection(self, user_id: str) -> Dict[str, Any]:
        result = self.supabase.table("ibkr_connections").select("*").eq(
            "user_id", user_id
        ).limit(1).execute()
        if not result.data:
            raise ValueError("Interactive Brokers is not connected")
        return result.data[0]

    async def _download_report(self, token: str, query_id: str) -> str:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.get(
                SEND_REQUEST_URL,
                params={"t": token, "q": query_id, "v": 3},
            )
            response.raise_for_status()
            root = ElementTree.fromstring(response.text)
            status = (root.findtext("Status") or "").strip()
            if status.lower() != "success":
                raise ValueError(
                    root.findtext("ErrorMessage")
                    or root.findtext("ErrorCode")
                    or "IBKR rejected the Flex request"
                )
            reference = root.findtext("ReferenceCode")
            statement_url = root.findtext("Url")
            if not reference or not statement_url:
                raise ValueError("IBKR did not return a Flex statement reference")

            for attempt in range(12):
                report = await client.get(
                    statement_url,
                    params={"q": reference, "t": token, "v": 3},
                )
                report.raise_for_status()
                report_root = ElementTree.fromstring(report.text)
                if report_root.tag == "FlexQueryResponse":
                    return report.text
                code = report_root.findtext("ErrorCode")
                if code not in {"1019", "1003"}:
                    raise ValueError(
                        report_root.findtext("ErrorMessage")
                        or "IBKR Flex report download failed"
                    )
                await asyncio.sleep(min(2 + attempt, 8))
        raise TimeoutError("IBKR Flex report was not ready in time")

    def _parse_report(self, xml_text: str) -> Dict[str, List[Dict[str, Any]]]:
        root = ElementTree.fromstring(xml_text)
        accounts: Dict[str, Dict[str, Any]] = {}
        positions: List[Dict[str, Any]] = []
        trades: List[Dict[str, Any]] = []

        for statement in root.findall(".//FlexStatement"):
            account_id = statement.attrib.get("accountId") or "IBKR"
            accounts[account_id] = {
                "account_id": account_id,
                "account_name": statement.attrib.get("accountName"),
                "currency": statement.attrib.get("currency"),
            }

            for node in statement.findall(".//OpenPosition"):
                raw = dict(node.attrib)
                asset = raw.get("assetCategory", "")
                is_option = asset.upper() in {"OPT", "FOP"}
                symbol = raw.get("symbol") or raw.get("underlyingSymbol") or "UNKNOWN"
                position_key = "|".join(
                    [
                        raw.get("conid", ""),
                        symbol,
                        raw.get("expiry", ""),
                        raw.get("strike", ""),
                        raw.get("putCall", ""),
                    ]
                )
                positions.append(
                    {
                        "account_ref": account_id,
                        "contract_id": raw.get("conid"),
                        "position_key": position_key,
                        "position_type": "option" if is_option else "equity",
                        "symbol": symbol,
                        "security_name": raw.get("description"),
                        "units": _number(raw.get("position")),
                        "price": _number(raw.get("markPrice")),
                        "market_value": _number(raw.get("positionValue")),
                        "average_purchase_price": _number(
                            raw.get("costBasisPrice")
                        ),
                        "open_pnl": _number(raw.get("fifoPnlUnrealized")),
                        "currency": raw.get("currency"),
                        "option_type": (raw.get("putCall") or "").lower() or None,
                        "strike_price": _number(raw.get("strike")) or None,
                        "expiration_date": _date(raw.get("expiry")),
                        "underlying_symbol": raw.get("underlyingSymbol") or symbol,
                        "multiplier": _number(raw.get("multiplier")) or 100,
                    }
                )

            for node in statement.findall(".//Trade"):
                raw = dict(node.attrib)
                trade_id = raw.get("tradeID") or raw.get("transactionID")
                if not trade_id:
                    continue
                trades.append(
                    {
                        "account_id": account_id,
                        "trade_id": trade_id,
                        "order_id": raw.get("orderID"),
                        "symbol": raw.get("symbol") or "UNKNOWN",
                        "security_name": raw.get("description"),
                        "asset_category": raw.get("assetCategory"),
                        "side": (raw.get("buySell") or "").lower(),
                        "quantity": _number(raw.get("quantity")),
                        "trade_price": _number(raw.get("tradePrice")),
                        "proceeds": _number(raw.get("proceeds")),
                        "realized_pnl": _number(raw.get("fifoPnlRealized")),
                        "commission": _number(raw.get("ibCommission")),
                        "currency": raw.get("currency"),
                        "trade_time": _timestamp(
                            raw.get("dateTime") or raw.get("tradeDate")
                        ),
                        "option_type": (raw.get("putCall") or "").lower() or None,
                        "strike_price": _number(raw.get("strike")) or None,
                        "expiration_date": _date(raw.get("expiry")),
                        "multiplier": _number(raw.get("multiplier")) or 100,
                        "raw_data": raw,
                    }
                )

        return {
            "accounts": list(accounts.values()),
            "positions": positions,
            "trades": trades,
        }

    def _persist(
        self, user_id: str, connection_id: str, parsed: Dict[str, List[Dict[str, Any]]]
    ) -> None:
        account_map: Dict[str, str] = {}
        for account in parsed["accounts"]:
            result = self.supabase.table("ibkr_accounts").upsert(
                {"connection_id": connection_id, **account},
                on_conflict="connection_id,account_id",
            ).execute()
            if result.data:
                account_map[account["account_id"]] = result.data[0]["id"]

        for account_uuid in account_map.values():
            self.supabase.table("ibkr_positions").delete().eq(
                "account_id", account_uuid
            ).execute()

        for position in parsed["positions"]:
            account_ref = position["account_ref"]
            account_uuid = account_map.get(account_ref)
            if account_uuid:
                self.supabase.table("ibkr_positions").upsert(
                    {
                        "account_id": account_uuid,
                        **{
                            key: value
                            for key, value in position.items()
                            if key != "account_ref"
                        },
                    },
                    on_conflict="account_id,position_key",
                ).execute()

        for trade in parsed["trades"]:
            self.supabase.table("ibkr_trades").upsert(
                {
                    "user_id": user_id,
                    **trade,
                    "raw_data": json.loads(json.dumps(trade["raw_data"])),
                },
                on_conflict="user_id,trade_id",
            ).execute()

    def _normalize_stock_trade(self, row: Dict[str, Any]) -> Dict[str, Any]:
        quantity = abs(_number(row.get("quantity")))
        price = _number(row.get("trade_price"))
        realized_pnl = (
            _number(row.get("realized_pnl"))
            if row.get("realized_pnl") is not None
            else None
        )
        proceeds = abs(_number(row.get("proceeds"))) or quantity * price
        cost_basis = None
        realized_percent = None
        if realized_pnl is not None and str(row.get("side") or "").lower() == "sell":
            cost_basis = proceeds - realized_pnl
            if cost_basis > 0:
                realized_percent = realized_pnl / cost_basis * 100
        return {
            "id": f"ibkr:{row['id']}",
            "order_id": f"ibkr:{row['trade_id']}",
            "ticker": row.get("symbol") or "UNKNOWN",
            "side": row.get("side"),
            "order_type": "execution",
            "quantity": quantity,
            "average_price": price,
            "total_amount": proceeds,
            "state": "filled",
            "created_time": row.get("trade_time"),
            "executed_time": row.get("trade_time"),
            "fees": abs(_number(row.get("commission"))),
            "cost_basis": round(cost_basis, 2) if cost_basis is not None else None,
            "realized_pnl": realized_pnl,
            "realized_pnl_percent": (
                round(realized_percent, 2) if realized_percent is not None else None
            ),
            "broker": "ibkr",
        }

    def _normalize_option_trade(self, row: Dict[str, Any]) -> Dict[str, Any]:
        raw = row.get("raw_data") or {}
        multiplier = _number(row.get("multiplier") or raw.get("multiplier")) or 100
        quantity = abs(_number(row.get("quantity")))
        price = _number(row.get("trade_price"))
        realized_pnl = (
            _number(row.get("realized_pnl"))
            if row.get("realized_pnl") is not None
            else None
        )
        premium = abs(_number(row.get("proceeds"))) or quantity * price * multiplier
        return {
            "id": f"ibkr:{row['id']}",
            "option_order_id": f"ibkr:{row['trade_id']}",
            "leg_id": f"ibkr:{row['trade_id']}",
            "chain_symbol": row.get("symbol"),
            "underlying_symbol": row.get("symbol"),
            "option_type": row.get("option_type"),
            "expiration_date": row.get("expiration_date"),
            "strike_price": row.get("strike_price"),
            "side": row.get("side"),
            "direction": row.get("side"),
            "opening_strategy": None,
            "closing_strategy": None,
            "order_type": "execution",
            "quantity": quantity,
            "processed_quantity": quantity,
            "price": price,
            "premium": premium,
            "state": "filled",
            "created_time": row.get("trade_time"),
            "executed_time": row.get("trade_time"),
            "realized_pnl": realized_pnl,
            "realized_pnl_percent": None,
            "broker": "ibkr",
        }


_service: Optional[IBKRFlexService] = None


def get_ibkr_flex_service() -> IBKRFlexService:
    global _service
    if _service is None:
        _service = IBKRFlexService()
    return _service
