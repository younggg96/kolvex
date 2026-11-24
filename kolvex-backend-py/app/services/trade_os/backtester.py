"""
Backtest Lab for Kolvex Trade OS — Swing Trading Strategy V3.0 (PRD §13).

Signals come from ``setup_detection.detect_pullback_setup``, the same code the
live scanner uses (PRD §20.3), so a backtest can never drift from the scan rules.

Portfolio replay over many symbols on one shared account:
- Entry only on t+1 / t+2 after the signal close, at max(open, entry trigger).
- Open more than 0.5R above the trigger cancels the trade (handled in detection).
- After a gap the stop distance (2.5%–10%) is rechecked against the actual fill.
- Same-day signals compete: all risk rules first, then RS20 high→low, then symbol
  (PRD §13.4); every signal that is not taken is listed with its reason.
- Market state per signal date sets risk per trade, max positions and total open risk.
- Size = min(risk budget, 10% of equity, cash, remaining open-risk budget).
- Fixed target = fill + 3R (V3.1; ``target_r_multiple``). No trailing stop, no scaling.
- Open through the stop exits at the open (gap loss is recorded).
- Stop and target on the same daily bar: the stop is assumed (conservative, AC-18).
- Time exit at the open of holding day 60 (V3.1; ``time_exit_day``; entry day = day 1).
- ``drawdown_tiers`` (PRD §12.4, on by default so the backtest follows the live risk rules): drawdown >= 6% cuts risk to 0.25% and open risk to
  1%; >= 8% pauses new entries for ``drawdown_pause_sessions`` sessions (a manual review is
  assumed after that), reset once drawdown is back under 6%.
- Slippage applied against the trader on both sides.

Not modelled yet (reported in ``assumptions``): earnings exits, dividends,
historical universe membership (survivorship bias), intraday path.
"""

import hashlib
import json
import math
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence, Tuple

from app.services.trade_os.decimal_utils import ZERO, d, quantize_money
from app.services.trade_os.market_regime import regime_limits
from app.services.trade_os.position_sizing import calculate_position_size
from app.services.trade_os.setup_detection import (
    DEFAULT_PARAMS,
    STRATEGY_CODE,
    STRATEGY_VERSION,
    detect_pullback_setup,
)

ENGINE_VERSION = "swing-v3-portfolio-3"
MIN_BARS = 220
MAX_POSITION_PCT = Decimal("0.10")
# Used when the market filter is off.
UNFILTERED_LIMITS = {"max_positions": 4, "max_open_risk_pct": Decimal("0.02")}

# PRD §13.3 recommended partitions: (name, first entry date, last entry date)
DEFAULT_SEGMENTS: Sequence[Tuple[str, Optional[str], Optional[str]]] = (
    ("development", None, "2023-12-31"),
    ("validation", "2024-01-01", "2025-12-31"),
    ("holdout", "2026-01-01", None),
)

# PRD §2.2 initial research thresholds.
RESEARCH_GATES = {
    "expectancy_r": 0.15,
    "profit_factor": 1.3,
    "max_drawdown_pct": 10.0,
    "min_trades": 100,
}


