import unittest
from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies.auth import get_current_user_id
from app.api.routes.x_crawler import admin_router, get_store
from app.core.supabase import get_supabase, get_supabase_service
from app.services.x_content import CrawlTablesMissing, XCrawlerSettings


class ServiceTests(unittest.TestCase):
    def test_missing_tables_raise_a_distinct_error(self):
        db = Mock()
        db.table.return_value.select.return_value.order.return_value.execute.side_effect = (
            RuntimeError("{'code': 'PGRST205'}")
        )
        with self.assertRaises(CrawlTablesMissing):
            XCrawlerSettings(db).get()

    def test_other_database_errors_are_not_hidden(self):
        db = Mock()
        db.table.return_value.select.return_value.order.return_value.execute.side_effect = (
            RuntimeError("offline")
        )
        with self.assertRaises(RuntimeError) as caught:
            XCrawlerSettings(db).get()
        self.assertNotIsInstance(caught.exception, CrawlTablesMissing)

    def test_source_username_is_normalized(self):
        db = Mock()
        db.table.return_value.upsert.return_value.execute.return_value.data = [
            {"username": "other"}
        ]
        XCrawlerSettings(db).save_source("@Other", False)
        row = db.table.return_value.upsert.call_args.args[0]
        self.assertEqual((row["username"], row["enabled"]), ("other", False))
        with self.assertRaises(ValueError):
            XCrawlerSettings(db).save_source("https://x.com/other")
        with self.assertRaises(ValueError):
            XCrawlerSettings(db).save_source("other", "yes")

    def test_batch_validates_all_before_writing_and_deduplicates(self):
        db = Mock()
        db.table.return_value.upsert.return_value.execute.return_value.data = [{}]
        store = XCrawlerSettings(db)
        with self.assertRaises(ValueError):
            store.save_sources(["good", "not valid!"])
        with self.assertRaises(ValueError):
            store.save_sources([])
        with self.assertRaises(ValueError):
            store.save_sources([f"user{i}" for i in range(201)])
        db.table.return_value.upsert.assert_not_called()
        store.save_sources(["@Other", "other", "TestUser"])
        rows = db.table.return_value.upsert.call_args.args[0]
        self.assertEqual(
            [(r["username"], r["enabled"]) for r in rows], [("other", True), ("testuser", True)]
        )

    def test_limits_are_bounded(self):
        db = Mock()
        db.table.return_value.upsert.return_value.execute.return_value.data = [{}]
        store = XCrawlerSettings(db)
        for bad in (
            {"max_posts_per_creator": 0, "max_scrolls_per_creator": 60},
            {"max_posts_per_creator": 500, "max_scrolls_per_creator": 301},
            {"max_posts_per_creator": "500", "max_scrolls_per_creator": 60},
        ):
            with self.assertRaises(ValueError):
                store.save_settings(bad)
        db.table.return_value.upsert.assert_not_called()
        store.save_settings({"max_posts_per_creator": 200, "max_scrolls_per_creator": 30})
        row = db.table.return_value.upsert.call_args.args[0]
        self.assertEqual(
            (row["id"], row["max_posts_per_creator"], row["max_scrolls_per_creator"]), (1, 200, 30)
        )


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(admin_router)
        self.db = Mock()
        self.store = Mock()
        self.app.dependency_overrides[get_supabase] = lambda: self.db
        self.app.dependency_overrides[get_supabase_service] = lambda: self.db
        self.app.dependency_overrides[get_store] = lambda: self.store
        self.client = TestClient(self.app)

    def login(self, admin):
        self.app.dependency_overrides[get_current_user_id] = lambda: "test-user"
        self.db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            "is_admin": admin
        }

    def requests(self):
        return [
            ("get", "/x-crawler", None),
            (
                "put",
                "/x-crawler/settings",
                {"max_posts_per_creator": 100, "max_scrolls_per_creator": 10},
            ),
            ("post", "/x-crawler/sources", {"username": "other"}),
            ("post", "/x-crawler/sources/batch", {"usernames": ["a", "b"]}),
        ]

    def test_everything_requires_admin(self):
        self.login(False)
        for method, path, body in self.requests():
            self.assertEqual(
                getattr(self.client, method)(path, **({"json": body} if body else {})).status_code,
                403,
            )
        self.store.get.assert_not_called()
        self.store.save_settings.assert_not_called()
        self.store.save_source.assert_not_called()
        self.store.save_sources.assert_not_called()

    def test_admin_can_read_and_write(self):
        self.login(True)
        self.store.get.return_value = {"sources": [], "settings": {}}
        self.store.save_settings.return_value = {"settings": {}}
        self.store.save_source.return_value = {"source": {}}
        self.store.save_sources.return_value = {"sources": []}
        for method, path, body in self.requests():
            self.assertEqual(
                getattr(self.client, method)(path, **({"json": body} if body else {})).status_code,
                200,
            )
        self.store.save_source.assert_called_once_with("other", True)
        self.store.save_sources.assert_called_once_with(["a", "b"])
        self.assertEqual(
            self.client.post("/x-crawler/sources/batch", json={"usernames": []}).status_code, 422
        )
        self.assertEqual(
            self.client.put(
                "/x-crawler/settings",
                json={"max_posts_per_creator": 0, "max_scrolls_per_creator": 10},
            ).status_code,
            422,
        )

    def test_missing_migration_is_reported(self):
        self.login(True)
        self.store.get.side_effect = CrawlTablesMissing("missing")
        response = self.client.get("/x-crawler")
        self.assertEqual((response.status_code, response.json()["detail"]), (503, "tables_missing"))


if __name__ == "__main__":
    unittest.main()
