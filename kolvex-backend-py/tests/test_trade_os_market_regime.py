from app.services.trade_os.market_regime import (
    compute_market_regime,
    evaluate_benchmark_bars,
)


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


def test_compute_market_regime_risk_on():
    spy_eval = {"valid": True, "status": "bullish", "symbol": "SPY"}
    qqq_eval = {"valid": True, "status": "bullish", "symbol": "QQQ"}

    regime = compute_market_regime(spy_eval, qqq_eval)
    assert regime["regime"] == "risk_on"
    assert regime["allow_new_entries"] is True
    assert regime["effective_risk_pct"] == "0.0050"


def test_compute_market_regime_risk_off():
    # If one is bearish (< 200 SMA), regime is risk_off
    spy_eval = {"valid": True, "status": "bullish", "symbol": "SPY"}
    qqq_eval = {"valid": True, "status": "bearish", "symbol": "QQQ"}

    regime = compute_market_regime(spy_eval, qqq_eval)
    assert regime["regime"] == "risk_off"
    assert regime["allow_new_entries"] is False
    assert regime["effective_risk_pct"] == "0.0000"


def test_compute_market_regime_neutral():
    spy_eval = {"valid": True, "status": "bullish", "symbol": "SPY"}
    qqq_eval = {"valid": True, "status": "neutral", "symbol": "QQQ"}

    regime = compute_market_regime(spy_eval, qqq_eval)
    assert regime["regime"] == "neutral"
    assert regime["allow_new_entries"] is True
    assert regime["effective_risk_pct"] == "0.0025"
