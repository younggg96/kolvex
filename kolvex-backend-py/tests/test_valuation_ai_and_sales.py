import asyncio
import json
import unittest

from app.services.valuation.ai_assumptions import (AiAssumptionsInvalid, AiAssumptionsService, AiKeyRejected, AiNotApplicable, AiRateLimited,
                                                   AiValuation, build_context, build_messages, required_models, to_commands)
from app.services.valuation.company_model import calculate_company, fcff_value
from app.services.valuation.sales_history import build_sales_history, percentile, ttm_revenue

SNAP = {"symbol": "U", "name": "Unity", "snapshot_id": "a"*64, "currency": "USD", "price": 47.81, "market_cap_reference": 21e9,
        "operating_margin": -.30, "origins": {}, "inputs": {"revenue": 2e9, "shares": 440e6, "cash": 2.3e9, "debt": 2.2e9,
                                                            "other_claims": .3e9, "tax_rate": .21, "eps": -1.36}}
PROFIT = {**SNAP, "operating_margin": .2, "inputs": {**SNAP["inputs"], "eps": 2.0}}
DCF = {"conservative": {"revenue_growth": .05, "operating_margin": .1, "reinvestment_rate": .2, "discount_rate": .12},
       "base": {"revenue_growth": .1, "operating_margin": .15, "reinvestment_rate": .3, "discount_rate": .1},
       "optimistic": {"revenue_growth": .15, "operating_margin": .2, "reinvestment_rate": .4, "discount_rate": .08},
       "years": 10, "terminal_growth": .02, "terminal_roic": .1}
TEXT = {"summary": "s", "rationale": [{"assumption": "a", "reason": "r"}], "risks": ["x"]}
CALL = dict(user_id="u1", model_id="deepseek-flash", locale="zh", user_api_keys={"deepseek": "k"}, consensus={"revenue_estimates": [], "eps_estimates": []})


class FakeLlm:
    def __init__(self, *answers):
        self.answers, self.prompts = list(answers), []

    def with_structured_output(self, schema, method=None):
        return self

    async def ainvoke(self, prompt):
        self.prompts.append(prompt)
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


class MarginPath(unittest.TestCase):
    ARGS = dict(revenue=100, shares=1, cash=0, debt=0, other_claims=0, tax_rate=.2, years=5, revenue_growth=0,
                reinvestment_rate=.5, discount_rate=.1, terminal_growth=.02, terminal_roic=.1)

    def test_margin_moves_linearly_to_final_year(self):
        row = fcff_value(operating_margin=.2, starting_margin=-.3, **self.ARGS)
        self.assertEqual([round(r["operating_margin"], 4) for r in row["forecast"]], [-.2, -.1, 0, .1, .2])

    def test_omitted_start_matches_constant_margin(self):
        self.assertEqual(fcff_value(operating_margin=.2, starting_margin=.2, **self.ARGS)["fair_price"],
                         fcff_value(operating_margin=.2, **self.ARGS)["fair_price"])

    def test_loss_year_has_no_tax_credit_or_negative_reinvestment(self):
        first = fcff_value(operating_margin=.2, starting_margin=-.3, **self.ARGS)["forecast"][0]
        self.assertEqual(first["nopat"], first["ebit"])
        self.assertEqual(first["reinvestment"], 0)
        self.assertEqual(first["fcff"], first["ebit"])

    def test_margin_path_values_below_jumping_straight_to_target(self):
        ramp = fcff_value(operating_margin=.2, starting_margin=-.3, **self.ARGS)["fair_price"]
        self.assertLess(ramp, fcff_value(operating_margin=.2, **self.ARGS)["fair_price"])

    def test_loss_terminal_stays_not_applicable(self):
        self.assertEqual(fcff_value(operating_margin=-.2, **self.ARGS)["status"], "not_applicable")

    def test_calculator_accepts_starting_margin_and_rejects_others(self):
        scenarios = {k: {**DCF[k], "starting_margin": -.3} for k in ("conservative", "base", "optimistic")}
        command = dict(model="dcf", inputs={}, scenarios=scenarios, years=5, terminal_growth=.02, terminal_roic=.1)
        self.assertEqual(calculate_company(SNAP, command)["status"], "complete")
        scenarios["base"]["surprise"] = 1
        with self.assertRaises(ValueError):
            calculate_company(SNAP, command)


