"""
Market Regime Engine for Kolvex Trade OS.
Determines macro market risk environment (Risk On / Neutral / Risk Off)
using dual-benchmark (SPY and QQQ) 200-day and 50-day moving average confirmation.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional

from app.services.trade_os.decimal_utils import ZERO, d, quantize_money
from app.services.trade_os.indicators import calculate_sma

logger = logging.getLogger(__name__)

# In-memory cached regime evaluation
_CACHED_REGIME: Optional[Dict[str, Any]] = None


def evaluate_benchmark_bars(
    symbol: str,
    bars: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Evaluates a single index benchmark (e.g. SPY, QQQ) from daily OHLCV bars.
    Requires at least 200 bars for valid 200 SMA calculation.
    """
    if len(bars) < 200:
        return {
            "symbol": symbol.upper(),
            "valid": False,
            "status": "stale_data",
            "message": f"Insufficient historical bars ({len(bars)}/200)",
            "price": None,
            "sma50": None,
            "sma200": None,
            "distance_to_sma200_pct": None,
            "is_above_sma200": False,
            "is_above_sma50": False,
            "is_golden_cross": False,
        }

    closes = [bar["close"] for bar in bars if bar.get("close") is not None]
    if len(closes) < 200:
        return {
            "symbol": symbol.upper(),
            "valid": False,
            "status": "stale_data",
            "message": "Missing close prices in historical data",
        }

    latest_price = d(closes[-1])
    sma50 = calculate_sma(closes, 50)
    sma200 = calculate_sma(closes, 200)

    if sma50 is None or sma200 is None:
        return {
            "symbol": symbol.upper(),
            "valid": False,
            "status": "stale_data",
            "message": "Could not compute moving averages",
        }

    # Distance to 200 SMA
    dist_200 = (latest_price - sma200) / sma200 * Decimal(100)
    dist_200_quantized = quantize_money(dist_200)

    # 20-day slope of 200 SMA
    prior_closes = closes[:-20]
    prior_sma200 = calculate_sma(prior_closes, 200) if len(prior_closes) >= 200 else sma200
    sma200_slope = (
        (sma200 - prior_sma200) / prior_sma200 * Decimal(100) if prior_sma200 > ZERO else ZERO
    )

    is_above_sma200 = latest_price > sma200
    is_above_sma50 = latest_price > sma50
    is_golden_cross = sma50 > sma200

    if not is_above_sma200:
        status = "bearish"
    elif is_above_sma200 and is_above_sma50 and is_golden_cross:
        status = "bullish"
    else:
        status = "neutral"

    return {
        "symbol": symbol.upper(),
        "valid": True,
        "status": status,
        "price": str(latest_price),
        "sma50": str(sma50),
        "sma200": str(sma200),
        "sma200_slope_20d_pct": str(quantize_money(sma200_slope)),
        "distance_to_sma200_pct": str(dist_200_quantized),
        "is_above_sma200": is_above_sma200,
        "is_above_sma50": is_above_sma50,
        "is_golden_cross": is_golden_cross,
        "last_bar_date": bars[-1].get("date"),
    }


