"""Deterministic Decimal ledger. Callers persist a whole state with version CAS."""
from copy import deepcopy
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

FEE = Decimal("0.0001")
SLIPPAGE = Decimal("0.0005")
ZERO = Decimal(0)


class TradingError(ValueError):
    pass


def d(value):
    try:
        result = Decimal(str(value))
        if not result.is_finite():
            raise ValueError()
        return result
    except Exception:
        raise TradingError("invalid_number") from None


def money(value):
    return str(d(value).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP))


def new_account(now):
    return {"initial_cash": "100000", "cash": "100000", "realized_pnl": "0",
            "orders": [], "positions": [], "fills": [], "marks": {},
            "snapshots": [{"at": now, "equity": "100000"}], "commands": []}


def pending(state):
    return [o for o in state["orders"] if o["status"] == "pending"]


def summary(state):
    cash = d(state["cash"])
    unrealized = ZERO
    value = ZERO
    for p in state["positions"]:
        mark = state["marks"].get(p["symbol"], {}).get("price", p["entry_price"])
        pnl = (d(mark) - d(p["entry_price"])) * p["quantity"] * (1 if p["side"] == "long" else -1)
        unrealized += pnl
        value += d(p["collateral"]) + pnl
    reserved = sum((d(o["reserved"]) for o in pending(state)), ZERO)
    closes = [f for f in state["fills"] if f["effect"] == "close"]
    # Win rate is per fully closed lot, after all entry and exit fees.
    totals = {}
    for f in closes:
        totals[f["position_id"]] = totals.get(f["position_id"], ZERO) + d(f["realized_pnl"])
    active = {p["id"] for p in state["positions"]}
    completed = [pnl for pid, pnl in totals.items() if pid not in active]
    equity = cash + value
    return {"cash": money(cash), "reserved": money(reserved), "available": money(cash - reserved),
            "equity": money(equity), "unrealized_pnl": money(unrealized),
            "realized_pnl": state["realized_pnl"], "total_pnl": money(equity - d(state["initial_cash"])),
            "return_pct": money((equity / d(state["initial_cash"]) - 1) * 100),
            "fill_count": len(state["fills"]), "closed_count": len(completed),
            "win_rate": money(sum(p > 0 for p in completed) / len(completed) * 100) if completed else None}


def position(state, pid):
    return next((p for p in state["positions"] if p["id"] == pid), None)


def validate_bracket(side, reference, stop, target):
    if stop is not None and (d(stop) <= 0 or (d(stop) >= reference if side == "long" else d(stop) <= reference)):
        raise TradingError("invalid_stop_loss")
    if target is not None and (d(target) <= 0 or (d(target) <= reference if side == "long" else d(target) >= reference)):
        raise TradingError("invalid_take_profit")


