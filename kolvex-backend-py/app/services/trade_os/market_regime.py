"""
Market Regime Engine for Kolvex Trade OS.
Determines macro market risk environment (Risk On / Neutral / Risk Off)
using dual-benchmark (SPY and QQQ) 200-day and 50-day moving average confirmation.
"""

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional

from app.services.trade_os.decimal_utils import ZERO, d, quantize_money
from app.services.trade_os.indicators import calculate_sma
from app.services.trade_os.trading_calendar import completed_bars, is_stale

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


RULE_VERSION = "swing-v3.0/regime-1"

# PRD §6.3 / §12.2 — limits that follow from each market state.
REGIME_LIMITS: Dict[str, Dict[str, Any]] = {
    "risk_on": {
        "allow_new_entries": True,
        "risk_pct": Decimal("0.0050"),
        "max_positions": 4,
        "max_open_risk_pct": Decimal("0.0200"),
    },
    "cautious": {
        "allow_new_entries": True,
        "risk_pct": Decimal("0.0025"),
        "max_positions": 2,
        "max_open_risk_pct": Decimal("0.0050"),
    },
    "risk_off": {
        "allow_new_entries": False,
        "risk_pct": Decimal("0"),
        "max_positions": 0,
        "max_open_risk_pct": Decimal("0"),
    },
    "unknown": {
        "allow_new_entries": False,
        "risk_pct": Decimal("0"),
        "max_positions": 0,
        "max_open_risk_pct": Decimal("0"),
    },
}

# Older rows and clients used these names.
_LEGACY_REGIMES = {"neutral": "cautious", "stale_data": "unknown"}

# A daily close more than this many completed NYSE sessions old is stale (PRD §6.4).
MAX_SESSION_LAG = 1

LEGACY_REGIME_COLUMNS = (
    "regime",
    "summary",
    "spy_metrics",
    "qqq_metrics",
    "allow_new_entries",
    "effective_risk_pct",
)


def normalize_regime(value: Optional[str]) -> str:
    v = (value or "unknown").strip().lower()
    v = _LEGACY_REGIMES.get(v, v)
    return v if v in REGIME_LIMITS else "unknown"


def regime_limits(value: Optional[str]) -> Dict[str, Any]:
    return REGIME_LIMITS[normalize_regime(value)]


def _bar_date(raw: Any) -> Optional[datetime]:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(raw)[:10])
        return parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _result(
    regime: str,
    summary: str,
    spy_eval: Dict[str, Any],
    qqq_eval: Dict[str, Any],
    conditions: List[Dict[str, Any]],
    now: datetime,
) -> Dict[str, Any]:
    limits = REGIME_LIMITS[regime]
    return {
        "regime": regime,
        "allow_new_entries": limits["allow_new_entries"],
        "effective_risk_pct": str(limits["risk_pct"]),
        "max_positions": limits["max_positions"],
        "max_open_risk_pct": str(limits["max_open_risk_pct"]),
        "conditions": conditions,
        "rule_version": RULE_VERSION,
        "data_as_of": spy_eval.get("last_bar_date") if spy_eval.get("valid") else None,
        "summary": summary,
        "spy": spy_eval,
        "qqq": qqq_eval,
        "evaluated_at": now.isoformat(),
    }


