"""Reader authorization, filtering and stored-contract compatibility."""
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from app.api.routes.briefs import router
from app.api.routes.admin.briefs import router as admin_router
from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service


class BriefReaderTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(router)
        self.app.include_router(admin_router, prefix="/admin")
        self.db = Mock()
        self.query = self.db.table.return_value
        self.app.dependency_overrides[get_supabase_service] = lambda: self.db
        self.client = TestClient(self.app)
        self.document = json.loads((Path(__file__).resolve().parents[2] / "docs/examples/evening-2026-10-17.json").read_text())

    def login(self):
        self.app.dependency_overrides[get_current_user_id] = lambda: "ordinary-reader"
        self.query.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"is_admin": False}

    def test_anonymous_cannot_read(self):
        for url in ["/briefs", "/briefs/evening-2026-10-17", "/briefs/calendar?month=2026-10"]:
            self.assertEqual(self.client.get(url).status_code, 401)
        self.db.table.assert_not_called()

    def test_ordinary_reader_reads_formatted_import_but_cannot_write(self):
        self.login()
        self.query.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [{"payload": self.document}]
        response = self.client.get("/briefs/evening-2026-10-17")
        self.assertEqual(response.status_code, 200)
        data = response.json()["payload"]
        self.assertEqual(data["sections"][0]["indices"][0]["close"], 52002.41)
        self.assertEqual(len(data["sections"][1]["items"]), 5)
        self.assertEqual(data["disclaimer"], self.document["disclaimer"])
        self.assertNotIn("imported_by", response.json())
        self.assertEqual(self.client.post("/admin/briefs", json=self.document).status_code, 403)
        self.query.insert.assert_not_called()
        for method in ["post", "patch", "delete"]:
            self.assertEqual(getattr(self.client, method)("/briefs").status_code, 405)

    def test_filtered_list_and_page_boundaries(self):
        self.login()
        execute = self.query.select.return_value.eq.return_value.order.return_value.order.return_value.range.return_value.execute
        execute.return_value = SimpleNamespace(data=[{"id": "morning-2026-10-16", "brief_type": "morning"}], count=11)
        response = self.client.get("/briefs?type=morning&page=2")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 11)
        self.query.select.return_value.eq.assert_called_once_with("brief_type", "morning")
        self.query.select.return_value.eq.return_value.order.return_value.order.return_value.range.assert_called_once_with(10, 19)
        for query in ["page=0", "page=-1", "page=x", "type=invalid"]:
            self.assertEqual(self.client.get(f"/briefs?{query}").status_code, 422)

    def test_intraday_list_and_article(self):
        self.login()
        self.query.select.return_value.eq.return_value.order.return_value.order.return_value.range.return_value.execute.return_value = SimpleNamespace(data=[], count=0)
        self.assertEqual(self.client.get("/briefs?type=intraday").status_code, 200)
        self.query.select.return_value.eq.assert_called_with("brief_type", "intraday")
        self.document["brief"].update(id="intraday-2026-10-17", type="intraday")
        self.query.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [{"payload": self.document}]
        response = self.client.get("/briefs/intraday-2026-10-17")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["payload"]["brief"]["type"], "intraday")

    def test_empty_list_and_missing_issue(self):
        self.login()
        self.query.select.return_value.order.return_value.order.return_value.range.return_value.execute.return_value = SimpleNamespace(data=[], count=0)
        self.assertEqual(self.client.get("/briefs").json(), {"items": [], "total": 0})
        self.query.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
        self.assertEqual(self.client.get("/briefs/missing").status_code, 404)

    def test_service_failure_has_retryable_status(self):
        self.login()
        self.query.select.side_effect = APIError({"message": "private database failure", "code": "XX000", "details": "", "hint": ""})
        for path in ["/briefs", "/briefs/evening-2026-10-17"]:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("private database failure", response.text)


    def test_date_and_type_filters_are_combined(self):
        self.login()
        filtered = self.query.select.return_value.eq.return_value.eq.return_value
        filtered.order.return_value.order.return_value.range.return_value.execute.return_value = SimpleNamespace(data=[], count=0)
        response = self.client.get("/briefs?type=evening&date=2026-10-17")
        self.assertEqual(response.status_code, 200)
        self.query.select.return_value.eq.assert_called_once_with("brief_type", "evening")
        self.query.select.return_value.eq.return_value.eq.assert_called_once_with("brief_date", "2026-10-17")
        for value in ["2026-02-30", "2026-13-01", "not-a-date"]:
            self.assertEqual(self.client.get(f"/briefs?date={value}").status_code, 422)

    def test_calendar_marks_three_editions_and_limits_month(self):
        self.login()
        execute = self.query.select.return_value.gte.return_value.lt.return_value.order.return_value.limit.return_value.execute
        execute.return_value = SimpleNamespace(data=[
            {"brief_date": "2026-10-17", "brief_type": "morning"},
            {"brief_date": "2026-10-17", "brief_type": "intraday"},
            {"brief_date": "2026-10-17", "brief_type": "evening"},
            {"brief_date": "2026-10-16", "brief_type": "evening"},
        ])
        response = self.client.get("/briefs/calendar?month=2026-10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"month": "2026-10", "days": [
            {"date": "2026-10-16", "types": ["evening"]},
            {"date": "2026-10-17", "types": ["evening", "intraday", "morning"]},
        ]})
        self.query.select.return_value.gte.assert_called_with("brief_date", "2026-10-01")
        self.query.select.return_value.gte.return_value.lt.assert_called_with("brief_date", "2026-11-01")
        self.query.select.return_value.gte.return_value.lt.return_value.order.return_value.limit.assert_called_with(93)
        for month in ["2026-13", "2026-1", "0000-01", "9999-12", "bad"]:
            self.assertEqual(self.client.get(f"/briefs/calendar?month={month}").status_code, 422)
        self.client.get("/briefs/calendar?month=2026-12")
        self.query.select.return_value.gte.return_value.lt.assert_called_with("brief_date", "2027-01-01")
