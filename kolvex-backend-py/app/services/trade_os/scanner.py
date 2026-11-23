"""
Opportunity Scanner for Kolvex Trade OS.
Executes the MVP "Trend Breakout 20D" strategy against a universe of liquid equities.
Produces structured candidate opportunities with validated price brackets.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional

from app.services.trade_os.decimal_utils import ZERO, d, quantize_money
from app.services.trade_os.indicators import (
    calculate_atr,
    calculate_highest_high,
    calculate_lowest_low,
    calculate_sma,
    calculate_volume_metrics,
)

logger = logging.getLogger(__name__)

# Default liquid focus universe (Mega-cap & high-momentum growth leaders)
DEFAULT_SCANNER_UNIVERSE = [
    "NVDA",
    "AAPL",
    "MSFT",
    "AMZN",
    "GOOGL",
    "META",
    "TSLA",
    "AVGO",
    "AMD",
    "QCOM",
    "NFLX",
    "PLTR",
    "CRM",
    "AMAT",
    "MU",
    "LRCX",
    "PANW",
    "NOW",
    "UBER",
    "COIN",
    "ARM",
    "LLY",
    "ORCL",
    "ADBE",
    "INTU",
]

_CACHED_SCAN_RUN: Optional[Dict[str, Any]] = None


def scan_single_symbol(
    symbol: str,
    bars: List[Dict[str, Any]],
    min_avg_volume: int = 500000,
) -> Optional[Dict[str, Any]]:
    """
    Evaluates a single symbol against the Trend Breakout 20D strategy rules.
    Returns candidate dict if all criteria met, else None.
    """
    if len(bars) < 200:
        return None

    closes = [bar["close"] for bar in bars if bar.get("close") is not None]
    highs = [bar["high"] for bar in bars if bar.get("high") is not None]
    lows = [bar["low"] for bar in bars if bar.get("low") is not None]
    volumes = [bar["volume"] for bar in bars if bar.get("volume") is not None]

    if len(closes) < 200 or len(highs) < 200 or len(lows) < 200 or len(volumes) < 20:
        return None

    current_close = d(closes[-1])
    current_high = d(highs[-1])

    # 1. Moving Average Filter (Price > SMA50 > SMA200)
    sma50 = calculate_sma(closes, 50)
    sma200 = calculate_sma(closes, 200)
    if sma50 is None or sma200 is None:
        return None

    if not (current_close > sma50 and sma50 > sma200):
        return None

    # 2. Volume & Liquidity Filter
    vol_metrics = calculate_volume_metrics(volumes, 20)
    avg_vol_20d = vol_metrics["avg_volume_20d"]
    if avg_vol_20d < min_avg_volume:
        return None

    # 3. Breakout Trigger: Today's High >= 20-day Prior High
    # Prior 20 bars excluding today
    prior_highs = highs[-21:-1]
    prior_20d_high = calculate_highest_high(prior_highs, 20)
    if prior_20d_high is None or current_high < prior_20d_high:
        return None

    # 4. Volatility & Risk Brackets
    atr14 = calculate_atr(highs, lows, closes, 14) or Decimal("2.00")

    # Stop: 20-day lowest low or 2*ATR below breakout
    prior_lows = lows[-21:-1]
    lowest_20d = calculate_lowest_low(prior_lows, 20)
    stop_by_atr = current_close - (Decimal("2.0") * atr14)

    if lowest_20d is not None and lowest_20d > ZERO:
        stop_price = max(lowest_20d, stop_by_atr)
    else:
        stop_price = stop_by_atr

    # Ensure stop is strictly below entry
    if stop_price >= current_close:
        stop_price = current_close * Decimal("0.95")  # 5% fallback stop

    risk_per_share = current_close - stop_price
    target_2r = current_close + (Decimal("2.0") * risk_per_share)
    target_3r = current_close + (Decimal("3.0") * risk_per_share)

    # 5. Candidate Rank Score
    dist_sma50_pct = (current_close - sma50) / sma50 * Decimal(100)
    surge = vol_metrics["volume_surge_ratio"]
    rank_score = (surge * Decimal("40")) + (dist_sma50_pct * Decimal("20"))

    return {
        "symbol": symbol.upper(),
        "strategy_code": "TREND_BREAKOUT_20D",
        "current_price": str(quantize_money(current_close)),
        "current_high": str(quantize_money(current_high)),
        "breakout_level": str(quantize_money(prior_20d_high)),
        "sma50": str(quantize_money(sma50)),
        "sma200": str(quantize_money(sma200)),
        "distance_to_sma50_pct": str(quantize_money(dist_sma50_pct)),
        "atr14": str(quantize_money(atr14)),
        "suggested_entry": str(quantize_money(current_close)),
        "suggested_stop": str(quantize_money(stop_price)),
        "suggested_target_2r": str(quantize_money(target_2r)),
        "suggested_target_3r": str(quantize_money(target_3r)),
        "risk_per_share": str(quantize_money(risk_per_share)),
        "volume_surge_ratio": str(surge),
        "avg_volume_20d": avg_vol_20d,
        "rank_score": float(quantize_money(rank_score)),
        "matched_criteria": [
            f"Price (${current_close:.2f}) > SMA50 (${sma50:.2f}) > SMA200 (${sma200:.2f})",
            f"High (${current_high:.2f}) broke 20-day high (${prior_20d_high:.2f})",
            f"20-day Avg Volume: {avg_vol_20d:,} shares",
            f"Volume surge: {surge:.2f}x average",
        ],
    }


async def run_opportunity_scanner(
    symbols: Optional[List[str]] = None,
    bar_fetcher: Optional[Callable[[str], List[Dict[str, Any]]]] = None,
    user_id: Optional[str] = None,
    save_to_db: bool = True,
) -> Dict[str, Any]:
    """
    Runs the Trend Breakout 20D scanner across target symbols.
    """
    global _CACHED_SCAN_RUN

    target_symbols = symbols or DEFAULT_SCANNER_UNIVERSE

    if bar_fetcher is None:
        from app.services.yfinance.client import get_yfinance_service

        yf_svc = get_yfinance_service()

        def default_bar_fetcher(sym: str) -> List[Dict[str, Any]]:
            return yf_svc.get_history(sym, period="1y")

        bar_fetcher = default_bar_fetcher

    candidates: List[Dict[str, Any]] = []

    for sym in target_symbols:
        try:
            bars = bar_fetcher(sym)
            if not bars:
                continue
            cand = scan_single_symbol(sym, bars)
            if cand:
                candidates.append(cand)
        except Exception as e:
            logger.warning(f"Error scanning {sym}: {e}")

    # Sort candidates by rank_score descending
    candidates.sort(key=lambda x: x.get("rank_score", 0), reverse=True)

    scan_result = {
        "strategy_code": "TREND_BREAKOUT_20D",
        "run_at": datetime.now(timezone.utc).isoformat(),
        "universe_type": "liquid_growth_top",
        "total_scanned": len(target_symbols),
        "candidates_count": len(candidates),
        "candidates": candidates,
    }

    _CACHED_SCAN_RUN = scan_result

    if save_to_db:
        try:
            from app.core.supabase import get_supabase_service

            client = get_supabase_service()
            if client:
                client.table("trade_os_scanner_runs").insert(
                    {
                        "user_id": user_id,
                        "strategy_code": scan_result["strategy_code"],
                        "universe_type": scan_result["universe_type"],
                        "total_scanned": scan_result["total_scanned"],
                        "candidates_count": scan_result["candidates_count"],
                        "candidates": scan_result["candidates"],
                    }
                ).execute()
        except Exception as err:
            logger.warning(f"Could not persist scanner run to database: {err}")

    return scan_result


def get_latest_scanner_run() -> Dict[str, Any]:
    """Returns the cached scanner run or fetches the latest from database."""
    if _CACHED_SCAN_RUN is not None:
        return _CACHED_SCAN_RUN

    try:
        from app.core.supabase import get_supabase_service

        client = get_supabase_service()
        if client:
            res = (
                client.table("trade_os_scanner_runs")
                .select("*")
                .order("run_at", desc=True)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0:
                row = res.data[0]
                return {
                    "strategy_code": row.get("strategy_code", "TREND_BREAKOUT_20D"),
                    "run_at": row.get("run_at"),
                    "universe_type": row.get("universe_type", "liquid_growth_top"),
                    "total_scanned": row.get("total_scanned", 0),
                    "candidates_count": row.get("candidates_count", 0),
                    "candidates": row.get("candidates", []),
                }
    except Exception:
        pass

    return {
        "strategy_code": "TREND_BREAKOUT_20D",
        "run_at": datetime.now(timezone.utc).isoformat(),
        "universe_type": "liquid_growth_top",
        "total_scanned": 0,
        "candidates_count": 0,
        "candidates": [],
    }
