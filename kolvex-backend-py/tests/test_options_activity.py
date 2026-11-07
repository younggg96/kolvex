import asyncio
from datetime import date, datetime, timezone
import unittest
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

from app.services.options_activity import aggregate, summary
from app.services.options_activity.collector import RateLimiter, stock_quote
from app.services.options_activity.service import OptionsActivityService, due_session

NY = ZoneInfo("America/New_York")
TODAY = date(2026, 11, 6)  # Friday


def row(kind, strike, exp="2026-11-13", volume=0, oi=0, vwap=None, bid=None, ask=None, last=None, gamma=None, iv=None):
    side = "C" if kind == "call" else "P"
    return {
        "symbol": f"XYZ261113{side}{int(strike * 1000):08d}", "type": kind, "strike": strike, "expiration": exp,
        "volume": volume, "open_interest": oi, "vwap": vwap, "bid": bid, "ask": ask, "last": last, "close": None,
        "multiplier": 100, "gamma": gamma, "iv": iv, "delta": None,
    }


def scan(symbol, rows, price=100.0, is_etf=False, earnings=None):
    return {"symbol": symbol, "is_etf": is_etf, "rows": rows, "earnings": earnings,
            "stock": {"price": price, "change_pct": 1.5, "bar_date": TODAY.isoformat()}}


class AggregateTests(unittest.TestCase):
    def test_premium_prefers_vwap_then_mid_then_last(self):
        self.assertEqual(aggregate.premium(row("call", 100, volume=10, vwap=2.0, bid=1, ask=1.2)), 2000)
        self.assertEqual(aggregate.premium(row("call", 100, volume=10, bid=1.0, ask=1.2)), 1100)
        self.assertEqual(aggregate.premium(row("call", 100, volume=10, last=0.5)), 500)
        self.assertEqual(aggregate.premium(row("call", 100, volume=0, vwap=2.0)), 0)
        self.assertEqual(aggregate.premium(row("call", 100, volume=10)), 0)

    def test_gamma_level_signs_puts_negative(self):
        rows = [row("call", 100, oi=1000, gamma=0.05), row("put", 95, oi=3000, gamma=0.04), row("put", 100, oi=100, gamma=0.05)]
        level = aggregate.gamma_exposure(rows, 100.0)
        # 95 put: -0.04*3000*100*100^2*0.01 = -1.2M ; 100: +500K call - 50K put = +450K
        self.assertEqual(level["strike"], 95)
        self.assertAlmostEqual(level["gex"], -1_200_000)
        self.assertAlmostEqual(level["total_gex"], -750_000)
        self.assertIsNone(aggregate.gamma_exposure(rows, None))

    def test_implied_range_skips_too_near_expirations(self):
        rows = [
            row("call", 100, exp="2026-11-09", bid=1, ask=1), row("put", 100, exp="2026-11-09", bid=1, ask=1),
            row("call", 100, exp="2026-11-13", bid=3, ask=3), row("put", 100, exp="2026-11-13", bid=2, ask=2),
        ]
        rng = aggregate.implied_range(rows, 100.0, TODAY)
        self.assertEqual((rng["expiration"], rng["low"], rng["high"], rng["pct"]), ("2026-11-13", 95.0, 105.0, 5.0))

    def test_report_contributors_baseline_and_flags(self):
        scans = [
            scan("AAA", [row("call", 105, volume=500, oi=100, vwap=2.0), row("put", 95, volume=100, oi=1000, vwap=1.0)],
                 earnings="2026-11-10"),
            scan("SPY", [row("call", 100, volume=10, vwap=1.0), row("put", 100, volume=400, oi=50, vwap=5.0)], is_etf=True),
            scan("ZZZ", []),
        ]
        history = [
            {"market": {"pc_premium_ratio": 1.0}, "tickers": [{"symbol": "AAA", "pc_premium_ratio": 0.2}]},
            {"market": {"pc_premium_ratio": 2.0}, "tickers": [{"symbol": "AAA", "pc_premium_ratio": 0.4}]},
            {"market": {"pc_premium_ratio": None}, "tickers": []},
        ]
        report = aggregate.build_report(scans, history, TODAY)
        market = report["market"]
        self.assertEqual((market["call_premium"], market["put_premium"], market["net_premium"]), (101_000, 210_000, -109_000))
        self.assertEqual(market["pc_baseline"], 1.5)
        self.assertEqual((market["etf_net_premium"], market["stock_net_premium"]), (-199_000, 90_000))
        self.assertEqual([c["symbol"] for c in report["contributors"]["positive"]], ["AAA"])
        self.assertEqual([c["symbol"] for c in report["contributors"]["negative"]], ["SPY"])

        aaa = next(t for t in report["tickers"] if t["symbol"] == "AAA")
        self.assertEqual(aaa["pc_baseline"], 0.3)
        top = report["contracts"][0]
        self.assertEqual((top["underlying"], top["type"], top["premium"]), ("SPY", "put", 200_000))
        self.assertTrue(top["flags"]["new_positions"])  # 400 traded vs 50 open
        aaa_call = next(c for c in report["contracts"] if c["underlying"] == "AAA" and c["type"] == "call")
        self.assertEqual((aaa_call["vol_oi"], aaa_call["otm_pct"], aaa_call["dte"]), (5.0, 5.0, 7))
        self.assertEqual(aaa_call["flags"], {"new_positions": True, "crosses_earnings": True})
        aaa_put = next(c for c in report["contracts"] if c["underlying"] == "AAA" and c["type"] == "put")
        self.assertFalse(aaa_put["flags"]["new_positions"])


