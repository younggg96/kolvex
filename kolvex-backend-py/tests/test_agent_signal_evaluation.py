import asyncio
import unittest
from datetime import date
from unittest.mock import MagicMock, Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.services import agent_signal_evaluation as ev
from app.services.agent_signal_evaluation import evaluate_due_signals, score_signal, summarize

TODAY = date(2026, 11, 20)


def bar(day, o, h=None, l=None, c=None):
    c = o if c is None else c
    return {"date": f"2026-11-{day:02d}T00:00:00-05:00", "open": o, "high": h or max(o, c), "low": l or min(o, c), "close": c}


def signal(**kw):
    return {"id": "s1", "user_id": "u1", "ticker": "NVDA", "trade_date": "2026-11-02",
            "expires_on": "2026-11-06", "rating": "BUY", "stop_loss_pct": None, "take_profit_pct": None, **kw}


# Trade date Mon 11-02; entry Tue 11-03 open 100; exit Fri 11-06 close 110.
STOCK = [bar(2, 95), bar(3, 100, 104, 98, 102), bar(4, 102, 106, 101, 105), bar(5, 105, 108, 103, 107), bar(6, 107, 111, 106, 110), bar(9, 120)]
SPY = [bar(2, 500), bar(3, 500), bar(4, 502), bar(5, 503), bar(6, 503, c=510), bar(9, 511)]


class ScoreTests(unittest.TestCase):
    def test_buy_entry_next_open_exit_expiry_close_with_excess(self):
        r = score_signal(signal(), STOCK, SPY, TODAY)
        self.assertEqual((r["entry_date"], r["entry_price"]), ("2026-11-03", 100.0))
        self.assertEqual((r["exit_date"], r["exit_price"]), ("2026-11-06", 110.0))
        self.assertEqual(r["return_pct"], 10.0)
        self.assertEqual(r["benchmark_return_pct"], 2.0)
        self.assertEqual(r["excess_return_pct"], 8.0)
        self.assertEqual(r["signed_excess_pct"], 8.0)
        self.assertTrue(r["hit"])
        self.assertEqual(r["max_adverse_pct"], -2.0)
        self.assertIsNone(r["bracket_outcome"])

    def test_sell_scored_as_short(self):
        r = score_signal(signal(rating="SELL"), STOCK, SPY, TODAY)
        self.assertFalse(r["hit"])
        self.assertEqual(r["signed_excess_pct"], -8.0)
        self.assertEqual(r["max_adverse_pct"], -11.0)

    def test_hold_hits_inside_band(self):
        flat = [bar(2, 100), bar(3, 100), bar(6, 100, c=101)]
        self.assertTrue(score_signal(signal(rating="HOLD"), flat, [], TODAY)["hit"])
        self.assertFalse(score_signal(signal(rating="HOLD"), STOCK, SPY, TODAY)["hit"])

    def test_stop_first_when_bar_touches_both(self):
        path = [bar(2, 100), bar(3, 100, 120, 90, 100), bar(6, 100)]
        r = score_signal(signal(stop_loss_pct=5, take_profit_pct=10), path, [], TODAY)
        self.assertEqual((r["bracket_outcome"], r["bracket_return_pct"]), ("stop_loss", -5.0))

    def test_take_profit_and_expired(self):
        tp = score_signal(signal(take_profit_pct=5), STOCK, SPY, TODAY)
        self.assertEqual((tp["bracket_outcome"], tp["bracket_return_pct"]), ("take_profit", 5.0))
        ex = score_signal(signal(stop_loss_pct=50), STOCK, SPY, TODAY)
        self.assertEqual((ex["bracket_outcome"], ex["bracket_return_pct"]), ("expired", 10.0))

    def test_not_expired_yet_waits(self):
        self.assertIsNone(score_signal(signal(), STOCK, SPY, date(2026, 11, 6)))

    def test_missing_data_waits_then_unscoreable(self):
        self.assertIsNone(score_signal(signal(), [], [], date(2026, 11, 10)))
        r = score_signal(signal(), [], [], TODAY)
        self.assertEqual(r["status"], "unscoreable")

    def test_benchmark_mismatch_falls_back_to_raw_return(self):
        r = score_signal(signal(), STOCK, [bar(6, 500)], TODAY)
        self.assertIsNone(r["excess_return_pct"])
        self.assertEqual(r["signed_excess_pct"], 10.0)


