"""Portfolio context and risk budget the trading agent sees before deciding.

Everything numeric here is computed by code from the user's paper trading account.
The LLM reads the result; it never computes sizes or limits itself, and the final
position action is resolved by `resolve_action`, not by the model.
"""
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from zoneinfo import ZoneInfo

from app.services.paper_trading.engine import d, new_account, summary

NY = ZoneInfo("America/New_York")
PAPER_TABLE = "paper_accounts"


@dataclass(frozen=True)
class RiskLimits:
    max_position_pct: float = 10.0      # one symbol, share of equity
    max_gross_exposure_pct: float = 100.0  # all positions; 100 = no leverage
    daily_loss_halt_pct: float = 3.0    # stop opening or adding after this intraday drawdown
    min_cash_pct: float = 5.0           # always keep this much equity in cash


def _pct(part: Decimal, whole: Decimal) -> float:
    return round(float(part / whole * 100), 2) if whole > 0 else 0.0


def _day_start_equity(state: dict, now: datetime) -> Decimal:
    """Equity at the last snapshot before today's New York date (the prior close)."""
    today = now.astimezone(NY).date()
    baseline = None
    for snap in state.get("snapshots", []):
        try:
            at = datetime.fromisoformat(snap["at"]).astimezone(NY)
        except (KeyError, TypeError, ValueError):
            continue
        if at.date() < today:
            baseline = snap["equity"]
    return d(baseline if baseline is not None else state["initial_cash"])


def build_portfolio_context(
    state: dict,
    ticker: str,
    now: Optional[datetime] = None,
    limits: RiskLimits = RiskLimits(),
) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    ticker = ticker.upper()
    totals = summary(state)
    equity = d(totals["equity"])

    positions = []
    gross = Decimal(0)
    for p in state["positions"]:
        mark_info = state["marks"].get(p["symbol"], {})
        mark = d(mark_info.get("price", p["entry_price"]))
        sign = 1 if p["side"] == "long" else -1
        pnl = (mark - d(p["entry_price"])) * p["quantity"] * sign
        value = d(p["collateral"]) + pnl
        gross += abs(value)
        positions.append({
            "symbol": p["symbol"], "side": p["side"], "quantity": p["quantity"],
            "entry_price": float(d(p["entry_price"])), "mark": float(mark),
            "mark_at": mark_info.get("at"), "market_value": round(float(value), 2),
            "weight_pct": _pct(abs(value), equity),
            "unrealized_pnl_pct": _pct(pnl, d(p["collateral"])),
            "stop_loss": p.get("stop_loss"), "take_profit": p.get("take_profit"),
        })
    positions.sort(key=lambda p: -p["weight_pct"])

    held = [p for p in positions if p["symbol"] == ticker]
    ticker_weight = sum(p["weight_pct"] for p in held)
    ticker_sides = sorted({p["side"] for p in held})
    gross_pct = _pct(gross, equity)
    available = d(totals["available"])
    cash_floor = equity * Decimal(str(limits.min_cash_pct)) / 100
    day_start = _day_start_equity(state, now)
    day_pnl_pct = _pct(equity - day_start, day_start)

    # Room to add in this symbol: the tightest of the position, exposure and cash limits.
    room_pct = max(0.0, min(
        limits.max_position_pct - ticker_weight,
        limits.max_gross_exposure_pct - gross_pct,
        _pct(max(available - cash_floor, Decimal(0)), equity),
    ))
    halted = day_pnl_pct <= -limits.daily_loss_halt_pct

    return {
        "as_of": now.isoformat(),
        "ticker": ticker,
        "account": {
            "equity": round(float(equity), 2), "cash": round(float(d(totals["cash"])), 2),
            "available": round(float(available), 2), "return_pct": float(d(totals["return_pct"])),
            "day_pnl_pct": day_pnl_pct, "gross_exposure_pct": gross_pct,
            "position_count": len(positions),
        },
        "positions": positions,
        "ticker_exposure": {
            "held": bool(held), "sides": ticker_sides, "weight_pct": round(ticker_weight, 2),
            "quantity": sum(p["quantity"] for p in held),
        },
        "budget": {
            "limits": asdict(limits),
            "room_pct": round(room_pct, 2),
            "room_usd": round(float(equity) * room_pct / 100, 2),
            "halted": halted,
            "halt_reason": f"intraday loss {day_pnl_pct}% breached -{limits.daily_loss_halt_pct}%" if halted else None,
        },
    }


