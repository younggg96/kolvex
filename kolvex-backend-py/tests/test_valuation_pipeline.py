"""Official-release parsing, share-basis boundaries, reconstruction and HTTP flows."""
import asyncio
from dataclasses import replace
from datetime import date, timedelta
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI

from app.services.valuation.basis import normalize_pilot_facts
from app.services.valuation.eps import EpsFact
from app.services.valuation.releases import parse_quarter_eps, supplement_q4
from app.services.valuation.series import build_series
from app.services.valuation.service import ValuationService


def release(value="2.10", *, year=2026, whitespace=" ", nongAAP=False):
    label = "Non-GAAP " if nongAAP else ""
    return f"<p>quarter ended September 26, {year}</p><table><tr><td>{label}Three Months Ended September 26, {year}</td></tr><tr><td>Net income</td><td>100</td></tr><tr><td>Diluted</td><td>${value}</td></tr></table>".replace(" ", whitespace).encode()


def fact(start="2026-01-01", end="2026-03-31", value=1, filed="2026-04-30", accession=1):
    return EpsFact(start, end, value, filed, f"0000789019-26-{accession:06d}", "10-Q", "USD/shares", 789019)


class ReleaseTests(unittest.TestCase):
    def test_direct_gaap_quarter_value_with_nonbreaking_spaces(self):
        result = parse_quarter_eps(release(whitespace="\u00a0"), symbol="AAPL", period_end="2026-09-26")
        self.assertEqual(result["value"], 2.1)
        self.assertEqual(len(result["sha256"]), 64)

    def test_non_gaap_table_is_not_accepted(self):
        with self.assertRaises(ValueError):
            parse_quarter_eps(release(nongAAP=True), symbol="AAPL", period_end="2026-09-26")

    def test_prior_year_reconciliation_does_not_override_current_year(self):
        raw = release() + release(value=".97", year=2025)
        self.assertEqual(parse_quarter_eps(raw, symbol="AAPL", period_end="2026-09-26")["value"], 2.1)

    def test_disagreeing_gaap_tables_fail_closed(self):
        with self.assertRaises(ValueError):
            parse_quarter_eps(release() + release("2.20"), symbol="AAPL", period_end="2026-09-26")

    def test_wrong_period_or_integer_share_count_cannot_be_eps(self):
        for raw, end in ((release(), "2025-09-26"), (release("14630318"), "2026-09-26")):
            with self.subTest(end=end), self.assertRaises(ValueError):
                parse_quarter_eps(raw, symbol="AAPL", period_end=end)


class BasisTests(unittest.TestCase):
    def market(self, splits=None):
        return {"currency": "USD", "rows": [{"date": "2018-01-01", "close": 10}, {"date": "2026-11-03", "close": 100}], "splits": splits or []}

    def test_issuer_without_actions_preserves_values_and_sources(self):
        f = fact()
        normalized, policy = normalize_pilot_facts("MSFT", [f], self.market(), as_of="2026-11-04")
        self.assertEqual(normalized[0].value, f.value)
        self.assertEqual(normalized[0].raw_value, f.value)
        self.assertEqual(normalized[0].share_basis_status, "verified")
        self.assertTrue(normalized[0].basis_evidence)

    def test_unknown_split_disables_publication(self):
        f = fact()
        normalized, policy = normalize_pilot_facts("MSFT", [f], self.market([{"date": "2026-01-01", "ratio": 2}]), as_of="2026-11-04")
        self.assertEqual(policy["status"], "corporate_action_review_required")
        self.assertEqual(normalized[0].share_basis_status, "unverified")

    def test_original_period_and_its_comparatives_use_one_filing_basis(self):
        current = fact("2024-04-29", "2024-07-28", 1, "2024-08-28")
        original_old = fact("2023-04-24", "2023-07-30", 10, "2023-08-28", 2)
        comparative = replace(original_old, value=1, filed=current.filed, accession=current.accession)
        market = self.market([{"date": "2021-07-20", "ratio": 4}, {"date": "2024-06-10", "ratio": 10}])
        rows, _ = normalize_pilot_facts("NVDA", [current, original_old, comparative], market, as_of="2026-11-04")
        self.assertEqual([r.value for r in rows], [1, 1, 1])

    def test_future_current_period_cannot_approve_a_historical_filing(self):
        rows, _ = normalize_pilot_facts("MSFT", [fact(filed="2027-04-30")], self.market(), as_of="2026-11-04")
        self.assertEqual(rows, [])

    def test_filing_near_split_requires_dedicated_review(self):
        market = self.market([{"date": "2021-07-20", "ratio": 4}, {"date": "2024-06-10", "ratio": 10}])
        rows, _ = normalize_pilot_facts("NVDA", [fact("2024-03-01", "2024-05-31", 1, "2024-06-10")], market, as_of="2026-11-04")
        self.assertEqual(rows[0].share_basis_status, "unverified")


