"""
Swing Trading Strategy V3.0 — Trend Pullback Confirmation (PRD §7–§10).

Pure, deterministic functions. Every value for bar ``i`` is computed only from
bars ``0..i`` so a signal can never read data after its own signal day.

State machine (PRD §8.1):
    SEARCHING -> PIVOT_FOUND -> PULLBACK_ACTIVE -> SIGNAL_CONFIRMED -> ENTRY_PENDING
    then TRIGGERED / EXPIRED / INVALIDATED

The scanner layers (liquidity, trend, RS20, earnings) and the market / risk
gates live in ``scanner.py`` and ``risk_engine.py``; this module only knows
about one symbol's price bars.
"""

from dataclasses import dataclass, field
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal
from typing import Any, Dict, List, Optional

from app.services.trade_os.decimal_utils import ZERO, d

STRATEGY_CODE = "SWING_V3_TREND_PULLBACK"
STRATEGY_VERSION = "3.1.0"

# Swing V3.0 as written in the PRD (2026-11-23). Kept so it can still be backtested.
V3_0_PARAMS: Dict[str, Any] = {
    "pivot_lookback": 20,
    "pullback_min_days": 3,
    "pullback_max_days": 10,
    "pullback_min_depth": Decimal("0.03"),
    "pullback_max_depth": Decimal("0.10"),
    "stop_atr_buffer": Decimal("0.25"),
    "target_r_multiple": Decimal("2"),
    "time_exit_day": 16,
    "min_stop_distance": Decimal("0.025"),
    "max_stop_distance": Decimal("0.10"),
    "entry_window_days": 2,
    "max_gap_r": Decimal("0.5"),
    "earnings_blackout_sessions": 5,
    "tick": Decimal("0.01"),
}

# Swing V3.1 (adopted 2026-11-23): wider stop, 3R target, 60-session time exit.
# Chosen on 2017–2023 only, confirmed on 2024–2025; see
# docs/trade-os/research-2026-11-23-swing-v3-params.md. Everything else is unchanged.
DEFAULT_PARAMS: Dict[str, Any] = {
    **V3_0_PARAMS,
    "stop_atr_buffer": Decimal("0.75"),
    "target_r_multiple": Decimal("3"),
    "time_exit_day": 60,
}

TICK = Decimal("0.01")


# ---------------------------------------------------------------------------
# Indicator series (causal: value at i uses bars 0..i only)
# ---------------------------------------------------------------------------


def sma_series(values: List[Decimal], period: int) -> List[Optional[Decimal]]:
    out: List[Optional[Decimal]] = [None] * len(values)
    running = ZERO
    for i, v in enumerate(values):
        running += v
        if i >= period:
            running -= values[i - period]
        if i >= period - 1:
            out[i] = running / Decimal(period)
    return out


def ema_series(values: List[Decimal], period: int) -> List[Optional[Decimal]]:
    """EMA seeded with the SMA of the first ``period`` values."""
    out: List[Optional[Decimal]] = [None] * len(values)
    if len(values) < period:
        return out
    k = Decimal(2) / Decimal(period + 1)
    prev = sum(values[:period]) / Decimal(period)
    out[period - 1] = prev
    for i in range(period, len(values)):
        prev = values[i] * k + prev * (1 - k)
        out[i] = prev
    return out


def wilder_atr_series(
    highs: List[Decimal], lows: List[Decimal], closes: List[Decimal], period: int = 14
) -> List[Optional[Decimal]]:
    """ATR with Wilder smoothing (PRD §8.5). First value = mean of first ``period`` TRs."""
    n = len(closes)
    out: List[Optional[Decimal]] = [None] * n
    if n <= period:
        return out
    trs: List[Decimal] = [ZERO]  # bar 0 has no previous close
    for i in range(1, n):
        trs.append(
            max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i - 1]),
                abs(lows[i] - closes[i - 1]),
            )
        )
    prev = sum(trs[1 : period + 1]) / Decimal(period)
    out[period] = prev
    for i in range(period + 1, n):
        prev = (prev * Decimal(period - 1) + trs[i]) / Decimal(period)
        out[i] = prev
    return out


def round_to_tick(value: Decimal, mode: str = "nearest") -> Decimal:
    if mode == "up":
        return (value / TICK).to_integral_value(rounding=ROUND_CEILING) * TICK
    if mode == "down":
        return (value / TICK).to_integral_value(rounding=ROUND_FLOOR) * TICK
    return value.quantize(TICK)


# ---------------------------------------------------------------------------
# Plan geometry (PRD §9.2)
# ---------------------------------------------------------------------------


