"""Score expired trading signals against what the market actually did.

Method (METHOD_VERSION 2):
- Entry: open of the first trading day after trade_date (an analysis finishes intraday,
  so the trade_date close was not realistically available).
- Exit: close of the last trading day on or before expires_on.
- Benchmark: SPY over the same entry open -> exit close.
- Hit (relative): BUY when excess return > 0, SELL when < 0, HOLD when |excess| <= HOLD_BAND_PCT.
  None when the SPY window is missing; it never falls back to the raw return.
- Direction hit: the same rule applied to the raw return.
- Bracket: walks daily bars from entry; if one bar touches both stop and target the stop
  is assumed first (conservative). SELL is scored as a short.
Only `structured`, point-in-time signals are scored. Backfilled analyses read data published
after their trade date, so they are counted separately and never scored.
"""
import asyncio
import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Optional
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

METHOD_VERSION = 2
BENCHMARK = "SPY"
HOLD_BAND_PCT = 2.0
# Give the data provider this long after expiry before calling a signal unscoreable.
GRACE_DAYS = 10
# Only look this far back for unscored signals; older ones were settled by the grace rule.
SCAN_WINDOW_DAYS = 45
SIGNALS_TABLE = "agent_signals"
EVALUATIONS_TABLE = "agent_signal_evaluations"
NY = ZoneInfo("America/New_York")

HistoryFn = Callable[[str, str, str], list[dict[str, Any]]]


def _day(bar: dict) -> date:
    return date.fromisoformat(str(bar["date"])[:10])


def _pct(a: float, b: float) -> float:
    return round((a / b - 1) * 100, 4)


def _window(bars: list[dict], trade_date: date, expires_on: date):
    """(entry_bar, exit_bar, path) or None when the data does not cover the window yet."""
    usable = sorted((b for b in bars if b.get("open") and b.get("close")), key=_day)
    entry = next((b for b in usable if _day(b) > trade_date), None)
    if entry is None:
        return None
    path = [b for b in usable if _day(entry) <= _day(b) <= expires_on]
    if not path:
        return None
    return entry, path[-1], path


def score_signal(
    signal: dict,
    bars: list[dict],
    benchmark_bars: list[dict],
    today: date,
) -> Optional[dict[str, Any]]:
    """Evaluation row for one signal, or None when it should be retried later."""
    trade_date = date.fromisoformat(signal["trade_date"])
    expires_on = date.fromisoformat(signal["expires_on"])
    base = {"signal_id": signal["id"], "user_id": signal["user_id"], "method_version": METHOD_VERSION}
    if today <= expires_on:
        return None  # the exit close is not final yet

    window = _window(bars, trade_date, expires_on)
    # A last bar before expiry is fine (weekend/holiday) unless data is clearly missing.
    complete = window is not None and (expires_on - _day(window[1])).days <= 4
    if not complete:
        if (today - expires_on).days > GRACE_DAYS:
            return {**base, "status": "unscoreable", "error": "no price data covering the signal window"}
        return None

    entry_bar, exit_bar, path = window
    entry, exit_ = float(entry_bar["open"]), float(exit_bar["close"])
    ret = _pct(exit_, entry)

    bench = None
    bench_window = _window(benchmark_bars, trade_date, expires_on)
    if bench_window and _day(bench_window[0]) == _day(entry_bar) and _day(bench_window[1]) == _day(exit_bar):
        bench = _pct(float(bench_window[1]["close"]), float(bench_window[0]["open"]))
    excess = round(ret - bench, 4) if bench is not None else None

    rating = signal["rating"]
    direction = {"BUY": 1, "SELL": -1}.get(rating, 0)
    hit = _hit(rating, excess) if excess is not None else None

    max_adverse = None
    bracket_outcome = bracket_return = None
    if direction:
        lows = [float(b["low"] or b["close"]) for b in path]
        highs = [float(b["high"] or b["close"]) for b in path]
        max_adverse = _pct(min(lows), entry) if direction > 0 else -_pct(max(highs), entry)
        bracket_outcome, bracket_return = _bracket(path, entry, direction, signal.get("stop_loss_pct"),
                                                   signal.get("take_profit_pct"), ret)

    return {
        **base, "status": "scored", "error": None,
        "entry_date": _day(entry_bar).isoformat(), "entry_price": entry,
        "exit_date": _day(exit_bar).isoformat(), "exit_price": exit_,
        "return_pct": ret, "benchmark_return_pct": bench, "excess_return_pct": excess,
        # Positive = the call made money relative to the benchmark (BUY long, SELL short).
        "signed_excess_pct": round(excess * direction, 4) if direction and excess is not None else None,
        "hit": hit,
        "direction_hit": _hit(rating, ret),
        "max_adverse_pct": max_adverse,
        "bracket_outcome": bracket_outcome, "bracket_return_pct": bracket_return,
    }


