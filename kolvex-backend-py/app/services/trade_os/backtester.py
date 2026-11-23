"""
Backtest Lab for Kolvex Trade OS — Swing Trading Strategy V3.0 (PRD §13).

Signals come from ``setup_detection.detect_pullback_setup``, the same code the
live scanner uses (PRD §20.3), so a backtest can never drift from the scan rules.

Execution model (PRD §10–§11):
- Entry only on t+1 / t+2 after the signal close, at max(open, entry trigger).
- Open more than 0.5R above the trigger cancels the trade.
- After a gap the stop distance (2.5%–10%) and size are recomputed from the fill.
- Fixed target = fill + 2 × (fill − initial stop). No trailing stop, no scaling.
- Open through the stop exits at the open (gap loss is recorded).
- Stop and target on the same daily bar: the stop is assumed (conservative, AC-18).
- Time exit at the open of holding day 16 (entry day = day 1).
- Slippage applied against the trader on both sides.

Not modelled yet (reported in ``assumptions``): earnings exits, dividends,
survivorship / historical universe, intraday path.
"""

import hashlib
import json
import math
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.services.trade_os.decimal_utils import ZERO, d, quantize_money
from app.services.trade_os.market_regime import regime_limits
from app.services.trade_os.position_sizing import calculate_position_size
from app.services.trade_os.setup_detection import (
    DEFAULT_PARAMS,
    STRATEGY_CODE,
    STRATEGY_VERSION,
    detect_pullback_setup,
)

ENGINE_VERSION = "swing-v3-backtest-1"
TIME_EXIT_DAY = 16
MAX_POSITION_PCT = Decimal("0.10")


