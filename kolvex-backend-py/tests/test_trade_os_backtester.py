"""Swing V3.0 Backtest Lab (PRD §13, AC-18, AC-19, AC-21)."""

from decimal import Decimal

from app.services.trade_os.backtester import run_strategy_backtest
from app.services.trade_os.setup_detection import V3_0_PARAMS


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
    res = run_strategy_backtest("NVDA", bars, slippage_bps=Decimal("0"), params=V3_0_PARAMS)
    t = res["trades"][0]
    assert t["exit_reason"] == "TARGET"
    assert t["entry_price"] == "154.01"
    assert abs(t["r_multiple"] - 2.0) < 0.01
    assert res["summary"]["total_trades"] == 1
    assert res["summary"]["profit_factor"] is None  # no losing trade, no invented ratio


def test_ac18_same_bar_stop_and_target_assumes_stop():
    bars = history([TRIGGER, (155, 170, 140, 160)])
    t = run_strategy_backtest("NVDA", bars, slippage_bps=Decimal("0"), params=V3_0_PARAMS)[
        "trades"
    ][0]
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
    t = run_strategy_backtest("NVDA", bars, slippage_bps=Decimal("0"), params=V3_0_PARAMS)[
        "trades"
    ][0]
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


# --- Portfolio (PRD §13.3–13.4) ---------------------------------------------

from datetime import date, timedelta  # noqa: E402

from app.services.trade_os.backtester import research_gates, run_portfolio_backtest  # noqa: E402


def dated(bars, start=date(2023, 6, 1)):
    return [{**b, "date": (start + timedelta(days=i)).isoformat()} for i, b in enumerate(bars)]


WIN = [TRIGGER, (155, 170, 154.5, 168)]


def test_same_day_signals_respect_max_positions_and_symbol_order():
    bars = dated(history(WIN))
    regimes = {b["date"]: "cautious" for b in bars}
    res = run_portfolio_backtest({"CCC": bars, "AAA": bars, "BBB": bars}, regimes=regimes)
    assert sorted(t["symbol"] for t in res["trades"]) == ["AAA", "BBB"]
    assert {"symbol": "CCC", "reason": "MAX_POSITIONS"}.items() <= next(
        s for s in res["skipped_signals"] if s["symbol"] == "CCC"
    ).items()


def test_risk_on_takes_all_three_on_one_account():
    bars = dated(history(WIN))
    res = run_portfolio_backtest(
        {"AAA": bars, "BBB": bars, "CCC": bars}, regimes={b["date"]: "risk_on" for b in bars}
    )
    assert len(res["trades"]) == 3
    # cash is shared: three 10% positions, never more than the account
    assert float(res["summary"]["ending_capital"]) > 100000


def test_segments_split_trades_by_entry_date():
    bars = dated(history(WIN), start=date(2023, 5, 1))  # entry lands in Jan 2024
    res = run_portfolio_backtest({"AAA": bars})
    names = {s["name"]: s["summary"]["total_trades"] for s in res["segments"]}
    assert names["development"] == 0
    assert names["validation"] == 1


def test_short_history_symbols_are_excluded_not_faked():
    res = run_portfolio_backtest({"AAA": dated(history(WIN)), "NEW": dated(history([]))[:50]})
    assert res["excluded_symbols"] == ["NEW"]


def test_research_gates_report_failures():
    gates = research_gates(
        {"expectancy_r": 0.1, "profit_factor": None, "max_drawdown_pct": 4, "total_trades": 120}
    )
    assert gates["passed"] is False
    assert gates["checks"] == {
        "expectancy_r": False,
        "profit_factor": False,
        "max_drawdown_pct": True,
        "min_trades": True,
    }


