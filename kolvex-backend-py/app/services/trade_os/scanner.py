"""
Stock Scanner for Kolvex Trade OS — Swing Trading Strategy V3.0 (PRD §7).

Four filter layers, then the pullback state machine from ``setup_detection``:
  1. Liquidity: close >= $10 and 20-day average dollar volume >= $20M
  2. Trend:     EMA20 > SMA50 > SMA200 and close > SMA50
  3. RS20:      stock 20-day return − SPY 20-day return > 0 (also the sort key)
  4. Events:    no earnings in the next 5 trading days; unknown calendar blocks the signal

Every symbol gets a status (PRD §7.7) with a reason, not just the passing ones.
AI scores are never used here.
"""

import asyncio
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional

from app.services.trade_os.decimal_utils import ZERO, d, quantize_money
from app.services.trade_os.market_regime import get_latest_market_regime, normalize_regime
from app.services.trade_os.setup_detection import (
    DEFAULT_PARAMS,
    STRATEGY_CODE,
    STRATEGY_VERSION,
    detect_pullback_setup,
    ema_series,
    sma_series,
)
from app.services.trade_os.trading_calendar import (
    completed_bars,
    last_completed_session,
    sessions_after,
)
from app.services.trade_os.universe import (
    build_universe,
    default_product_lookup,
    sector_of,
)

logger = logging.getLogger(__name__)

# The scan universe (core, sector, ETF, YouTube and Reddit lists) lives in universe.py.

SCAN_CONCURRENCY = 8
MIN_PRICE = Decimal("10")
MIN_DOLLAR_VOLUME = Decimal("20000000")
EARNINGS_WINDOW_TRADING_DAYS = 5

SIGNAL_STATES = ("SIGNAL_CONFIRMED", "ENTRY_PENDING")
_STATUS_ORDER = {
    "SIGNAL_CONFIRMED": 0,
    "ENTRY_PENDING": 1,
    "TRIGGERED": 2,
    "BLOCKED": 3,
    "PULLBACK_ACTIVE": 4,
    "TREND_VALID": 5,
    "EXPIRED": 6,
    "INVALIDATED": 7,
    "INELIGIBLE": 8,
}

_CACHED_SCAN_RUN: Optional[Dict[str, Any]] = None


def _pct(value: Optional[Decimal]) -> Optional[str]:
    return None if value is None else str(quantize_money(value * Decimal(100)))


def _money(value: Optional[Decimal]) -> Optional[str]:
    return None if value is None else str(quantize_money(value))


def _return_20d(closes: List[Decimal]) -> Optional[Decimal]:
    if len(closes) < 21 or closes[-21] <= ZERO:
        return None
    return closes[-1] / closes[-21] - 1