def _hash(payload: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def run_strategy_backtest(
    symbol: str,
    bars: List[Dict[str, Any]],
    initial_capital: Decimal = Decimal("100000.00"),
    regimes: Optional[Dict[str, str]] = None,
    slippage_bps: Decimal = Decimal("5"),
    risk_per_trade_pct: Optional[Decimal] = None,
) -> Dict[str, Any]:
    """
    Single-symbol replay of Swing V3.0.

    ``regimes`` maps bar date -> market state. When given, signals on Risk Off /
    Unknown days are skipped and risk per trade follows the state (0.5% / 0.25%).
    When omitted, the market filter is off and ``risk_per_trade_pct`` (default 0.5%) is used.
    """
    sym = symbol.upper()
    if len(bars) < 220:
        return {
            "error": "Insufficient historical data for backtest (minimum 220 bars required).",
            "trades": [],
            "skipped_signals": [],
            "summary": {},
            "equity_curve": [],
        }

    slip = d(slippage_bps) / Decimal(10000)
    flat_risk = d(risk_per_trade_pct) if risk_per_trade_pct is not None else Decimal("0.0050")
    config = {
        "strategy_code": STRATEGY_CODE,
        "strategy_version": STRATEGY_VERSION,
        "engine_version": ENGINE_VERSION,
        "symbol": sym,
        "start": bars[0].get("date"),
        "end": bars[-1].get("date"),
        "initial_capital": str(initial_capital),
        "market_filter": regimes is not None,
        "risk_per_trade_pct": None if regimes is not None else str(flat_risk),
        "slippage_bps": str(slippage_bps),
        "params": {k: str(v) for k, v in DEFAULT_PARAMS.items()},
    }

    opens = [d(b["open"]) for b in bars]
    highs = [d(b["high"]) for b in bars]
    lows = [d(b["low"]) for b in bars]
    closes = [d(b["close"]) for b in bars]

    signals = detect_pullback_setup(bars)["signals"]
    fills = {s["fill_index"]: s for s in signals if s.get("outcome") == "TRIGGERED"}

    capital = d(initial_capital)
    trades: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []
    equity_curve: List[Dict[str, Any]] = []
    peak = capital
    pos: Optional[Dict[str, Any]] = None

    for sig in signals:
        if sig.get("outcome") != "TRIGGERED":
            skipped.append(
                {
                    "signal_date": sig["signal_date"],
                    "reason": sig.get("outcome_reason") or "NOT_TRIGGERED",
                }
            )

    def close_position(i: int, raw_price: Decimal, reason: str, path_uncertain: bool = False):
        nonlocal capital, pos
        exit_price = raw_price * (1 - slip)
        pnl = (exit_price - pos["entry"]) * pos["shares"]
        planned_loss = pos["risk_per_share"] * pos["shares"]
        capital += pnl
        window_hi = max(highs[pos["index"] : i + 1])
        window_lo = min(lows[pos["index"] : i + 1])
        r = pos["risk_per_share"]
        trades.append(
            {
                "symbol": sym,
                "signal_date": pos["signal_date"],
                "entry_date": bars[pos["index"]].get("date"),
                "exit_date": bars[i].get("date"),
                "entry_price": str(quantize_money(pos["entry"])),
                "stop_price": str(quantize_money(pos["stop"])),
                "target_price": str(quantize_money(pos["target"])),
                "exit_price": str(quantize_money(exit_price)),
                "shares": int(pos["shares"]),
                "planned_risk": str(quantize_money(planned_loss)),
                "pnl": str(quantize_money(pnl)),
                "r_multiple": float(quantize_money(pnl / planned_loss))
                if planned_loss > ZERO
                else 0.0,
                "mfe_r": float(quantize_money((window_hi - pos["entry"]) / r)),
                "mae_r": float(quantize_money((window_lo - pos["entry"]) / r)),
                "exit_reason": reason,
                "holding_days": i - pos["index"] + 1,
                "gap_loss": reason == "GAP_STOP",
                "path_uncertain": path_uncertain,
            }
        )
        pos = None

    for i in range(len(bars)):
        day = bars[i].get("date")

        # 1. Manage an open position
        if pos is not None and i > pos["index"]:
            holding_day = i - pos["index"] + 1
            o, h, lo = opens[i], highs[i], lows[i]
            if holding_day >= TIME_EXIT_DAY:
                close_position(i, o, "TIME_EXIT")
            elif o <= pos["stop"]:
                close_position(i, o, "GAP_STOP")
            elif o >= pos["target"]:
                close_position(i, o, "TARGET")
            elif lo <= pos["stop"] and h >= pos["target"]:
                close_position(i, pos["stop"], "STOP", path_uncertain=True)
            elif lo <= pos["stop"]:
                close_position(i, pos["stop"], "STOP")
            elif h >= pos["target"]:
                close_position(i, pos["target"], "TARGET")

        # 2. New entry on a triggered signal
        sig = fills.get(i)
        if sig is not None:
            reason = None
            regime = (regimes or {}).get(bars[sig["signal_index"]].get("date"), "unknown")
            if pos is not None:
                reason = "DUPLICATE_POSITION"
            elif regimes is not None and not regime_limits(regime)["allow_new_entries"]:
                reason = "MARKET_RISK_OFF" if regime == "risk_off" else "STALE_MARKET_DATA"

            fill = sig["fill_price"] * (1 + slip)
            stop = sig["stop"]
            r = fill - stop
            if reason is None and not (
                DEFAULT_PARAMS["min_stop_distance"]
                <= r / fill
                <= DEFAULT_PARAMS["max_stop_distance"]
            ):
                reason = "INVALID_STOP_AFTER_GAP"

            if reason is None:
                risk_pct = regime_limits(regime)["risk_pct"] if regimes is not None else flat_risk
                sizing = calculate_position_size(
                    capital, fill, stop, risk_pct, MAX_POSITION_PCT, available_cash=capital
                )
                shares = sizing["max_allowed_quantity"]
                if shares < 1:
                    reason = "SIZE_BELOW_ONE_SHARE"
                else:
                    pos = {
                        "index": i,
                        "signal_date": sig["signal_date"],
                        "entry": fill,
                        "stop": stop,
                        "target": fill + 2 * r,
                        "risk_per_share": r,
                        "shares": Decimal(shares),
                    }
                    # Stop hit on the entry bar itself: assume the worse order.
                    if lows[i] <= stop:
                        close_position(i, stop, "STOP", path_uncertain=True)
            if reason is not None:
                skipped.append({"signal_date": sig["signal_date"], "reason": reason})

        # 3. Mark to market
        unrealized = (closes[i] - pos["entry"]) * pos["shares"] if pos else ZERO
        equity = capital + unrealized
        peak = max(peak, equity)
        dd = (peak - equity) / peak * 100 if peak > ZERO else ZERO
        equity_curve.append(
            {
                "date": day,
                "equity": str(quantize_money(equity)),
                "drawdown_pct": str(quantize_money(dd)),
                "in_position": pos is not None,
            }
        )

    if pos is not None:
        close_position(len(bars) - 1, closes[-1], "END_OF_DATA")

    summary = _summarize(sym, trades, equity_curve, d(initial_capital), capital)
    return {
        "symbol": sym,
        "config": config,
        "config_hash": _hash(config),
        "assumptions": {
            "fills": "Next-day open or trigger, whichever is higher; slippage against you on both sides.",
            "same_bar_stop_and_target": "Stop assumed first (daily bars only).",
            "earnings_filter": "not_applied",
            "dividends": "not_applied",
            "universe": "single symbol, today's ticker (survivorship not handled)",
        },
        "summary": summary,
        "trades": trades,
        "skipped_signals": skipped,
        "equity_curve": equity_curve,
    }


def _summarize(
    sym: str,
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
        "symbol": sym,
        "total_trades": n,
        "winning_trades": len(wins),
        "losing_trades": len(losses),
        "win_rate_pct": float(quantize_money(Decimal(len(wins)) / n * 100)) if n else 0.0,
        # None instead of a made-up 99.99 when there were no losing trades.
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
        "initial_capital": str(initial),
        "ending_capital": str(quantize_money(ending)),
    }