def _hit(rating: str, change: float) -> bool:
    if rating == "BUY":
        return change > 0
    if rating == "SELL":
        return change < 0
    return abs(change) <= HOLD_BAND_PCT


def _bracket(path, entry, direction, stop_pct, target_pct, plain_return):
    if stop_pct is None and target_pct is None:
        return None, None
    stop = entry * (1 - direction * float(stop_pct) / 100) if stop_pct is not None else None
    target = entry * (1 + direction * float(target_pct) / 100) if target_pct is not None else None
    for b in path:
        low, high = float(b["low"] or b["close"]), float(b["high"] or b["close"])
        if stop is not None and (low <= stop if direction > 0 else high >= stop):
            return "stop_loss", round(-float(stop_pct), 4)
        if target is not None and (high >= target if direction > 0 else low <= target):
            return "take_profit", round(float(target_pct), 4)
    return "expired", round(plain_return * direction, 4)


# ---------------------------------------------------------------------------
# Job
# ---------------------------------------------------------------------------

def due_signals(db: Any, today: date) -> list[dict]:
    """Structured signals whose window closed recently and have no evaluation yet."""
    since = (today - timedelta(days=SCAN_WINDOW_DAYS)).isoformat()
    out, offset = [], 0
    while True:
        rows = (db.table(SIGNALS_TABLE)
                .select("id,user_id,ticker,trade_date,expires_on,rating,stop_loss_pct,take_profit_pct")
                .eq("extraction_status", "structured").eq("point_in_time", True)
                .lt("expires_on", today.isoformat()).gte("expires_on", since)
                .order("expires_on").range(offset, offset + 499).execute().data) or []
        out.extend(rows)
        if len(rows) < 500:
            break
        offset += 500
    if not out:
        return []
    done: set[str] = set()
    ids = [r["id"] for r in out]
    for i in range(0, len(ids), 200):
        rows = (db.table(EVALUATIONS_TABLE).select("signal_id,method_version")
                .in_("signal_id", ids[i:i + 200]).execute().data) or []
        # Rows from an older method are re-scored in place (upsert on signal_id).
        done.update(r["signal_id"] for r in rows if r.get("method_version") == METHOD_VERSION)
    return [r for r in out if r["id"] not in done]


def evaluate_due_signals(db: Any, history: HistoryFn, today: Optional[date] = None) -> dict[str, int]:
    """One pass. history(symbol, start, end) returns daily bars; end is exclusive."""
    today = today or datetime.now(timezone.utc).astimezone(NY).date()
    signals = due_signals(db, today)
    counts = {"due": len(signals), "scored": 0, "unscoreable": 0, "pending": 0, "failed": 0}
    if not signals:
        return counts

    start = min(s["trade_date"] for s in signals)
    end = (today + timedelta(days=1)).isoformat()
    cache: dict[str, Optional[list[dict]]] = {}

    def bars(symbol: str) -> Optional[list[dict]]:
        """None means the fetch failed: retry next pass, never call the signal unscoreable."""
        if symbol not in cache:
            try:
                cache[symbol] = history(symbol, start, end) or []
            except Exception as error:  # noqa: BLE001
                logger.warning("[SignalEval] history failed for %s: %s", symbol, error)
                cache[symbol] = None
        return cache[symbol]

    benchmark = bars(BENCHMARK)
    for signal in signals:
        try:
            stock = bars(signal["ticker"])
            if stock is None or benchmark is None:
                counts["pending"] += 1
                continue
            row = score_signal(signal, stock, benchmark, today)
            if row is None:
                counts["pending"] += 1
                continue
            db.table(EVALUATIONS_TABLE).upsert(row, on_conflict="signal_id").execute()
            counts[row["status"]] += 1
        except Exception:  # noqa: BLE001
            counts["failed"] += 1
            logger.exception("[SignalEval] scoring signal %s failed", signal.get("id"))
    logger.info("[SignalEval] pass done: %s", counts)
    return counts


def _yfinance_history(symbol: str, start: str, end: str) -> list[dict]:
    from app.services.yfinance.client import get_yfinance_service
    return get_yfinance_service().get_history(symbol, interval="1d", start=start, end=end)


async def run_signal_evaluation_worker() -> None:
    # Opt in after applying the agent_signals and agent_signal_evaluations migrations.
    if os.getenv("AGENT_SIGNAL_EVAL_WORKER_ENABLED", "false").lower() != "true":
        return
    from app.core.supabase import get_supabase_service
    interval = int(os.getenv("AGENT_SIGNAL_EVAL_INTERVAL_SECONDS", str(6 * 3600)))
    while True:
        try:
            await asyncio.to_thread(evaluate_due_signals, get_supabase_service(), _yfinance_history)
        except Exception:  # noqa: BLE001
            logger.exception("[SignalEval] worker pass failed")
        await asyncio.sleep(interval)


