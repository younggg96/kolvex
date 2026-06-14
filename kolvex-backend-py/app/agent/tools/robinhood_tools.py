"""Read-only Robinhood tools for the authenticated user's chat agent."""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from langchain_core.tools import tool

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)


def _get_robinhood_service():
    # Delay the import because RobinhoodService imports the agent LLM helpers.
    from app.services.robinhood.service import get_robinhood_service

    return get_robinhood_service()


def _json(payload: Any) -> str:
    return json.dumps(payload, default=str, ensure_ascii=False)


def _error(message: str, error_type: str = "robinhood_error") -> str:
    return _json(
        {
            "status": "error",
            "error_type": error_type,
            "message": message,
        }
    )


def _sanitize_stock_order(order: dict[str, Any]) -> dict[str, Any]:
    return {
        key: order.get(key)
        for key in (
            "order_id",
            "ticker",
            "side",
            "order_type",
            "quantity",
            "average_price",
            "total_amount",
            "state",
            "created_time",
            "executed_time",
            "fees",
            "realized_pnl",
            "realized_pnl_percent",
        )
    }


def _sanitize_option_order(order: dict[str, Any]) -> dict[str, Any]:
    return {
        key: order.get(key)
        for key in (
            "option_order_id",
            "leg_id",
            "underlying_symbol",
            "chain_symbol",
            "option_type",
            "expiration_date",
            "strike_price",
            "side",
            "direction",
            "opening_strategy",
            "closing_strategy",
            "quantity",
            "processed_quantity",
            "price",
            "premium",
            "state",
            "created_time",
            "executed_time",
            "realized_pnl",
            "realized_pnl_percent",
        )
    }