def execute(state, order, quote, now, reason="order"):
    """Execute one order at an observed price; a rejected fill never debits cash."""
    buying = (order["side"] == "long") == (order["effect"] == "open")
    raw = d(quote["price"])
    price = raw * (1 + SLIPPAGE if buying else 1 - SLIPPAGE)
    if order["kind"] == "limit":
        price = min(price, d(order["price"])) if buying else max(price, d(order["price"]))
    price = d(money(price))
    quantity = order["quantity"]
    notional = price * quantity
    fee = d(money(notional * FEE))
    pnl = ZERO
    if order["effect"] == "open":
        try:
            validate_bracket(order["side"], price, order["stop_loss"], order["take_profit"])
        except TradingError:
            order.update(status="rejected", rejection="bracket_crossed", completed_at=now)
            return
        available = d(summary(state)["available"]) + d(order["reserved"])
        if len(state["positions"]) >= 200:
            order.update(status="rejected", rejection="account_capacity", completed_at=now)
            return
        if notional + fee > available:
            order.update(status="rejected", rejection="insufficient_funds", completed_at=now)
            return
        pid = order["id"]
        state["cash"] = money(d(state["cash"]) - notional - fee)
        state["positions"].append({"id": pid, "symbol": order["symbol"], "side": order["side"],
                                   "quantity": quantity, "entry_price": money(price), "collateral": money(notional),
                                   "entry_fee": money(fee), "stop_loss": order["stop_loss"],
                                   "take_profit": order["take_profit"], "opened_at": now,
                                   "last_quote_at": quote["at"],
                                   "note": order["note"], "source": order["source"]})
    else:
        p = position(state, order["position_id"])
        if p is None or quantity > p["quantity"]:
            order.update(status="rejected", rejection="position_unavailable", completed_at=now)
            return
        pid = p["id"]
        ratio = Decimal(quantity) / p["quantity"]
        collateral = d(money(d(p["collateral"]) * ratio))
        entry_fee = d(money(d(p["entry_fee"]) * ratio))
        gross = (price - d(p["entry_price"])) * quantity * (1 if p["side"] == "long" else -1)
        pnl = gross - fee - entry_fee
        state["cash"] = money(d(state["cash"]) + collateral + gross - fee)
        state["realized_pnl"] = money(d(state["realized_pnl"]) + pnl)
        p["quantity"] -= quantity
        p["collateral"] = money(d(p["collateral"]) - collateral)
        p["entry_fee"] = money(d(p["entry_fee"]) - entry_fee)
        if not p["quantity"]:
            state["positions"].remove(p)
        # Release sibling close reservations even on partial close. Never overclose.
        for sibling in pending(state):
            if sibling["id"] != order["id"] and sibling.get("position_id") == pid:
                sibling.update(status="cancelled", completed_at=now)
    order.update(status="filled", fill_price=money(price), completed_at=now)
    state["fills"].append({"id": str(uuid4()), "order_id": order["id"], "position_id": pid,
                           "symbol": order["symbol"], "side": order["side"], "effect": order["effect"],
                           "quantity": quantity, "price": money(price), "fee": money(fee),
                           "realized_pnl": money(pnl), "at": now, "quote_at": quote["at"],
                           "reason": reason, "note": order["note"], "source": order["source"]})


def sync(state, quotes, now):
    for symbol, quote in quotes.items():
        previous = state["marks"].get(symbol)
        if not previous or quote["at"] >= previous["at"]:
            state["marks"][symbol] = quote
        if not quote["tradable"]:
            continue
        # Brackets have priority over manual close orders; only process newer ticks.
        for p in list(state["positions"]):
            if p["symbol"] != symbol or quote["at"] <= p.get("last_quote_at", ""):
                continue
            p["last_quote_at"] = quote["at"]
            price, entry = d(quote["price"]), d(p["entry_price"])
            long = p["side"] == "long"
            stop, target = p["stop_loss"], p["take_profit"]
            reason = None
            if not long and (entry - price) * p["quantity"] <= -d(p["collateral"]):
                reason = "margin"
            elif stop and (price <= d(stop) if long else price >= d(stop)):
                reason = "stop_loss"
            elif target and (price >= d(target) if long else price <= d(target)):
                reason = "take_profit"
            if reason:
                o = make_order({"symbol": symbol, "side": p["side"], "effect": "close", "quantity": p["quantity"],
                                "position_id": p["id"], "kind": "market", "note": p["note"], "source": p["source"]}, now)
                state["orders"].append(o)
                execute(state, o, quote, now, reason)
        for o in list(pending(state)):
            if o["symbol"] != symbol or quote["at"] <= o["after_quote_at"]:
                continue
            buying = (o["side"] == "long") == (o["effect"] == "open")
            price = d(quote["price"])
            threshold = d(o["price"]) if o["price"] is not None else price
            trigger = (price <= threshold if buying else price >= threshold) if o["kind"] == "limit" else (price >= threshold if buying else price <= threshold)
            if o["kind"] == "market" or trigger:
                execute(state, o, quote, now)
    if not state["snapshots"] or now[:16] != state["snapshots"][-1]["at"][:16]:
        state["snapshots"].append({"at": now, "equity": summary(state)["equity"]})
        state["snapshots"] = state["snapshots"][-1000:]


