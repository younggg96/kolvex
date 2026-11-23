from decimal import Decimal

from app.services.trade_os.backtester import run_strategy_backtest


def _generate_synthetic_stock_history(total_bars: int = 300):
    bars = []
    price = 100.0
    for i in range(total_bars):
        # Create clear bull market trend with several breakout waves and consolidation
        if i < 200:
            price += 0.2
        elif 200 <= i < 230:
            price += 1.0  # Wave 1 breakout
        elif 230 <= i < 250:
            price -= 0.3  # Consolidation
        elif 250 <= i < 280:
            price += 1.2  # Wave 2 breakout
        else:
            price -= 0.5

        bars.append(
            {
                "date": f"2025-{(i // 25) + 1:02d}-{(i % 25) + 1:02d}",
                "open": round(price - 0.5, 2),
                "high": round(price + 1.5, 2),
                "low": round(price - 1.0, 2),
                "close": round(price, 2),
                "volume": 2000000,
            }
        )
    return bars


def test_backtest_insufficient_data():
    bars = _generate_synthetic_stock_history(100)
    res = run_strategy_backtest("NVDA", bars)
    assert "error" in res
    assert len(res["trades"]) == 0


def test_backtest_execution_and_statistics():
    bars = _generate_synthetic_stock_history(300)
    res = run_strategy_backtest(
        symbol="NVDA",
        bars=bars,
        initial_capital=Decimal("100000.00"),
        risk_per_trade_pct=Decimal("0.0050"),
    )

    assert "summary" in res
    summary = res["summary"]
    assert summary["symbol"] == "NVDA"
    assert summary["total_trades"] > 0
    assert summary["win_rate_pct"] >= 0.0
    assert summary["profit_factor"] >= 0.0
    assert "expectancy_r" in summary
    assert "max_drawdown_pct" in summary
    assert len(res["equity_curve"]) == 100  # 300 - 200 warmup bars

    # Check trade log details
    trades = res["trades"]
    for t in trades:
        assert float(t["entry_price"]) > 0
        assert float(t["exit_price"]) > 0
        assert t["exit_reason"] in ("stop_loss", "take_profit", "time_stop")
        assert "r_multiple" in t