class Assumptions(unittest.TestCase):
    def run_service(self, service, snapshot, llm, **extra):
        return asyncio.run(service.generate(snapshot, llm=llm, **{**CALL, **extra}))

    def test_prompt_withholds_price_and_market_cap(self):
        text = json.dumps(build_context(SNAP, {}))
        self.assertNotIn("47.81", text)
        self.assertNotIn("price", text.lower())
        self.assertNotIn("market_cap", text)

    def test_loss_maker_gets_dcf_only_starting_from_reported_margin(self):
        llm = FakeLlm(AiValuation(dcf=DCF, **TEXT))
        data = self.run_service(AiAssumptionsService(), SNAP, llm)
        self.assertEqual(list(data["assumptions"]), ["dcf"])
        self.assertEqual(data["primary_model"], "dcf")
        self.assertEqual(data["assumptions"]["dcf"]["scenarios"]["base"]["starting_margin"], -.30)
        self.assertIn("Set pe, peg to null", llm.prompts[0][0][1])

    def test_loss_maker_pe_answer_is_ignored(self):
        llm = FakeLlm(AiValuation(dcf=DCF, pe={"conservative": 10, "base": 20, "optimistic": 30}, **TEXT))
        self.assertNotIn("pe", self.run_service(AiAssumptionsService(), SNAP, llm)["assumptions"])

    def test_profitable_company_needs_all_models(self):
        peg = {k: {"target_peg": p, "eps_growth": .2} for k, p in zip(("conservative", "base", "optimistic"), (.75, 1, 1.25))}
        answer = AiValuation(dcf=DCF, pe={"conservative": 10, "base": 20, "optimistic": 30}, peg=peg, **TEXT)
        data = self.run_service(AiAssumptionsService(), PROFIT, FakeLlm(answer))
        self.assertEqual(set(data["assumptions"]), {"dcf", "pe", "peg"})

    def test_financial_company_skips_dcf(self):
        snapshot = {**PROFIT, "dcf_exclusion": "specialized_financial_model_required"}
        self.assertEqual(required_models(snapshot), {"dcf": False, "pe": True, "peg": True})

    def test_no_usable_model_raises_before_any_call(self):
        llm = FakeLlm()
        with self.assertRaises(AiNotApplicable):
            self.run_service(AiAssumptionsService(), {**SNAP, "dcf_exclusion": "x"}, llm)
        self.assertEqual(llm.prompts, [])

    def test_out_of_range_retries_with_reason_then_succeeds(self):
        bad = json.loads(json.dumps(DCF))
        bad["base"]["discount_rate"] = .5
        llm = FakeLlm(AiValuation(dcf=bad, **TEXT), AiValuation(dcf=DCF, **TEXT))
        self.assertEqual(self.run_service(AiAssumptionsService(), SNAP, llm)["status"], "complete")
        self.assertIn("base.discount_rate", llm.prompts[1][-1][1])

    def test_crossed_scenarios_fail_after_retries(self):
        crossed = json.loads(json.dumps(DCF))
        crossed["conservative"], crossed["optimistic"] = crossed["optimistic"], crossed["conservative"]
        llm = FakeLlm(AiValuation(dcf=crossed, **TEXT), AiValuation(dcf=crossed, **TEXT))
        with self.assertRaises(AiAssumptionsInvalid):
            self.run_service(AiAssumptionsService(), SNAP, llm)
        self.assertEqual(len(llm.prompts), 2)

    def test_negative_terminal_cash_flow_is_rejected(self):
        bad = json.loads(json.dumps(DCF))
        bad["conservative"]["operating_margin"] = -.1
        with self.assertRaises(AiAssumptionsInvalid):
            to_commands(AiValuation(dcf=bad, **TEXT), SNAP, required_models(SNAP))

    def test_nonpositive_equity_is_accepted_not_retried_away(self):
        llm = FakeLlm(AiValuation(dcf=DCF, **TEXT))
        data = self.run_service(AiAssumptionsService(), SNAP, llm)
        command = data["assumptions"]["dcf"]
        self.assertEqual(len(llm.prompts), 1)
        self.assertEqual(calculate_company(SNAP, command)["scenarios"]["conservative"]["status"], "nonpositive_equity_value")

    def test_missing_required_model_is_rejected(self):
        with self.assertRaises(AiAssumptionsInvalid):
            to_commands(AiValuation(**TEXT), SNAP, required_models(SNAP))

    def test_cache_returns_without_new_call_and_regenerate_calls_again(self):
        service = AiAssumptionsService()
        llm = FakeLlm(AiValuation(dcf=DCF, **TEXT), AiValuation(dcf=DCF, **TEXT))
        self.assertFalse(self.run_service(service, SNAP, llm)["cached"])
        self.assertTrue(self.run_service(service, SNAP, llm)["cached"])
        self.assertEqual(len(llm.prompts), 1)
        self.assertFalse(self.run_service(service, SNAP, llm, regenerate=True)["cached"])

    def test_rate_limit_is_per_user(self):
        service = AiAssumptionsService()
        for _ in range(10):
            service._take_call("a")
        with self.assertRaises(AiRateLimited):
            service._take_call("a")
        service._take_call("b")

    def test_requires_users_own_key(self):
        from app.services.technical_analysis import AiNotConfigured
        with self.assertRaises(AiNotConfigured):
            self.run_service(AiAssumptionsService(), SNAP, FakeLlm(), user_api_keys={})

    def test_auth_failure_is_reported_as_key_rejected(self):
        with self.assertRaises(AiKeyRejected):
            self.run_service(AiAssumptionsService(), SNAP, FakeLlm(RuntimeError("401 unauthorized")))

    def test_messages_request_chinese_for_zh(self):
        self.assertIn("Simplified Chinese", build_messages(SNAP, {}, required_models(SNAP), "zh")[0][1])