class CollectorTests(unittest.TestCase):
    def test_stock_quote_uses_eastern_bar_date(self):
        quote = stock_quote({"latestTrade": {"p": 110}, "dailyBar": {"t": "2026-11-06T05:00:00Z", "c": 109},
                             "prevDailyBar": {"c": 100}})
        self.assertEqual((quote["price"], quote["change_pct"], quote["bar_date"]), (110, 10.0, "2026-11-06"))

    def test_rate_limiter_spaces_calls(self):
        clock, sleeps = [0.0], []

        async def fake_sleep(delay):
            sleeps.append(delay)

        async def main():
            limiter = RateLimiter(120, clock=lambda: clock[0], sleep=fake_sleep)
            for _ in range(3):
                await limiter.wait()

        asyncio.run(main())
        self.assertEqual(sleeps, [0.5, 1.0])


class SummaryTests(unittest.TestCase):
    def test_llm_failure_falls_back_to_template(self):
        class Broken:
            model_name = "broken"

            def with_structured_output(self, *a, **k):
                raise RuntimeError("boom")

        report = aggregate.build_report([scan("AAA", [row("call", 105, volume=500, vwap=2.0)])], [], TODAY)
        result = asyncio.run(summary.summarize(report, "intraday", TODAY.isoformat(), llm=Broken()))
        self.assertEqual((result["source"], result["sentiment"], result["model_id"]), ("template", "bullish", None))
        self.assertIn("$100K", result["points_zh"][0])
        self.assertIn("AAA", result["points_en"][1])


class FakeCollector:
    configured = True

    def __init__(self, bar_date=TODAY.isoformat(), fail=False):
        self.bar_date, self.fail, self.calls = bar_date, fail, 0

    async def scan(self, today):
        self.calls += 1
        if self.fail:
            raise RuntimeError("alpaca down")
        s = scan("AAA", [row("call", 105, volume=500, vwap=2.0)])
        s["stock"]["bar_date"] = self.bar_date
        return [s], ["BBB"]


class FakeRedis:
    is_connected = False

    def __init__(self):
        self.store = {}

    async def get_json(self, key):
        return self.store.get(key)

    async def set_json(self, key, value, ttl=None):
        self.store[key] = value


def at(hour, minute, day=TODAY):
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=NY).astimezone(timezone.utc)


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.store = {name: AsyncMock() for name in ("recent_payloads", "existing", "has_data_date", "save")}
        self.store["recent_payloads"].return_value = []
        self.store["existing"].return_value = None
        self.store["has_data_date"].return_value = False
        self.store["save"].side_effect = lambda db, r: {**r, "id": "run-1"}
        for name, mock in self.store.items():
            p = patch(f"app.services.options_activity.store.{name}", mock)
            p.start()
            self.addCleanup(p.stop)
        self.redis = FakeRedis()
        p = patch("app.services.options_activity.service.get_redis", return_value=self.redis)
        p.start()
        self.addCleanup(p.stop)
        p = patch("app.services.options_activity.service.summarize",
                  AsyncMock(return_value={"sentiment": "mixed", "points_zh": ["x"], "points_en": ["x"], "model_id": "m", "prompt_version": "v"}))
        p.start()
        self.addCleanup(p.stop)

    def service(self, collector):
        return OptionsActivityService(collector=collector, db_factory=lambda: object())

    def test_due_session_schedule(self):
        self.assertIsNone(due_session(at(8, 59)))
        self.assertEqual(due_session(at(9, 0)), "pre")
        self.assertEqual(due_session(at(12, 29)), "pre")
        self.assertEqual(due_session(at(12, 30)), "intraday")
        self.assertEqual(due_session(at(23, 0)), "post")
        self.assertIsNone(due_session(at(13, 0, date(2026, 11, 7))))  # Saturday

    def test_run_saves_report_with_failed_symbols(self):
        result = asyncio.run(self.service(FakeCollector()).run("intraday", at(12, 30)))
        self.assertEqual((result["status"], result["id"], result["failed_symbols"]), ("ok", "run-1", ["BBB"]))
        saved = self.store["save"].call_args.args[1]
        self.assertEqual((saved["trade_date"], saved["session"], saved["status"], saved["model_id"]), ("2026-11-06", "intraday", "ok", "m"))
        self.assertEqual(saved["payload"]["market"]["call_premium"], 100_000)

    def test_holiday_is_saved_as_skipped(self):
        result = asyncio.run(self.service(FakeCollector(bar_date="2026-11-05")).run("post", at(16, 20)))
        self.assertEqual(result["status"], "skipped")
        self.assertEqual(self.store["save"].call_args.args[1]["status"], "skipped")

        self.store["has_data_date"].return_value = True  # pre-market on a holiday repeats yesterday's pre data
        result = asyncio.run(self.service(FakeCollector(bar_date="2026-11-05")).run("pre", at(9, 0)))
        self.assertEqual(result["status"], "skipped")

    def test_tick_runs_once_and_backs_off_after_failures(self):
        self.store["existing"].return_value = {"id": "done"}
        collector = FakeCollector()
        self.assertIsNone(asyncio.run(self.service(collector).tick(at(12, 31))))
        self.assertEqual(collector.calls, 0)

        self.store["existing"].return_value = None
        failing = FakeCollector(fail=True)
        service = self.service(failing)
        self.assertEqual(asyncio.run(service.tick(at(12, 31)))["status"], "failed")
        self.assertIsNone(asyncio.run(service.tick(at(12, 40))))  # within the 15-minute retry window
        asyncio.run(service.tick(at(12, 47)))
        asyncio.run(service.tick(at(13, 3)))
        self.assertIsNone(asyncio.run(service.tick(at(13, 30))))  # gave up after 3 attempts
        self.assertEqual(failing.calls, 3)


class ManualRunTests(unittest.TestCase):
    def test_manual_run_records_state_and_blocks_overlap(self):
        from app.services.options_activity import service as svc

        async def main():
            gate = asyncio.Event()

            async def slow_run(session, force=False):
                await gate.wait()
                return {"status": "skipped", "data_date": "2026-11-05"}

            with patch.object(svc.options_activity_service, "run", side_effect=slow_run):
                self.assertTrue(svc.start_manual_run("post"))
                self.assertEqual(svc.manual_state["status"], "running")
                self.assertFalse(svc.start_manual_run("pre"))
                gate.set()
                await asyncio.gather(*svc._manual_runs)
            self.assertEqual((svc.manual_state["status"], svc.manual_state["session"]), ("done", "post"))
            self.assertEqual(svc.manual_state["result"]["status"], "skipped")
            self.assertIsNotNone(svc.manual_state["finished_at"])

            with patch.object(svc.options_activity_service, "run", AsyncMock(side_effect=RuntimeError("alpaca 500"))):
                self.assertTrue(svc.start_manual_run("intraday"))
                await asyncio.gather(*svc._manual_runs)
            self.assertEqual((svc.manual_state["status"], svc.manual_state["error"]), ("failed", "alpaca 500"))

        asyncio.run(main())


if __name__ == "__main__":
    unittest.main()
