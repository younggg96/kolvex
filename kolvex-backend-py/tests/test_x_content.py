import unittest
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.x_content import router, get_service
from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase, get_supabase_service
from app.services.x_content import XContentService, normalize_import


def post(**values):
    return {"id": "2114829879803785351", "author_username": "MentoviaX",
            "published_at": "2026-10-26T14:21:49-07:00", "text": "$TSLA and $NVDA",
            **values}


class ImportTests(unittest.TestCase):
    def test_preserves_precision_original_text_timezone_and_missing_counts(self):
        value = normalize_import({"posts": [post()]})[0]
        self.assertEqual(value["id"], "2114829879803785351")
        self.assertEqual(value["author_username"], "mentoviax")
        self.assertEqual(value["text"], "$TSLA and $NVDA")
        self.assertEqual(value["published_at"], "2026-10-26T21:21:49+00:00")
        self.assertEqual(value["cashtags"], ["NVDA", "TSLA"])
        self.assertIsNone(value["metrics"]["likes"])

    def test_rejects_invalid_batch_before_any_write(self):
        invalid = [post(id=2114829879803785351), post(id="-1"), post(author_username="evil/path"),
                   post(published_at="2026-10-26T12:00:00"), post(published_at="wrong"), post(text=""),
                   post(url="https://evil.test"), post(url="https://x.com/other/status/2114829879803785351"),
                   post(cashtags=["<script>"]), post(metrics={"likes": -1}), post(metrics={"views": True}),
                   post(metrics={"likes": 1.3}), post(quoted_texts=[{}]), post(media_links=["javascript:alert(1)"]),
                   post(truncated="false")]
        db = Mock()
        service = XContentService(db)
        for item in invalid:
            with self.subTest(item=item), self.assertRaises(ValueError):
                service.upload([post(id="1"), item])
        db.rpc.assert_not_called()
        db.table.assert_not_called()

    def test_duplicate_ids_within_batch_rejected(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            normalize_import([post(), post()])

    def test_bounded_import(self):
        for payload in ([], [post()] * 501, {"posts": "invalid"}, [post(text="a" * 2100000)]):
            with self.subTest(payload_type=type(payload)), self.assertRaises(ValueError):
                normalize_import(payload)

    def test_optional_source_data_and_zero_are_preserved(self):
        item = post(metrics={"likes": 0}, quoted_texts=["original quote"], truncated=True,
                    media_links=["https://x.com/MentoviaX/status/2114829879803785351/photo/1"])
        result = normalize_import([item])[0]
        self.assertEqual(result["metrics"]["likes"], 0)
        self.assertEqual(result["quoted_texts"], item["quoted_texts"])
        self.assertTrue(result["truncated"])
        self.assertEqual(result["media_links"], item["media_links"])

    def test_upload_uses_atomic_rpc_and_reports_duplicates(self):
        db = Mock()
        db.rpc.return_value.execute.return_value.data = {"inserted": 0}
        result = XContentService(db).upload([post()])
        self.assertEqual(result, {"total": 1, "inserted": 0, "skipped": 1})
        self.assertEqual(db.rpc.call_args.args[0], "import_x_posts")
        db.table.assert_not_called()

    def test_profile_urls_are_validated_before_saving(self):
        db = Mock()
        for url in ("javascript:alert(1)", "http://example.com", "https://user:secret@example.com"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                XContentService(db).save_creator("test", "Test", "", avatar_url=url)
        db.table.assert_not_called()

    def test_legacy_profile_save_preserves_optional_fields(self):
        db = Mock()
        db.table.return_value.upsert.return_value.execute.return_value.data = [{"username": "test"}]
        XContentService(db).save_creator("test", "Test", "Bio")
        values = db.table.return_value.upsert.call_args.args[0]
        self.assertNotIn("avatar_url", values)
        self.assertEqual(values["bio"], "Bio")

    def test_summaries_require_all_citations_and_correct_author(self):
        from datetime import datetime, timezone
        import json
        from pathlib import Path
        snapshot = json.loads((Path(__file__).resolve().parents[1] / "data/x_creator_summaries.json").read_text())
        record = snapshot["summaries"][0]
        rows = [{"id": post_id, "author_username": record["username"],
                 "url": f"https://x.com/{record['username']}/status/{post_id}",
                 "published_at": "2026-10-31T00:00:00Z"} for post_id in record["source_ids"]]
        db = Mock()
        query = db.table.return_value.select.return_value.in_.return_value
        query.execute.return_value.data = rows
        service = XContentService(db)
        result = service.summaries(record["username"])
        self.assertEqual(len(result["summaries"]), 1)
        self.assertEqual(len(result["summaries"][0]["sources"]), len(rows))
        query.execute.return_value.data = rows[:-1]
        self.assertEqual(service.summaries(record["username"])["summaries"], [])
        query.execute.return_value.data = [{**row, "author_username": "other"} for row in rows]
        self.assertEqual(service.summaries(record["username"])["summaries"], [])
        db.rpc.assert_not_called()

    def test_unknown_creator_has_no_fabricated_summary(self):
        db = Mock()
        self.assertEqual(XContentService(db).summaries("untracked")["summaries"], [])
        db.table.assert_not_called()

    def test_filter_and_pagination_are_applied_in_database(self):
        db = Mock()
        query = db.table.return_value.select.return_value
        query.eq.return_value = query
        query.contains.return_value = query
        query.order.return_value = query
        query.range.return_value = query
        query.execute.return_value.data = []
        query.execute.return_value.count = 42
        result = XContentService(db).posts("@MentoviaX", "$tsla", 20, 20)
        query.eq.assert_called_once_with("author_username", "mentoviax")
        query.contains.assert_called_once_with("cashtags", ["TSLA"])
        query.range.assert_called_once_with(20, 39)
        self.assertEqual(result["total"], 42)


    def test_ticker_heat_counts_current_and_previous_windows_by_publication_date(self):
        from datetime import datetime, timezone
        db = Mock()
        query = db.table.return_value.select.return_value
        query.gte.return_value = query
        query.lte.return_value = query
        query.order.return_value = query
        query.range.return_value = query
        query.execute.return_value.data = [
            {"author_username": "a", "published_at": "2026-11-05T12:00:00+00:00", "cashtags": ["NVDA", "TSLA"]},
            {"author_username": "b", "published_at": "2026-11-04T12:00:00+00:00", "cashtags": ["NVDA", "NVDA"]},
            {"author_username": "a", "published_at": "2026-10-28T12:00:00+00:00", "cashtags": ["NVDA", "AMD"]},
        ]
        result = XContentService(db).ticker_heat(now=datetime(2026, 11, 6, tzinfo=timezone.utc))
        self.assertEqual([row["ticker"] for row in result["tickers"]], ["NVDA", "TSLA"])
        self.assertEqual(result["tickers"][0], {"ticker": "NVDA", "posts": 2, "previous": 1, "authors": 2,
                                                "latest": "2026-11-05T12:00:00+00:00"})
        query.gte.assert_called_once_with("published_at", "2026-10-23T00:00:00+00:00")


class PermissionTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(router)
        self.db = Mock()
        self.service = Mock()
        self.app.dependency_overrides[get_supabase] = lambda: self.db
        self.app.dependency_overrides[get_supabase_service] = lambda: self.db
        self.app.dependency_overrides[get_service] = lambda: self.service
        self.client = TestClient(self.app)

    def login(self, admin):
        self.app.dependency_overrides[get_current_user_id] = lambda: "test-user"
        self.db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"is_admin": admin}

    def test_public_reads(self):
        self.service.creators.return_value = {"creators": []}
        self.service.posts.return_value = {"posts": [], "total": 0}
        self.assertEqual(self.client.get("/x-content/creators").status_code, 200)
        self.assertEqual(self.client.get("/x-content/posts").status_code, 200)

    def test_all_writes_require_admin(self):
        for expected, admin in [(401, None), (403, False)]:
            if admin is not None:
                self.login(admin)
            for endpoint, payload in [("creators", {"username": "test"}), ("validate", [post()]), ("upload", [post()])]:
                self.assertEqual(self.client.post(f"/x-content/{endpoint}", json=payload).status_code, expected)
        self.service.upload.assert_not_called()
        self.service.save_creator.assert_not_called()
        self.service.validate.assert_not_called()

    def test_admin_can_import(self):
        self.login(True)
        self.service.upload.return_value = {"total": 1, "inserted": 1, "skipped": 0}
        self.assertEqual(self.client.post("/x-content/upload", json=[post()]).json()["inserted"], 1)

    def test_admin_can_save_public_profile_fields(self):
        self.login(True)
        self.service.save_creator.return_value = {"creator": {"username": "test"}}
        response = self.client.post("/x-content/creators", json={"username": "test", "avatar_url": "https://pbs.twimg.com/example.jpg", "followers_count": 0})
        self.assertEqual(response.status_code, 200)
        self.service.save_creator.assert_called_once_with("test", "", "", avatar_url="https://pbs.twimg.com/example.jpg", followers_count=0)
        self.assertEqual(self.client.post("/x-content/creators", json={"username": "test", "followers_count": -1}).status_code, 422)

    def test_pagination_validation(self):
        for query in ("limit=0", "limit=101", "offset=-1", "offset=100001"):
            self.assertEqual(self.client.get(f"/x-content/posts?{query}").status_code, 422)

    def test_database_errors_are_sanitized_and_retryable(self):
        self.service.posts.side_effect = RuntimeError("secret database URL")
        with patch("app.api.routes.x_content.logger.exception"):
            response = self.client.get("/x-content/posts")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("secret", response.text)


if __name__ == "__main__":
    unittest.main()