def format_portfolio_context(ctx: dict[str, Any]) -> str:
    """Plain-text block for agent prompts."""
    a, t, b = ctx["account"], ctx["ticker_exposure"], ctx["budget"]
    lines = [
        f"Account (paper, as of {ctx['as_of']}): equity ${a['equity']:,.2f}, available cash ${a['available']:,.2f}, "
        f"today {a['day_pnl_pct']:+.2f}%, total return {a['return_pct']:+.2f}%, gross exposure {a['gross_exposure_pct']}%.",
    ]
    if ctx["positions"]:
        lines.append("Open positions (largest first):")
        for p in ctx["positions"][:15]:
            lines.append(
                f"- {p['symbol']} {p['side']} {p['quantity']} @ {p['entry_price']} (mark {p['mark']}), "
                f"{p['weight_pct']}% of equity, unrealized {p['unrealized_pnl_pct']:+.2f}%"
            )
        if len(ctx["positions"]) > 15:
            lines.append(f"- ... {len(ctx['positions']) - 15} more")
    else:
        lines.append("Open positions: none.")
    if t["held"]:
        lines.append(f"Current {ctx['ticker']} exposure: {'/'.join(t['sides'])} {t['quantity']} shares, {t['weight_pct']}% of equity.")
    else:
        lines.append(f"Current {ctx['ticker']} exposure: none.")
    lim = b["limits"]
    lines.append(
        f"Risk budget (enforced by code, not negotiable): max {lim['max_position_pct']}% per symbol, "
        f"max {lim['max_gross_exposure_pct']}% gross exposure, keep {lim['min_cash_pct']}% cash, "
        f"halt new risk after -{lim['daily_loss_halt_pct']}% in a day. "
        f"Room to add {ctx['ticker']}: {b['room_pct']}% (${b['room_usd']:,.2f})."
    )
    if b["halted"]:
        lines.append(f"TRADING HALT: {b['halt_reason']}. Only holding, reducing or closing is allowed today.")
    lines.append("Long-only: SELL means reduce or close an existing long; with no position, SELL becomes no action.")
    return "\n".join(lines)


def resolve_action(rating: str, sell_size: Optional[str], ctx: Optional[dict]) -> tuple[Optional[str], str]:
    """Turn a BUY/SELL/HOLD rating into a position action the budget allows.

    Returns (action, reason). action is None when no portfolio context applies
    (e.g. a historical trade date), because holdings then were unknown.
    """
    if ctx is None:
        return None, "no portfolio context for this trade date"
    exposure, budget = ctx["ticker_exposure"], ctx["budget"]
    long_held = "long" in exposure["sides"]
    short_held = "short" in exposure["sides"]

    if rating == "BUY":
        if short_held:
            return "close", "BUY against an existing short: cover it"
        if budget["halted"]:
            return "hold", f"BUY blocked: {budget['halt_reason']}"
        if budget["room_pct"] <= 0:
            return "hold", "BUY blocked: no room left under position, exposure or cash limits"
        return ("add" if long_held else "open_long"), f"within budget, room {budget['room_pct']}%"
    if rating == "SELL":
        if long_held:
            action = sell_size if sell_size in ("reduce", "close") else "close"
            return action, f"SELL on an existing long: {action}"
        return "hold", "SELL with no long position: long-only, nothing to do"
    return "hold", "HOLD"


def load_paper_state(db: Any, user_id: str) -> dict:
    """Read-only: a user without a paper account is treated as a fresh one, never created here."""
    rows = db.table(PAPER_TABLE).select("state").eq("user_id", user_id).execute().data
    if rows:
        return rows[0]["state"]
    return new_account(datetime.now(timezone.utc).isoformat())


def is_live_trade_date(trade_date: str, now: Optional[datetime] = None) -> bool:
    """Current holdings only describe today; a past analysis date must not see them."""
    now = now or datetime.now(timezone.utc)
    return trade_date == now.astimezone(NY).date().isoformat()
