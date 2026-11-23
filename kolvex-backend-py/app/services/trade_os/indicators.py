"""
Pure deterministic technical indicators for Kolvex Trade OS.
Calculates SMA, ATR, 20-Day High/Low channels, and Volume statistics with Decimal precision.
"""

from decimal import Decimal
from typing import List, Optional, Union

from app.services.trade_os.decimal_utils import ZERO, d, quantize_money


def calculate_sma(series: List[Union[Decimal, float, str, int]], period: int) -> Optional[Decimal]:
    """
    Computes Simple Moving Average (SMA) over the most recent `period` elements.
    Returns None if there are fewer than `period` data points.
    """
    if len(series) < period or period <= 0:
        return None
    recent = [d(x) for x in series[-period:]]
    avg = sum(recent) / Decimal(period)
    return quantize_money(avg)


def calculate_atr(
    highs: List[Union[Decimal, float, str, int]],
    lows: List[Union[Decimal, float, str, int]],
    closes: List[Union[Decimal, float, str, int]],
    period: int = 14,
) -> Optional[Decimal]:
    """
    Computes Average True Range (ATR) over `period` bars.
    TR = max(H - L, abs(H - C_prev), abs(L - C_prev))
    Returns None if len < period + 1.
    """
    n = len(closes)
    if n <= period or len(highs) < n or len(lows) < n or period <= 0:
        return None

    true_ranges: List[Decimal] = []
    for i in range(1, n):
        h = d(highs[i])
        low = d(lows[i])
        prev_close = d(closes[i - 1])

        tr1 = h - low
        tr2 = abs(h - prev_close)
        tr3 = abs(low - prev_close)
        tr = max(tr1, tr2, tr3)
        true_ranges.append(tr)

    if len(true_ranges) < period:
        return None

    # Calculate standard simple or smoothed ATR over the last `period` TRs
    recent_trs = true_ranges[-period:]
    atr_val = sum(recent_trs) / Decimal(period)
    return quantize_money(atr_val)


def calculate_highest_high(
    highs: List[Union[Decimal, float, str, int]], period: int = 20
) -> Optional[Decimal]:
    """
    Computes the highest high over the last `period` bars.
    """
    if len(highs) < period or period <= 0:
        return None
    recent = [d(h) for h in highs[-period:]]
    return quantize_money(max(recent))


def calculate_lowest_low(
    lows: List[Union[Decimal, float, str, int]], period: int = 20
) -> Optional[Decimal]:
    """
    Computes the lowest low over the last `period` bars.
    """
    if len(lows) < period or period <= 0:
        return None
    recent = [d(val) for val in lows[-period:]]
    return quantize_money(min(recent))


def calculate_volume_metrics(
    volumes: List[Union[Decimal, float, str, int]], period: int = 20
) -> dict:
    """
    Calculates 20-day average volume and today's volume surge ratio.
    """
    if not volumes:
        return {
            "current_volume": 0,
            "avg_volume_20d": 0,
            "volume_surge_ratio": Decimal("1.00"),
        }

    cur_vol = int(d(volumes[-1]))
    if len(volumes) < period:
        hist_vols = [d(v) for v in volumes]
    else:
        # Exclude today to compare against prior 20-day average
        hist_vols = [d(v) for v in volumes[-(period + 1) : -1]]

    if not hist_vols:
        avg_vol = Decimal(cur_vol)
    else:
        avg_vol = sum(hist_vols) / Decimal(len(hist_vols))

    if avg_vol > ZERO:
        surge = Decimal(cur_vol) / avg_vol
    else:
        surge = Decimal("1.00")

    return {
        "current_volume": cur_vol,
        "avg_volume_20d": int(avg_vol),
        "volume_surge_ratio": quantize_money(surge),
    }
