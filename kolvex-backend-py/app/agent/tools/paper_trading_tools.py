"""Paper-trading review tool: the signed-in user's virtual account, read-only.

Reads `paper_accounts` directly instead of PaperTradingService.load, which creates an account on
first read: a chat question must never open one. The tool is bound to the user id per request.
"""

import json
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation

from langchain_core.tools import tool

from app.core.supabase import get_supabase_service
from app.services.paper_trading.engine import summary

logger = logging.getLogger(__name__)

MAX_CLOSED = 20
MAX_FILLS = 20
EQUITY_POINTS = 12


def _dec(value) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return Decimal(0)


def _parse(at) -> datetime | None:
    try:
        return datetime.fromisoformat(str(at).replace("Z", "+00:00"))
    except ValueError:
        return None


def _hours(start, end) -> float | None:
    a, b = _parse(start), _parse(end)
    return round((b - a).total_seconds() / 3600, 1) if a and b else None


def closed_trades(state: dict) -> list[dict]:
    """One row per fully closed lot: entry, exit, fees, net P&L, holding time and how it was closed."""
    active = {p["id"] for p in state.get("positions") or []}
    lots: dict[str, dict] = {}
    for f in state.get("fills") or []:
        lot = lots.setdefault(f["position_id"], {"opens": [], "closes": []})
        lot["opens" if f["effect"] == "open" else "closes"].append(f)
    rows = []
    for pid, lot in lots.items():
        if pid in active or not lot["opens"] or not lot["closes"]:
            continue
        first, last = lot["opens"][0], lot["closes"][-1]
        quantity = sum(f["quantity"] for f in lot["closes"])
        exit_value = sum(_dec(f["price"]) * f["quantity"] for f in lot["closes"])
        fees = sum(_dec(f["fee"]) for f in lot["opens"] + lot["closes"])
        # Realized P&L on close fills already nets both legs' fees (engine.execute).
        net = sum(_dec(f["realized_pnl"]) for f in lot["closes"])
        rows.append(
            {
                "symbol": first["symbol"],
                "side": first["side"],
                "quantity": quantity,
                "entry_price": first["price"],
                "exit_price": str(round(exit_value / quantity, 4)) if quantity else None,
                "opened_at": first["at"],
                "closed_at": last["at"],
                "holding_hours": _hours(first["at"], last["at"]),
                "fees": str(fees),
                "net_pnl": str(net),
                "exit_reasons": sorted({f.get("reason") or "order" for f in lot["closes"]}),
                "entry_note": first.get("note") or None,
                "source": first.get("source"),
            }
        )
    rows.sort(key=lambda r: r["closed_at"], reverse=True)
    return rows


def paper_payload(state: dict) -> dict:
    closed = closed_trades(state)
    wins = [r for r in closed if _dec(r["net_pnl"]) > 0]
    losses = [r for r in closed if _dec(r["net_pnl"]) < 0]

    def avg(rows: list[dict]) -> str | None:
        return str(round(sum(_dec(r["net_pnl"]) for r in rows) / len(rows), 2)) if rows else None

    snapshots = state.get("snapshots") or []
    step = max(1, len(snapshots) // EQUITY_POINTS)
    return {
        "currency": "USD",
        "virtual_account": True,
        "summary": summary(state),
        "closed_trade_stats": {
            "count": len(closed),
            "wins": len(wins),
            "losses": len(losses),
            "average_win": avg(wins),
            "average_loss": avg(losses),
            "with_stop_loss_exit": sum("stop_loss" in r["exit_reasons"] for r in closed),
        },
        "open_positions": [
            {
                "symbol": p["symbol"],
                "side": p["side"],
                "quantity": p["quantity"],
                "entry_price": p["entry_price"],
                "mark": (state.get("marks") or {}).get(p["symbol"]),
                "stop_loss": p.get("stop_loss"),
                "take_profit": p.get("take_profit"),
                "opened_at": p.get("opened_at"),
            }
            for p in state.get("positions") or []
        ],
        "pending_orders": [
            {
                k: o.get(k)
                for k in (
                    "symbol",
                    "side",
                    "effect",
                    "kind",
                    "quantity",
                    "price",
                    "stop_loss",
                    "take_profit",
                )
            }
            for o in state.get("orders") or []
            if o.get("status") == "pending"
        ],
        "recent_closed_trades": closed[:MAX_CLOSED],
        "recent_fills": [
            {
                k: f.get(k)
                for k in (
                    "symbol",
                    "side",
                    "effect",
                    "quantity",
                    "price",
                    "fee",
                    "realized_pnl",
                    "at",
                    "reason",
                )
            }
            for f in (state.get("fills") or [])[-MAX_FILLS:][::-1]
        ],
        "equity_curve": snapshots[::step][-EQUITY_POINTS:],
    }


def _fetch(user_id: str) -> dict:
    try:
        rows = (
            get_supabase_service().table("paper_accounts").select("state")
            .eq("user_id", user_id).limit(1).execute().data
        )  # fmt: skip
    except Exception as error:  # noqa: BLE001
        logger.warning("paper account read failed: %s", type(error).__name__)
        return {"gap": "unavailable", "error": "paper trading account unavailable"}
    if not rows:
        return {"status": "no_account", "gap": "no_data",
                "message": "The user has not used paper trading yet."}  # fmt: skip
    return paper_payload(rows[0]["state"])


def create_paper_trading_tool_for_user(user_id: str):
    """Bind the paper-trading review tool to the authenticated user."""

    @tool
    def get_paper_trading_account() -> str:
        """The current user's paper-trading (模拟交易) account: equity, P&L, open positions, pending
        orders, recently closed trades with holding time and exit reason, and closed-trade stats.

        Virtual money only. Uses the signed-in user automatically; no arguments.
        """
        return json.dumps(_fetch(user_id), ensure_ascii=False, default=str)

    return get_paper_trading_account