class SavedRuns(unittest.TestCase):
    def generate(self, service, persist, **extra):
        llm = FakeLlm(AiValuation(dcf=DCF, **TEXT), AiValuation(dcf=DCF, **TEXT))
        return asyncio.run(service.generate(SNAP, llm=llm, persist=persist, **{**CALL, **extra}))

    def test_fresh_run_is_saved_with_results_and_inputs(self):
        records = []
        data = self.generate(AiAssumptionsService(), lambda r: records.append(r) or {"id": "r1", "created_at": "2026-11-05T00:00:00Z"})
        self.assertEqual((data["run_id"], data["saved"], data["generated_at"]), ("r1", True, "2026-11-05T00:00:00Z"))
        record = records[0]
        self.assertEqual(record["financial_snapshot"]["inputs"]["revenue"], 2e9)
        self.assertEqual(record["financial_snapshot"]["price"], 47.81)
        self.assertEqual(record["results"]["dcf"]["conservative"]["status"], "nonpositive_equity_value")
        self.assertGreater(record["results"]["dcf"]["base"]["fair_price"], 0)
        self.assertEqual(record["payload"]["summary"], "s")

    def test_record_is_json_safe_and_holds_no_key_or_prompt(self):
        records = []
        self.generate(AiAssumptionsService(), lambda r: records.append(r) or {"id": "r1", "created_at": "t"}, user_api_keys={"deepseek": "secret-key"})
        text = json.dumps(records[0], allow_nan=False)
        self.assertNotIn("secret-key", text)
        self.assertNotIn("You are a careful", text)

    def test_cache_hit_does_not_save_twice_but_regenerate_does(self):
        records, service = [], AiAssumptionsService()
        persist = lambda r: records.append(r) or {"id": f"r{len(records)}", "created_at": "t"}
        first = self.generate(service, persist)
        again = self.generate(service, persist)
        self.assertEqual((len(records), again["run_id"], again["cached"]), (1, first["run_id"], True))
        self.assertEqual(self.generate(service, persist, regenerate=True)["run_id"], "r2")

    def test_storage_failure_keeps_the_paid_for_result(self):
        def fail(record):
            raise RuntimeError("database down")
        data = self.generate(AiAssumptionsService(), fail)
        self.assertEqual((data["status"], data["saved"], data["run_id"]), ("complete", False, None))

    def test_list_filters_to_owner_and_ticker_and_flattens(self):
        from unittest.mock import MagicMock
        from app.services.valuation.ai_runs import ValuationAiRuns
        db = MagicMock()
        query = db.table.return_value.select.return_value
        query.eq.return_value = query
        query.order.return_value = query
        query.limit.return_value = query
        query.execute.return_value.data = [{"id": "r1", "created_at": "t", "model_id": "m", "prompt_version": "v", "snapshot_id": "s", "ticker": "U",
                                            "payload": {"summary": "s"}, "results": {"dcf": {}}, "financial_snapshot": {"price": 47.81}}]
        items = ValuationAiRuns(db).list("u1", "U")
        query.eq.assert_any_call("user_id", "u1")
        query.eq.assert_any_call("ticker", "U")
        self.assertEqual(items[0]["run_id"], "r1")
        self.assertEqual(items[0]["summary"], "s")
        self.assertTrue(items[0]["saved"])
        self.assertEqual(items[0]["price_at_generation"], 47.81)


