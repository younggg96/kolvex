"""
Unit tests for Trade OS Risk Assessment Engine
"""

from app.services.trade_os.risk_engine import assess_trade_plan

DEFAULT_RISK_CONFIG = {
    "max_risk_per_trade_pct": "0.0050",  # 0.5%
    "max_risk_per_trade_neutral_pct": "0.0025",  # 0.25%
    "max_single_position_pct": "0.1000",  # 10%
    "max_portfolio_risk_pct": "0.0200",  # 2%
    "drawdown_freeze_pct": "0.0800",  # 8%
    "drawdown_critical_pct": "0.1000",  # 10%
}


def test_assess_plan_approved():
    """Valid plan within all constraints should be APPROVED."""
    res = assess_trade_plan(
        symbol="AAPL",
        side="long",
        planned_entry="180",
        planned_stop="171",
        planned_target="198",
        planned_quantity=16,
        account_equity="30000",
        risk_config=DEFAULT_RISK_CONFIG,
        market_regime="risk_on",
    )

    assert res["decision"] == "approved"
    assert len(res["violations"]) == 0
    assert res["calculated_limits"]["planned_quantity"] == 16
    assert res["calculated_limits"]["max_allowed_quantity"] == 16


def test_assess_plan_blocked_by_risk_limit():
    """Exceeding 0.5% risk budget must be BLOCKED (AC-02)."""
    res = assess_trade_plan(
        symbol="AAPL",
        side="long",
        planned_entry="180",
        planned_stop="171",  # $9 risk/share
        planned_target="198",
        planned_quantity=50,  # 50 * $9 = $450 risk > $150 budget
        account_equity="30000",
        risk_config=DEFAULT_RISK_CONFIG,
        market_regime="risk_on",
    )

    assert res["decision"] == "blocked"
    violation_rules = [v["rule"] for v in res["violations"]]
    assert "single_trade_risk" in violation_rules


def test_assess_plan_blocked_by_portfolio_risk_budget():
    """Existing open risk + new risk exceeding 2% must be BLOCKED (AC-03)."""
    # $100,000 equity. 2% portfolio budget is $2,000.
    # Existing positions already carry $1,800 open risk.
    existing_positions = [
        {
            "symbol": "MSFT",
            "quantity": "100",
            "average_cost": "400",
            "current_stop": "382",  # 100 * $18 = $1,800 open risk
            "status": "open",
        }
    ]

    # New trade carries $400 risk (entry $100, stop $96, qty 100 -> $400 risk)
    # Total portfolio risk = $1,800 + $400 = $2,200 > $2,000 (2%)
    res = assess_trade_plan(
        symbol="NVDA",
        side="long",
        planned_entry="100",
        planned_stop="96",
        planned_target="110",
        planned_quantity=100,
        account_equity="100000",
        risk_config=DEFAULT_RISK_CONFIG,
        market_regime="risk_on",
        current_positions=existing_positions,
    )

    assert res["decision"] == "blocked"
    violation_rules = [v["rule"] for v in res["violations"]]
    assert "portfolio_risk_budget" in violation_rules


def test_assess_plan_blocked_by_account_lock():
    """When account drawdown exceeds freeze limit (>=8%) or state locked, BLOCKED (AC-10)."""
    res = assess_trade_plan(
        symbol="AAPL",
        side="long",
        planned_entry="180",
        planned_stop="171",
        planned_target="198",
        planned_quantity=10,
        account_equity="30000",
        risk_config=DEFAULT_RISK_CONFIG,
        market_regime="risk_on",
        current_drawdown_pct="0.09",  # 9% drawdown >= 8% freeze
    )

    assert res["decision"] == "blocked"
    violation_rules = [v["rule"] for v in res["violations"]]
    assert "account_drawdown_freeze" in violation_rules


def test_assess_plan_blocked_by_market_regime_risk_off():
    """Risk Off market must block new long entries."""
    res = assess_trade_plan(
        symbol="AAPL",
        side="long",
        planned_entry="180",
        planned_stop="171",
        planned_target="198",
        planned_quantity=10,
        account_equity="30000",
        risk_config=DEFAULT_RISK_CONFIG,
        market_regime="risk_off",
    )

    assert res["decision"] == "blocked"
    violation_rules = [v["rule"] for v in res["violations"]]
    assert "market_regime" in violation_rules


def test_assess_plan_neutral_market_reduces_risk_budget():
    """Neutral market cuts allowed risk per trade in half (0.25%)."""
    # $30,000 equity. 0.25% budget is $75.
    # Entry $180, Stop $171 ($9 risk/share). Max allowed qty = floor(75 / 9) = 8.
    res = assess_trade_plan(
        symbol="AAPL",
        side="long",
        planned_entry="180",
        planned_stop="171",
        planned_target="198",
        planned_quantity=8,
        account_equity="30000",
        risk_config=DEFAULT_RISK_CONFIG,
        market_regime="neutral",
    )

    assert res["decision"] == "approved"
    assert res["calculated_limits"]["max_allowed_quantity"] == 8
