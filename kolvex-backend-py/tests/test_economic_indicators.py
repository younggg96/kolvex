from datetime import date, datetime, timedelta, timezone
import io
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, Mock, patch
import zipfile
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.services import economic_indicators as economic
from app.core.redis import RedisService

NOW = datetime(2026, 10, 23, 12, tzinfo=timezone.utc)


def spec(key):
    return next(item for item in economic.INDICATORS if item.key == key)


class EconomicCalculationTests(unittest.TestCase):
    def test_fred_mixed_frequency_zip_preserves_units_dates_and_real_zeros(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("README.txt", "Untrusted metadata is never executed or used as instructions")
            archive.writestr("monthly.csv", "observation_date,UNRATE,PAYEMS\n2026-08-01,4.1,159000\n2026-09-01,0,159100\n2027-01-01,99,999999\n2026-07-01,.,NaN\n")
            archive.writestr("quarterly.csv", "observation_date,A191RL1Q225SBEA\n2026-04-01,2.2\n")
        result = economic.parse_fred(buffer.getvalue(), NOW.date(), date(2020, 1, 1))
        self.assertEqual(result["UNRATE"][date(2026, 9, 1)], 0)
        self.assertNotIn(date(2027, 1, 1), result["UNRATE"])
        self.assertNotIn(date(2026, 7, 1), result["PAYEMS"])
        self.assertEqual(result["A191RL1Q225SBEA"][date(2026, 4, 1)], 2.2)

    def test_plain_csv_and_invalid_html_response(self):
        result = economic.parse_fred(b"DATE,UNRATE\n2026-09-01,4.2\n", NOW.date(), date(2020, 1, 1))
        self.assertEqual(result["UNRATE"][date(2026, 9, 1)], 4.2)
        with self.assertRaises(ValueError):
            economic.parse_fred(b"<html>Unavailable</html>", NOW.date(), date(2020, 1, 1))

    def test_cpi_yoy_matches_same_month_last_year_not_twelve_rows_ago(self):
        raw = {date(2025, 8, 1): 100, date(2025, 9, 1): 102, date(2026, 8, 1): 103, date(2026, 9, 1): 106.08}
        item = economic.build_indicator(spec("cpi"), {"CPIAUCNS": raw}, NOW)
        self.assertEqual(item["value"], 4)
        self.assertEqual(item["previous_value"], 3)
        self.assertEqual(item["change"], 1)
        self.assertEqual(item["change_unit"], "pp")

    def test_missing_cpi_base_does_not_invent_growth(self):
        item = economic.build_indicator(spec("cpi"), {"CPIAUCNS": {date(2026, 9, 1): 100}}, NOW)
        self.assertIsNone(item["value"])
        self.assertEqual(item["status"], "unavailable")

    def test_nonfarm_monthly_change_is_in_thousands_and_handles_january(self):
        raw = {date(2025, 11, 1): 159000, date(2025, 12, 1): 159100, date(2026, 1, 1): 159230}
        item = economic.build_indicator(spec("payrolls"), {"PAYEMS": raw}, NOW)
        self.assertEqual(item["value"], 130)
        self.assertEqual(item["change"], 30)
        self.assertEqual(item["period"], "2026-01-01")

    def test_employment_missing_month_is_not_counted_as_monthly_increase(self):
        raw = {date(2026, 7, 1): 159000, date(2026, 9, 1): 159230}
        item = economic.build_indicator(spec("payrolls"), {"PAYEMS": raw}, NOW)
        self.assertIsNone(item["value"])

    def test_spread_joins_same_day_yields_and_changes_in_basis_points(self):
        series = {"DGS2": {date(2026, 10, 21): 4.64, date(2026, 10, 22): 4.47},
                  "DGS10": {date(2026, 10, 21): 4.9, date(2026, 10, 22): 4.95, date(2026, 10, 23): 5}}
        item = economic.build_indicator(spec("spread"), series, NOW)
        self.assertEqual(item["value"], 0.48)
        self.assertEqual(item["change"], 22)
        self.assertEqual(item["period"], "2026-10-22")

    def test_gdp_is_already_annualized_and_quarter_dates_are_not_release_dates(self):
        item = economic.build_indicator(spec("gdp"), {"A191RL1Q225SBEA": {date(2026, 1, 1): 1.5, date(2026, 4, 1): 2.2}}, NOW)
        self.assertEqual(item["value"], 2.2)
        self.assertEqual(item["change"], 0.7)
        self.assertEqual(item["status"], "ready")
        self.assertEqual(item["period"], "2026-04-01")

    def test_missing_quarter_does_not_create_previous_quarter_change(self):
        item = economic.build_indicator(spec("gdp"), {"A191RL1Q225SBEA": {date(2025, 10, 1): 1.5, date(2026, 4, 1): 2.2}}, NOW)
        self.assertIsNone(item["change"])

    def test_daily_yields_preserve_zero_and_skip_holiday_missing_values(self):
        content = b"observation_date,DGS2,DGS10\n2026-10-21,0,4.9\n2026-10-22,.,\n2027-01-01,99,99\n"
        parsed = economic.parse_fred(content, NOW.date(), date(2020, 1, 1))
        self.assertEqual(parsed["DGS2"], {date(2026, 10, 21): 0})
        self.assertEqual(parsed["DGS10"], {date(2026, 10, 21): 4.9})


class EconomicServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.service = economic.EconomicIndicatorsService()
        self.redis = Mock(is_connected=False, get_json=AsyncMock(return_value=None), set_json=AsyncMock(return_value=True))
        patcher = patch.object(economic, "get_redis", return_value=self.redis)
        patcher.start()
        self.addCleanup(patcher.stop)

    async def test_cold_timeout_is_bounded_and_retries_do_not_hammer_sources(self):
        with patch.object(self.service, "_collect", AsyncMock(side_effect=TimeoutError)) as collect:
            snapshot = await self.service.get_snapshot(NOW)
            await self.service.get_snapshot(NOW + timedelta(minutes=5))
            collect.assert_awaited_once()
        self.assertEqual(snapshot["status"], "unavailable")
        self.assertTrue(all(item["value"] is None for item in snapshot["indicators"]))

    async def test_cached_snapshot_is_served_without_refetching(self):
        self.service._snapshot = {"status": "ready", "fetched_at": NOW.isoformat(), "retry_at": (NOW + timedelta(hours=6)).isoformat(), "refresh_hours": 6, "indicators": []}
        with patch.object(self.service, "_collect", AsyncMock()) as collect:
            result = await self.service.get_snapshot(NOW)
            collect.assert_not_awaited()
        self.assertEqual(result["status"], "ready")

    async def test_refresh_failure_retains_prior_values_with_stale_status(self):
        old = economic.build_indicator(spec("unemployment"), {"UNRATE": {date(2026, 9, 1): 4.2}}, NOW)
        self.service._snapshot = {"status": "ready", "fetched_at": (NOW - timedelta(hours=8)).isoformat(), "retry_at": NOW.isoformat(), "indicators": [old]}
        with patch.object(self.service, "_collect", AsyncMock(side_effect=ValueError)):
            result = await self.service.get_snapshot(NOW)
        self.assertEqual(result["indicators"][0]["value"], 4.2)
        self.assertEqual(result["indicators"][0]["status"], "stale")
        self.assertEqual(result["status"], "stale")


class EconomicRouteTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location("economic_route_under_test", Path(__file__).parents[1] / "app/api/routes/economic_indicators.py")
        self.route = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.route)
        self.app = FastAPI()
        self.app.include_router(self.route.router)
        from app.core.supabase import get_supabase
        self.app.dependency_overrides[get_supabase] = lambda: Mock()
        self.client = TestClient(self.app)

    def test_snapshot_requires_login_and_returns_private_data(self):
        with patch.object(self.route.economic_indicators_service, "get_snapshot", AsyncMock(return_value={"status": "ready", "indicators": []})) as snapshot:
            self.assertEqual(self.client.get("/market/indicators").status_code, 401)
            snapshot.assert_not_awaited()
            self.app.dependency_overrides[self.route.get_current_user_id] = lambda: "test-user"
            result = self.client.get("/market/indicators")
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["indicators"], [])
            self.assertEqual(result.headers["Cache-Control"], "private, no-store")
            snapshot.assert_awaited_once()

    def test_paid_macro_endpoint_is_no_longer_exposed(self):
        self.assertEqual(self.client.get("/market/macro").status_code, 404)


class RedisLeaseTests(unittest.IsolatedAsyncioTestCase):
    async def test_json_reads_and_token_owned_leases(self):
        redis = RedisService()
        client = Mock(set=AsyncMock(return_value=True), eval=AsyncMock())
        with patch.object(redis, "_client", client), patch.object(redis, "_initialized", True), patch.object(redis, "get", AsyncMock(return_value='{"indicators": []}')):
            self.assertEqual(await redis.get_json("macro"), {"indicators": []})
            self.assertTrue(await redis.acquire_lock("lease", "token", ttl=90))
            self.assertEqual(client.set.call_args.kwargs, {"nx": True, "ex": 90})
            await redis.release_lock("lease", "token")
            self.assertEqual(client.eval.call_args.args[-1], "token")


if __name__ == "__main__":
    unittest.main()
