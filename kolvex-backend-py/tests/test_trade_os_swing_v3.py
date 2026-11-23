"""Swing Trading Strategy V3.0 acceptance tests (PRD §25)."""

from datetime import datetime, timezone
from decimal import Decimal

from app.services.trade_os.market_regime import compute_market_regime, normalize_regime
from app.services.trade_os.position_sizing import calculate_position_size
from app.services.trade_os.risk_engine import (
    assess_trade_plan,
    count_consecutive_losses,
    drawdown_level,
)
from app.services.trade_os.setup_detection import (
    V3_0_PARAMS,
    build_plan_levels,
    detect_pullback_setup,
    ema_series,
    wilder_atr_series,
)

NOW = datetime(2026, 11, 23, tzinfo=timezone.utc)


def bar(o, h, low, c, date="2026-11-20"):
    return {"date": date, "open": o, "high": h, "low": low, "close": c, "volume": 1_000_000}


def uptrend(n=60, start=100.0):
    """Steady uptrend: every bar is a fresh 20-day high."""
    return [bar(start + i - 0.5, start + i + 0.5, start + i - 1, start + i) for i in range(n)]


# Pullback that dips to the EMA20 and is confirmed on day 5 (depth ~6%).
PULLBACK = [
    bar(158.0, 158.5, 155.0, 155.5),
    bar(155.5, 156.0, 152.0, 152.5),
    bar(152.5, 153.0, 150.0, 150.5),
    bar(150.5, 151.5, 149.8, 151.0),
]
SIGNAL = bar(151.0, 154.0, 150.8, 153.8)


# --- Market regime (AC-01..03) ---------------------------------------------


def ev(symbol, price, sma50, sma200, valid=True, last="2026-11-20"):
    return {
        "symbol": symbol,
        "valid": valid,
        "price": str(price),
        "sma50": str(sma50),
        "sma200": str(sma200),
        "last_bar_date": last,
    }


def test_ac01_risk_on_when_all_conditions_hold():
    r = compute_market_regime(ev("SPY", 600, 580, 550), ev("QQQ", 520, 500, 470), now=NOW)
    assert r["regime"] == "risk_on"
    assert r["allow_new_entries"] is True
    assert r["effective_risk_pct"] == "0.0050"
    assert r["max_positions"] == 4
    assert all(c["passed"] for c in r["conditions"])


def test_cautious_when_qqq_below_sma50():
    r = compute_market_regime(ev("SPY", 600, 580, 550), ev("QQQ", 490, 500, 470), now=NOW)
    assert r["regime"] == "cautious"
    assert r["effective_risk_pct"] == "0.0025"
    assert r["max_positions"] == 2
    assert r["max_open_risk_pct"] == "0.0050"


def test_ac02_risk_off_when_spy_below_sma200_even_if_qqq_strong():
    r = compute_market_regime(ev("SPY", 540, 560, 550), ev("QQQ", 520, 500, 470), now=NOW)
    assert r["regime"] == "risk_off"
    assert r["allow_new_entries"] is False


def test_ac03_unknown_without_sma200_history():
    r = compute_market_regime({"symbol": "SPY", "valid": False}, ev("QQQ", 1, 1, 1), now=NOW)
    assert r["regime"] == "unknown"
    assert r["allow_new_entries"] is False


def test_ac28_stale_close_is_unknown():
    r = compute_market_regime(
        ev("SPY", 600, 580, 550, last="2026-11-10"), ev("QQQ", 520, 500, 470), now=NOW
    )
    assert r["regime"] == "unknown"


def test_legacy_regime_names_are_normalized():
    assert normalize_regime("neutral") == "cautious"
    assert normalize_regime("stale_data") == "unknown"
    assert normalize_regime(None) == "unknown"


# --- Indicators --------------------------------------------------------------


def test_ema_seeds_with_sma_and_wilder_atr_smooths():
    values = [Decimal(x) for x in range(1, 25)]
    ema = ema_series(values, 20)
    assert ema[18] is None and ema[19] == Decimal("10.5")
    highs = [Decimal(2)] * 20
    lows = [Decimal(0)] * 20
    closes = [Decimal(1)] * 20
    atr = wilder_atr_series(highs, lows, closes, 14)
    assert atr[13] is None and atr[14] == Decimal(2) and atr[19] == Decimal(2)


# --- Setup detection (AC-05..AC-12) -----------------------------------------


def test_ac05_new_20_day_high_sets_pivot():
    res = detect_pullback_setup(uptrend())
    assert res["state"] == "PIVOT_FOUND"
    assert res["pivot_high"] == Decimal("159.5")