def evaluate_symbol(
    symbol: str,
    bars: List[Dict[str, Any]],
    spy_bars: Optional[List[Dict[str, Any]]] = None,
    market_regime: Optional[str] = None,
    earnings_lookup: Optional[Callable[[str], Dict[str, Any]]] = None,
    today: Optional[date] = None,
    product_lookup: Optional[Callable[[str], Dict[str, bool]]] = None,
) -> Dict[str, Any]:
    """Runs all four layers plus the setup state machine for one symbol."""
    sym = symbol.upper()
    row: Dict[str, Any] = {
        "symbol": sym,
        "strategy_code": STRATEGY_CODE,
        "strategy_version": STRATEGY_VERSION,
        "status": "INELIGIBLE",
        "status_reason": None,
        "checks": [],
    }
    clean = [
        b
        for b in bars
        if all(b.get(k) is not None for k in ("open", "high", "low", "close", "volume"))
    ]
    if len(clean) < 200 or len(clean) != len(bars):
        row["status_reason"] = "INSUFFICIENT_DATA"
        return row

    closes = [d(b["close"]) for b in clean]
    vols = [d(b["volume"]) for b in clean]
    close = closes[-1]
    ema20 = ema_series(closes, 20)[-1]
    sma50 = sma_series(closes, 50)[-1]
    sma200 = sma_series(closes, 200)[-1]
    dollar_vol = sum(c * v for c, v in zip(closes[-20:], vols[-20:])) / Decimal(20)
    row.update(
        {
            "current_price": _money(close),
            "data_as_of": clean[-1].get("date"),
            "avg_dollar_volume_20d": str(int(dollar_vol)),
            "ema20": _money(ema20),
            "sma50": _money(sma50),
            "sma200": _money(sma200),
        }
    )

    def check(code: str, passed: bool) -> bool:
        row["checks"].append({"code": code, "passed": passed})
        return passed

    # Layer 1: liquidity
    liquid = check("PRICE_AT_LEAST_10", close >= MIN_PRICE) & check(
        "DOLLAR_VOLUME_20M", dollar_vol >= MIN_DOLLAR_VOLUME
    )
    # Layer 2: trend
    trend = (
        check("EMA20_ABOVE_SMA50", ema20 > sma50)
        & check("SMA50_ABOVE_SMA200", sma50 > sma200)
        & check("CLOSE_ABOVE_SMA50", close > sma50)
    )
    # Layer 3: RS20
    stock_ret = _return_20d(closes)
    spy_closes = [d(b["close"]) for b in (spy_bars or []) if b.get("close") is not None]
    spy_ret = _return_20d(spy_closes)
    rs20 = None if stock_ret is None or spy_ret is None else stock_ret - spy_ret
    row["rs20_pct"] = _pct(rs20)
    strong = check("RS20_POSITIVE", rs20 is not None and rs20 > ZERO)

    if not liquid:
        row["status_reason"] = "LIQUIDITY_FILTER"
        return row
    if not trend:
        row["status_reason"] = "TREND_FILTER"
        return row
    if rs20 is None:
        row["status_reason"] = "RS_DATA_UNAVAILABLE"
        return row
    if not strong:
        row["status_reason"] = "RS20_NOT_POSITIVE"
        return row

    # Setup state machine
    setup = detect_pullback_setup(clean)
    state = setup["state"]
    row.update(
        {
            "status": "TREND_VALID" if state in ("SEARCHING", "PIVOT_FOUND") else state,
            "status_reason": setup.get("reason"),
            "pivot_high": _money(setup.get("pivot_high")),
            "pivot_date": setup.get("pivot_date"),
            "pullback_low": _money(setup.get("pullback_low")),
            "pullback_days": setup.get("pullback_days") or None,
            "pullback_depth_pct": _pct(setup.get("pullback_depth")),
            "atr14": _money(setup.get("atr14")),
        }
    )

    sig = setup.get("signal")
    if sig and state in SIGNAL_STATES + ("TRIGGERED",):
        row.update(
            {
                "signal_date": sig.get("signal_date"),
                "pivot_high": _money(sig["pivot_high"]),
                "pullback_low": _money(sig["pullback_low"]),
                "pullback_days": sig["pullback_days"],
                "pullback_depth_pct": _pct(sig["pullback_depth"]),
                "atr14": _money(sig["atr14"]),
                "suggested_entry": _money(sig["entry"]),
                "suggested_stop": _money(sig["stop"]),
                "suggested_target": _money(sig["target"]),
                "risk_per_share": _money(sig["risk_per_share"]),
                "stop_distance_pct": _pct(sig["stop_distance_pct"]),
                "reward_risk": str(quantize_money(DEFAULT_PARAMS["target_r_multiple"])),
            }
        )

    if state not in SIGNAL_STATES:
        return row

    # Layer 4: product type and earnings (only looked up for live signals)
    product = (product_lookup or default_product_lookup)(sym)
    if product["leveraged"]:
        row.update(status="BLOCKED", status_reason="LEVERAGED_PRODUCT")
        return row
    if product["is_etf"]:
        row["earnings_status"] = "not_applicable"
    else:
        info = (earnings_lookup or default_earnings_lookup)(sym)
        next_date = info.get("next_date")
        row["earnings_date"] = next_date.isoformat() if next_date else None
        if next_date is None:
            row["earnings_status"] = "unavailable"
        else:
            gap = sessions_after(today or last_completed_session(), next_date)
            row["earnings_status"] = "blackout" if gap <= EARNINGS_WINDOW_TRADING_DAYS else "clear"

    # Market and event gates turn a valid signal into BLOCKED, with the reason kept.
    regime = normalize_regime(market_regime)
    if regime == "risk_off":
        row.update(status="BLOCKED", status_reason="MARKET_RISK_OFF")
    elif regime == "unknown":
        row.update(status="BLOCKED", status_reason="STALE_MARKET_DATA")
    elif row.get("earnings_status") == "blackout":
        row.update(status="BLOCKED", status_reason="EARNINGS_BLACKOUT")
    elif row.get("earnings_status") == "unavailable":
        row.update(status="BLOCKED", status_reason="EVENT_DATA_UNAVAILABLE")
    return row