def build_plan_levels(
    signal_high: Any,
    pullback_low: Any,
    atr14: Any,
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Entry = Signal High + $0.01
    Stop  = Pullback Low − 0.25 × ATR14   (rounded down to the tick)
    R     = Entry − Stop
    Target = Entry + 2R
    Valid only when 2.5% ≤ R / Entry ≤ 10%.
    """
    p = {**DEFAULT_PARAMS, **(params or {})}
    entry = round_to_tick(d(signal_high) + p["tick"])
    stop = round_to_tick(d(pullback_low) - p["stop_atr_buffer"] * d(atr14), "down")
    r = entry - stop
    target = round_to_tick(entry + p["target_r_multiple"] * r)
    distance = r / entry if entry > ZERO else ZERO
    valid = r > ZERO and p["min_stop_distance"] <= distance <= p["max_stop_distance"]
    return {
        "entry": entry,
        "stop": stop,
        "target": target,
        "risk_per_share": r,
        "stop_distance_pct": distance,
        "valid": valid,
        "reject_code": None if valid else "INVALID_STOP",
    }


# ---------------------------------------------------------------------------
# State machine (PRD §8, §10.1–10.2)
# ---------------------------------------------------------------------------


@dataclass
class SetupState:
    state: str = "SEARCHING"
    pivot_index: Optional[int] = None
    pivot_high: Optional[Decimal] = None
    pullback_low: Optional[Decimal] = None
    pullback_days: int = 0
    ema_touched: bool = False
    signal_index: Optional[int] = None
    signal: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    event_index: Optional[int] = None
    events: List[Dict[str, Any]] = field(default_factory=list)
    signals: List[Dict[str, Any]] = field(default_factory=list)


def _bar_series(bars: List[Dict[str, Any]]) -> Dict[str, List[Decimal]]:
    return {
        "open": [d(b["open"]) for b in bars],
        "high": [d(b["high"]) for b in bars],
        "low": [d(b["low"]) for b in bars],
        "close": [d(b["close"]) for b in bars],
    }


def detect_pullback_setup(
    bars: List[Dict[str, Any]],
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Replays the state machine over ``bars`` (oldest first) and returns the state
    as of the last bar, the most recent signal (if any) and an event log with
    reasons for every reset, invalidation and expiry.
    """
    p = {**DEFAULT_PARAMS, **(params or {})}
    required = ("open", "high", "low", "close")
    if not bars or any(b.get(k) is None for b in bars for k in required):
        return {"state": "INELIGIBLE", "reason": "MISSING_PRICE_DATA", "events": []}

    s = _bar_series(bars)
    o, h, lo, c = s["open"], s["high"], s["low"], s["close"]
    ema20 = ema_series(c, 20)
    sma50 = sma_series(c, 50)
    atr14 = wilder_atr_series(h, lo, c, 14)
    lookback = p["pivot_lookback"]

    st = SetupState()

    def finish(state: str, i: int, reason: str) -> None:
        if st.state in ("SIGNAL_CONFIRMED", "ENTRY_PENDING") and st.signal is not None:
            st.signal["outcome"], st.signal["outcome_reason"] = state, reason
            st.signal["outcome_index"] = i
        st.events.append(
            {"index": i, "date": bars[i].get("date"), "state": state, "reason": reason}
        )
        st.state, st.reason, st.event_index = state, reason, i
        st.pivot_index = st.pivot_high = st.pullback_low = None
        st.pullback_days, st.ema_touched = 0, False

    for i in range(lookback, len(bars)):
        # Terminal states only last for the bar they happened on.
        if st.state in ("TRIGGERED", "EXPIRED", "INVALIDATED") and st.event_index != i:
            st.state, st.reason = "SEARCHING", None

        # --- Entry window after a confirmed signal (PRD §10) ---
        if st.state in ("SIGNAL_CONFIRMED", "ENTRY_PENDING") and st.signal:
            sig = st.signal
            entry, stop, r = sig["entry"], sig["stop"], sig["risk_per_share"]
            day = i - st.signal_index  # 1 = t+1
            if o[i] > entry + p["max_gap_r"] * r:
                finish("INVALIDATED", i, "GAP_ABOVE_ENTRY")
            elif h[i] >= entry and lo[i] <= stop:
                # Both touched on one daily bar: order unknown, assume the worse path.
                sig["path_uncertain"] = True
                finish("INVALIDATED", i, "STOP_AND_ENTRY_SAME_BAR")
            elif lo[i] <= stop:
                finish("INVALIDATED", i, "STOP_TOUCHED_BEFORE_ENTRY")
            elif h[i] >= entry:
                fill = max(o[i], entry)
                sig["fill_price"] = fill
                sig["fill_index"] = i
                finish("TRIGGERED", i, "ENTRY_TRIGGERED")
            elif day >= p["entry_window_days"]:
                finish("EXPIRED", i, "ENTRY_WINDOW_PASSED")
            else:
                st.state = "ENTRY_PENDING"
            continue

        # --- New structure high resets everything (PRD §8.2, §8.6 rule 4) ---
        prior_max = max(h[i - lookback : i])
        if h[i] > prior_max:
            if st.state in ("PIVOT_FOUND", "PULLBACK_ACTIVE"):
                st.events.append(
                    {
                        "index": i,
                        "date": bars[i].get("date"),
                        "state": "PIVOT_FOUND",
                        "reason": "NEW_HIGH_RESET",
                    }
                )
            st.state = "PIVOT_FOUND"
            st.reason = None
            st.pivot_index, st.pivot_high = i, h[i]
            st.pullback_low, st.pullback_days, st.ema_touched = None, 0, False
            continue

        if st.state not in ("PIVOT_FOUND", "PULLBACK_ACTIVE"):
            continue

        # --- Pullback bookkeeping ---
        st.pullback_days = i - st.pivot_index
        st.pullback_low = lo[i] if st.pullback_low is None else min(st.pullback_low, lo[i])
        depth = (st.pivot_high - st.pullback_low) / st.pivot_high

        if sma50[i] is None or ema20[i] is None or atr14[i] is None:
            finish("INVALIDATED", i, "INSUFFICIENT_INDICATOR_HISTORY")
            continue
        if c[i] < sma50[i]:
            finish("INVALIDATED", i, "CLOSE_BELOW_SMA50")
            continue
        if depth > p["pullback_max_depth"]:
            finish("INVALIDATED", i, "PULLBACK_TOO_DEEP")
            continue
        if abs(lo[i] - ema20[i]) <= atr14[i]:
            st.ema_touched = True

        in_window = p["pullback_min_days"] <= st.pullback_days <= p["pullback_max_days"]
        confirm = (
            in_window
            and c[i] > h[i - 1]
            and c[i] > o[i]
            and c[i] > ema20[i]
            and st.ema_touched
            and depth >= p["pullback_min_depth"]
        )
        if confirm:
            levels = build_plan_levels(h[i], st.pullback_low, atr14[i], p)
            st.signal_index = i
            st.signal = {
                "signal_index": i,
                "signal_date": bars[i].get("date"),
                "pivot_date": bars[st.pivot_index].get("date"),
                "pivot_high": st.pivot_high,
                "pullback_low": st.pullback_low,
                "pullback_days": st.pullback_days,
                "pullback_depth": depth,
                "signal_high": h[i],
                "close": c[i],
                "ema20": ema20[i],
                "sma50": sma50[i],
                "atr14": atr14[i],
                **levels,
            }
            st.events.append(
                {
                    "index": i,
                    "date": bars[i].get("date"),
                    "state": "SIGNAL_CONFIRMED",
                    "reason": None,
                }
            )
            st.signals.append(st.signal)
            if levels["valid"]:
                st.state, st.reason = "SIGNAL_CONFIRMED", None
            else:
                st.signal.update(
                    outcome="INVALIDATED", outcome_reason="INVALID_STOP", outcome_index=i
                )
                finish("INVALIDATED", i, "INVALID_STOP")
            continue

        if st.pullback_days >= p["pullback_max_days"]:
            finish("EXPIRED", i, "PULLBACK_WINDOW_PASSED")
            continue
        st.state = "PULLBACK_ACTIVE"

    last = len(bars) - 1
    return {
        "state": st.state,
        "reason": st.reason,
        "pivot_high": st.pivot_high,
        "pivot_date": bars[st.pivot_index].get("date") if st.pivot_index is not None else None,
        "pullback_low": st.pullback_low,
        "pullback_days": st.pullback_days,
        "pullback_depth": (
            (st.pivot_high - st.pullback_low) / st.pivot_high
            if st.pivot_high and st.pullback_low is not None
            else None
        ),
        "signal": st.signal,
        "signal_is_current": st.signal_index is not None
        and st.state in ("SIGNAL_CONFIRMED", "ENTRY_PENDING"),
        "ema20": ema20[last],
        "sma50": sma50[last],
        "atr14": atr14[last],
        "events": st.events,
        "signals": st.signals,
    }