class SeriesTests(unittest.TestCase):
    def fixture(self):
        facts = []
        for year in range(2018, 2027):
            for quarter in range(4):
                month = quarter * 3 + 1
                start = date(year, month, 1)
                following = date(year + 1, 1, 1) if quarter == 3 else date(year, month + 3, 1)
                end = following - timedelta(days=1)
                facts.append(fact(str(start), str(end), 1, str(end + timedelta(days=30)), len(facts)+1))
        start, end = date(2019, 1, 1), date(2026, 11, 4)
        prices = [{"date": str(start + timedelta(days=i)), "close": 100} for i in range((end-start).days)
                  if (start + timedelta(days=i)).weekday() < 5]
        return facts, {"currency": "USD", "rows": prices, "splits": []}

    def test_reference_warmup_and_full_series_have_correct_units(self):
        facts, market = self.fixture()
        data = build_series("MSFT", facts, market, as_of="2026-11-04")
        self.assertIsNone(data["points"][0]["base"])
        self.assertEqual(data["current"]["eps"], 4)
        self.assertEqual(data["current"]["reference"]["scenarios"]["base"]["reference_value"], 100)
        self.assertEqual(data["points"][-1]["premium_discount"], 0)

    def test_future_high_earnings_do_not_change_any_historical_point(self):
        facts, market = self.fixture()
        before = build_series("MSFT", facts, market, as_of="2026-11-04")
        facts.append(fact("2027-01-01", "2027-03-31", 1000, "2027-04-30", 100))
        after = build_series("MSFT", facts, market, as_of="2026-11-04")
        self.assertEqual(before, after)

    def test_unreviewed_action_leaves_gaps_not_plausible_values(self):
        facts, market = self.fixture()
        market["splits"] = [{"date": "2024-06-10", "ratio": 10}]
        data = build_series("MSFT", facts, market, as_of="2026-11-04")
        self.assertEqual(data["coverage"]["eps_sessions"], 0)
        self.assertIsNone(data["current"]["reference"])

    def test_quotes_alone_do_not_change_frozen_reference_multiples(self):
        facts, market = self.fixture()
        for i, row in enumerate(market["rows"]):
            row["close"] += i / 100
        data = build_series("MSFT", facts, market, as_of="2026-11-04")
        self.assertEqual(data["points"][-1]["base"], data["current"]["reference"]["scenarios"]["base"]["reference_value"])


class JobTests(unittest.IsolatedAsyncioTestCase):
    async def test_concurrent_readers_share_one_background_build(self):
        service = ValuationService()
        with patch.object(service, "build", new=AsyncMock(return_value={})) as build:
            first, second = service.request("NVDA"), service.request("NVDA")
            self.assertEqual(first[1]["job_id"], second[1]["job_id"])
            await service.jobs[first[1]["job_id"]]["task"]
            build.assert_awaited_once()
            self.assertEqual(service.job(first[1]["job_id"])["status"], "complete")

    async def test_failed_build_requires_explicit_retry(self):
        service = ValuationService()
        with patch.object(service, "build", new=AsyncMock(side_effect=ValueError("provider debug detail"))):
            status, job = service.request("AAPL")
            await service.jobs[job["job_id"]]["task"]
            self.assertEqual(service.request("AAPL")[0], 503)
            self.assertNotIn("provider debug detail", str(service.job(job["job_id"])))
            _, second = service.request("AAPL", retry=True)
            await service.jobs[second["job_id"]]["task"]
            self.assertNotEqual(job["job_id"], second["job_id"])


route_spec = importlib.util.spec_from_file_location("valuation_routes_under_test", Path(__file__).resolve().parents[1] / "app/api/routes/valuation.py")
route_module = importlib.util.module_from_spec(route_spec)
route_spec.loader.exec_module(route_module)


class RouteTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        app = FastAPI(); app.include_router(route_module.router)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_unsupported_and_invalid_symbols(self):
        response = await self.client.get("/valuation/TSLA/history")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "unsupported")
        self.assertEqual((await self.client.get("/valuation/$BAD/history")).status_code, 422)

    async def test_invalid_parameters_are_rejected_before_calculation(self):
        payload = {"snapshot_id": "a"*64, "multiples": {"conservative": True, "base": 20, "optimistic": 24},
                   "growth": {"conservative": 0, "base": 0, "optimistic": 0}, "target_dates": ["2027-01-01"]}
        self.assertEqual((await self.client.post("/valuation/NVDA/simulate", json=payload)).status_code, 422)

    async def test_unknown_snapshot_is_conflict_not_fake_result(self):
        payload = {"snapshot_id": "a"*64, "multiples": {"conservative": 16, "base": 20, "optimistic": 24},
                   "growth": {"conservative": 0, "base": 0, "optimistic": 0}, "target_dates": ["2027-01-01"]}
        self.assertEqual((await self.client.post("/valuation/NVDA/simulate", json=payload)).status_code, 409)

    async def test_unknown_job_is_recoverable_not_server_error(self):
        self.assertEqual((await self.client.get(f"/valuation/jobs/{'b'*32}")).status_code, 404)


if __name__ == "__main__":
    unittest.main()
