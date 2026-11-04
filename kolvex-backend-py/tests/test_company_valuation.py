import asyncio
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI

from app.services.valuation.company_model import fcff_value, calculate_company
from app.services.valuation.company_inputs import normalize_company_inputs, CompanyInputsService


def snapshot():
    return {"symbol": "TEST", "snapshot_id": "a" * 64, "currency": "USD", "price": 20, "quote_time": "2026-11-03T21:00:00Z",
            "inputs": {"revenue": 100, "shares": 10, "eps": 2, "cash": 10, "debt": 20, "other_claims": 5, "tax_rate": .25},
            "origins": {"revenue": "reported_vendor_data"}, "dcf_exclusion": None}


def command(model="dcf"):
    assumptions = {"revenue_growth": 0, "operating_margin": .2, "reinvestment_rate": 0, "discount_rate": .1} if model == "dcf" else {"target_pe": 20} if model == "pe" else {"target_peg": 1, "eps_growth": .2}
    return {"model": model, "snapshot_id": "a" * 64, "inputs": {}, "scenarios": {name: dict(assumptions) for name in ("conservative", "base", "optimistic")},
            "years": 5, "terminal_growth": 0, "terminal_roic": .1}


def fcff(**changes):
    values = {**snapshot()["inputs"], **command()["scenarios"]["base"], "years": 5, "terminal_growth": 0, "terminal_roic": .1}
    values.pop("eps")
    return fcff_value(**{**values, **changes})


class CompanyModelTests(unittest.TestCase):
    def test_constant_cashflow_matches_perpetuity_and_explicit_equity_bridge(self):
        value = fcff()
        self.assertAlmostEqual(value["enterprise_value"], 15 / .1)
        self.assertAlmostEqual(value["equity_value"], 150 + 10 - 20 - 5)
        self.assertAlmostEqual(value["fair_price"], 13.5)
        self.assertEqual(value["forecast"][0]["fcff"], 15)

    def test_terminal_growth_requires_reinvestment_not_free_growth(self):
        result = fcff(terminal_growth=.02)
        self.assertAlmostEqual(result["terminal_reinvestment_rate"], .2)
        self.assertAlmostEqual(result["terminal_fcff"], 15 * 1.02 * .8)
        expected = sum(15 / 1.1 ** n for n in range(1, 6)) + (15 * 1.02 * .8 / .08) / 1.1 ** 5
        self.assertAlmostEqual(result["enterprise_value"], expected)

    def test_forecast_reinvestment_is_deducted_from_nopat(self):
        self.assertEqual(fcff(reinvestment_rate=.4)["forecast"][0]["fcff"], 9)

    def test_debt_is_deducted_once_and_shares_only_change_per_share_value(self):
        first, second = fcff(), fcff(shares=20)
        self.assertEqual(first["equity_value"], second["equity_value"])
        self.assertEqual(first["fair_price"], 2 * second["fair_price"])

    def test_negative_equity_does_not_become_a_negative_stock_price(self):
        value = fcff(debt=1000)
        self.assertEqual(value["status"], "nonpositive_equity_value")
        self.assertLess(value["equity_value"], 0)
        self.assertIsNone(value["fair_price"])

    def test_negative_terminal_cashflow_is_not_applicable(self):
        self.assertEqual(fcff(operating_margin=-.2)["reason"], "nonpositive_terminal_cashflow")

    def test_invalid_terminal_conditions_and_nonnumeric_values_fail(self):
        for change in ({"discount_rate": .02, "terminal_growth": .02}, {"terminal_roic": .01, "terminal_growth": .02}, {"years": True},
                       {"shares": 0}, {"revenue": float("nan")}, {"tax_rate": True}, {"reinvestment_rate": -1}, {"revenue": 1e308, "revenue_growth": 2}):
            with self.subTest(change=change), self.assertRaises((ValueError, OverflowError)):
                fcff(**change)

    def test_pe_and_peg_calculate_equity_without_inventing_enterprise_value(self):
        for model in ("pe", "peg"):
            value = calculate_company(snapshot(), command(model))["scenarios"]["base"]
            self.assertEqual(value["fair_price"], 40)
            self.assertEqual(value["equity_value"], 400)
            self.assertIsNone(value["enterprise_value"])
            self.assertEqual(value["comparison"]["price_space"], 1)

    def test_losses_exclude_pe_and_financial_companies_exclude_generic_dcf(self):
        source = snapshot(); source["inputs"]["eps"] = -2
        self.assertEqual(calculate_company(source, command("pe"))["reason"], "positive_eps_required")
        source["dcf_exclusion"] = "specialized_financial_model_required"
        self.assertEqual(calculate_company(source, command())["status"], "not_applicable")

    def test_immutable_source_and_explicit_override_origin(self):
        source = snapshot(); before = copy.deepcopy(source)
        request = command(); request["inputs"] = {"cash": 11}
        result = calculate_company(source, request)
        self.assertEqual(source, before)
        self.assertEqual(result["input_origins"]["cash"], "user_assumption")
        self.assertEqual(len(result["sensitivity"]), 9)

    def test_crossed_scenarios_and_wrong_model_fields_are_rejected(self):
        request = command("pe"); request["scenarios"]["conservative"]["target_pe"] = 30
        with self.assertRaisesRegex(ValueError, "scenario_values_cross"):
            calculate_company(snapshot(), request)
        request = command("pe"); request["scenarios"]["base"]["discount_rate"] = .1
        with self.assertRaisesRegex(ValueError, "unexpected_scenario_fields"):
            calculate_company(snapshot(), request)