def _get_robinhood_positions(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    supabase = get_supabase_service()
    account = (
        supabase.table("portfolio_accounts")
        .select("id")
        .eq("account_id", f"robinhood:{user_id}")
        .limit(1)
        .execute()
    )
    if not account.data:
        return []

    result = (
        supabase.table("portfolio_positions")
        .select(
            "symbol,security_name,position_type,units,price,open_pnl,"
            "average_purchase_price,currency,option_type,strike_price,"
            "expiration_date,underlying_symbol"
        )
        .eq("account_id", account.data[0]["id"])
        .order("open_pnl", desc=True)
        .limit(max(1, min(limit, 100)))
        .execute()
    )

    positions: list[dict[str, Any]] = []
    for row in result.data or []:
        units = float(row.get("units") or 0)
        price = float(row.get("price") or 0)
        multiplier = 100 if row.get("position_type") == "option" else 1
        positions.append(
            {
                **row,
                "market_value": round(units * price * multiplier, 2),
            }
        )
    return positions


def create_robinhood_tools_for_user(user_id: str) -> list:
    """Create tools bound to the authenticated user. No credential access."""

    @tool
    async def get_robinhood_account() -> str:
        """Get Robinhood connection status, sync freshness, account totals, and current stock and option positions.

        Use this for questions about the user's Robinhood account, holdings,
        buying power, portfolio value, current P&L, or whether data is synced.
        This is read-only and returns cached Kolvex data.
        """
        try:
            service = _get_robinhood_service()
            status = await service.get_status(user_id)
            if not status.get("is_connected"):
                return _json(
                    {
                        "status": "not_connected",
                        **status,
                        "message": (
                            "Robinhood is not connected. Ask the user to connect "
                            "Robinhood from the portfolio page."
                        ),
                    }
                )

            profile = await service.get_profile(user_id)
            positions = _get_robinhood_positions(user_id)
            return _json(
                {
                    "status": "success",
                    "connection": {
                        "is_connected": status.get("is_connected"),
                        "last_synced_at": status.get("last_synced_at"),
                        "positions_count": status.get("positions_count"),
                        "option_positions_count": status.get(
                            "option_positions_count"
                        ),
                        "orders_count": status.get("orders_count"),
                        "is_syncing": status.get("is_syncing"),
                        "sync_started_at": status.get("sync_started_at"),
                        "last_sync_error": status.get("last_sync_error"),
                    },
                    "account": {
                        "portfolio_value": profile.get("portfolio_value"),
                        "cash_balance": profile.get("cash_balance"),
                        "buying_power": profile.get("buying_power"),
                        "total_equity": profile.get("total_equity"),
                        "last_synced_at": profile.get("last_synced_at"),
                    },
                    "positions": positions,
                    "position_count": len(positions),
                }
            )
        except Exception as error:
            logger.exception("Robinhood account agent tool failed")
            return _error(str(error))

    @tool
    async def get_robinhood_stock_trades(
        symbol: Optional[str] = None,
        limit: int = 50,
        status: str = "filled",
    ) -> str:
        """Get the user's latest Robinhood stock trades, newest first.

        Args:
            symbol: Optional ticker such as NVDA. Omit for all symbols.
            limit: Number of rows, from 1 to 100.
            status: Order status, usually filled or all.
        """
        try:
            payload = await _get_robinhood_service().get_orders(
                user_id,
                limit=max(1, min(limit, 100)),
                offset=0,
                symbol=symbol,
                status_filter=status,
            )
            return _json(
                {
                    **payload,
                    "orders": [
                        _sanitize_stock_order(order)
                        for order in payload.get("orders", [])
                    ],
                }
            )
        except Exception as error:
            logger.exception("Robinhood stock trades agent tool failed")
            return _error(str(error))

    @tool
    async def get_robinhood_option_trades(
        symbol: Optional[str] = None,
        limit: int = 50,
        status: str = "filled",
    ) -> str:
        """Get the user's latest Robinhood option trades with contract details and realized P&L when available.

        Args:
            symbol: Optional underlying ticker such as AAPL.
            limit: Number of option legs, from 1 to 100.
            status: Order status, usually filled or all.
        """
        try:
            payload = await _get_robinhood_service().get_option_orders(
                user_id,
                limit=max(1, min(limit, 100)),
                offset=0,
                symbol=symbol,
                status_filter=status,
            )
            return _json(
                {
                    **payload,
                    "orders": [
                        _sanitize_option_order(order)
                        for order in payload.get("orders", [])
                    ],
                }
            )
        except Exception as error:
            if error.__class__.__name__ == "RobinhoodStorageNotReady":
                return _error(str(error), "migration_required")
            logger.exception("Robinhood option trades agent tool failed")
            return _error(str(error))

    @tool
    async def get_robinhood_wash_sale_risk() -> str:
        """Get symbols that may trigger a wash sale if repurchased now.

        The result is a risk screen based on synced Robinhood trades, not
        personalized tax advice. Explain that users should consult a tax
        professional for final tax treatment.
        """
        try:
            return _json(await _get_robinhood_service().get_wash_sale_risk(user_id))
        except Exception as error:
            logger.exception("Robinhood wash sale agent tool failed")
            return _error(str(error))

    @tool
    async def get_robinhood_sell_review(
        symbol: Optional[str] = None,
        limit: int = 30,
    ) -> str:
        """Compare Robinhood stock sale prices with current prices.

        Use this to explain whether shares rose or fell after the user sold,
        including missed upside, avoided downside, and realized P&L.
        """
        try:
            return _json(
                await _get_robinhood_service().get_sell_performance(
                    user_id,
                    limit=max(1, min(limit, 100)),
                    offset=0,
                    symbol=symbol,
                )
            )
        except Exception as error:
            logger.exception("Robinhood sell review agent tool failed")
            return _error(str(error))

    return [
        get_robinhood_account,
        get_robinhood_stock_trades,
        get_robinhood_option_trades,
        get_robinhood_wash_sale_risk,
        get_robinhood_sell_review,
    ]


__all__ = ["create_robinhood_tools_for_user"]