def test_ac07_day5_pullback_confirms_signal():
    res = detect_pullback_setup(uptrend() + PULLBACK + [SIGNAL])
    assert res["state"] == "SIGNAL_CONFIRMED", res["events"]
    sig = res["signal"]
    assert sig["pullback_days"] == 5
    assert Decimal("0.03") <= sig["pullback_depth"] <= Decimal("0.10")
    assert sig["entry"] == Decimal("154.01")
    assert sig["stop"] < sig["pullback_low"]
    assert sig["target"] == sig["entry"] + 3 * sig["risk_per_share"]  # V3.1: 3R
    assert sig["valid"] is True


def test_ac06_bounce_on_day2_is_not_a_signal():
    early = [PULLBACK[0], bar(155.0, 158.0, 154.5, 157.9)]
    res = detect_pullback_setup(uptrend() + early)
    assert res["state"] == "PULLBACK_ACTIVE"
    assert res["signal"] is None


def test_ac08_pullback_deeper_than_10pct_invalidates():
    deep = PULLBACK[:2] + [bar(152.5, 153.0, 142.0, 146.0)]
    res = detect_pullback_setup(uptrend() + deep)
    assert res["state"] == "INVALIDATED"
    assert res["reason"] == "PULLBACK_TOO_DEEP"


def test_ac09_close_below_sma50_invalidates():
    crash = PULLBACK[:1] + [bar(155.0, 155.0, 128.0, 129.0)]
    res = detect_pullback_setup(uptrend() + crash)
    assert res["state"] == "INVALIDATED"
    assert res["reason"] == "CLOSE_BELOW_SMA50"


def test_ac10_close_not_above_prior_high_is_not_a_signal():
    weak = bar(151.0, 151.6, 150.8, 151.4)  # close below prior high 151.5
    res = detect_pullback_setup(uptrend() + PULLBACK + [weak])
    assert res["state"] == "PULLBACK_ACTIVE"
    assert res["signal"] is None


def test_entry_pending_then_triggered_next_day():
    pending = bar(153.5, 153.9, 152.0, 153.0)
    res = detect_pullback_setup(uptrend() + PULLBACK + [SIGNAL, pending])
    assert res["state"] == "ENTRY_PENDING"
    hit = bar(153.6, 155.0, 153.0, 154.8)
    res = detect_pullback_setup(uptrend() + PULLBACK + [SIGNAL, pending, hit])
    assert res["state"] == "TRIGGERED"
    assert res["signal"]["fill_price"] == Decimal("154.01")


def test_ac11_signal_expires_after_two_days():
    quiet = bar(153.5, 153.9, 152.0, 153.0)
    res = detect_pullback_setup(uptrend() + PULLBACK + [SIGNAL, quiet, quiet])
    assert res["state"] == "EXPIRED"
    assert res["reason"] == "ENTRY_WINDOW_PASSED"


def test_ac12_gap_above_half_r_cancels():
    res = detect_pullback_setup(uptrend() + PULLBACK + [SIGNAL])
    r = res["signal"]["risk_per_share"]
    gap_open = float(Decimal("154.01") + r * Decimal("0.6"))
    res = detect_pullback_setup(
        uptrend() + PULLBACK + [SIGNAL, bar(gap_open, gap_open + 1, gap_open - 0.1, gap_open + 0.5)]
    )
    assert res["state"] == "INVALIDATED"
    assert res["reason"] == "GAP_ABOVE_ENTRY"


def test_ac18_stop_and_entry_same_bar_uses_conservative_path():
    wide = bar(153.0, 156.0, 140.0, 150.0)
    res = detect_pullback_setup(uptrend() + PULLBACK + [SIGNAL, wide])
    assert res["state"] == "INVALIDATED"
    assert res["signal"]["path_uncertain"] is True


def test_detection_is_deterministic():
    bars = uptrend() + PULLBACK + [SIGNAL]
    assert detect_pullback_setup(bars)["signal"] == detect_pullback_setup(bars)["signal"]


def test_plan_rejects_stop_outside_2_5_to_10_pct():
    tight = build_plan_levels("100", "99.5", "0.4")  # ~0.6% stop distance
    assert tight["valid"] is False and tight["reject_code"] == "INVALID_STOP"
    ok = build_plan_levels("100", "96", "1")
    assert ok["entry"] == Decimal("100.01")
    assert ok["stop"] == Decimal("95.25")  # V3.1: pullback low − 0.75×ATR
    v30 = build_plan_levels("100", "96", "1", V3_0_PARAMS)
    assert v30["stop"] == Decimal("95.75")
    assert v30["target"] == v30["entry"] + 2 * v30["risk_per_share"]
    assert ok["valid"] is True


# --- Position sizing (PRD §25.1) --------------------------------------------


def test_prd_numeric_example_risk_on_and_cautious():
    on = calculate_position_size(10_000, 100, 95, Decimal("0.005"), Decimal("0.10"))
    assert on["risk_per_share"] == 5
    assert on["risk_budget"] == 50
    assert on["max_allowed_quantity"] == 10
    assert on["planned_notional"] == 1000
    assert on["planned_risk_amount"] == 50
    cautious = calculate_position_size(10_000, 100, 95, Decimal("0.0025"), Decimal("0.10"))
    assert cautious["max_allowed_quantity"] == 5


