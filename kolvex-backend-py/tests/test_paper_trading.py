import unittest
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import Mock
from uuid import uuid4

from app.services.paper_trading.engine import command, d, new_account, pending, summary, TradingError
from app.services.paper_trading.service import normalize_quote, PaperTradingService, Conflict

NOW = "2026-11-02T15:00:00+00:00"
LATER = "2026-11-02T15:01:00+00:00"


def quote(price=100, at=NOW, tradable=True):
    return {"price": str(price), "at": at, "tradable": tradable, "currency": "USD"}


def order(**overrides):
    return {"action": "order", "request_id": str(uuid4()), "symbol": "AAPL", "side": "long",
            "effect": "open", "quantity": 10, "kind": "market", **overrides}


def run(state, body=None, price=100, at=NOW, tradable=True):
    return command(state, body or {"action": "sync", "request_id": str(uuid4())}, {"AAPL": quote(price, at, tradable)}, at)


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.state = new_account(NOW)

    def test_market_long_debits_notional_and_fee(self):
        s = run(self.state, order())
        self.assertEqual(d(s["positions"][0]["entry_price"]), Decimal("100.05"))
        self.assertEqual(d(s["cash"]), Decimal("98999.399950"))
        self.assertEqual(d(summary(s)["total_pnl"]), Decimal("-0.600050"))
        self.assertEqual(self.state["positions"], [])

    def test_long_partial_and_full_close_conserves_net_pnl(self):
        s = run(self.state, order())
        pid = s["positions"][0]["id"]
        s = run(s, order(effect="close", position_id=pid, quantity=4), price=110, at=LATER)
        self.assertEqual(s["positions"][0]["quantity"], 6)
        self.assertEqual(summary(s)["closed_count"], 0)
        s = run(s, order(effect="close", position_id=pid, quantity=6), price=120, at=LATER)
        self.assertEqual(s["positions"], [])
        self.assertEqual(d(s["cash"]) - 100000, d(s["realized_pnl"]))
        self.assertEqual(summary(s)["closed_count"], 1)
        self.assertEqual(d(summary(s)["win_rate"]), 100)

    def test_short_uses_cash_collateral_and_releases_on_close(self):
        s = run(self.state, order(side="short"))
        self.assertLess(d(s["cash"]), 100000)
        self.assertEqual(d(s["positions"][0]["entry_price"]), Decimal("99.95"))
        pid = s["positions"][0]["id"]
        s = run(s, order(side="short", effect="close", position_id=pid), price=90, at=LATER)
        self.assertGreater(d(s["cash"]), 100000)
        self.assertEqual(d(s["cash"]) - 100000, d(s["realized_pnl"]))

    def test_short_partial_close_fee_allocation(self):
        s = run(self.state, order(side="short", quantity=3))
        pid = s["positions"][0]["id"]
        for i in range(3):
            s = run(s, order(side="short", effect="close", position_id=pid, quantity=1), price=95+i, at=LATER)
        self.assertEqual(d(s["cash"]) - 100000, d(s["realized_pnl"]))
        self.assertEqual(summary(s)["closed_count"], 1)

    def test_limit_reserves_and_cancel_releases(self):
        s = run(self.state, order(kind="limit", price=90))
        self.assertEqual(len(pending(s)), 1)
        self.assertGreater(d(summary(s)["reserved"]), 900)
        self.assertEqual(d(s["cash"]), 100000)
        s = run(s, {"action": "cancel", "request_id": str(uuid4()), "order_id": s["orders"][0]["id"]})
        self.assertEqual(d(summary(s)["available"]), 100000)

    def test_pending_reservations_prevent_double_spend(self):
        s = run(self.state, order(kind="limit", price=90, quantity=1000))
        with self.assertRaisesRegex(TradingError, "insufficient_funds"):
            run(s, order(kind="limit", price=90, quantity=1000))

    def test_long_limit_fills_at_limit_or_better(self):
        s = run(self.state, order(kind="limit", price=90))
        s = run(s, price=90, at=LATER)
        self.assertEqual(d(s["fills"][0]["price"]), 90)

    def test_short_limit_and_cover_limit_directions(self):
        s = run(self.state, order(side="short", kind="limit", price=110))
        s = run(s, price=120, at=LATER)
        self.assertGreaterEqual(d(s["fills"][0]["price"]), 110)
        pid = s["positions"][0]["id"]
        s = run(s, order(side="short", effect="close", position_id=pid, kind="limit", price=90), price=120, at=LATER)
        self.assertEqual(len(pending(s)), 1)
        s = run(s, price=90, at="2026-11-02T15:02:00+00:00")
        self.assertLessEqual(d(s["fills"][-1]["price"]), 90)

    def test_breakout_entry_triggers_in_trade_direction(self):
        for side, trigger, before, after in [("long", 110, 105, 115), ("short", 90, 95, 85)]:
            s = run(self.state, order(side=side, kind="stop", price=trigger))
            s = run(s, price=before, at=LATER)
            self.assertEqual(len(pending(s)), 1)
            s = run(s, price=after, at="2026-11-02T15:02:00+00:00")
            self.assertEqual(len(s["positions"]), 1)

    def test_gap_beyond_reserved_cash_rejects_without_debit(self):
        s = run(self.state, order(kind="stop", price=101, quantity=900))
        s = run(s, price=150, at=LATER)
        self.assertEqual(s["orders"][0]["status"], "rejected")
        self.assertEqual(d(s["cash"]), 100000)
        self.assertEqual(d(summary(s)["reserved"]), 0)

    def test_stop_loss_closes_once_and_cancels_pending_close(self):
        s = run(self.state, order(stop_loss=95, take_profit=120))
        pid = s["positions"][0]["id"]
        s = run(s, order(effect="close", position_id=pid, kind="limit", price=130))
        s = run(s, price=90, at=LATER)
        self.assertEqual(s["positions"], [])
        self.assertEqual(s["orders"][1]["status"], "cancelled")
        self.assertEqual(s["fills"][-1]["reason"], "stop_loss")
        again = run(s, price=90, at=LATER)
        self.assertEqual(len(again["fills"]), 2)

    def test_short_stop_and_take_profit_are_mirrored(self):
        for next_price, reason in [(115, "stop_loss"), (85, "take_profit")]:
            s = run(self.state, order(side="short", stop_loss=110, take_profit=90))
            s = run(s, price=next_price, at=LATER)
            self.assertEqual(s["fills"][-1]["reason"], reason)
            self.assertEqual(s["positions"], [])

    def test_short_collateral_exhaustion_forces_close(self):
        s = run(self.state, order(side="short"))
        s = run(s, price=250, at=LATER)
        self.assertEqual(s["positions"], [])
        self.assertEqual(s["fills"][-1]["reason"], "margin")

    def test_stale_and_duplicate_quotes_cannot_fill_pending(self):
        s = run(self.state, order(kind="limit", price=90))
        for at, tradable in [(NOW, True), (LATER, False)]:
            s = run(s, price=80, at=at, tradable=tradable)
            self.assertEqual(len(s["fills"]), 0)

    def test_stale_quotes_value_but_do_not_trigger_bracket(self):
        s = run(self.state, order(stop_loss=95))
        s = run(s, price=80, at=LATER, tradable=False)
        self.assertEqual(len(s["positions"]), 1)
        self.assertLess(d(summary(s)["unrealized_pnl"]), 0)

    def test_quote_before_entry_cannot_retroactively_trigger_stop(self):
        s = run(self.state, order(stop_loss=95))
        s = run(s, price=80, at="2026-11-02T14:59:00+00:00")
        self.assertEqual(len(s["positions"]), 1)
        self.assertEqual(len(s["fills"]), 1)
        self.assertEqual(d(s["marks"]["AAPL"]["price"]), 100)

    def test_market_requires_valid_quote_but_limits_can_queue(self):
        with self.assertRaisesRegex(TradingError, "market_closed_or_stale"):
            run(self.state, order(), tradable=False)
        s = run(self.state, order(kind="limit", price=110), tradable=False)
        self.assertEqual(len(pending(s)), 1)

    def test_gap_past_bracket_rejects_open_without_cash_change(self):
        s = run(self.state, order(kind="limit", price=90, stop_loss=85))
        s = run(s, price=80, at=LATER)
        self.assertEqual(s["orders"][0]["status"], "rejected")
        self.assertEqual(d(s["cash"]), 100000)

    def test_idempotent_request_does_not_duplicate_any_fill(self):
        body = order()
        s = run(self.state, body)
        again = run(s, body, price=110, at=LATER)
        self.assertEqual(again, s)

    def test_pending_close_reserves_shares(self):
        s = run(self.state, order())
        pid = s["positions"][0]["id"]
        s = run(s, order(effect="close", position_id=pid, kind="limit", price=110, quantity=8))
        with self.assertRaisesRegex(TradingError, "quantity_reserved"):
            run(s, order(effect="close", position_id=pid, quantity=3))

    def test_cannot_close_other_side_or_symbol(self):
        s = run(self.state, order())
        with self.assertRaisesRegex(TradingError, "position_unavailable"):
            run(s, order(side="short", effect="close", position_id=s["positions"][0]["id"]))

    def test_edit_and_remove_brackets(self):
        s = run(self.state, order(stop_loss=95))
        body = {"action": "bracket", "request_id": str(uuid4()), "position_id": s["positions"][0]["id"], "stop_loss": None, "take_profit": 120}
        s = run(s, body)
        self.assertIsNone(s["positions"][0]["stop_loss"])
        self.assertEqual(d(s["positions"][0]["take_profit"]), 120)
        with self.assertRaisesRegex(TradingError, "invalid_stop_loss"):
            run(s, {**body, "request_id": str(uuid4()), "stop_loss": 150})

    def test_sync_does_not_grow_command_receipts(self):
        s = run(self.state)
        self.assertEqual(s["commands"], [])

    def test_nonfinite_decimal_rejected(self):
        for value in ("NaN", "Infinity", "-Infinity", None):
            with self.assertRaises(TradingError):
                d(value)


