"""Technical indicator tool: EMA, RSI, ATR, volume and swing-based levels from daily bars.

Computed in code with the same functions the chart's AI technical analysis uses
(app/services/technical_analysis.py); no model is called here.
"""

import json
import logging
from typing import Any, Optional

from langchain_core.tools import tool

logger = logging.getLogger(__name__)

VIEW_BARS = 252  # about one year of sessions for swings, levels and the 52-week range
MIN_BARS = 30
MAX_LEVELS = 3


def _round(value: Optional[float], digits: int = 2) -> Optional[float]:
    return round(value, digits) if value is not None else None


def _pct(value: float, base: Optional[float]) -> Optional[float]:
    return round((value / base - 1) * 100, 2) if base else None


def indicators_payload(symbol: str, history: list[dict[str, Any]]) -> dict[str, Any]:
    """Indicators for the latest daily bar. `history` is oldest first; bars with a missing price are dropped."""
    from app.services import technical_analysis as ta

    bars = [
        b
        for b in history
        if all(
            isinstance(b.get(k), (int, float)) and b[k] > 0
            for k in ("open", "high", "low", "close")
        )
    ]
    if len(bars) < MIN_BARS:
        return {
            "symbol": symbol,
            "error": f"no technical indicators: fewer than {MIN_BARS} daily bars",
        }
    closes = [b["close"] for b in bars]
    view = bars[-VIEW_BARS:]
    last = view[-1]["close"]

    averages = {}
    for period in (20, 50, 200):
        value = ta.ema(closes, period)[-1]
        averages[f"ema{period}"] = {"value": _round(value), "close_vs_ema_pct": _pct(last, value)}

    atr = ta.atr(view)
    volumes = [b.get("volume") for b in bars[-21:-1]]
    current_volume = bars[-1].get("volume")
    relative_volume = None
    if (
        len(volumes) == 20
        and all(isinstance(v, (int, float)) and v >= 0 for v in volumes)
        and current_volume
    ):
        average = sum(volumes) / 20
        relative_volume = round(current_volume / average, 2) if average else None

    # Same swing window and level tolerance as the chart analysis.
    window = 2 if len(view) < 60 else 3 if len(view) < 200 else 5
    tolerance = max(atr * 0.6, last * 0.002)
    levels = ta.candidate_levels(ta.swing_points(view, window), tolerance)
    supports = sorted((lv for lv in levels if lv["price"] < last), key=lambda lv: -lv["price"])[
        :MAX_LEVELS
    ]
    resistances = sorted((lv for lv in levels if lv["price"] > last), key=lambda lv: lv["price"])[
        :MAX_LEVELS
    ]

    high = max(b["high"] for b in view)
    low = min(b["low"] for b in view)
    rsi = ta.rsi(closes)
    return {
        "symbol": symbol,
        "interval": "1d",
        "last_bar_date": str(view[-1]["date"])[:10],
        "last_close": round(last, 2),
        "bars_used": len(bars),
        "moving_averages": averages,
        "rsi14": _round(rsi, 1),
        "atr14": round(atr, 2),
        "atr14_pct": _pct(last + atr, last),
        "relative_volume": relative_volume,
        "range": {
            "sessions": len(view),
            "high": round(high, 2),
            "low": round(low, 2),
            "close_vs_high_pct": _pct(last, high),
            "close_vs_low_pct": _pct(last, low),
        },
        "supports": supports,
        "resistances": resistances,
        "note": (
            "Computed from unadjusted daily bars; the last bar may be today's unfinished session. "
            "Levels are clusters of past swing highs and lows (touches = how many). Descriptive, not a forecast."
        ),
    }


@tool
def get_technical_indicators(symbol: str) -> str:
    """Get technical indicators for a stock from its daily price history.

    Returns EMA 20/50/200 and how far the close is from each, RSI(14), ATR(14), relative
    volume versus the prior 20 sessions, the one-year high/low range, and the nearest
    support and resistance levels found from past swing highs and lows. Use for questions
    about trend, momentum, overbought/oversold, volatility or support/resistance. Describe
    what the indicators show; do not turn them into price targets or buy/sell advice.

    Args:
        symbol: Stock ticker symbol, e.g. "NVDA".
    """
    from app.services.yfinance.client import get_yfinance_service

    ticker = symbol.upper().strip()
    try:
        history = get_yfinance_service().get_history(ticker, period="2y", interval="1d")
        payload = indicators_payload(ticker, history)
    except Exception as error:  # noqa: BLE001
        logger.warning("get_technical_indicators failed for %s: %s", ticker, error)
        payload = {"symbol": ticker, "error": "technical indicators unavailable"}
    return json.dumps(payload, ensure_ascii=False, default=str)