def test_job_execution_with_market_filter_and_failed_fetch():
    from app.services.trade_os.backtest_jobs import _mark_stale, execute_portfolio_backtest

    bars = dated(history(WIN))
    flat = [{**b, "open": 500, "high": 501, "low": 499, "close": 500} for b in bars]

    def fetch(sym, start, end):
        if sym == "BAD":
            raise RuntimeError("boom")
        return flat if sym in ("SPY", "QQQ") else bars

    res = execute_portfolio_backtest(
        {"symbols": ["AAA", "BAD"], "start_date": "2023-01-01", "use_market_filter": True}, fetch
    )
    assert "BAD" in res["excluded_symbols"]
    assert res["gates"]["passed"] is False  # one trade is far below the 100-trade gate
    old = {"status": "running", "created_at": "2020-01-01T00:00:00+00:00"}
    assert _mark_stale(old)["status"] == "failed"


# --- Earnings rules (PRD §7.6, §11.5, AC-24) --------------------------------


def test_report_within_five_sessions_blocks_entry():
    bars = history(WIN + [(168, 169, 167, 168)] * 5)  # signal at index 264
    res = run_portfolio_backtest({"NVDA": bars}, earnings={"NVDA": ["d0267"]}, segments=())
    assert res["trades"] == []
    assert res["skipped_signals"][-1]["reason"] == "EARNINGS_BLACKOUT"


def test_open_position_exits_at_close_before_report():
    flat = [(155, 156, 154, 155)] * 20
    res = run_portfolio_backtest(
        {"NVDA": history([TRIGGER] + flat)}, earnings={"NVDA": ["d0275"]}, segments=()
    )
    t = res["trades"][0]
    assert t["exit_reason"] == "EARNINGS_EXIT"
    assert t["holding_days"] == 10  # exits on d0274, the session before the report


def test_unknown_earnings_dates_are_not_traded():
    res = run_portfolio_backtest({"NVDA": history(WIN)}, earnings={"NVDA": None}, segments=())
    assert res["trades"] == []
    assert res["skipped_signals"][-1]["reason"] == "EVENT_DATA_UNAVAILABLE"


def test_v3_1_defaults_use_3r_target_and_60_day_exit():
    up = [(155 + i * 0.1, 155.5 + i * 0.1, 154.5 + i * 0.1, 155.2 + i * 0.1) for i in range(70)]
    t = run_strategy_backtest("NVDA", history([TRIGGER] + up), slippage_bps=Decimal("0"))["trades"][
        0
    ]
    assert t["exit_reason"] == "TIME_EXIT"
    assert t["holding_days"] == 60
    assert abs(float(t["target_price"]) - (154.01 + 3 * (154.01 - float(t["stop_price"])))) < 0.02


# --- Concentration cap and account risk tiers --------------------------------


def test_group_cap_skips_extra_positions_in_the_same_group():
    bars = dated(history(WIN))
    groups = {"AAA": "tech", "BBB": "tech", "CCC": "tech"}
    regimes = {b["date"]: "risk_on" for b in bars}
    res = run_portfolio_backtest(
        {"AAA": bars, "BBB": bars, "CCC": bars},
        regimes=regimes,
        params={"max_per_group": 2},
        groups=groups,
        segments=(),
    )
    assert [t["symbol"] for t in res["trades"]] == ["AAA", "BBB"]
    assert {s["symbol"]: s["reason"] for s in res["skipped_signals"]}["CCC"] == "GROUP_LIMIT"


def test_group_cap_is_off_by_default():
    bars = dated(history(WIN))
    res = run_portfolio_backtest(
        {"AAA": bars, "BBB": bars},
        regimes={b["date"]: "risk_on" for b in bars},
        groups={"AAA": "tech", "BBB": "tech"},
        segments=(),
    )
    assert len(res["trades"]) == 2


def test_drawdown_tiers_are_on_by_default_and_recorded_in_the_config_hash():
    bars = dated(history(WIN))
    on = run_portfolio_backtest({"AAA": bars}, segments=())
    off = run_portfolio_backtest({"AAA": bars}, segments=(), params={"drawdown_tiers": False})
    assert on["config"]["params"]["drawdown_tiers"] == "True"
    assert on["config_hash"] != off["config_hash"]
