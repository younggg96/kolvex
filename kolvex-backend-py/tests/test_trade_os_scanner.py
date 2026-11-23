from app.services.trade_os.scanner import scan_single_symbol


def _build_test_bars(num_bars: int, base_price: float, trend_up: bool, breakout_today: bool):
    bars = []
    price = base_price
    for i in range(num_bars - 1):
        step = 0.5 if trend_up else -0.5
        price += step
        bars.append(
            {
                "date": f"2026-01-{(i % 28) + 1:02d}",
                "open": price - 1.0,
                "high": price + 1.0,
                "low": price - 1.0,
                "close": price,
                "volume": 1000000,
            }
        )

    # Today's bar
    if breakout_today:
        today_price = price + 5.0
        today_high = price + 10.0  # Clear breakout over prior 20-day high
    else:
        today_price = price - 2.0
        today_high = price - 1.0

    bars.append(
        {
            "date": "2026-02-01",
            "open": today_price,
            "high": today_high,
            "low": today_price - 1.0,
            "close": today_price,
            "volume": 2500000,
        }
    )
    return bars


def test_scan_single_symbol_success_breakout():
    # 250 bars in uptrend + breakout today
    bars = _build_test_bars(250, 100.0, trend_up=True, breakout_today=True)
    res = scan_single_symbol("NVDA", bars, min_avg_volume=500000)
    assert res is not None
    assert res["symbol"] == "NVDA"
    assert res["strategy_code"] == "TREND_BREAKOUT_20D"
    assert float(res["suggested_entry"]) > float(res["suggested_stop"])
    assert float(res["suggested_target_2r"]) > float(res["suggested_entry"])
    assert len(res["matched_criteria"]) == 4


def test_scan_single_symbol_downtrend_rejected():
    # 250 bars in downtrend
    bars = _build_test_bars(250, 300.0, trend_up=False, breakout_today=True)
    res = scan_single_symbol("BAD_STOCK", bars, min_avg_volume=500000)
    assert res is None


def test_scan_single_symbol_no_breakout_rejected():
    # 250 bars in uptrend but no breakout today
    bars = _build_test_bars(250, 100.0, trend_up=True, breakout_today=False)
    res = scan_single_symbol("NO_BREAKOUT", bars, min_avg_volume=500000)
    assert res is None