def compute_market_regime(
    spy_eval: Dict[str, Any],
    qqq_eval: Dict[str, Any],
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Swing V3.0 market state (PRD §6.3):
    - RISK_ON:  SPY close > SMA200 AND SPY SMA50 > SMA200 AND QQQ close > QQQ SMA50
    - CAUTIOUS: SPY close > SMA200 but not all RISK_ON conditions
    - RISK_OFF: SPY close <= SMA200
    - UNKNOWN:  missing / insufficient / stale data -> no new entries (PRD §6.4)
    """
    now = now or datetime.now(timezone.utc)

    if not spy_eval.get("valid") or not qqq_eval.get("valid"):
        return _result(
            "unknown",
            "Benchmark data is missing or too short for SMA200. New entries are blocked until data recovers.",
            spy_eval,
            qqq_eval,
            [],
            now,
        )

    for ev in (spy_eval, qqq_eval):
        last = _bar_date(ev.get("last_bar_date"))
        if last is not None and is_stale(last.date(), now, MAX_SESSION_LAG):
            return _result(
                "unknown",
                f"{ev['symbol']} last daily close is {ev.get('last_bar_date')}, more than "
                f"{MAX_SESSION_LAG} trading session behind. New entries are blocked.",
                spy_eval,
                qqq_eval,
                [],
                now,
            )

    spy_price, spy50, spy200 = d(spy_eval["price"]), d(spy_eval["sma50"]), d(spy_eval["sma200"])
    qqq_price, qqq50 = d(qqq_eval["price"]), d(qqq_eval["sma50"])
    conditions = [
        {"code": "SPY_CLOSE_ABOVE_SMA200", "passed": spy_price > spy200},
        {"code": "SPY_SMA50_ABOVE_SMA200", "passed": spy50 > spy200},
        {"code": "QQQ_CLOSE_ABOVE_SMA50", "passed": qqq_price > qqq50},
    ]

    if not conditions[0]["passed"]:
        regime = "risk_off"
        summary = "SPY closed at or below its 200-day SMA. New long entries are prohibited."
    elif all(cond["passed"] for cond in conditions):
        regime = "risk_on"
        summary = "All Risk On conditions hold. 0.50% risk per trade, up to 4 positions, 2% total open risk."
    else:
        regime = "cautious"
        summary = "SPY is above its 200-day SMA but not every Risk On condition holds. 0.25% per trade, up to 2 positions, 0.5% total open risk."

    return _result(regime, summary, spy_eval, qqq_eval, conditions, now)


def regime_by_date(
    spy_bars: List[Dict[str, Any]], qqq_bars: List[Dict[str, Any]]
) -> Dict[str, str]:
    """
    Historical market state for every SPY date, using only bars up to that date
    (for backtests; PRD §13.4 time correctness).
    """
    qqq_index = {b.get("date"): i for i, b in enumerate(qqq_bars)}
    out: Dict[str, str] = {}
    for k, spy_bar in enumerate(spy_bars):
        day = spy_bar.get("date")
        q = qqq_index.get(day)
        if q is None:
            out[day] = "unknown"
            continue
        spy_eval = evaluate_benchmark_bars("SPY", spy_bars[: k + 1])
        qqq_eval = evaluate_benchmark_bars("QQQ", qqq_bars[: q + 1])
        as_of = _bar_date(day) or datetime.now(timezone.utc)
        out[day] = compute_market_regime(spy_eval, qqq_eval, now=as_of)["regime"]
    return out


async def evaluate_market_regime(
    bar_fetcher: Optional[Callable[[str], List[Dict[str, Any]]]] = None,
    save_to_db: bool = True,
    trading_date: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Fetches 1y history for SPY and QQQ, computes market regime, and saves to database.
    ``trading_date`` is set by the after-close job; it makes the stored row unique per day.
    """
    global _CACHED_REGIME

    if bar_fetcher is None:
        from app.services.yfinance.client import get_yfinance_service

        yf_svc = get_yfinance_service()

        def default_bar_fetcher(sym: str) -> List[Dict[str, Any]]:
            return completed_bars(yf_svc.get_history(sym, period="1y"))

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
        from app.services.trade_os.persistence import save_row

        row = {
            "regime": regime_result["regime"],
            "summary": regime_result["summary"],
            "spy_metrics": spy_eval,
            "qqq_metrics": qqq_eval,
            "allow_new_entries": regime_result["allow_new_entries"],
            "effective_risk_pct": float(regime_result["effective_risk_pct"]),
            "rule_version": regime_result["rule_version"],
            "conditions": regime_result["conditions"],
            "data_as_of": regime_result["data_as_of"],
            "max_positions": regime_result["max_positions"],
            "max_open_risk_pct": float(regime_result["max_open_risk_pct"]),
        }
        if trading_date is not None:
            row["trading_date"] = trading_date.isoformat()
        save_row(
            "trade_os_market_regimes",
            row,
            LEGACY_REGIME_COLUMNS,
            on_conflict="trading_date,rule_version" if trading_date else None,
        )

    return regime_result


def get_latest_market_regime() -> Dict[str, Any]:
    """
    Newest stored evaluation (from the after-close job or a manual recalculation),
    falling back to this process's cache. Staleness is re-checked on every read, so a
    Friday close never reads as current the following Thursday.
    """
    candidates: List[Dict[str, Any]] = []
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
            if res.data:
                row = res.data[0]
                candidates.append(
                    {
                        "spy": row.get("spy_metrics") or {},
                        "qqq": row.get("qqq_metrics") or {},
                        "evaluated_at": row.get("evaluated_at"),
                    }
                )
    except Exception as err:  # noqa: BLE001
        logger.warning(f"Could not read stored market regime: {err}")

    if _CACHED_REGIME is not None:
        candidates.append(_CACHED_REGIME)

    if candidates:
        newest = max(candidates, key=lambda r: str(r.get("evaluated_at") or ""))
        result = compute_market_regime(newest["spy"], newest["qqq"])
        result["evaluated_at"] = newest.get("evaluated_at")
        return result

    # No evaluation yet: never pretend the market is Risk On.
    return _result(
        "unknown",
        "No market regime has been evaluated yet. New entries are blocked until one is.",
        {"symbol": "SPY", "valid": False, "status": "stale_data"},
        {"symbol": "QQQ", "valid": False, "status": "stale_data"},
        [],
        datetime.now(timezone.utc),
    )