class QuoteTests(unittest.TestCase):
    def test_usd_equity_regular_session_and_staleness(self):
        now = datetime(2026, 11, 2, 15, 0, tzinfo=timezone.utc)
        raw = {"currency": "USD", "quote_type": "EQUITY", "current_price": 100, "market_time": now.timestamp() - 900}
        self.assertTrue(normalize_quote(raw, now)["tradable"])
        self.assertFalse(normalize_quote({**raw, "market_time": now.timestamp() - 1201}, now)["tradable"])
        self.assertFalse(normalize_quote({**raw, "market_time": now.timestamp() + 1}, now)["tradable"])
        self.assertFalse(normalize_quote(raw, datetime(2026, 11, 2, 22, 0, tzinfo=timezone.utc))["tradable"])

    def test_reject_unknown_currency_instrument_and_timestamp(self):
        raw = {"currency": "USD", "quote_type": "ETF", "current_price": 100, "market_time": 1793631600}
        for override in ({"currency": "HKD"}, {"quote_type": "CRYPTOCURRENCY"}, {"market_time": None}, {"current_price": 0}):
            with self.assertRaises(TradingError):
                normalize_quote({**raw, **override})


class ServiceTests(unittest.TestCase):
    def service(self):
        service = PaperTradingService(Mock(), quote_provider=lambda symbol: {})
        service.load = Mock(return_value={"state": new_account(NOW), "version": 7})
        return service

    def test_cas_scopes_both_user_and_version(self):
        service = self.service()
        chain = service.db.table.return_value.update.return_value
        chain.eq.return_value.eq.return_value.execute.return_value.data = [{"version": 8}]
        result = service.mutate("user-a", {"action": "sync", "request_id": str(uuid4())})
        chain.eq.assert_called_once_with("user_id", "user-a")
        chain.eq.return_value.eq.assert_called_once_with("version", 7)
        self.assertEqual(result["version"], 8)

    def test_conflict_reloads_and_has_bounded_retries(self):
        service = self.service()
        service.db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        with self.assertRaises(Conflict):
            service.mutate("user-a", {"action": "sync", "request_id": str(uuid4())})
        self.assertEqual(service.load.call_count, 4)

    def test_retry_after_uncertain_success_returns_saved_receipt(self):
        service = self.service()
        body = order()
        saved = run(new_account(NOW), body)
        service.load.return_value = {"state": saved, "version": 8}
        result = service.mutate("user-a", body)
        self.assertEqual(result["version"], 8)
        service.db.table.assert_not_called()

    def test_review_rejects_open_position_and_uses_ledger_snapshot(self):
        service = self.service()
        s = run(new_account(NOW), order())
        pid = s["positions"][0]["id"]
        service.load.return_value = {"state": s, "version": 1}
        with self.assertRaisesRegex(TradingError, "position_still_open"):
            service.publish("user-a", pid, "A useful trading review")
        s = run(s, order(effect="close", position_id=pid), price=110, at=LATER)
        service.load.return_value = {"state": s, "version": 2}
        service.db.table.return_value.upsert.return_value.execute.return_value.data = [{"id": "review"}]
        service.publish("user-a", pid, "A useful trading review")
        row = service.db.table.return_value.upsert.call_args.args[0]
        self.assertEqual(row["user_id"], "user-a")
        self.assertEqual(d(row["snapshot"]["realized_pnl"]), d(s["realized_pnl"]))
        self.assertNotIn("cash", row["snapshot"])


if __name__ == "__main__":
    unittest.main()
