"""
Unit tests for Trade OS Drawdown Calculator
"""

from decimal import Decimal

from app.services.trade_os.drawdown import compute_cash_flow_adjusted_drawdown


def test_drawdown_pure_market_movement():
    """
    Day 1: $100k -> Day 2: $110k (peak) -> Day 3: $99k (10% DD from peak 110k)
    """
    initial = 100000
    snaps = [
        {"snapshot_at": "2026-01-01T00:00:00Z", "net_liquidation_value": "100000"},
        {"snapshot_at": "2026-01-02T00:00:00Z", "net_liquidation_value": "110000"},
        {"snapshot_at": "2026-01-03T00:00:00Z", "net_liquidation_value": "99000"},
    ]
    cfs = []

    res = compute_cash_flow_adjusted_drawdown(initial, snaps, cfs)
    # Peak is 1.10. Current is 0.99. Drawdown = (1.10 - 0.99) / 1.10 = 0.10 (10%)
    assert res["current_drawdown_pct"] == Decimal("0.1")
    assert res["max_drawdown_pct"] == Decimal("0.1")


def test_drawdown_withdrawal_does_not_fabricate_drawdown():
    """
    Day 1: $100k
    Day 2: User withdraws $20k -> balance drops to $80k.
    Market return was 0%, so real trading drawdown must be 0%.
    """
    initial = 100000
    snaps = [
        {"snapshot_at": "2026-01-01T00:00:00Z", "net_liquidation_value": "100000"},
        {"snapshot_at": "2026-01-02T00:00:00Z", "net_liquidation_value": "80000"},
    ]
    cfs = [{"effective_date": "2026-01-02", "amount": "20000", "flow_type": "withdrawal"}]

    res = compute_cash_flow_adjusted_drawdown(initial, snaps, cfs)
    assert res["current_drawdown_pct"] == Decimal("0")
    assert res["max_drawdown_pct"] == Decimal("0")


def test_drawdown_deposit_does_not_mask_drawdown():
    """
    Day 1: $100k
    Day 2: Market drops to $80k (-20% loss). User deposits $20k cash on Day 2, so balance is $100k.
    The portfolio STILL suffered a 20% drawdown!
    """
    initial = 100000
    snaps = [
        {"snapshot_at": "2026-01-01T00:00:00Z", "net_liquidation_value": "100000"},
        {"snapshot_at": "2026-01-02T00:00:00Z", "net_liquidation_value": "100000"},
    ]
    cfs = [{"effective_date": "2026-01-02", "amount": "20000", "flow_type": "deposit"}]

    res = compute_cash_flow_adjusted_drawdown(initial, snaps, cfs)
    # Market end was 100k - 20k = 80k. Daily return = (80k / 100k) - 1 = -0.20
    # Peak = 1.0, Current = 0.8 -> Drawdown = 20%
    assert res["current_drawdown_pct"] == Decimal("0.2")
    assert res["max_drawdown_pct"] == Decimal("0.2")