def default_earnings_lookup(symbol: str) -> Dict[str, Any]:
    """Next known earnings date from Yahoo; ``next_date`` is None when it cannot be confirmed."""
    try:
        from app.services.yfinance.client import get_yfinance_service

        today = datetime.now(timezone.utc).date()
        dates = get_yfinance_service().get_earnings(symbol).get("earnings_dates") or []
        upcoming = sorted(
            dt
            for dt in (
                datetime.fromisoformat(str(e["date"])[:10]).date() for e in dates if e.get("date")
            )
            if dt >= today
        )
        return {"next_date": upcoming[0] if upcoming else None}
    except Exception as e:  # noqa: BLE001 - any failure means "unknown", never "clear"
        logger.warning(f"Earnings lookup failed for {symbol}: {e}")
        return {"next_date": None}


def sort_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Status first, then RS20 high→low, then symbol (PRD §7.8, §13.4)."""
    return sorted(
        rows,
        key=lambda r: (
            _STATUS_ORDER.get(r["status"], 99),
            -float(r["rs20_pct"]) if r.get("rs20_pct") is not None else float("inf"),
            r["symbol"],
        ),
    )


async def run_opportunity_scanner(
    symbols: Optional[List[str]] = None,
    bar_fetcher: Optional[Callable[[str], List[Dict[str, Any]]]] = None,
    user_id: Optional[str] = None,
    save_to_db: bool = True,
    market_regime: Optional[str] = None,
    earnings_lookup: Optional[Callable[[str], Dict[str, Any]]] = None,
    trading_date: Optional[date] = None,
) -> Dict[str, Any]:
    """Runs the Swing V3.0 scanner across the universe and returns every symbol's status."""
    global _CACHED_SCAN_RUN

    if symbols:
        target_symbols = [s.strip().upper() for s in symbols if s.strip()]
        universe = {
            "symbols": target_symbols,
            "sources": {s: ["manual"] for s in target_symbols},
            "counts": {"manual": len(target_symbols), "total": len(target_symbols)},
            "errors": {},
        }
    else:
        universe = await build_universe()
        target_symbols = universe["symbols"]

    if bar_fetcher is None:
        from app.services.yfinance.client import get_yfinance_service

        yf_svc = get_yfinance_service()

        def bar_fetcher(sym: str) -> List[Dict[str, Any]]:
            return completed_bars(yf_svc.get_history(sym, period="1y"))

    regime_result = None
    if market_regime is None:
        regime_result = get_latest_market_regime()
        market_regime = regime_result["regime"]

    try:
        spy_bars = await asyncio.to_thread(bar_fetcher, "SPY")
    except Exception as e:
        logger.warning(f"Failed to fetch SPY bars for RS20: {e}")
        spy_bars = []

    gate = asyncio.Semaphore(SCAN_CONCURRENCY)
    errors: List[str] = []

    async def scan_one(sym: str) -> Dict[str, Any]:
        # Bars come from blocking yfinance calls: run them off the event loop, a few at a time.
        async with gate:
            try:
                row = await asyncio.to_thread(
                    lambda: evaluate_symbol(
                        sym, bar_fetcher(sym) or [], spy_bars, market_regime, earnings_lookup
                    )
                )
            except Exception as e:
                logger.warning(f"Error scanning {sym}: {e}")
                errors.append(sym)
                row = {
                    "symbol": sym,
                    "strategy_code": STRATEGY_CODE,
                    "status": "INELIGIBLE",
                    "status_reason": "DATA_FETCH_FAILED",
                    "checks": [],
                }
        row["sources"] = universe["sources"].get(sym, [])
        if sector_of(sym):
            row["sector"] = sector_of(sym)
        return row

    rows: List[Dict[str, Any]] = list(await asyncio.gather(*(scan_one(s) for s in target_symbols)))

    rows = sort_rows(rows)
    signals = [r for r in rows if r["status"] in SIGNAL_STATES]

    scan_result = {
        "strategy_code": STRATEGY_CODE,
        "strategy_version": STRATEGY_VERSION,
        "run_at": datetime.now(timezone.utc).isoformat(),
        "trading_date": trading_date.isoformat() if trading_date else None,
        "universe_type": "mixed" if not symbols else "manual",
        "universe": {"counts": universe["counts"], "errors": universe["errors"]},
        "market_regime": normalize_regime(market_regime),
        "total_scanned": len(target_symbols),
        "candidates_count": len(signals),
        "failed_symbols": errors,
        "candidates": rows,
    }

    _CACHED_SCAN_RUN = scan_result

    if save_to_db:
        from app.services.trade_os.persistence import save_row

        row = {
            "user_id": user_id,
            "strategy_code": scan_result["strategy_code"],
            "universe_type": scan_result["universe_type"],
            "total_scanned": scan_result["total_scanned"],
            "candidates_count": scan_result["candidates_count"],
            "candidates": scan_result["candidates"],
            "strategy_version": STRATEGY_VERSION,
            "market_regime": scan_result["market_regime"],
            "failed_symbols": errors,
            "universe": scan_result["universe"],
        }
        if trading_date is not None:
            row["trading_date"] = trading_date.isoformat()
        save_row(
            "trade_os_scanner_runs",
            row,
            (
                "user_id",
                "strategy_code",
                "universe_type",
                "total_scanned",
                "candidates_count",
                "candidates",
            ),
            on_conflict="strategy_code,trading_date" if trading_date else None,
        )

    return scan_result