class CompanyInputTests(unittest.TestCase):
    def normalize(self, **changes):
        args = {"symbol": "TEST", "info": {"symbol": "TEST", "quoteType": "EQUITY", "currency": "USD", "financialCurrency": "USD", "country": "United States", "trailingEps": 2, "sharesOutstanding": 10, "regularMarketPrice": 20, "regularMarketTime": 1793739600},
                "quarterly": [{"period": p, "Total Revenue": 100, "Operating Income": 20, "Tax Provision": 5, "Pretax Income": 20} for p in ("2026-09-30", "2026-06-30", "2026-03-31", "2025-12-31")],
                "annual": [{"period": "2025-12-31", "Total Revenue": 300}], "balances": [{"period": "2026-09-30", "Cash And Cash Equivalents": 0, "Total Debt": 20}], "fetched_at": "2026-11-04T05:00:00+00:00"}
        return normalize_company_inputs(**{**args, **changes})

    def test_ttm_aggregates_contiguous_quarters_and_preserves_zero_cash(self):
        value = self.normalize()
        self.assertEqual(value["inputs"]["revenue"], 400)
        self.assertEqual(value["inputs"]["cash"], 0)
        self.assertEqual(value["inputs"]["tax_rate"], .25)
        self.assertEqual(value["income_basis"], "ttm_four_quarters")
        self.assertEqual(len(value["snapshot_id"]), 64)

    def test_incomplete_quarters_use_explicit_annual_fallback(self):
        value = self.normalize(quarterly=[])
        self.assertEqual(value["income_basis"], "reported_fiscal_year")
        self.assertEqual(value["inputs"]["revenue"], 300)
        self.assertEqual(value["origins"]["tax_rate"], "assumed_21_percent")

    def test_missing_balance_is_not_silently_zero_debt(self):
        value = self.normalize(balances=[])
        self.assertIsNone(value["inputs"]["debt"])
        self.assertEqual(value["origins"]["other_claims"], "missing_components_assumed_zero")

    def test_gaps_and_future_quarters_cannot_form_ttm(self):
        q = [{"period": p, "Total Revenue": 100} for p in ("2027-01-01", "2026-09-30", "2026-03-31", "2025-12-31")]
        self.assertEqual(self.normalize(quarterly=q)["income_basis"], "reported_fiscal_year")

    def test_symbol_country_currency_and_asset_type_are_checked(self):
        for overrides in ({"symbol": "OTHER"}, {"country": "Canada"}, {"financialCurrency": "EUR"}, {"quoteType": "ETF"}):
            info = {"symbol": "TEST", "quoteType": "EQUITY", "currency": "USD", "financialCurrency": "USD", "country": "United States", **overrides}
            self.assertEqual(self.normalize(info=info)["status"], "unsupported")

    def test_unknown_quote_timestamp_cannot_generate_price_space(self):
        info = {"symbol": "TEST", "quoteType": "EQUITY", "currency": "USD", "financialCurrency": "USD", "country": "United States", "regularMarketPrice": 20}
        self.assertIsNone(self.normalize(info=info)["price"])


class CompanyApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        spec = importlib.util.spec_from_file_location("company_route_test", Path(__file__).parents[1] / "app/api/routes/valuation.py")
        self.route = importlib.util.module_from_spec(spec); spec.loader.exec_module(self.route)
        self.service = CompanyInputsService(); self.service.cache["TEST"] = (float("inf"), snapshot())
        self.route.company_inputs_service = self.service
        app = FastAPI(); app.include_router(self.route.router)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_inputs_and_calculation_flow_with_no_provider_reads_on_post(self):
        self.assertEqual((await self.client.get("/valuation/TEST/inputs")).status_code, 200)
        response = await self.client.post("/valuation/TEST/calculate", json=command())
        self.assertEqual(response.status_code, 200)
        self.assertAlmostEqual(response.json()["scenarios"]["base"]["fair_price"], 13.5)
        self.assertIn("no-store", response.headers["cache-control"])

    async def test_expired_snapshot_is_conflict(self):
        request = command(); request["snapshot_id"] = "b" * 64
        self.assertEqual((await self.client.post("/valuation/TEST/calculate", json=request)).status_code, 409)

    async def test_boolean_unknown_fields_and_invalid_model_are_rejected(self):
        for key, value in (("inputs", {"cash": True}), ("inputs", {"price": 100}), ("model", "average"), ("years", True)):
            request = command(); request[key] = value
            self.assertEqual((await self.client.post("/valuation/TEST/calculate", json=request)).status_code, 422)
        request = command(); request["scenarios"]["base"]["discount_rate"] = True
        self.assertEqual((await self.client.post("/valuation/TEST/calculate", json=request)).status_code, 422)

    async def test_source_failure_is_recoverable(self):
        with patch.object(self.service, "load", AsyncMock(side_effect=ValueError("provider"))):
            self.assertEqual((await self.client.get("/valuation/TEST/inputs")).status_code, 503)


if __name__ == "__main__":
    unittest.main()
