from decimal import Decimal

from app.services.trade_os.indicators import (
    calculate_atr,
    calculate_highest_high,
    calculate_lowest_low,
    calculate_sma,
    calculate_volume_metrics,
)


def test_calculate_sma():
    prices = [Decimal(str(i)) for i in range(1, 11)]  # 1..10
    sma5 = calculate_sma(prices, 5)
    # last 5 are 6, 7, 8, 9, 10 -> sum=40 -> avg=8.00
    assert sma5 == Decimal("8.00")

    # Not enough data
    assert calculate_sma(prices, 20) is None


def test_calculate_atr():
    # 5 bars
    highs = [10, 12, 11, 13, 14]
    lows = [8, 9, 10, 11, 12]
    closes = [9, 11, 10.5, 12.5, 13]

    atr = calculate_atr(highs, lows, closes, period=3)
    assert atr is not None
    assert atr > Decimal("0")


def test_calculate_highest_high_and_lowest_low():
    highs = [10, 20, 15, 30, 25]
    lows = [5, 12, 8, 22, 18]

    hh = calculate_highest_high(highs, period=3)
    # last 3 highs: 15, 30, 25 -> max 30.00
    assert hh == Decimal("30.00")

    ll = calculate_lowest_low(lows, period=3)
    # last 3 lows: 8, 22, 18 -> min 8.00
    assert ll == Decimal("8.00")


def test_calculate_volume_metrics():
    # 20 historical bars of 1,000,000 volume, plus current bar of 2,500,000
    vols = [1000000] * 20 + [2500000]
    metrics = calculate_volume_metrics(vols, period=20)
    assert metrics["current_volume"] == 2500000
    assert metrics["avg_volume_20d"] == 1000000
    assert metrics["volume_surge_ratio"] == Decimal("2.50")
