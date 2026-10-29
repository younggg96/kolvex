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

    def test_uploaded_bilingual_content_is_validated_and_preserved(self):
        value = sample()
        value["language"] = "zh"
        value["translations"] = {"en": {"title": "Evening brief", "headline": "Market recap", "sections": [{"section_id": "outlook", "order": 2, "title": "Outlook", "narrative": "Uploaded English copy"}, {"section_id": "market_recap", "order": 1, "title": "Recap"}], "disclaimer": "Information only"}}
        parsed = Envelope.model_validate(value).model_dump(mode="json")
        self.assertEqual(parsed["brief"]["id"], value["brief"]["id"])
        self.assertEqual(parsed["translations"]["en"]["headline"], "Market recap")
        self.assertEqual(parsed["translations"]["en"]["sections"][0]["order"], 1)
        self.assertEqual(parsed["sections"][0]["title"], "复盘")
        for patch in [{"sections": []}, {"id": "override"}, {"sections": [{"section_id": "x", "order": 1, "title": "one"}, {"section_id": "x", "order": 2, "title": "two"}]}, {"hero_image": {"url": "javascript:bad", "caption": "x", "credit": "x", "source_page": "https://example.com"}}, {"accounts": []}]:
            invalid = copy.deepcopy(value)
            invalid["translations"]["en"].update(patch)
            with self.subTest(patch=patch), self.assertRaises(ValidationError):
                Envelope.model_validate(invalid)
        for language in ["zh", "fr"]:
            invalid = copy.deepcopy(value)
            invalid["translations"] = {language: value["translations"]["en"]}
            with self.assertRaises(ValidationError):
                Envelope.model_validate(invalid)
        value["language"] = "en"
        value["translations"] = {"zh": value["translations"]["en"]}
        self.assertEqual(Envelope.model_validate(value).language, "en")

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

    def test_update_and_delete_are_admin_only(self):
        for admin, expected in [(None, 401), (False, 403)]:
            if admin is not None:
                self.login(admin)
            for method in ["put", "delete"]:
                response = getattr(self.client, method)("/briefs/evening-2026-10-17", headers={"If-Match": "test"}, **({"json": sample()} if method == "put" else {}))
                self.assertEqual(response.status_code, expected)
        self.db.table.return_value.update.assert_not_called()
        self.db.table.return_value.delete.assert_not_called()

    def test_update_bilingual_copy_and_atomic_version_guard(self):
        self.login()
        original = Envelope.model_validate(sample()).model_dump(mode="json")
        query = self.db.table.return_value
        query.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [{"payload": original}]
        changed = copy.deepcopy(original)
        changed["brief"]["headline"] = "Updated headline"
        changed["translations"] = {"en": {"title": "Brief", "headline": "Uploaded English", "sections": [{"section_id": "outlook", "order": 1, "title": "Outlook"}]}}
        query.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": original["brief"]["id"]}]
        headers = {"If-Match": "1"}
        response = self.client.put("/briefs/evening-2026-10-17", headers=headers, json=changed)
        self.assertEqual(response.status_code, 200)
        written = query.update.call_args.args[0]
        self.assertEqual(written["headline"], "Updated headline")
        self.assertEqual(written["payload"]["translations"]["en"]["headline"], "Uploaded English")
        self.assertEqual(response.json()["revision"], "2")
        self.assertEqual(query.update.return_value.eq.return_value.eq.call_args.args[0], "revision")
        self.assertEqual(query.update.return_value.eq.return_value.eq.call_args.args[1], 1)
        # A write that loses the race after the initial read also fails.
        query.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        self.assertEqual(self.client.put("/briefs/evening-2026-10-17", headers=headers, json=changed).status_code, 409)

    def test_update_rejects_stale_missing_identity_and_invalid_payload(self):
        self.login()
        original = Envelope.model_validate(sample()).model_dump(mode="json")
        query = self.db.table.return_value
        lookup = query.select.return_value.eq.return_value.limit.return_value.execute
        lookup.return_value.data = [{"payload": original}]
        url = "/briefs/evening-2026-10-17"
        self.assertEqual(self.client.put(url, json=sample()).status_code, 422)
        self.assertEqual(self.client.put(url, headers={"If-Match": "stale"}, json=sample()).status_code, 409)
        changed = sample(); changed["brief"].update(id="morning-2026-10-17", type="morning")
        self.assertEqual(self.client.put(url, headers={"If-Match": "test"}, json=changed).status_code, 422)
        self.assertEqual(self.client.put(url, headers={"If-Match": "test"}, content="{").status_code, 422)
        lookup.return_value.data = []
        self.assertEqual(self.client.put(url, headers={"If-Match": "test"}, json=sample()).status_code, 404)
        query.update.assert_not_called()

    def test_delete_and_stale_delete(self):
        self.login()
        original = Envelope.model_validate(sample()).model_dump(mode="json")
        query = self.db.table.return_value
        lookup = query.select.return_value.eq.return_value.limit.return_value.execute
        lookup.return_value.data = [{"payload": original}]
        url = "/briefs/evening-2026-10-17"
        self.assertEqual(self.client.delete(url).status_code, 422)
        self.assertEqual(self.client.delete(url, headers={"If-Match": "stale"}).status_code, 409)
        query.delete.assert_not_called()
        query.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": original["brief"]["id"]}]
        headers = {"If-Match": "1"}
        self.assertTrue(self.client.delete(url, headers=headers).json()["deleted"])
        self.assertEqual(query.delete.return_value.eq.return_value.eq.call_args.args[1], 1)
        query.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        self.assertEqual(self.client.delete(url, headers=headers).status_code, 409)
        lookup.return_value.data = []
        self.assertEqual(self.client.delete(url, headers=headers).status_code, 404)

    def test_validate_does_not_save_and_errors_do_not_save(self):
        self.login()
        response = self.client.post("/briefs/validate", json=sample())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["payload"]["sections"][0]["order"], 1)
        self.assertEqual(self.client.post("/briefs", content="{").status_code, 422)
        self.assertEqual(self.client.post("/briefs", content="x" * (2 * 1024 * 1024 + 1)).status_code, 413)
        self.db.table.return_value.insert.assert_not_called()

    def test_three_editions_save_independently_and_filter_admin_list(self):
        self.login()
        for edition in ["morning", "intraday", "evening"]:
            value = sample()
            value["brief"].update(type=edition, id=f"{edition}-2026-10-17")
            response = self.client.post("/briefs/validate", json=value)
            self.assertEqual(response.status_code, 200)
            response = self.client.post("/briefs", json=value)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["id"], value["brief"]["id"])
            saved = self.db.table.return_value.insert.call_args.args[0]
            self.assertEqual(saved["brief_type"], edition)
            self.assertEqual(saved["payload"]["brief"]["type"], edition)
        value["brief"]["type"] = "intraday"
        self.assertEqual(self.client.post("/briefs", json=value).status_code, 422)
        self.db.table.return_value.select.return_value.eq.return_value.order.return_value.order.return_value.range.return_value.execute.return_value = Mock(data=[], count=0)
        self.assertEqual(self.client.get("/briefs?type=intraday").status_code, 200)
        self.db.table.return_value.select.return_value.eq.assert_called_with("brief_type", "intraday")
        self.assertEqual(self.client.get("/briefs?type=invalid").status_code, 422)

    def test_bilingual_save_and_legacy_retry(self):
        self.login()
        value = sample()
        value["language"] = "zh"
        value["translations"] = {"en": {"title": "Brief", "headline": "Recap", "sections": [{"section_id": "outlook", "order": 1, "title": "Outlook"}]}}
        self.assertEqual(self.client.post("/briefs", json=value).status_code, 200)
        saved = self.db.table.return_value.insert.call_args.args[0]
        self.assertEqual(saved["payload"]["translations"]["en"]["headline"], "Recap")
        self.db.table.return_value.insert.return_value.execute.side_effect = APIError({"code": "23505", "message": "duplicate", "details": "", "hint": ""})
        legacy = Envelope.model_validate(sample()).model_dump(mode="json")
        del legacy["language"]
        del legacy["translations"]
        lookup = self.db.table.return_value.select.return_value.eq.return_value.single.return_value.execute
        lookup.side_effect = [Mock(data={"is_admin": True}), Mock(data={"payload": legacy})]
        self.assertTrue(self.client.post("/briefs", json=sample()).json()["already_exists"])

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
