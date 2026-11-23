"""Swing V3.0 Backtest Lab (PRD §13, AC-18, AC-19, AC-21)."""

from decimal import Decimal

from app.services.trade_os.backtester import run_strategy_backtest


def bar(o, h, low, c, date):
    return {"date": date, "open": o, "high": h, "low": low, "close": c, "volume": 1_000_000}


def history(after):
    """200 flat bars, 60-bar uptrend, a day-5 pullback signal, then ``after`` bars."""
    rows = [(100, 100.5, 99, 100) for _ in range(200)]
    rows += [(100 + i - 0.5, 100 + i + 0.5, 100 + i - 1, 100 + i) for i in range(60)]
    rows += [
        (158.0, 158.5, 155.0, 155.5),
        (155.5, 156.0, 152.0, 152.5),
        (152.5, 153.0, 150.0, 150.5),
        (150.5, 151.5, 149.8, 151.0),
        (151.0, 154.0, 150.8, 153.8),  # signal, entry trigger 154.01
    ]
    rows += after
    return [bar(*r, date=f"d{i:04d}") for i, r in enumerate(rows)]


TRIGGER = (153.9, 155.0, 153.5, 154.8)


def test_insufficient_data():
    res = run_strategy_backtest("X", history([])[:100])
    assert "error" in res and res["trades"] == []


def test_target_hit_records_2r_trade():
    bars = history([TRIGGER, (155, 170, 154.5, 168)])
    res = run_strategy_backtest("NVDA", bars, slippage_bps=Decimal("0"))
    t = res["trades"][0]
    assert t["exit_reason"] == "TARGET"
    assert t["entry_price"] == "154.01"
    assert abs(t["r_multiple"] - 2.0) < 0.01
    assert res["summary"]["total_trades"] == 1
    assert res["summary"]["profit_factor"] is None  # no losing trade, no invented ratio


def test_ac18_same_bar_stop_and_target_assumes_stop():
    bars = history([TRIGGER, (155, 170, 140, 160)])
    t = run_strategy_backtest("NVDA", bars, slippage_bps=Decimal("0"))["trades"][0]
    assert t["exit_reason"] == "STOP"
    assert t["path_uncertain"] is True
    assert abs(t["r_multiple"] + 1.0) < 0.05


def test_gap_below_stop_exits_at_open():
    bars = history([TRIGGER, (140, 141, 139, 140)])
    t = run_strategy_backtest("NVDA", bars, slippage_bps=Decimal("0"))["trades"][0]
    assert t["exit_reason"] == "GAP_STOP"
    assert t["gap_loss"] is True
    assert t["exit_price"] == "140.00"


def test_ac19_time_exit_on_day_16_open():
    flat = [(155, 156, 154, 155)] * 20
    bars = history([TRIGGER] + flat)
    t = run_strategy_backtest("NVDA", bars, slippage_bps=Decimal("0"))["trades"][0]
    assert t["exit_reason"] == "TIME_EXIT"
    assert t["holding_days"] == 16


def test_risk_off_regime_skips_signal():
    bars = history([TRIGGER, (155, 170, 154.5, 168)])
    regimes = {b["date"]: "risk_off" for b in bars}
    res = run_strategy_backtest("NVDA", bars, regimes=regimes)
    assert res["trades"] == []
    assert res["skipped_signals"][0]["reason"] == "MARKET_RISK_OFF"


def test_cautious_regime_uses_quarter_percent_risk():
    bars = history([TRIGGER, (155, 170, 154.5, 168)])
    on = run_strategy_backtest("NVDA", bars, regimes={b["date"]: "risk_on" for b in bars})
    cautious = run_strategy_backtest("NVDA", bars, regimes={b["date"]: "cautious" for b in bars})
    # risk_on is capped by the 10% position limit; cautious by 0.25% of $100k
    assert on["trades"][0]["shares"] == 64
    assert float(cautious["trades"][0]["planned_risk"]) <= 250
    assert cautious["trades"][0]["shares"] < on["trades"][0]["shares"]


def test_ac21_same_input_same_result_and_hash():
    bars = history([TRIGGER, (155, 170, 154.5, 168)])
    a = run_strategy_backtest("NVDA", bars)
    b = run_strategy_backtest("NVDA", bars)
    assert a["config_hash"] == b["config_hash"]
    assert a["trades"] == b["trades"]