def fact(start, end, val, filed, form="10-Q"):
    return {"start": start, "end": end, "val": val, "filed": filed, "form": form, "accn": f"0001-{filed}"}


def company(revenue, shares, concept="Revenues"):
    return {"cik": 1, "facts": {"us-gaap": {concept: {"units": {"USD": revenue}},
                                            "WeightedAverageNumberOfSharesOutstandingBasic": {"units": {"shares": shares}}}}}


REVENUE = [fact("2024-01-01", "2024-12-31", 100, "2025-02-01", "10-K"), fact("2024-01-01", "2024-03-31", 20, "2024-05-01"),
           fact("2025-01-01", "2025-03-31", 30, "2025-05-01")]
SHARES = [fact("2024-10-01", "2024-12-31", 10, "2025-02-01", "10-K"), fact("2025-01-01", "2025-03-31", 10, "2025-05-01")]


def market(*rows, splits=()):
    return {"rows": [{"date": d, "close": c} for d, c in rows], "splits": list(splits), "currency": "USD"}


class SalesHistory(unittest.TestCase):
    def test_ttm_adds_ytd_and_removes_prior_ytd(self):
        rows = [{**r, "concept": "Revenues"} for r in REVENUE]
        self.assertEqual(ttm_revenue(rows, "2025-06-01")["value"], 110)

    def test_filing_on_or_after_session_is_not_known(self):
        rows = [{**r, "concept": "Revenues"} for r in REVENUE]
        self.assertEqual(ttm_revenue(rows, "2025-05-01")["value"], 100)
        self.assertEqual(ttm_revenue(rows, "2025-02-01"), None)

    def test_later_restatement_does_not_rewrite_history(self):
        restated = fact("2024-01-01", "2024-12-31", 999, "2026-02-01", "10-K")
        data = build_sales_history("X", company(REVENUE+[restated], SHARES), market(("2025-06-02", 5), ("2025-06-03", 5)), as_of="2025-06-04")
        self.assertEqual(data["current"]["ttm_revenue"], 110)

    def test_larger_total_wins_over_subset_concept(self):
        payload = company(REVENUE, SHARES)
        payload["facts"]["us-gaap"]["RevenueFromContractWithCustomerExcludingAssessedTax"] = {"units": {"USD": [fact("2024-01-01", "2024-12-31", 90, "2025-02-01", "10-K")]}}
        data = build_sales_history("X", payload, market(("2025-03-03", 5)), as_of="2025-03-04")
        self.assertEqual(data["current"]["ttm_revenue"], 100)

    def test_price_to_sales_value(self):
        data = build_sales_history("X", company(REVENUE, SHARES), market(("2025-06-02", 22)), as_of="2025-06-03")
        self.assertEqual(data["current"]["ps"], 2.0)
        self.assertEqual(data["current"]["market_cap"], 220)

    def test_split_after_filing_restates_shares_to_current_basis(self):
        data = build_sales_history("X", company(REVENUE, SHARES), market(("2025-07-01", 5), splits=[{"date": "2025-06-15", "ratio": 2}]), as_of="2025-07-02")
        self.assertEqual(data["current"]["shares"], 20)

    def test_share_mismatch_with_vendor_is_withheld(self):
        data = build_sales_history("X", company(REVENUE, SHARES), market(("2025-06-02", 22)), as_of="2025-06-03", vendor_market_cap=22000)
        self.assertEqual((data["status"], data["reason"]), ("unavailable", "share_basis_unverified"))

    def test_stale_revenue_is_unavailable_not_old_value(self):
        data = build_sales_history("X", company(REVENUE, SHARES), market(("2025-06-02", 5), ("2026-06-02", 5)), as_of="2026-06-03")
        self.assertEqual((data["status"], data["reason"]), ("unavailable", "insufficient_sec_history"))

    def test_unexplained_share_jump_blanks_older_points(self):
        shares = [fact("2024-10-01", "2024-12-31", 1, "2025-02-01", "10-K"), fact("2025-01-01", "2025-03-31", 10, "2025-05-01")]
        data = build_sales_history("X", company(REVENUE, shares), market(("2025-03-03", 5), ("2025-06-02", 5)), as_of="2025-06-03")
        self.assertIsNone(data["points"][0]["ps"])
        self.assertIsNotNone(data["points"][1]["ps"])

    def test_missing_facts_are_unavailable(self):
        self.assertEqual(build_sales_history("X", {"facts": {}}, market(("2025-06-02", 5)), as_of="2025-06-03")["reason"], "sec_facts_missing")

    def test_reference_needs_a_year_of_sessions(self):
        self.assertIsNone(build_sales_history("X", company(REVENUE, SHARES), market(("2025-06-02", 22)), as_of="2025-06-03")["reference"])

    def test_percentile_interpolates(self):
        self.assertEqual(percentile([1, 2, 3, 4], .5), 2.5)


