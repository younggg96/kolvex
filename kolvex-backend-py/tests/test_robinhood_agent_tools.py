import json
import unittest
from unittest.mock import AsyncMock, patch

from app.agent.tools import get_tools_for_sources
from app.agent.tools.robinhood_tools import create_robinhood_tools_for_user


class RobinhoodAgentToolTests(unittest.IsolatedAsyncioTestCase):
    def test_robinhood_tools_are_only_added_for_selected_source(self):
        robinhood_names = {
            tool.name
            for tool in get_tools_for_sources(
                ["robinhood"],
                base_tools="financial",
                user_id="user-123",
            )
        }
        portfolio_names = {
            tool.name
            for tool in get_tools_for_sources(
                ["portfolio"],
                base_tools="financial",
                user_id="user-123",
            )
        }

        self.assertIn("get_robinhood_account", robinhood_names)
        self.assertIn("get_robinhood_stock_trades", robinhood_names)
        self.assertIn("get_robinhood_option_trades", robinhood_names)
        self.assertNotIn("get_robinhood_account", portfolio_names)

    def test_bound_tools_do_not_expose_identity_or_credentials(self):
        tools = create_robinhood_tools_for_user("user-123")

        for bound_tool in tools:
            schema = bound_tool.args_schema.model_json_schema()
            properties = schema.get("properties", {})
            self.assertNotIn("user_id", properties)
            self.assertNotIn("username", properties)
            self.assertNotIn("password", properties)
            self.assertNotIn("token", properties)

    async def test_stock_trade_tool_strips_raw_order_payload(self):
        service = AsyncMock()
        service.get_orders.return_value = {
            "orders": [
                {
                    "order_id": "order-1",
                    "ticker": "NVDA",
                    "side": "sell",
                    "state": "filled",
                    "quantity": 2,
                    "average_price": 150,
                    "realized_pnl": 25,
                    "raw_order": {"access_token": "must-not-leak"},
                }
            ],
            "total": 1,
            "limit": 50,
            "offset": 0,
            "has_more": False,
            "wash_sale_risk_symbols": [],
        }
        tools = {
            tool.name: tool for tool in create_robinhood_tools_for_user("user-123")
        }

        with patch(
            "app.agent.tools.robinhood_tools._get_robinhood_service",
            return_value=service,
        ):
            result = await tools["get_robinhood_stock_trades"].ainvoke({})

        payload = json.loads(result)
        self.assertEqual(payload["orders"][0]["ticker"], "NVDA")
        self.assertNotIn("raw_order", payload["orders"][0])
        self.assertNotIn("access_token", result)

    async def test_account_tool_omits_identity_and_raw_profile(self):
        service = AsyncMock()
        service.get_status.return_value = {
            "is_connected": True,
            "last_synced_at": "2026-06-13T10:00:00",
            "positions_count": 2,
            "option_positions_count": 1,
            "orders_count": 10,
            "profile": {"email": "private@example.com"},
        }
        service.get_profile.return_value = {
            "username": "private@example.com",
            "account_number": "123456789",
            "portfolio_value": 1000,
            "cash_balance": 100,
            "buying_power": 200,
            "total_equity": 1000,
            "last_synced_at": "2026-06-13T10:00:00",
            "profile": {"email": "private@example.com"},
        }
        tools = {
            tool.name: tool for tool in create_robinhood_tools_for_user("user-123")
        }

        with (
            patch(
                "app.agent.tools.robinhood_tools._get_robinhood_service",
                return_value=service,
            ),
            patch(
                "app.agent.tools.robinhood_tools._get_robinhood_positions",
                return_value=[],
            ),
        ):
            result = await tools["get_robinhood_account"].ainvoke({})

        self.assertNotIn("private@example.com", result)
        self.assertNotIn("123456789", result)
        self.assertNotIn('"profile"', result)


if __name__ == "__main__":
    unittest.main()