def _hash(payload: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def _day(bar: Dict[str, Any]) -> str:
    return str(bar.get("date"))[:10]


def run_portfolio_backtest(
    bars_by_symbol: Dict[str, List[Dict[str, Any]]],
    initial_capital: Decimal = Decimal("100000.00"),
    regimes: Optional[Dict[str, str]] = None,
    slippage_bps: Decimal = Decimal("5"),
    risk_per_trade_pct: Optional[Decimal] = None,
    benchmark_bars: Optional[List[Dict[str, Any]]] = None,
    segments: Sequence[Tuple[str, Optional[str], Optional[str]]] = DEFAULT_SEGMENTS,
    params: Optional[Dict[str, Any]] = None,
    earnings: Optional[Dict[str, Optional[List[str]]]] = None,
    groups: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    ``params`` overrides strategy parameters (setup_detection.DEFAULT_PARAMS plus
    ``time_exit_day``) for research runs; overrides become part of the config hash.
    ``regimes`` maps date (YYYY-MM-DD) -> market state; None turns the market filter off
    (then ``risk_per_trade_pct``, default 0.5%, 4 positions, 2% open risk).
    ``benchmark_bars`` (SPY) is used for RS20 ranking and the buy-and-hold comparison.
    ``groups`` maps symbol -> concentration group; with ``params["max_per_group"]`` set, a
    signal is skipped (GROUP_LIMIT) when that many positions in its group are already open.
    ``earnings`` maps symbol -> report timestamps (ISO, New York time); None turns the
    earnings rules off. A symbol mapped to None has unknown dates and is not traded.
    """
    p = {
        **DEFAULT_PARAMS,
        "drawdown_tiers": True,
        "drawdown_pause_sessions": 20,
        **(params or {}),
    }
    slip = d(slippage_bps) / Decimal(10000)
    flat_risk = d(risk_per_trade_pct) if risk_per_trade_pct is not None else Decimal("0.0050")
    regime_map = {k[:10]: v for k, v in (regimes or {}).items()}

    usable = {s.upper(): b for s, b in bars_by_symbol.items() if len(b) >= MIN_BARS}
    excluded = sorted(s.upper() for s, b in bars_by_symbol.items() if len(b) < MIN_BARS)
    if not usable:
        return {
            "error": f"Insufficient historical data for backtest (minimum {MIN_BARS} bars required).",
            "trades": [],
            "skipped_signals": [],
            "summary": {},
            "segments": [],
            "equity_curve": [],
            "excluded_symbols": excluded,
        }

    # Per-symbol arrays and the dates they cover
    data: Dict[str, Dict[str, Any]] = {}
    for sym, bars in usable.items():
        data[sym] = {
            "bars": bars,
            "index": {_day(b): i for i, b in enumerate(bars)},
            "open": [d(b["open"]) for b in bars],
            "high": [d(b["high"]) for b in bars],
            "low": [d(b["low"]) for b in bars],
            "close": [d(b["close"]) for b in bars],
        }
    # Earnings (PRD §7.6, §11.5): index of the last session to hold before each report.
    # After-close report -> that day's session; before-open or unknown time -> the day before.
    for sym, arr in data.items():
        arr["earnings_exit"] = set()
        arr["earnings_unknown"] = earnings is not None and earnings.get(sym, None) is None
        if earnings is None or not earnings.get(sym):
            continue
        days = [_day(b) for b in arr["bars"]]
        for stamp in earnings[sym]:
            day, hour = str(stamp)[:10], str(stamp)[11:13]
            k = next((i for i, dd in enumerate(days) if dd >= day), None)
            if k is None:
                continue
            after_close = days[k] == day and hour.isdigit() and int(hour) >= 16
            arr["earnings_exit"].add(k if after_close else k - 1)
    blackout_days = int(p.get("earnings_blackout_sessions", 5))

    bench_close = {_day(b): d(b["close"]) for b in (benchmark_bars or []) if b.get("close")}
    bench_days = sorted(bench_close)

    def rs20(sym: str, i: int) -> Decimal:
        closes = data[sym]["close"]
        if i < 20 or closes[i - 20] <= ZERO:
            return ZERO
        stock = closes[i] / closes[i - 20] - 1
        day = _day(data[sym]["bars"][i])
        if day not in bench_close:
            return stock
        k = bench_days.index(day)
        if k < 20:
            return stock
        return stock - (bench_close[day] / bench_close[bench_days[k - 20]] - 1)

    # Triggered signals grouped by fill date
    fills_by_day: Dict[str, List[Dict[str, Any]]] = {}
    skipped: List[Dict[str, Any]] = []
    for sym in data:
        for sig in detect_pullback_setup(data[sym]["bars"], p)["signals"]:
            if sig.get("outcome") != "TRIGGERED":
                skipped.append(
                    {
                        "symbol": sym,
                        "signal_date": sig["signal_date"],
                        "reason": sig.get("outcome_reason") or "NOT_TRIGGERED",
                    }
                )
                continue
            fill_day = _day(data[sym]["bars"][sig["fill_index"]])
            fills_by_day.setdefault(fill_day, []).append(
                {"symbol": sym, "sig": sig, "rs20": rs20(sym, sig["signal_index"])}
            )

    all_days = sorted({day for sym in data for day in data[sym]["index"]})
    cash = d(initial_capital)
    positions: Dict[str, Dict[str, Any]] = {}
    last_close: Dict[str, Decimal] = {}
    trades: List[Dict[str, Any]] = []
    curve: List[Dict[str, Any]] = []
    peak = cash

    def close_position(sym: str, i: int, raw_price: Decimal, reason: str, uncertain: bool = False):
        nonlocal cash
        pos = positions.pop(sym)
        arr = data[sym]
        exit_price = raw_price * (1 - slip)
        cash += exit_price * pos["shares"]
        pnl = (exit_price - pos["entry"]) * pos["shares"]
        planned = pos["risk_per_share"] * pos["shares"]
        r = pos["risk_per_share"]
        hi = max(arr["high"][pos["index"] : i + 1])
        lo = min(arr["low"][pos["index"] : i + 1])
        trades.append(
            {
                "symbol": sym,
                "signal_date": pos["signal_date"],
                "entry_date": arr["bars"][pos["index"]].get("date"),
                "exit_date": arr["bars"][i].get("date"),
                "entry_price": str(quantize_money(pos["entry"])),
                "stop_price": str(quantize_money(pos["stop"])),
                "target_price": str(quantize_money(pos["target"])),
                "exit_price": str(quantize_money(exit_price)),
                "shares": int(pos["shares"]),
                "planned_risk": str(quantize_money(planned)),
                "pnl": str(quantize_money(pnl)),
                "r_multiple": float(quantize_money(pnl / planned)) if planned > ZERO else 0.0,
                "mfe_r": float(quantize_money((hi - pos["entry"]) / r)),
                "mae_r": float(quantize_money((lo - pos["entry"]) / r)),
                "exit_reason": reason,
                "holding_days": i - pos["index"] + 1,
                "gap_loss": reason == "GAP_STOP",
                "path_uncertain": uncertain,
                "market_regime": pos["regime"],
                "rs20_pct": float(quantize_money(pos["rs20"] * 100)),
            }
        )

    pause_start: Optional[int] = None  # day index when drawdown first reached the pause level
    for di, day in enumerate(all_days):
        # 1. Manage open positions on symbols that traded today
        for sym in list(positions):
            i = data[sym]["index"].get(day)
            pos = positions[sym]
            if i is None or i <= pos["index"]:
                continue
            o, h, lo = data[sym]["open"][i], data[sym]["high"][i], data[sym]["low"][i]
            if i - pos["index"] + 1 >= p["time_exit_day"]:
                close_position(sym, i, o, "TIME_EXIT")
            elif o <= pos["stop"]:
                close_position(sym, i, o, "GAP_STOP")
            elif o >= pos["target"]:
                close_position(sym, i, o, "TARGET")
            elif lo <= pos["stop"] and h >= pos["target"]:
                close_position(sym, i, pos["stop"], "STOP", uncertain=True)
            elif lo <= pos["stop"]:
                close_position(sym, i, pos["stop"], "STOP")
            elif h >= pos["target"]:
                close_position(sym, i, pos["target"], "TARGET")
            elif i in data[sym]["earnings_exit"]:
                close_position(sym, i, data[sym]["close"][i], "EARNINGS_EXIT")

        # 2. New entries: rules first, then RS20 high→low, then symbol
        equity_now = cash + sum(
            p["shares"] * last_close.get(s, p["entry"]) for s, p in positions.items()
        )
        # Account risk tiers (PRD §12.4): the same drawdown rules the live risk engine applies.
        dd_now = (peak - equity_now) / peak if peak > ZERO else ZERO
        tier_risk_cap, tier_open_cap, paused = None, None, False
        if p.get("drawdown_tiers"):
            if dd_now < Decimal("0.06"):
                pause_start = None
            elif dd_now >= Decimal("0.08") and pause_start is None:
                pause_start = di
            if dd_now >= Decimal("0.06"):
                tier_risk_cap, tier_open_cap = Decimal("0.0025"), Decimal("0.0100")
            # Level 2/3 stop new entries; a manual review is assumed after this many sessions.
            paused = pause_start is not None and di - pause_start < int(
                p["drawdown_pause_sessions"]
            )

        for cand in sorted(fills_by_day.get(day, []), key=lambda c: (-c["rs20"], c["symbol"])):
            sym, sig = cand["symbol"], cand["sig"]
            i = sig["fill_index"]
            signal_day = _day(data[sym]["bars"][sig["signal_index"]])
            regime = regime_map.get(signal_day, "unknown") if regimes is not None else None
            if regime is not None:
                limits = regime_limits(regime)
                risk_pct = limits["risk_pct"]
            else:
                limits = {**UNFILTERED_LIMITS, "allow_new_entries": True}
                risk_pct = flat_risk

            fill = sig["fill_price"] * (1 + slip)
            stop = sig["stop"]
            r = fill - stop
            open_risk = sum(p["risk_per_share"] * p["shares"] for p in positions.values())

            reason = None
            si = sig["signal_index"]
            max_open_pct = limits["max_open_risk_pct"]
            if tier_risk_cap is not None:
                risk_pct = min(risk_pct, tier_risk_cap)
                max_open_pct = min(max_open_pct, tier_open_cap)
            if sym in positions:
                reason = "DUPLICATE_POSITION"
            elif paused:
                reason = "DRAWDOWN_LIMIT"
            elif data[sym]["earnings_unknown"]:
                reason = "EVENT_DATA_UNAVAILABLE"
            elif any(si < k <= si + blackout_days for k in data[sym]["earnings_exit"]):
                reason = "EARNINGS_BLACKOUT"
            elif not limits["allow_new_entries"]:
                reason = "MARKET_RISK_OFF" if regime == "risk_off" else "STALE_MARKET_DATA"
            elif len(positions) >= limits["max_positions"]:
                reason = "MAX_POSITIONS"
            elif (
                p.get("max_per_group")
                and groups
                and sum(1 for held in positions if groups.get(held) == groups.get(sym))
                >= int(p["max_per_group"])
            ):
                reason = "GROUP_LIMIT"
            elif not (p["min_stop_distance"] <= r / fill <= p["max_stop_distance"]):
                reason = "INVALID_STOP_AFTER_GAP"

            if reason is None:
                sizing = calculate_position_size(
                    equity_now,
                    fill,
                    stop,
                    risk_pct,
                    MAX_POSITION_PCT,
                    available_cash=cash,
                    remaining_risk_budget=max(ZERO, equity_now * max_open_pct - open_risk),
                )
                shares = sizing["max_allowed_quantity"]
                if shares < 1:
                    reason = {
                        "cash": "INSUFFICIENT_CASH",
                        "portfolio_risk": "TOTAL_OPEN_RISK_LIMIT",
                    }.get(sizing["binding_limit"], "SIZE_BELOW_ONE_SHARE")
                else:
                    cash -= fill * shares
                    positions[sym] = {
                        "index": i,
                        "signal_date": sig["signal_date"],
                        "entry": fill,
                        "stop": stop,
                        "target": fill + d(p["target_r_multiple"]) * r,
                        "risk_per_share": r,
                        "shares": Decimal(shares),
                        "regime": regime,
                        "rs20": cand["rs20"],
                    }
                    # Stop hit on the entry bar itself: assume the worse order.
                    if data[sym]["low"][i] <= stop:
                        close_position(sym, i, stop, "STOP", uncertain=True)
            if reason is not None:
                skipped.append({"symbol": sym, "signal_date": sig["signal_date"], "reason": reason})

        # 3. Mark to market at today's closes
        for sym in data:
            i = data[sym]["index"].get(day)
            if i is not None:
                last_close[sym] = data[sym]["close"][i]
        equity = cash + sum(p["shares"] * last_close[s] for s, p in positions.items())
        peak = max(peak, equity)
        dd = (peak - equity) / peak * 100 if peak > ZERO else ZERO
        curve.append(
            {
                "date": day,
                "equity": str(quantize_money(equity)),
                "drawdown_pct": str(quantize_money(dd)),
                "in_position": bool(positions),
                "positions": len(positions),
            }
        )

    for sym in list(positions):
        last_i = len(data[sym]["bars"]) - 1
        close_position(sym, last_i, data[sym]["close"][last_i], "END_OF_DATA")
    ending = cash

    config = {
        "strategy_code": STRATEGY_CODE,
        "strategy_version": STRATEGY_VERSION,
        "engine_version": ENGINE_VERSION,
        "symbols": sorted(data),
        "start": all_days[0],
        "end": all_days[-1],
        "initial_capital": str(initial_capital),
        "market_filter": regimes is not None,
        "risk_per_trade_pct": None if regimes is not None else str(flat_risk),
        "slippage_bps": str(slippage_bps),
        "params": {k: str(v) for k, v in p.items()},
        "segments": [list(s) for s in segments],
        "earnings_rules": earnings is not None,
    }

    summary = _summarize("PORTFOLIO", trades, curve, d(initial_capital), ending)
    segment_results = []
    for name, start, end in segments:
        seg_trades = [
            t
            for t in trades
            if (start is None or str(t["entry_date"])[:10] >= start)
            and (end is None or str(t["entry_date"])[:10] <= end)
        ]
        seg_curve = [
            p
            for p in curve
            if (start is None or p["date"] >= start) and (end is None or p["date"] <= end)
        ]
        if not seg_curve:
            continue
        seg_start = d(seg_curve[0]["equity"])
        seg_summary = _summarize(
            name, seg_trades, _rebase(seg_curve), seg_start, d(seg_curve[-1]["equity"])
        )
        segment_results.append(
            {
                "name": name,
                "start": seg_curve[0]["date"],
                "end": seg_curve[-1]["date"],
                "summary": seg_summary,
                "gates": research_gates(seg_summary),
            }
        )

    benchmark = None
    if bench_days:
        span = [day for day in bench_days if all_days[0] <= day <= all_days[-1]]
        if len(span) > 1:
            benchmark = {
                "symbol": "SPY",
                "total_return_pct": float(
                    quantize_money((bench_close[span[-1]] / bench_close[span[0]] - 1) * 100)
                ),
                "basis": "Price return, no dividends, no costs, fully invested from the first day.",
            }

    return {
        "symbol": config["symbols"][0] if len(data) == 1 else "PORTFOLIO",
        "config": config,
        "config_hash": _hash(config),
        "assumptions": {
            "fills": "Next-day open or trigger, whichever is higher; slippage against you on both sides.",
            "same_bar_stop_and_target": "Stop assumed first (daily bars only).",
            "earnings_filter": "applied: no entry within 5 sessions of a report; exit at the close before it"
            if earnings is not None
            else "not_applied",
            "dividends": "not_applied",
            "universe": "Today's ticker list applied to the past (survivorship bias not removed).",
        },
        "summary": summary,
        "gates": research_gates(summary),
        "segments": segment_results,
        "benchmark": benchmark,
        "trades": trades,
        "skipped_signals": skipped,
        "excluded_symbols": excluded,
        "equity_curve": curve,
    }


def run_strategy_backtest(
    symbol: str,
    bars: List[Dict[str, Any]],
    initial_capital: Decimal = Decimal("100000.00"),
    regimes: Optional[Dict[str, str]] = None,
    slippage_bps: Decimal = Decimal("5"),
    risk_per_trade_pct: Optional[Decimal] = None,
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Single-symbol run: the portfolio engine with one stock (same rules, same code)."""
    return run_portfolio_backtest(
        {symbol: bars},
        initial_capital=initial_capital,
        regimes=regimes,
        slippage_bps=slippage_bps,
        risk_per_trade_pct=risk_per_trade_pct,
        segments=(),
        params=params,
    )


def research_gates(summary: Dict[str, Any]) -> Dict[str, Any]:
    """PRD §2.2 thresholds. A result is shown whether or not it passes."""
    pf = summary.get("profit_factor")
    checks = {
        "expectancy_r": summary.get("expectancy_r", 0) >= RESEARCH_GATES["expectancy_r"],
        "profit_factor": pf is not None and pf >= RESEARCH_GATES["profit_factor"],
        "max_drawdown_pct": summary.get("max_drawdown_pct", 100)
        <= RESEARCH_GATES["max_drawdown_pct"],
        "min_trades": summary.get("total_trades", 0) >= RESEARCH_GATES["min_trades"],
    }
    return {"checks": checks, "passed": all(checks.values()), "thresholds": RESEARCH_GATES}


def _rebase(curve: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Drawdown measured from the segment's own start, not the whole run's peak."""
    peak = ZERO
    out = []
    for p in curve:
        eq = d(p["equity"])
        peak = max(peak, eq)
        dd = (peak - eq) / peak * 100 if peak > ZERO else ZERO
        out.append({**p, "drawdown_pct": str(quantize_money(dd))})
    return out


def _summarize(
    label: str,
    trades: List[Dict[str, Any]],
    curve: List[Dict[str, Any]],
    initial: Decimal,
    ending: Decimal,
) -> Dict[str, Any]:
    n = len(trades)
    wins = [t for t in trades if d(t["pnl"]) > ZERO]
    losses = [t for t in trades if d(t["pnl"]) < ZERO]
    gross_profit = sum((d(t["pnl"]) for t in wins), ZERO)
    gross_loss = abs(sum((d(t["pnl"]) for t in losses), ZERO))
    rs = [t["r_multiple"] for t in trades]

    streak = longest = 0
    for t in trades:
        streak = streak + 1 if d(t["pnl"]) < ZERO else 0
        longest = max(longest, streak)

    if len(rs) > 1:
        mean_r = sum(rs) / len(rs)
        std_r = math.sqrt(sum((x - mean_r) ** 2 for x in rs) / (len(rs) - 1))
        sharpe = (mean_r / std_r) * math.sqrt(252 / 10) if std_r > 0 else 0.0
    else:
        sharpe = 0.0

    exposure = (sum(1 for p in curve if p["in_position"]) / len(curve) * 100) if curve else 0.0

    return {
        "symbol": label,
        "total_trades": n,
        "winning_trades": len(wins),
        "losing_trades": len(losses),
        "win_rate_pct": float(quantize_money(Decimal(len(wins)) / n * 100)) if n else 0.0,
        # None instead of a made-up number when there were no losing trades.
        "profit_factor": float(quantize_money(gross_profit / gross_loss))
        if gross_loss > ZERO
        else None,
        "expectancy_r": float(quantize_money(Decimal(str(sum(rs))) / n)) if n else 0.0,
        "avg_win_pnl": str(quantize_money(gross_profit / len(wins))) if wins else "0.00",
        "avg_loss_pnl": str(quantize_money(gross_loss / len(losses))) if losses else "0.00",
        "gross_profit": str(quantize_money(gross_profit)),
        "gross_loss": str(quantize_money(gross_loss)),
        "net_pnl": str(quantize_money(ending - initial)),
        "total_return_pct": float(quantize_money((ending - initial) / initial * 100))
        if initial > ZERO
        else 0.0,
        "max_drawdown_pct": float(max((d(p["drawdown_pct"]) for p in curve), default=ZERO)),
        "max_consecutive_losses": longest,
        "avg_holding_days": round(sum(t["holding_days"] for t in trades) / n, 1) if n else 0.0,
        "gap_loss_count": sum(1 for t in trades if t["gap_loss"]),
        "market_exposure_pct": round(exposure, 1),
        "sharpe_ratio": round(sharpe, 2),
        "initial_capital": str(quantize_money(initial)),
        "ending_capital": str(quantize_money(ending)),
    }