class Routes(unittest.TestCase):
    def setUp(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from app.api.dependencies.auth import get_current_user_id
        from app.api.routes.valuation import router
        from app.services.user_api_keys_service import get_user_api_keys_service

        class Keys:
            async def get_keys_dict(self, user_id):
                return {"deepseek": "k"}
        self.app = FastAPI()
        self.app.include_router(router)
        self.app.dependency_overrides[get_user_api_keys_service] = lambda: Keys()
        self.auth = get_current_user_id
        self.client = TestClient(self.app)
        self.body = {"snapshot_id": "a"*64, "model": "deepseek-flash"}

    def post(self, snapshot=SNAP, failure=None):
        from unittest.mock import AsyncMock, patch
        self.app.dependency_overrides[self.auth] = lambda: "u1"
        generate = AsyncMock(side_effect=failure, return_value={"status": "complete"})
        with patch("app.api.routes.valuation.company_inputs_service.snapshot", side_effect=None if snapshot else LookupError(), return_value=snapshot), \
                patch("app.api.routes.valuation.ai_assumptions_service.generate", generate):
            return self.client.post("/valuation/U/ai-assumptions", json=self.body)

    def test_requires_sign_in(self):
        self.assertIn(self.client.post("/valuation/U/ai-assumptions", json=self.body).status_code, {401, 403})

    def test_runs_require_sign_in_and_hide_database_errors(self):
        from unittest.mock import patch
        self.assertIn(self.client.get("/valuation/U/ai-runs").status_code, {401, 403})
        self.app.dependency_overrides[self.auth] = lambda: "u1"
        with patch("app.api.routes.valuation.ValuationAiRuns") as store, patch("app.api.routes.valuation.get_supabase_service"):
            store.return_value.list.side_effect = RuntimeError("secret")
            response = self.client.get("/valuation/U/ai-runs")
            self.assertEqual((response.status_code, response.json()["detail"]), (503, "ai_runs_unavailable"))
            store.return_value.list.side_effect = None
            store.return_value.list.return_value = [{"run_id": "r1"}]
            self.assertEqual(self.client.get("/valuation/U/ai-runs").json(), {"items": [{"run_id": "r1"}]})
            store.return_value.list.assert_called_with("u1", "U", 20)

    def test_success(self):
        self.assertEqual(self.post().json(), {"status": "complete"})

    def test_changed_snapshot_is_conflict(self):
        self.assertEqual(self.post(snapshot=None).status_code, 409)

    def test_errors_use_stable_codes_without_provider_text(self):
        from app.services.technical_analysis import AiNotConfigured
        for failure, status, code in ((AiNotConfigured("x"), 503, "ai_not_configured"), (AiKeyRejected("x"), 400, "ai_key_rejected"),
                                      (AiRateLimited("x"), 429, "ai_rate_limited"), (AiNotApplicable("x"), 422, "ai_not_applicable"),
                                      (AiAssumptionsInvalid("x"), 502, "ai_assumptions_invalid"), (TimeoutError(), 504, "ai_analysis_timeout"),
                                      (RuntimeError("secret sk-123"), 503, "ai_unavailable")):
            response = self.post(failure=failure)
            self.assertEqual((response.status_code, response.json()["detail"]), (status, code))


if __name__ == "__main__":
    unittest.main()