def test_sizing_respects_cash_and_remaining_risk_budget():
    res = calculate_position_size(
        10_000, 100, 95, Decimal("0.005"), Decimal("0.10"), available_cash=450
    )
    assert res["max_allowed_quantity"] == 4 and res["binding_limit"] == "cash"
    res = calculate_position_size(
        10_000, 100, 95, Decimal("0.005"), Decimal("0.10"), remaining_risk_budget=15
    )
    assert res["max_allowed_quantity"] == 3 and res["binding_limit"] == "portfolio_risk"


# --- Risk engine (AC-13..17, 26, §12.5–12.7) --------------------------------

CONFIG = {
    "max_risk_per_trade_pct": "0.0050",
    "max_risk_per_trade_neutral_pct": "0.0025",
    "max_single_position_pct": "0.1000",
    "max_portfolio_risk_pct": "0.0200",
}


def assess(**kw):
    args = dict(
        symbol="ABC",
        side="long",
        planned_entry=100,
        planned_stop=95,
        planned_target=110,
        planned_quantity=10,
        account_equity=10_000,
        risk_config=CONFIG,
        market_regime="risk_on",
    )
    args.update(kw)
    return assess_trade_plan(**args)


def open_pos(symbol, qty=10, cost=100, stop=95):
    return {
        "symbol": symbol,
        "status": "open",
        "quantity": qty,
        "average_cost": cost,
        "current_stop": stop,
    }


def test_prd_example_is_approved_in_risk_on():
    res = assess()
    assert res["decision"] == "approved", res["violations"]


def test_cautious_blocks_10_shares_but_allows_5():
    assert "SINGLE_POSITION_LIMIT" in assess(market_regime="cautious")["reject_codes"]
    assert assess(market_regime="cautious", planned_quantity=5)["decision"] == "approved"


def test_unknown_regime_blocks_with_stale_code():
    assert assess(market_regime="unknown")["reject_codes"] == ["STALE_MARKET_DATA"]


def test_ac16_ac17_drawdown_levels():
    assert drawdown_level("0.05") == 0
    assert drawdown_level("0.07") == 1
    assert drawdown_level("0.08") == 2
    assert drawdown_level("0.10") == 3
    assert assess(current_drawdown_pct="0.08")["decision"] == "blocked"
    assert "DRAWDOWN_LIMIT" in assess(current_drawdown_pct="0.10")["reject_codes"]


def test_ac26_duplicate_position_blocked():
    res = assess(current_positions=[open_pos("ABC")])
    assert "DUPLICATE_POSITION" in res["reject_codes"]


def test_max_positions_in_cautious():
    res = assess(
        market_regime="cautious",
        planned_quantity=1,
        current_positions=[open_pos("X", 1), open_pos("Y", 1)],
    )
    assert "TOTAL_OPEN_RISK_LIMIT" in res["reject_codes"]


def test_ac15_total_open_risk_full_blocks_new_trade():
    full = [open_pos(s, 10, 100, 95) for s in ("A", "B", "C")]  # 3 × $50 = $150 of $200
    res = assess(current_positions=full)
    assert res["calculated_limits"]["max_allowed_quantity"] == 10
    more = full + [
        {"symbol": "D", "status": "open", "quantity": 20, "average_cost": 100, "current_stop": 97.5}
    ]
    res = assess(current_positions=more, market_regime="risk_on")
    assert res["decision"] == "blocked"


def test_stop_distance_outside_band_blocked():
    assert "INVALID_STOP" in assess(planned_stop=99, planned_quantity=1)["reject_codes"]
    assert "INVALID_STOP" in assess(planned_stop=85, planned_quantity=1)["reject_codes"]


def test_insufficient_cash_code():
    res = assess(available_cash=500)
    assert "INSUFFICIENT_CASH" in res["reject_codes"]


def test_weekly_monthly_and_streak_limits():
    assert "WEEKLY_LOSS_LIMIT" in assess(period_returns={"week": "-0.02"})["reject_codes"]
    assert "MONTHLY_LOSS_LIMIT" in assess(period_returns={"month": "-0.06"})["reject_codes"]
    assert "CONSECUTIVE_LOSSES" in assess(consecutive_losses=3)["reject_codes"]
    assert assess(period_returns={"week": "-0.01"}, consecutive_losses=2)["decision"] == "approved"


def test_consecutive_losses_counts_newest_streak():
    trades = [
        {"closed_at": "2026-11-01", "realized_pnl": "50"},
        {"closed_at": "2026-11-02", "realized_pnl": "-10"},
        {"closed_at": "2026-11-05", "realized_pnl": "-20"},
    ]
    assert count_consecutive_losses(trades) == 2