class JobTests(unittest.TestCase):
    def db_with(self, signals, evaluated=()):
        db = MagicMock()
        tables = {ev.SIGNALS_TABLE: MagicMock(), ev.EVALUATIONS_TABLE: MagicMock()}
        db.table.side_effect = lambda name: tables[name]
        q = tables[ev.SIGNALS_TABLE].select.return_value.eq.return_value.lt.return_value.gte.return_value
        q.order.return_value.range.return_value.execute.return_value.data = signals
        tables[ev.EVALUATIONS_TABLE].select.return_value.in_.return_value.execute.return_value.data = [
            {"signal_id": i} for i in evaluated]
        return db, tables

    def test_scores_unevaluated_and_fetches_each_symbol_once(self):
        db, tables = self.db_with([signal(), signal(id="s2"), signal(id="s3")], evaluated=["s3"])
        history = Mock(side_effect=lambda sym, start, end: STOCK if sym == "NVDA" else SPY)
        counts = evaluate_due_signals(db, history, TODAY)
        self.assertEqual(counts["due"], 2)
        self.assertEqual(counts["scored"], 2)
        self.assertEqual(sorted(c.args[0] for c in history.call_args_list), ["NVDA", "SPY"])
        self.assertEqual(tables[ev.EVALUATIONS_TABLE].upsert.call_count, 2)

    def test_history_failure_leaves_signal_pending(self):
        db, tables = self.db_with([signal()])
        counts = evaluate_due_signals(db, Mock(side_effect=RuntimeError("down")), TODAY)
        self.assertEqual(counts["pending"], 1)
        tables[ev.EVALUATIONS_TABLE].upsert.assert_not_called()


class SummaryTests(unittest.TestCase):
    def test_counts_calibration_and_degraded(self):
        def row(conv, hit, status="structured", evaluation=True, rating="BUY"):
            e = {"status": "scored", "hit": hit, "excess_return_pct": 2.0 if hit else -2.0,
                 "signed_excess_pct": 2.0 if hit else -2.0, "bracket_outcome": None} if evaluation else None
            return {"rating": rating, "conviction": conv, "model_id": "m", "position_action": None,
                    "extraction_status": status, "evaluation": e}
        s = summarize([row(0.9, True), row(0.85, True), row(0.3, False), row(0.5, True, evaluation=False),
                       row(0.5, True, status="rating_only")])
        self.assertEqual(s["by_extraction_status"], {"structured": 4, "rating_only": 1})
        self.assertEqual(s["awaiting_evaluation"], 1)
        self.assertEqual(s["overall"]["count"], 3)
        self.assertEqual(s["overall"]["hit_rate"], 66.67)
        self.assertEqual(s["by_conviction"]["0.8-1"]["hit_rate"], 100.0)
        self.assertEqual(s["by_conviction"]["0-0.4"]["hit_rate"], 0.0)
        self.assertEqual(s["by_conviction"]["0.6-0.8"]["count"], 0)


class RouteTests(unittest.TestCase):
    def test_performance_route_uses_current_user_and_maps_errors(self):
        from app.api.dependencies.auth import get_current_user_id
        from app.api.routes.trading_analysis import routes
        app = FastAPI()
        app.include_router(routes.router)
        app.dependency_overrides[get_current_user_id] = lambda: "user-1"
        client = TestClient(app)
        with patch.object(routes, "get_supabase_service", return_value="db"), \
             patch.object(routes, "load_user_performance", return_value={"signals": 0}) as load:
            self.assertEqual(client.get("/trading-analysis/signals/performance").json(), {"signals": 0})
            load.assert_called_with("db", "user-1")
        with patch.object(routes, "get_supabase_service", return_value="db"), \
             patch.object(routes, "load_user_performance", side_effect=RuntimeError("no table")):
            self.assertEqual(client.get("/trading-analysis/signals/performance").status_code, 503)


class WorkerTests(unittest.TestCase):
    def test_worker_is_opt_in(self):
        with patch.dict("os.environ", {}, clear=False):
            import os
            os.environ.pop("AGENT_SIGNAL_EVAL_WORKER_ENABLED", None)
            self.assertIsNone(asyncio.run(ev.run_signal_evaluation_worker()))


if __name__ == "__main__":
    unittest.main()