def make_order(body, now):
    return {"id": str(uuid4()), "symbol": body["symbol"], "side": body["side"],
            "effect": body.get("effect", "open"), "quantity": body["quantity"], "kind": body["kind"],
            "price": money(body["price"]) if body.get("price") is not None else None,
            "stop_loss": money(body["stop_loss"]) if body.get("stop_loss") is not None else None,
            "take_profit": money(body["take_profit"]) if body.get("take_profit") is not None else None,
            "position_id": body.get("position_id"), "note": body.get("note", ""),
            "source": body.get("source", "manual"), "status": "pending", "reserved": "0",
            "created_at": now, "after_quote_at": ""}


def command(original, body, quotes, now):
    state = deepcopy(original)
    if body["request_id"] in state["commands"]:
        return state
    if body["action"] == "order" and body.get("effect", "open") == "open" and len(state["commands"]) >= 15000:
        raise TradingError("account_capacity")
    sync(state, quotes, now)
    action = body["action"]
    if action == "order":
        opening = body.get("effect", "open") == "open"
        if (opening and len(state["orders"]) >= 5000) or (len(pending(state)) >= 100 and (opening or body["kind"] != "market")):
            raise TradingError("account_capacity")
        o = make_order(body, now)
        quote = quotes.get(o["symbol"])
        if not quote:
            raise TradingError("quote_unavailable")
        reference = d(o["price"]) if o["price"] else d(quote["price"])
        if reference <= 0:
            raise TradingError("invalid_number")
        if o["kind"] == "market" and not quote["tradable"]:
            raise TradingError("market_closed_or_stale")
        if o["effect"] == "open":
            validate_bracket(o["side"], reference, o["stop_loss"], o["take_profit"])
            o["reserved"] = money(reference * o["quantity"] * (1 + SLIPPAGE + FEE + SLIPPAGE * FEE))
            if d(o["reserved"]) > d(summary(state)["available"]):
                raise TradingError("insufficient_funds")
        else:
            p = position(state, o["position_id"])
            if not p or p["side"] != o["side"] or p["symbol"] != o["symbol"]:
                raise TradingError("position_unavailable")
            reserved = sum(x["quantity"] for x in pending(state) if x.get("position_id") == p["id"])
            if o["quantity"] > p["quantity"] - reserved:
                raise TradingError("quantity_reserved")
        state["orders"].append(o)
        o["after_quote_at"] = quote["at"]
        buying = (o["side"] == "long") == (o["effect"] == "open")
        marketable = o["kind"] == "market" or ((d(quote["price"]) <= reference if buying else d(quote["price"]) >= reference) if o["kind"] == "limit" else (d(quote["price"]) >= reference if buying else d(quote["price"]) <= reference))
        if marketable and quote["tradable"]:
            execute(state, o, quote, now)
            if o["status"] == "rejected":
                raise TradingError(o["rejection"])
    elif action == "cancel":
        o = next((o for o in pending(state) if o["id"] == body["order_id"]), None)
        if not o:
            raise TradingError("order_not_pending")
        o.update(status="cancelled", completed_at=now)
    elif action == "bracket":
        p = position(state, body["position_id"])
        if not p:
            raise TradingError("position_unavailable")
        mark = state["marks"].get(p["symbol"], {}).get("price", p["entry_price"])
        validate_bracket(p["side"], d(mark), body.get("stop_loss"), body.get("take_profit"))
        for key in ("stop_loss", "take_profit"):
            p[key] = money(body[key]) if body.get(key) is not None else None
    elif action != "sync":
        raise TradingError("invalid_action")
    if action != "sync":
        state["commands"].append(body["request_id"])
    # Include the immediate post-trade equity, not just the pre-command sample.
    state["snapshots"][-1] = {"at": now, "equity": summary(state)["equity"]}
    return state
