import asyncio
from datetime import date, datetime, timezone
import json
import unittest
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

from app.services.options_activity import aggregate, candidates, summary
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


def candidate(contract="AAA261120C00105000", underlying="AAA", kind="call", strike=105, exp="2026-11-20", confidence="medium", **overrides):
    return {
        "contract": contract, "underlying": underlying, "type": kind, "strike": strike, "expiration": exp,
        "thesis_zh": "Call 成交额集中，且价外幅度不大。", "thesis_en": "Call premium traded here and it is near the money.",
        "risk_zh": "时间衰减。", "risk_en": "Time decay.",
        "invalidation_zh": "跌破隐含区间下沿。", "invalidation_en": "A close below the implied range.",
        "confidence": confidence, **overrides,
    }


class FakeLLM:
    model_name = "deepseek-test"

    def __init__(self, content):
        self.content = content

    async def ainvoke(self, messages):
        from langchain_core.messages import AIMessage

        return AIMessage(content=self.content)


class CandidateTests(unittest.TestCase):
    def setUp(self):
        aaa = [dict(row("call", 105, exp="2026-11-20", volume=500, oi=100, vwap=2.0), symbol="AAA261120C00105000"),
               dict(row("call", 110, exp="2026-11-20", volume=400, oi=100, vwap=2.0), symbol="AAA261120C00110000"),
               dict(row("call", 100, exp="2026-11-09", volume=9000, oi=100, vwap=2.0), symbol="AAA261109C00100000")]
        bbb = [dict(row("put", 90, exp="2026-12-18", volume=100, oi=1000, vwap=3.0), symbol="BBB261218P00090000")]
        self.report = aggregate.build_report([scan("AAA", aaa, earnings="2026-11-10"), scan("BBB", bbb)], [], TODAY)
        self.pool = self.report["candidate_contracts"]

    def generate(self, content):
        return asyncio.run(candidates.generate_candidates(self.report, "intraday", TODAY.isoformat(), llm=FakeLLM(content)))

    def test_pool_skips_short_dated_and_caps_each_symbol(self):
        symbols = [c["symbol"] for c in self.pool]
        self.assertNotIn("AAA261109C00100000", symbols)
        self.assertIn("AAA261120C00105000", symbols)

        many = [dict(c, symbol=f"S{i}", underlying="AAA", premium=100 - i, dte=20) for i, c in enumerate([self.pool[0]] * 5)]
        self.assertEqual([c["symbol"] for c in aggregate.candidate_pool(many)], ["S0", "S1", "S2"])
        deep = [dict(self.pool[0], symbol="DEEP", delta=-0.95), dict(self.pool[0], symbol="OK", delta=-0.6), dict(self.pool[0], symbol="NONE", delta=None)]
        self.assertEqual([c["symbol"] for c in aggregate.candidate_pool(deep)], ["OK", "NONE"])

    def test_real_contract_takes_facts_from_run_data(self):
        result = self.generate(json.dumps({"candidates": [candidate(premium=1, dte=99)]}))
        self.assertEqual((result["status"], result["dropped"], result["model_id"]), ("ok", 0, "deepseek-test"))
        item = result["items"][0]
        self.assertEqual((item["symbol"], item["premium"], item["dte"], item["confidence"]), ("AAA261120C00105000", 100_000, 14, "medium"))
        self.assertTrue(item["flags"]["crosses_earnings"])

    def test_invented_or_mismatched_contracts_are_dropped(self):
        bad = [
            candidate(contract="AAA261120C00999000", strike=999),  # not in this run
            candidate(strike=106),  # real symbol, wrong strike
            candidate(exp="2026-12-18"),
            candidate(kind="put"),
            candidate(underlying="ZZZ"),
            candidate(contract="AAA261109C00100000", strike=100, exp="2026-11-09"),  # real but same-day, outside the pool
            "not an object",
        ]
        valid = [c["symbol"] for c in candidates.validate_candidates(bad + [candidate()], self.pool)[0]]
        self.assertEqual(valid, ["AAA261120C00105000"])
        self.assertEqual(candidates.validate_candidates(bad, self.pool), ([], len(bad)))

    def test_chinese_words_and_string_numbers_normalize(self):
        item = candidate(kind="看涨", strike="105.0", confidence="中等", contract="aaa261120c00105000")
        valid, dropped = candidates.validate_candidates([item], self.pool)
        self.assertEqual(dropped, 0)
        self.assertEqual((valid[0]["type"], valid[0]["strike"], valid[0]["confidence"]), ("call", 105, "medium"))

    def test_incomplete_or_unknown_confidence_is_dropped(self):
        self.assertEqual(candidates.validate_candidates([candidate(confidence="很确定")], self.pool)[0], [])
        self.assertEqual(candidates.validate_candidates([candidate(risk_zh="  ")], self.pool)[0], [])
        self.assertEqual(candidates.validate_candidates([candidate(thesis_en="x" * 401)], self.pool)[0], [])

    def test_premium_described_as_a_buy_signal_is_dropped(self):
        for field, text in (("thesis_zh", "大额成交是买入信号。"), ("risk_zh", "可能是聪明钱。"), ("thesis_en", "Whales bought this."), ("invalidation_en", "smart money leaves")):
            self.assertEqual(candidates.validate_candidates([candidate(**{field: text})], self.pool)[0], [], field)

    def test_keeps_one_per_underlying_and_caps_total(self):
        second = candidate(contract="AAA261120C00110000", strike=110)
        put = candidate(contract="BBB261218P00090000", underlying="BBB", kind="put", strike=90, exp="2026-12-18")
        valid, dropped = candidates.validate_candidates([candidate(), second, put], self.pool)
        self.assertEqual([c["symbol"] for c in valid], ["AAA261120C00105000", "BBB261218P00090000"])
        self.assertEqual(dropped, 1)

    def test_parses_fenced_json_and_bare_list(self):
        self.assertEqual(self.generate("结果如下：\n```json\n" + json.dumps({"candidates": [candidate()]}) + "\n```")["status"], "ok")
        self.assertEqual(self.generate(json.dumps([candidate()]))["status"], "ok")

    def test_bad_output_is_unavailable_not_an_error(self):
        for content, reason in (("抱歉，我无法回答", "invalid_output"), ('{"candidates": [', "invalid_output"), ('{"candidates": "none"}', "invalid_output"),
                                (json.dumps({"candidates": []}), "no_valid_candidates"),
                                (json.dumps({"candidates": [candidate(strike=999)]}), "no_valid_candidates")):
            result = self.generate(content)
            self.assertEqual((result["status"], result["reason"], result["items"]), ("unavailable", reason, []), content)

    def test_model_failure_and_timeout_never_raise(self):
        class Boom:
            async def ainvoke(self, messages):
                raise RuntimeError("500")

        class Slow:
            async def ainvoke(self, messages):
                await asyncio.sleep(1)

        result = asyncio.run(candidates.generate_candidates(self.report, "pre", None, llm=Boom()))
        self.assertEqual((result["status"], result["reason"]), ("unavailable", "model_error"))
        with patch.object(candidates, "LLM_TIMEOUT_SECONDS", 0.01):
            result = asyncio.run(candidates.generate_candidates(self.report, "pre", None, llm=Slow()))
        self.assertEqual((result["status"], result["reason"]), ("unavailable", "model_error"))

    def test_missing_key_is_unavailable(self):
        with patch("app.agent.llm._create_llm", side_effect=ValueError("API key not configured")):
            result = asyncio.run(candidates.generate_candidates(self.report, "pre", None))
        self.assertEqual((result["status"], result["reason"]), ("unavailable", "model_error"))

    def test_no_eligible_contracts_skips_the_model(self):
        self.report["candidate_contracts"] = []
        result = asyncio.run(candidates.generate_candidates(self.report, "pre", None, llm=object()))
        self.assertEqual((result["status"], result["reason"]), ("unavailable", "no_eligible_contracts"))


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
        self.candidates = AsyncMock(return_value={"status": "ok", "items": [{"symbol": "X"}]})
        p = patch("app.services.options_activity.service.generate_candidates", self.candidates)
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

    def test_run_saves_candidates_inside_summary(self):
        asyncio.run(self.service(FakeCollector()).run("intraday", at(12, 30)))
        saved = self.store["save"].call_args.args[1]
        self.assertEqual(saved["summary"]["candidates"]["items"], [{"symbol": "X"}])
        self.assertEqual(saved["summary"]["points_zh"], ["x"])

    def test_report_still_saves_when_model_is_down(self):
        class Down:
            model_name = "down"

            async def ainvoke(self, messages):
                raise RuntimeError("deepseek 503")

        self.candidates.side_effect = candidates.generate_candidates
        service = OptionsActivityService(collector=FakeCollector(), db_factory=lambda: object(), candidates_llm=Down())
        result = asyncio.run(service.run("intraday", at(12, 30)))
        self.assertEqual(result["status"], "ok")
        saved = self.store["save"].call_args.args[1]
        self.assertEqual(saved["status"], "ok")
        self.assertEqual(saved["payload"]["market"]["call_premium"], 100_000)
        self.assertEqual(saved["summary"]["sentiment"], "mixed")
        self.assertEqual((saved["summary"]["candidates"]["status"], saved["summary"]["candidates"]["items"]), ("unavailable", []))

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