def compute_market_regime(
    spy_eval: Dict[str, Any],
    qqq_eval: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Combines SPY and QQQ evaluations to determine overall Market Regime.
    Rules:
    - If either has stale/invalid data -> 'stale_data'
    - If either is bearish (< 200 SMA) -> 'risk_off'
    - If both are bullish (> 50 SMA > 200 SMA) -> 'risk_on'
    - Otherwise -> 'neutral'
    """
    if not spy_eval.get("valid") or not qqq_eval.get("valid"):
        return {
            "regime": "stale_data",
            "allow_new_entries": False,
            "effective_risk_pct": "0.0000",
            "summary": "Market benchmark data is unconfirmed or stale. New trade plan approvals are suspended.",
            "spy": spy_eval,
            "qqq": qqq_eval,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }

    spy_status = spy_eval["status"]
    qqq_status = qqq_eval["status"]

    if spy_status == "bearish" or qqq_status == "bearish":
        regime = "risk_off"
        allow_new_entries = False
        effective_risk = Decimal("0.0000")
        summary = (
            "SPY or QQQ is below 200 SMA. Risk Off regime active: all new long entries prohibited."
        )
    elif spy_status == "bullish" and qqq_status == "bullish":
        regime = "risk_on"
        allow_new_entries = True
        effective_risk = Decimal("0.0050")
        summary = "Both SPY and QQQ are in healthy bull market structure (Price > 50 SMA > 200 SMA). Full 0.50% risk budget."
    else:
        regime = "neutral"
        allow_new_entries = True
        effective_risk = Decimal("0.0025")
        summary = "Mixed benchmark signals. Neutral regime active: new trade entries allowed at half risk (0.25%)."

    return {
        "regime": regime,
        "allow_new_entries": allow_new_entries,
        "effective_risk_pct": str(effective_risk),
        "summary": summary,
        "spy": spy_eval,
        "qqq": qqq_eval,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }


async def evaluate_market_regime(
    bar_fetcher: Optional[Callable[[str], List[Dict[str, Any]]]] = None,
    save_to_db: bool = True,
) -> Dict[str, Any]:
    """
    Fetches 1y history for SPY and QQQ, computes market regime, and saves to database.
    """
    global _CACHED_REGIME

    if bar_fetcher is None:
        from app.services.yfinance.client import get_yfinance_service

        yf_svc = get_yfinance_service()

        def default_bar_fetcher(sym: str) -> List[Dict[str, Any]]:
            return yf_svc.get_history(sym, period="1y")

        bar_fetcher = default_bar_fetcher

    try:
        spy_bars = bar_fetcher("SPY")
    except Exception as e:
        logger.warning(f"Failed to fetch SPY bars: {e}")
        spy_bars = []

    try:
        qqq_bars = bar_fetcher("QQQ")
    except Exception as e:
        logger.warning(f"Failed to fetch QQQ bars: {e}")
        qqq_bars = []

    spy_eval = evaluate_benchmark_bars("SPY", spy_bars)
    qqq_eval = evaluate_benchmark_bars("QQQ", qqq_bars)

    regime_result = compute_market_regime(spy_eval, qqq_eval)
    _CACHED_REGIME = regime_result

    if save_to_db:
        try:
            from app.core.supabase import get_supabase_service

            client = get_supabase_service()
            if client:
                client.table("trade_os_market_regimes").insert(
                    {
                        "regime": regime_result["regime"],
                        "summary": regime_result["summary"],
                        "spy_metrics": spy_eval,
                        "qqq_metrics": qqq_eval,
                        "allow_new_entries": regime_result["allow_new_entries"],
                        "effective_risk_pct": float(regime_result["effective_risk_pct"]),
                    }
                ).execute()
        except Exception as err:
            logger.warning(f"Could not persist market regime to database: {err}")

    return regime_result


def get_latest_market_regime() -> Dict[str, Any]:
    """Returns the cached regime evaluation or a fallback."""
    if _CACHED_REGIME is not None:
        return _CACHED_REGIME

    # Check database
    try:
        from app.core.supabase import get_supabase_service

        client = get_supabase_service()
        if client:
            res = (
                client.table("trade_os_market_regimes")
                .select("*")
                .order("evaluated_at", desc=True)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0:
                row = res.data[0]
                return {
                    "regime": row["regime"],
                    "summary": row.get("summary", ""),
                    "spy": row.get("spy_metrics", {}),
                    "qqq": row.get("qqq_metrics", {}),
                    "allow_new_entries": row.get("allow_new_entries", False),
                    "effective_risk_pct": str(row.get("effective_risk_pct", "0.0050")),
                    "evaluated_at": row.get("evaluated_at"),
                }
    except Exception:
        pass

    # Default fallback
    return {
        "regime": "risk_on",
        "summary": "Defaulting to Risk On (initial setup)",
        "allow_new_entries": True,
        "effective_risk_pct": "0.0050",
        "spy": {"symbol": "SPY", "status": "bullish", "valid": True},
        "qqq": {"symbol": "QQQ", "status": "bullish", "valid": True},
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }
