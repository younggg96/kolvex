"""
Unit tests for Trade OS Position Sizing Engine
"""

from decimal import Decimal

import pytest

from app.services.trade_os.position_sizing import (
    PositionSizingError,
    calculate_position_size,
)


def test_position_sizing_prd_example():
    """
    PRD Section 10.3 Example:
      Equity: $30,000
      Allowed Risk: 0.5% ($150)
      Entry: $180
      Stop: $171 ($9 risk/share)
      Notional Limit: 10% ($3,000)
    Result:
      Qty by risk: 16
      Qty by notional: 16
      Final allowed quantity: 16
      Planned notional: $2,880
      Planned risk: $144
    """
    res = calculate_position_size(
        account_equity=Decimal("30000"),
        entry_price=Decimal("180"),
        stop_price=Decimal("171"),
        allowed_risk_pct=Decimal("0.0050"),
        max_position_notional_pct=Decimal("0.1000"),
        side="long",
    )

    assert res["risk_per_share"] == Decimal("9")
    assert res["risk_budget"] == Decimal("150")
    assert res["quantity_by_risk"] == 16
    assert res["quantity_by_notional"] == 16
    assert res["max_allowed_quantity"] == 16
    assert res["planned_risk_amount"] == Decimal("144")
    assert res["planned_notional"] == Decimal("2880")


def test_position_sizing_risk_limited():
    """
    When risk per share is large, risk budget constrains quantity before notional does.
      Equity: $100,000, 0.5% risk ($500)
      Entry: $50, Stop: $40 ($10 risk/share)
      Qty by risk = floor(500 / 10) = 50
      Qty by notional = floor(10000 / 50) = 200
      Result = 50
    """
    res = calculate_position_size(
        account_equity=Decimal("100000"),
        entry_price=Decimal("50"),
        stop_price=Decimal("40"),
        allowed_risk_pct=Decimal("0.0050"),
        max_position_notional_pct=Decimal("0.1000"),
        side="long",
    )

    assert res["quantity_by_risk"] == 50
    assert res["quantity_by_notional"] == 200
    assert res["max_allowed_quantity"] == 50
    assert res["planned_risk_amount"] == Decimal("500")
    assert res["planned_notional"] == Decimal("2500")


def test_position_sizing_notional_limited():
    """
    When stop is very tight, notional limit constrains quantity.
      Equity: $100,000, 0.5% risk ($500)
      Entry: $100, Stop: $99.50 ($0.50 risk/share)
      Qty by risk = floor(500 / 0.5) = 1000 ($100k notional > $10k notional limit)
      Qty by notional = floor(10000 / 100) = 100
      Result = 100
    """
    res = calculate_position_size(
        account_equity=Decimal("100000"),
        entry_price=Decimal("100"),
        stop_price=Decimal("99.50"),
        allowed_risk_pct=Decimal("0.0050"),
        max_position_notional_pct=Decimal("0.1000"),
        side="long",
    )

    assert res["quantity_by_risk"] == 1000
    assert res["quantity_by_notional"] == 100
    assert res["max_allowed_quantity"] == 100


def test_position_sizing_invalid_brackets():
    # Long trade with stop >= entry
    with pytest.raises(PositionSizingError):
        calculate_position_size(10000, 100, 105, side="long")

    with pytest.raises(PositionSizingError):
        calculate_position_size(10000, 100, 100, side="long")

    # Zero or negative equity
    with pytest.raises(PositionSizingError):
        calculate_position_size(0, 100, 90, side="long")