class AnalyzeLatestTests(unittest.TestCase):
    PAYLOAD = {"contracts": [{"symbol": "A", "underlying": "AAA", "dte": 30, "delta": 0.4}, {"symbol": "B", "underlying": "BBB", "dte": 1, "delta": 0.4}]}

    def analyze(self, run, fresh):
        generate = AsyncMock(return_value=fresh)
        update = AsyncMock()
        with patch("app.services.options_activity.store.get_run", AsyncMock(return_value=run)), \
                patch("app.services.options_activity.store.update_summary", update), \
                patch("app.services.options_activity.service.generate_candidates", generate):
            result = asyncio.run(OptionsActivityService(collector=FakeCollector(), db_factory=lambda: object()).analyze_latest())
        return result, generate, update

    def test_old_run_gets_a_pool_and_keeps_its_summary(self):
        run = {"id": "r", "session": "post", "data_date": "2026-11-06", "payload": self.PAYLOAD, "summary": {"points_zh": ["x"]}}
        result, generate, update = self.analyze(run, {"status": "ok", "items": [{"symbol": "A"}]})
        self.assertEqual(result, {"status": "ok", "reason": None, "count": 1})
        self.assertEqual([c["symbol"] for c in generate.call_args.args[0]["candidate_contracts"]], ["A"])
        self.assertEqual(update.call_args.args[1:], ("r", {"points_zh": ["x"], "candidates": {"status": "ok", "items": [{"symbol": "A"}]}}))

    def test_failed_attempt_keeps_an_earlier_good_list(self):
        down = {"status": "unavailable", "reason": "model_error", "items": []}
        good = {"status": "ok", "items": [{"symbol": "A"}]}
        run = {"id": "r", "session": "post", "payload": {"candidate_contracts": []}, "summary": {"candidates": good}}
        result, _, update = self.analyze(run, down)
        self.assertEqual(result, {"status": "unavailable", "reason": "model_error", "count": 0})
        update.assert_not_called()
        _, _, update = self.analyze({**run, "summary": {}}, down)
        update.assert_called_once()

    def test_no_saved_run_is_reported_as_failed_state(self):
        from app.services.options_activity import service as svc

        async def main():
            with patch("app.services.options_activity.store.get_run", AsyncMock(return_value=None)):
                self.assertTrue(svc.start_analysis())
                self.assertFalse(svc.start_manual_run("post"), "a new report must wait for the analysis")
                await asyncio.gather(*svc._manual_runs)
            self.assertEqual((svc.analysis_state["status"], svc.analysis_state["error"]), ("failed", "no_runs"))

        asyncio.run(main())


if __name__ == "__main__":
    unittest.main()
