from app.services.trade_os.market_regime import evaluate_benchmark_bars


def _generate_bars(num_bars: int, start_price: float, step: float):
    bars = []
    price = start_price
    for i in range(num_bars):
        price += step
        bars.append(
            {
                "date": f"2026-01-{(i % 28) + 1:02d}",
                "open": price - 1.0,
                "high": price + 2.0,
                "low": price - 2.0,
                "close": price,
                "volume": 50000000,
            }
        )
    return bars


def test_evaluate_benchmark_insufficient_bars():
    bars = _generate_bars(50, 100.0, 0.5)
    res = evaluate_benchmark_bars("SPY", bars)
    assert res["valid"] is False
    assert res["status"] == "stale_data"


def test_evaluate_benchmark_bullish():
    # 250 bars with upward trend: 100 up to 225
    bars = _generate_bars(250, 100.0, 0.5)
    res = evaluate_benchmark_bars("SPY", bars)
    assert res["valid"] is True
    assert res["status"] == "bullish"
    assert res["is_above_sma200"] is True
    assert res["is_above_sma50"] is True
    assert res["is_golden_cross"] is True


def test_evaluate_benchmark_bearish():
    # 250 bars with downward trend: 300 down to 175
    bars = _generate_bars(250, 300.0, -0.5)
    res = evaluate_benchmark_bars("QQQ", bars)
    assert res["valid"] is True
    assert res["status"] == "bearish"
    assert res["is_above_sma200"] is False


# compute_market_regime rules (Swing V3.0, PRD §6.3) are covered in test_trade_os_swing_v3.py.
