"""
Unit tests for Trade OS Reconciliation and Trade Grouping
"""

from datetime import datetime, timezone
from decimal import Decimal

from app.services.trade_os.reconciliation import group_executions_fifo


def test_group_executions_single_round_trip():
    execs = [
        {
            "id": "e1",
            "symbol": "AAPL",
            "side": "buy",
            "quantity": Decimal("10"),
            "price": Decimal("150.00"),
            "fees": Decimal("0.50"),
            "executed_at": datetime(2026, 1, 15, 14, 30, tzinfo=timezone.utc),
        },
        {
            "id": "e2",
            "symbol": "AAPL",
            "side": "sell",
            "quantity": Decimal("10"),
            "price": Decimal("160.00"),
            "fees": Decimal("0.50"),
            "executed_at": datetime(2026, 1, 20, 15, 0, tzinfo=timezone.utc),
        },
    ]

    groups, issues = group_executions_fifo(execs)
    assert len(issues) == 0
    assert len(groups) == 1

    g = groups[0]
    assert g["symbol"] == "AAPL"
    assert g["side"] == "long"
    assert g["status"] == "closed"
    assert g["total_buy_quantity"] == Decimal("10")
    assert g["total_sell_quantity"] == Decimal("10")
    assert g["open_quantity"] == Decimal("0")
    assert g["average_entry_price"] == Decimal("150.00")
    # Cost: 10 * 150 = 1500. Proceeds: 10 * 160 = 1600. Gain: 100. Fees: 0.50 + 0.50 = 1.00. Net: 99.00
    assert g["realized_pnl"] == Decimal("99.00")
    assert g["total_fees"] == Decimal("1.00")
    assert g["execution_ids"] == ["e1", "e2"]


def test_group_executions_partial_fill_and_multiple_buys():
    execs = [
        # Buy 10 @ $100
        {
            "id": "e1",
            "symbol": "MSFT",
            "side": "buy",
            "quantity": Decimal("10"),
            "price": Decimal("100.00"),
            "fees": Decimal("0"),
            "executed_at": datetime(2026, 1, 10, 10, 0, tzinfo=timezone.utc),
        },
        # Buy 10 @ $120 (avg cost = $110)
        {
            "id": "e2",
            "symbol": "MSFT",
            "side": "buy",
            "quantity": Decimal("10"),
            "price": Decimal("120.00"),
            "fees": Decimal("0"),
            "executed_at": datetime(2026, 1, 11, 10, 0, tzinfo=timezone.utc),
        },
        # Sell 15 @ $130 (FIFO: closes 10 @ $100 -> gain $300, closes 5 @ $120 -> gain $50 => total realized $350)
        {
            "id": "e3",
            "symbol": "MSFT",
            "side": "sell",
            "quantity": Decimal("15"),
            "price": Decimal("130.00"),
            "fees": Decimal("0"),
            "executed_at": datetime(2026, 1, 15, 10, 0, tzinfo=timezone.utc),
        },
    ]

    groups, issues = group_executions_fifo(execs)
    assert len(issues) == 0
    assert len(groups) == 1

    g = groups[0]
    assert g["symbol"] == "MSFT"
    assert g["status"] == "partial"
    assert g["total_buy_quantity"] == Decimal("20")
    assert g["total_sell_quantity"] == Decimal("15")
    assert g["open_quantity"] == Decimal("5")
    assert g["average_entry_price"] == Decimal("110.00")
    assert g["realized_pnl"] == Decimal("350.00")


def test_group_executions_missing_cost_basis():
    execs = [
        # Sell without buy
        {
            "id": "e1",
            "symbol": "NVDA",
            "side": "sell",
            "quantity": Decimal("5"),
            "price": Decimal("120.00"),
            "executed_at": datetime(2026, 1, 5, 10, 0, tzinfo=timezone.utc),
        }
    ]

    groups, issues = group_executions_fifo(execs)
    assert len(groups) == 0
    assert len(issues) == 1
    assert issues[0]["issue_type"] == "missing_cost_basis"
    assert issues[0]["symbol"] == "NVDA"
