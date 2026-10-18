import copy
import json
from pathlib import Path
import unittest
from unittest.mock import Mock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from postgrest.exceptions import APIError
from app.services.daily_briefs import Envelope, Index
from app.api.routes.admin.briefs import router
from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service


def sample():
    return {"schema_version": "kolvex-brief/1.0", "brief": {
        "id": "evening-2026-10-17", "type": "evening", "date": "2026-10-17",
        "title": "测试晚报", "headline": "仅用于校验的测试数据", "subtitle": "测试",
        "generated_at_pt": "2026-10-17T18:00:00-07:00", "market_status": "weekend"},
        "sections": [{"section_id": "outlook", "order": 4, "title": "展望"},
                     {"section_id": "market_recap", "order": 1, "title": "复盘", "narrative": "**测试**", "indices": [{"name": "Test", "close": None, "change_pct": None}]}]}


class SchemaTests(unittest.TestCase):
    def test_supplied_complete_evening_brief(self):
        path = Path(__file__).resolve().parents[2] / "docs/examples/evening-2026-10-17.json"
        original = json.loads(path.read_text())
        parsed = Envelope.model_validate(original).model_dump(mode="json")
        self.assertEqual(parsed["brief"], original["brief"])
        self.assertEqual(parsed["disclaimer"], original["disclaimer"])
        self.assertEqual([s["order"] for s in parsed["sections"]], [1, 2, 4])
        indices = parsed["sections"][0]["indices"]
        self.assertEqual(indices[0]["prev_close"], 51654.95)
        self.assertEqual(indices[0]["close"], 52002.41)
        self.assertEqual(indices[0]["change_pct"], 0.67)
        self.assertEqual(indices[2]["change_pct"], -4.48)
        self.assertIsNone(indices[-1]["change_pct"])
        self.assertEqual(len(parsed["sections"][1]["items"]), 5)
        for actual, expected in zip(parsed["sections"][1]["items"], original["sections"][1]["items"]):
            for key, value in expected.items():
                self.assertEqual(actual[key], value)
        self.assertEqual(Envelope.model_validate(parsed).model_dump(mode="json"), parsed)

    def test_formatted_index_values(self):
        for supplied, expected in [("52,002.41", 52002.41), ("+0.67%", 0.67), ("-11.41%", -11.41), ("0%", 0), (None, None), (4.5, 4.5)]:
            self.assertEqual(Index(name="test", change_pct=supplied).change_pct, expected)
        for supplied in ["52,00.41", "1,2,3", "NaN", "Infinity", "3%%", "", True]:
            with self.subTest(value=supplied), self.assertRaises(ValidationError):
                Index(name="test", change_pct=supplied)
        with self.assertRaises(ValidationError):
            Index(name="test", close="10%")

    def test_order_gaps_nulls_and_unknown_sections(self):
        value = sample()
        value["sections"].append({"section_id": "future", "order": 9, "title": "新章节", "paragraphs": ["文本"], "future_field": "保留"})
        parsed = Envelope.model_validate(value).model_dump()
        self.assertEqual([s["order"] for s in parsed["sections"]], [1, 4, 9])
        self.assertIsNone(parsed["sections"][0]["indices"][0]["close"])
        self.assertEqual(parsed["sections"][-1]["future_field"], "保留")

    def test_morning_checklist_and_winter_offset(self):
        value = sample()
        value["brief"].update(id="morning-2026-12-01", type="morning", date="2026-12-01", generated_at_pt="2026-12-01T06:00:00-08:00")
        value["sections"] = [{"section_id": "trading_plan", "order": 2, "title": "计划", "items": [{"time_pt": "06:30", "title": "检查", "detail": "测试", "checklist": ["一", "二"]}]}]
        self.assertEqual(Envelope.model_validate(value).sections[0].items[0].checklist, ["一", "二"])

    def test_invalid_identity_schema_and_portfolio(self):
        for field, content in [("id", "bad"), ("date", "2026-02-30"), ("generated_at_pt", "2026-10-17T18:00:00"), ("generated_at_pt", "2026-10-17T18:00:00-08:00")]:
            value = sample()
            value["brief"][field] = content
            with self.subTest(field=field), self.assertRaises(ValidationError):
                Envelope.model_validate(value)
        for patch in [{"schema_version": "2.0"}, {"accounts": []}]:
            with self.assertRaises(ValidationError):
                Envelope.model_validate({**sample(), **patch})

    def test_nested_validation_and_unsafe_urls(self):
        for url in ["javascript:alert(1)", "https://u:p@example.com/a", "file:///tmp/a"]:
            value = sample()
            value["brief"]["hero_image"] = {"url": url, "caption": "test", "credit": "test", "source_page": "https://example.com"}
            with self.assertRaises(ValidationError):
                Envelope.model_validate(value)
        value = sample()
        value["sections"][0]["items"] = [{"title": "test", "impact": {"short_term": []}}]
        with self.assertRaises(ValidationError):
            Envelope.model_validate(value)


class RoutesTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(router)
        self.db = Mock()
        self.app.dependency_overrides[get_supabase_service] = lambda: self.db
        self.client = TestClient(self.app)

    def login(self, admin=True):
        self.app.dependency_overrides[get_current_user_id] = lambda: "admin-id"
        self.db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"is_admin": admin}

    def test_all_endpoints_are_admin_only(self):
        for admin, expected in [(None, 401), (False, 403)]:
            if admin is not None:
                self.login(admin)
            self.assertEqual(self.client.get("/briefs").status_code, expected)
            self.assertEqual(self.client.get("/briefs/test").status_code, expected)
            for path in ["/briefs", "/briefs/validate"]:
                self.assertEqual(self.client.post(path, json=sample()).status_code, expected)
        self.db.table.return_value.insert.assert_not_called()

    def test_validate_does_not_save_and_errors_do_not_save(self):
        self.login()
        response = self.client.post("/briefs/validate", json=sample())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["payload"]["sections"][0]["order"], 1)
        self.assertEqual(self.client.post("/briefs", content="{").status_code, 422)
        self.assertEqual(self.client.post("/briefs", content="x" * (2 * 1024 * 1024 + 1)).status_code, 413)
        self.db.table.return_value.insert.assert_not_called()

    def test_save_identical_retry_and_conflict(self):
        self.login()
        self.assertEqual(self.client.post("/briefs", json=sample()).json()["already_exists"], False)
        self.db.table.return_value.insert.return_value.execute.side_effect = APIError({"code": "23505", "message": "duplicate", "details": "", "hint": ""})
        normalized = Envelope.model_validate(sample()).model_dump(mode="json")
        # verify_admin and duplicate lookup use the same mock chain.
        lookup = self.db.table.return_value.select.return_value.eq.return_value.single.return_value.execute
        lookup.side_effect = [Mock(data={"is_admin": True}), Mock(data={"payload": normalized})]
        self.assertTrue(self.client.post("/briefs", json=sample()).json()["already_exists"])
        changed = copy.deepcopy(normalized)
        changed["brief"]["headline"] = "不同内容"
        lookup.side_effect = [Mock(data={"is_admin": True}), Mock(data={"payload": changed})]
        self.assertEqual(self.client.post("/briefs", json=sample()).status_code, 409)


if __name__ == "__main__":
    unittest.main()