def _universe_from_rows(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Per-source counts rebuilt from stored rows (runs saved before the universe column)."""
    counts: Dict[str, int] = {}
    for r in rows:
        for tag in r.get("sources") or []:
            counts[tag] = counts.get(tag, 0) + 1
    return {"counts": {**counts, "total": len(rows)}, "errors": {}}


def get_latest_scanner_run() -> Optional[Dict[str, Any]]:
    """Latest Swing V3.0 run, or None when there is none (older breakout runs are ignored)."""
    stored: Optional[Dict[str, Any]] = None
    try:
        from app.core.supabase import get_supabase_service

        client = get_supabase_service()
        if client:
            res = (
                client.table("trade_os_scanner_runs")
                .select("*")
                .eq("strategy_code", STRATEGY_CODE)
                .order("run_at", desc=True)
                .limit(1)
                .execute()
            )
            if res.data:
                row = res.data[0]
                cands = row.get("candidates", []) or []
                stored = {
                    "strategy_code": row.get("strategy_code"),
                    "strategy_version": STRATEGY_VERSION,
                    "run_at": row.get("run_at"),
                    "universe_type": row.get("universe_type"),
                    "market_regime": row.get("market_regime"),
                    "trading_date": row.get("trading_date"),
                    "total_scanned": row.get("total_scanned", 0),
                    "candidates_count": row.get("candidates_count", 0),
                    "failed_symbols": row.get("failed_symbols") or [],
                    "universe": row.get("universe") or _universe_from_rows(cands),
                    "candidates": cands,
                }
    except Exception as e:
        logger.warning(f"Could not read latest scanner run: {e}")

    # Prefer whichever is newer: the stored run (maybe from another replica) or our own.
    runs = [r for r in (stored, _CACHED_SCAN_RUN) if r is not None]
    if not runs:
        return None
    return max(runs, key=lambda r: str(r.get("run_at") or ""))
