"""
Event-driven Strategy Backtester for Kolvex Trade OS.
Simulates Trend Breakout 20D strategy against historical daily OHLCV bars.
Calculates risk-adjusted returns, R-Multiple distributions, and cash-flow equity curves.
"""

import logging
import math
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.services.trade_os.decimal_utils import ZERO, d, quantize_money
from app.services.trade_os.indicators import calculate_atr, calculate_highest_high, calculate_sma

logger = logging.getLogger(__name__)


def run_strategy_backtest(
    symbol: str,
    bars: List[Dict[str, Any]],
    initial_capital: Decimal = Decimal("100000.00"),
    risk_per_trade_pct: Decimal = Decimal("0.0050"),
    breakout_period: int = 20,
    atr_period: int = 14,
    stop_atr_mult: Decimal = Decimal("2.0"),
    target_r_mult: Decimal = Decimal("2.5"),
    max_holding_bars: int = 60,
) -> Dict[str, Any]:
    """
    Executes a daily bar backtest of the Trend Breakout strategy.
    """
    if len(bars) < 220:
        return {
            "error": "Insufficient historical data for backtest (minimum 220 bars required).",
            "trades": [],
            "summary": {},
            "equity_curve": [],
        }

    capital = initial_capital
    peak_capital = capital
    equity_curve: List[Dict[str, Any]] = []
    trades: List[Dict[str, Any]] = []

    # State
    in_pos = False
    pos_shares = 0
    pos_entry_price = ZERO
    pos_stop_price = ZERO
    pos_target_price = ZERO
    pos_initial_risk = ZERO
    pos_entry_date = ""
    pos_bars_held = 0

    closes = [d(b["close"]) for b in bars]
    highs = [d(b["high"]) for b in bars]
    lows = [d(b["low"]) for b in bars]

    # Warmup loop start index
    warmup_idx = 200

    for i in range(warmup_idx, len(bars)):
        bar = bars[i]
        b_date = bar.get("date", f"bar_{i}")
        b_open = d(bar["open"])
        b_high = d(bar["high"])
        b_low = d(bar["low"])
        b_close = d(bar["close"])

        # History slices up to yesterday (i-1)
        hist_closes = closes[:i]
        hist_highs = highs[:i]
        hist_lows = lows[:i]

        sma50 = calculate_sma(hist_closes, 50)
        sma200 = calculate_sma(hist_closes, 200)

        # 1. Manage active position exit
        if in_pos:
            pos_bars_held += 1
            exit_price: Optional[Decimal] = None
            exit_reason = ""

            # Check stop loss hit
            if b_low <= pos_stop_price:
                # If opened with a gap down below stop, fill at open; otherwise at stop
                exit_price = min(b_open, pos_stop_price)
                exit_reason = "stop_loss"
            # Check target hit
            elif b_high >= pos_target_price:
                # If opened with a gap up above target, fill at open; otherwise at target
                exit_price = max(b_open, pos_target_price)
                exit_reason = "take_profit"
            # Time stop / max holding period
            elif pos_bars_held >= max_holding_bars:
                exit_price = b_close
                exit_reason = "time_stop"

            if exit_price is not None:
                pnl = (exit_price - pos_entry_price) * Decimal(pos_shares)
                r_mult = pnl / pos_initial_risk if pos_initial_risk > ZERO else ZERO
                capital += pnl

                trades.append(
                    {
                        "symbol": symbol.upper(),
                        "entry_date": pos_entry_date,
                        "exit_date": b_date,
                        "entry_price": str(quantize_money(pos_entry_price)),
                        "exit_price": str(quantize_money(exit_price)),
                        "shares": pos_shares,
                        "pnl": str(quantize_money(pnl)),
                        "r_multiple": float(quantize_money(r_mult)),
                        "exit_reason": exit_reason,
                        "holding_bars": pos_bars_held,
                    }
                )

                # Reset position
                in_pos = False
                pos_shares = 0

        # 2. Look for new entry if flat
        if not in_pos and sma50 is not None and sma200 is not None:
            # Trend condition: prior close > SMA50 > SMA200
            prior_close = hist_closes[-1]
            is_uptrend = prior_close > sma50 and sma50 > sma200

            if is_uptrend:
                prior_breakout = calculate_highest_high(hist_highs, breakout_period)
                if prior_breakout is not None and b_high >= prior_breakout:
                    atr = calculate_atr(hist_highs, hist_lows, hist_closes, atr_period) or Decimal(
                        "2.00"
                    )
                    entry_p = max(b_open, prior_breakout)
                    stop_p = entry_p - (stop_atr_mult * atr)
                    risk_per_share = entry_p - stop_p

                    if risk_per_share > ZERO and stop_p < entry_p:
                        # Position Sizing
                        risk_budget = capital * risk_per_trade_pct
                        allowed_shares = int(risk_budget / risk_per_share)
                        # Cap max notional at 15% of capital
                        max_notional_shares = int((capital * Decimal("0.15")) / entry_p)
                        shares = min(allowed_shares, max_notional_shares)

                        if shares > 0:
                            in_pos = True
                            pos_shares = shares
                            pos_entry_price = entry_p
                            pos_stop_price = stop_p
                            pos_target_price = entry_p + (target_r_mult * risk_per_share)
                            pos_initial_risk = Decimal(shares) * risk_per_share
                            pos_entry_date = b_date
                            pos_bars_held = 0

        # Mark equity at day end
        unrealized = ((b_close - pos_entry_price) * Decimal(pos_shares)) if in_pos else ZERO
        current_equity = capital + unrealized
        if current_equity > peak_capital:
            peak_capital = current_equity

        dd_pct = (
            (peak_capital - current_equity) / peak_capital * Decimal(100)
            if peak_capital > ZERO
            else ZERO
        )

        equity_curve.append(
            {
                "date": b_date,
                "equity": str(quantize_money(current_equity)),
                "drawdown_pct": str(quantize_money(dd_pct)),
                "in_position": in_pos,
            }
        )

    # 3. Compute Summary Statistics
    total_trades = len(trades)
    winning_trades = [t for t in trades if float(t["pnl"]) > 0]
    losing_trades = [t for t in trades if float(t["pnl"]) < 0]

    win_count = len(winning_trades)
    loss_count = len(losing_trades)
    win_rate = (
        (Decimal(win_count) / Decimal(total_trades) * Decimal(100)) if total_trades > 0 else ZERO
    )

    gross_profit = sum([d(t["pnl"]) for t in winning_trades], ZERO)
    gross_loss = abs(sum([d(t["pnl"]) for t in losing_trades], ZERO))

    profit_factor = (
        (gross_profit / gross_loss)
        if gross_loss > ZERO
        else (Decimal("99.99") if gross_profit > ZERO else Decimal("1.00"))
    )

    total_r = sum([d(t["r_multiple"]) for t in trades], ZERO)
    expectancy_r = total_r / Decimal(total_trades) if total_trades > 0 else ZERO

    avg_win_pnl = gross_profit / Decimal(win_count) if win_count > 0 else ZERO
    avg_loss_pnl = gross_loss / Decimal(loss_count) if loss_count > 0 else ZERO

    # Max Drawdown from equity curve
    max_dd = max([d(pt["drawdown_pct"]) for pt in equity_curve], default=ZERO)
    total_return_pct = (
        (capital - initial_capital) / initial_capital * Decimal(100)
        if initial_capital > ZERO
        else ZERO
    )

    # Sharpe approximation
    trade_returns = [float(t["r_multiple"]) for t in trades]
    if len(trade_returns) > 1:
        mean_r = sum(trade_returns) / len(trade_returns)
        std_r = math.sqrt(sum((x - mean_r) ** 2 for x in trade_returns) / (len(trade_returns) - 1))
        sharpe = (mean_r / std_r) * math.sqrt(252 / 10) if std_r > 0 else 0.0
    else:
        sharpe = 0.0

    summary = {
        "symbol": symbol.upper(),
        "total_trades": total_trades,
        "winning_trades": win_count,
        "losing_trades": loss_count,
        "win_rate_pct": float(quantize_money(win_rate)),
        "profit_factor": float(quantize_money(profit_factor)),
        "expectancy_r": float(quantize_money(expectancy_r)),
        "avg_win_pnl": str(quantize_money(avg_win_pnl)),
        "avg_loss_pnl": str(quantize_money(avg_loss_pnl)),
        "gross_profit": str(quantize_money(gross_profit)),
        "gross_loss": str(quantize_money(gross_loss)),
        "net_pnl": str(quantize_money(capital - initial_capital)),
        "total_return_pct": float(quantize_money(total_return_pct)),
        "max_drawdown_pct": float(quantize_money(max_dd)),
        "sharpe_ratio": round(sharpe, 2),
        "initial_capital": str(initial_capital),
        "ending_capital": str(quantize_money(capital)),
    }

    return {
        "symbol": symbol.upper(),
        "summary": summary,
        "trades": trades,
        "equity_curve": equity_curve,
    }
