import unittest
from datetime import datetime, timezone
from unittest.mock import Mock

from app.services.agent_portfolio import (
    RiskLimits,
    build_portfolio_context,
    format_portfolio_context,
    is_live_trade_date,
    load_paper_state,
    resolve_action,
)
from app.services.paper_trading.engine import new_account
from tradingagents.graph.propagation import Propagator

NOW = datetime(2026, 11, 6, 15, 0, tzinfo=timezone.utc)  # 10:00 New York


def account(positions=(), cash="100000", marks=None, snapshots=None):
    state = new_account("2026-11-01T15:00:00+00:00")
    state["cash"] = cash
    state["marks"] = marks or {}
    state["positions"] = [
        {"id": f"p{i}", "symbol": sym, "side": side, "quantity": qty, "entry_price": str(entry),
         "collateral": str(entry * qty), "entry_fee": "0", "stop_loss": None, "take_profit": None}
        for i, (sym, side, qty, entry) in enumerate(positions)
    ]
    if snapshots is not None:
        state["snapshots"] = snapshots
    return state


def mark(price):
    return {"price": str(price), "at": "2026-11-06T14:59:00+00:00"}


class ContextTests(unittest.TestCase):
    def test_empty_account_has_full_room_up_to_position_limit(self):
        ctx = build_portfolio_context(account(), "nvda", NOW)
        self.assertEqual(ctx["ticker"], "NVDA")
        self.assertFalse(ctx["ticker_exposure"]["held"])
        self.assertEqual(ctx["budget"]["room_pct"], 10.0)
        self.assertEqual(ctx["budget"]["room_usd"], 10000.0)
        self.assertFalse(ctx["budget"]["halted"])

    def test_existing_position_weight_and_remaining_room(self):
        # 80 NVDA bought at 100, now 100: $8,000 of $100,000 equity.
        state = account([("NVDA", "long", 80, 100)], cash="92000", marks={"NVDA": mark(100)})
        ctx = build_portfolio_context(state, "NVDA", NOW)
        self.assertEqual(ctx["ticker_exposure"]["weight_pct"], 8.0)
        self.assertEqual(ctx["budget"]["room_pct"], 2.0)

    def test_cash_floor_limits_room(self):
        # 97% invested elsewhere: only 3% cash, 5% must stay -> no room.
        state = account([("SPY", "long", 970, 100)], cash="3000", marks={"SPY": mark(100)},
                        snapshots=[{"at": "2026-11-05T20:00:00+00:00", "equity": "100000"}])
        ctx = build_portfolio_context(state, "NVDA", NOW, RiskLimits(max_position_pct=100))
        self.assertEqual(ctx["budget"]["room_pct"], 0.0)

    def test_daily_loss_halt_uses_prior_day_snapshot(self):
        state = account([("TSLA", "long", 100, 100)], cash="90000", marks={"TSLA": mark(60)},
                        snapshots=[{"at": "2026-11-05T20:00:00+00:00", "equity": "100000"},
                                   {"at": "2026-11-06T14:30:00+00:00", "equity": "97000"}])
        ctx = build_portfolio_context(state, "NVDA", NOW)
        self.assertEqual(ctx["account"]["day_pnl_pct"], -4.0)
        self.assertTrue(ctx["budget"]["halted"])
        self.assertIn("TRADING HALT", format_portfolio_context(ctx))

    def test_format_mentions_holdings_and_budget(self):
        state = account([("NVDA", "long", 80, 100)], cash="92000", marks={"NVDA": mark(110)})
        text = format_portfolio_context(build_portfolio_context(state, "NVDA", NOW))
        self.assertIn("NVDA long 80 @ 100.0 (mark 110.0)", text)
        self.assertIn("Room to add NVDA", text)


class ResolveActionTests(unittest.TestCase):
    def ctx(self, positions=(), **kw):
        state = account(positions, marks={s: mark(e) for s, _, _, e in positions}, **kw)
        return build_portfolio_context(state, "NVDA", NOW)

    def test_buy_without_position_opens(self):
        self.assertEqual(resolve_action("BUY", None, self.ctx())[0], "open_long")

    def test_buy_with_position_adds_when_room(self):
        self.assertEqual(resolve_action("BUY", None, self.ctx([("NVDA", "long", 50, 100)], cash="95000"))[0], "add")

    def test_buy_at_position_limit_holds(self):
        action, reason = resolve_action("BUY", None, self.ctx([("NVDA", "long", 100, 100)], cash="90000"))
        self.assertEqual(action, "hold")
        self.assertIn("no room", reason)

    def test_buy_blocked_by_halt(self):
        ctx = self.ctx()
        ctx["budget"].update(halted=True, halt_reason="intraday loss")
        self.assertEqual(resolve_action("BUY", None, ctx), ("hold", "BUY blocked: intraday loss"))

    def test_sell_on_long_uses_size_hint_else_close(self):
        ctx = self.ctx([("NVDA", "long", 50, 100)], cash="95000")
        self.assertEqual(resolve_action("SELL", "reduce", ctx)[0], "reduce")
        self.assertEqual(resolve_action("SELL", None, ctx)[0], "close")

    def test_sell_still_allowed_during_halt(self):
        ctx = self.ctx([("NVDA", "long", 50, 100)], cash="95000")
        ctx["budget"]["halted"] = True
        self.assertEqual(resolve_action("SELL", "reduce", ctx)[0], "reduce")

    def test_sell_without_position_is_noop(self):
        self.assertEqual(resolve_action("SELL", "close", self.ctx())[0], "hold")

    def test_no_context_means_no_action(self):
        self.assertIsNone(resolve_action("BUY", None, None)[0])


class LoadingTests(unittest.TestCase):
    def test_missing_account_is_fresh_and_not_created(self):
        db = Mock()
        db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        state = load_paper_state(db, "u-1")
        self.assertEqual(state["cash"], "100000")
        db.table.return_value.upsert.assert_not_called()

    def test_live_trade_date_is_new_york_today(self):
        self.assertTrue(is_live_trade_date("2026-11-06", NOW))
        self.assertFalse(is_live_trade_date("2026-11-05", NOW))
        late = datetime(2026, 11, 7, 2, 0, tzinfo=timezone.utc)  # still Nov 6 in New York
        self.assertTrue(is_live_trade_date("2026-11-06", late))

    def test_initial_state_carries_portfolio_text(self):
        self.assertEqual(Propagator().create_initial_state("NVDA", "2026-11-06", "ctx")["portfolio_context"], "ctx")
        self.assertEqual(Propagator().create_initial_state("NVDA", "2026-11-06")["portfolio_context"], "")


if __name__ == "__main__":
    unittest.main()
