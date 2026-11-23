"""Swing V3.0 scanner layers (PRD §7, AC-04, AC-24)."""

import asyncio
from datetime import date

from app.services.trade_os.scanner import evaluate_symbol, run_opportunity_scanner, sort_rows

TODAY = date(2026, 11, 23)


def bar(o, h, low, c, volume=1_000_000):
    return {"date": "2026-11-20", "open": o, "high": h, "low": low, "close": c, "volume": volume}


def signal_bars(volume=1_000_000):
    flat = [bar(100, 100.5, 99, 100, volume) for _ in range(200)]
    trend = [bar(100 + i - 0.5, 100 + i + 0.5, 100 + i - 1, 100 + i, volume) for i in range(60)]
    pullback = [
        bar(158.0, 158.5, 155.0, 155.5, volume),
        bar(155.5, 156.0, 152.0, 152.5, volume),
        bar(152.5, 153.0, 150.0, 150.5, volume),
        bar(150.5, 151.5, 149.8, 151.0, volume),
        bar(151.0, 154.0, 150.8, 153.8, volume),
    ]
    return flat + trend + pullback


SPY = [bar(500, 501, 499, 500) for _ in range(265)]


def clear(_sym):
    return {"next_date": date(2027, 1, 28)}


def test_valid_signal_has_plan_levels():
    row = evaluate_symbol("NVDA", signal_bars(), SPY, "risk_on", clear, TODAY)
    assert row["status"] == "SIGNAL_CONFIRMED", row
    assert row["suggested_entry"] == "154.01"
    assert float(row["suggested_stop"]) < float(row["pullback_low"])
    assert row["reward_risk"] == "2.00"
    assert float(row["rs20_pct"]) > 0
    assert row["earnings_status"] == "clear"
    assert all(c["passed"] for c in row["checks"])


def test_ac24_unknown_earnings_blocks_instead_of_passing():
    row = evaluate_symbol(
        "NVDA", signal_bars(), SPY, "risk_on", lambda s: {"next_date": None}, TODAY
    )
    assert row["status"] == "BLOCKED"
    assert row["status_reason"] == "EVENT_DATA_UNAVAILABLE"


def test_earnings_within_five_trading_days_blocks():
    soon = lambda s: {"next_date": date(2026, 11, 27)}  # noqa: E731
    row = evaluate_symbol("NVDA", signal_bars(), SPY, "risk_on", soon, TODAY)
    assert row["status_reason"] == "EARNINGS_BLACKOUT"


def test_etf_skips_earnings_filter():
    row = evaluate_symbol(
        "XLK", signal_bars(), SPY, "risk_on", lambda s: {"next_date": None}, TODAY
    )
    assert row["status"] == "SIGNAL_CONFIRMED"
    assert row["earnings_status"] == "not_applicable"


def test_risk_off_and_unknown_regime_block_signals():
    assert (
        evaluate_symbol("NVDA", signal_bars(), SPY, "risk_off", clear, TODAY)["status_reason"]
        == "MARKET_RISK_OFF"
    )
    assert (
        evaluate_symbol("NVDA", signal_bars(), SPY, None, clear, TODAY)["status_reason"]
        == "STALE_MARKET_DATA"
    )


def test_ac04_low_dollar_volume_is_ineligible():
    row = evaluate_symbol("THIN", signal_bars(volume=10_000), SPY, "risk_on", clear, TODAY)
    assert row["status"] == "INELIGIBLE"
    assert row["status_reason"] == "LIQUIDITY_FILTER"


def test_downtrend_fails_trend_filter():
    down = [bar(300 - i + 0.5, 300 - i + 1, 300 - i - 1, 300 - i) for i in range(260)]
    row = evaluate_symbol("DOWN", down, SPY, "risk_on", clear, TODAY)
    assert row["status_reason"] == "TREND_FILTER"


def test_short_history_is_ineligible():
    row = evaluate_symbol("NEW", signal_bars()[-100:], SPY, "risk_on", clear, TODAY)
    assert row["status_reason"] == "INSUFFICIENT_DATA"


def test_sort_by_status_then_rs20_then_symbol():
    rows = [
        {"symbol": "B", "status": "TREND_VALID", "rs20_pct": "5"},
        {"symbol": "A", "status": "TREND_VALID", "rs20_pct": "5"},
        {"symbol": "C", "status": "SIGNAL_CONFIRMED", "rs20_pct": "1"},
        {"symbol": "D", "status": "TREND_VALID", "rs20_pct": "9"},
    ]
    assert [r["symbol"] for r in sort_rows(rows)] == ["C", "D", "A", "B"]


def test_run_reports_every_symbol_and_counts_only_signals():
    data = {"SPY": SPY, "NVDA": signal_bars(), "THIN": signal_bars(volume=10_000)}
    res = asyncio.run(
        run_opportunity_scanner(
            symbols=["NVDA", "THIN"],
            bar_fetcher=lambda s: data[s],
            save_to_db=False,
            market_regime="risk_on",
            earnings_lookup=clear,
        )
    )
    assert res["total_scanned"] == 2
    assert res["candidates_count"] == 1
    assert [r["symbol"] for r in res["candidates"]] == ["NVDA", "THIN"]