# ---------------------------------------------------------------------------
# Performance summary
# ---------------------------------------------------------------------------

CONVICTION_BUCKETS = ((0.0, 0.4, "0-0.4"), (0.4, 0.6, "0.4-0.6"), (0.6, 0.8, "0.6-0.8"), (0.8, 1.01, "0.8-1"))


def _stats(rows: list[dict]) -> dict[str, Any]:
    n = len(rows)
    if not n:
        return {"count": 0, "hit_rate": None, "direction_hit_rate": None,
                "avg_excess_pct": None, "avg_signed_excess_pct": None}
    hits = [r["hit"] for r in rows if r.get("hit") is not None]
    direction = [r["direction_hit"] for r in rows if r.get("direction_hit") is not None]
    excess = [r["excess_return_pct"] for r in rows if r.get("excess_return_pct") is not None]
    signed = [r["signed_excess_pct"] for r in rows if r.get("signed_excess_pct") is not None]
    return {
        "count": n,
        # Relative to SPY; rows without a benchmark window are left out, not judged on raw return.
        "hit_rate": round(sum(hits) / len(hits) * 100, 2) if hits else None,
        "direction_hit_rate": round(sum(direction) / len(direction) * 100, 2) if direction else None,
        "avg_excess_pct": round(sum(excess) / len(excess), 4) if excess else None,
        "avg_signed_excess_pct": round(sum(signed) / len(signed), 4) if signed else None,
    }


def _group(rows: list[dict], key: Callable[[dict], Any]) -> dict[str, Any]:
    groups: dict[str, list[dict]] = {}
    for r in rows:
        groups.setdefault(str(key(r)), []).append(r)
    return {k: _stats(v) for k, v in sorted(groups.items())}


def _bucket(conviction: float) -> str:
    return next(label for lo, hi, label in CONVICTION_BUCKETS if lo <= conviction < hi)


def summarize(signals: list[dict]) -> dict[str, Any]:
    """signals: agent_signals rows, each with an `evaluation` dict or None."""
    by_status: dict[str, int] = {}
    for s in signals:
        by_status[s["extraction_status"]] = by_status.get(s["extraction_status"], 0) + 1
    scored = []
    unscoreable = awaiting = backfilled = outdated = 0
    for s in signals:
        if s["extraction_status"] != "structured":
            continue
        if not s.get("point_in_time"):
            backfilled += 1
            continue
        ev = s.get("evaluation")
        if not ev:
            awaiting += 1
        elif ev.get("method_version") != METHOD_VERSION:
            outdated += 1
        elif ev["status"] == "unscoreable":
            unscoreable += 1
        else:
            scored.append({**ev, "rating": s["rating"], "conviction": float(s["conviction"]),
                           "model_id": s.get("model_id"), "position_action": s.get("position_action")})
    brackets = [r for r in scored if r.get("bracket_outcome")]
    return {
        "method_version": METHOD_VERSION,
        "signals": len(signals),
        "by_extraction_status": by_status,
        "awaiting_evaluation": awaiting,
        # Analyses run after their trade date: their inputs leak the future, so never scored.
        "backfilled": backfilled,
        # Scored under an earlier method; kept out so one summary never mixes definitions.
        "outdated_method": outdated,
        "unscoreable": unscoreable,
        "overall": _stats(scored),
        "by_rating": _group(scored, lambda r: r["rating"]),
        # Calibration: hit rate should rise with conviction, or conviction must not size positions.
        "by_conviction": {label: _stats([r for r in scored if _bucket(r["conviction"]) == label])
                          for _, _, label in CONVICTION_BUCKETS},
        "by_model": _group(scored, lambda r: r.get("model_id") or "unknown"),
        "by_position_action": _group(scored, lambda r: r.get("position_action") or "none"),
        "brackets": {
            "count": len(brackets),
            "stop_loss": sum(1 for r in brackets if r["bracket_outcome"] == "stop_loss"),
            "take_profit": sum(1 for r in brackets if r["bracket_outcome"] == "take_profit"),
            "expired": sum(1 for r in brackets if r["bracket_outcome"] == "expired"),
            "avg_return_pct": round(sum(r["bracket_return_pct"] for r in brackets) / len(brackets), 4) if brackets else None,
        },
    }


def load_user_performance(db: Any, user_id: str, limit: int = 2000) -> dict[str, Any]:
    rows = (db.table(SIGNALS_TABLE)
            .select("id,rating,conviction,model_id,position_action,extraction_status,point_in_time,"
                    f"{EVALUATIONS_TABLE}(*)")
            .eq("user_id", user_id).order("trade_date", desc=True).limit(limit).execute().data) or []
    for r in rows:
        ev = r.pop(EVALUATIONS_TABLE, None)
        r["evaluation"] = ev[0] if isinstance(ev, list) and ev else (ev or None)
    return summarize(rows)
