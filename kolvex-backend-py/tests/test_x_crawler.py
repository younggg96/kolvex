import unittest
from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies.auth import get_current_user_id
from app.api.routes.x_crawler import admin_router, get_store
from app.core.supabase import get_supabase, get_supabase_service
from app.services.x_content import CrawlTablesMissing, XContentService, XCrawlerSettings


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
        [row] = db.table.return_value.upsert.call_args.args[0]
        self.assertEqual((row["username"], row["enabled"]), ("other", False))
        self.assertNotIn("deleted_at", row)  # turning off is not deleting
        XCrawlerSettings(db).save_source("other", True)
        [row] = db.table.return_value.upsert.call_args.args[0]
        self.assertIsNone(row["deleted_at"])  # turning on restores a deleted account
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

    def test_delete_creator_stops_crawling_then_removes_media_posts_and_profile(self):
        db = Mock()
        calls = []
        db.table.side_effect = lambda name: calls.append(name) or tables[name]
        tables = {name: Mock() for name in ("x_crawl_sources", "x_posts", "x_creators")}
        tables["x_crawl_sources"].upsert.return_value.execute.return_value.data = [{}]
        media = (
            "https://p.supabase.co/storage/v1/object/public/x-post-media/12/" + "a" * 64 + ".jpg"
        )
        select = tables["x_posts"].select.return_value.eq.return_value.order.return_value
        select.range.return_value.execute.return_value.data = [
            {
                "id": "12",
                "media_assets": [
                    {"url": media},
                    {"url": "https://evil.example/x-post-media/../../secret.jpg"},
                    {
                        "url": "https://p.supabase.co/storage/v1/object/public/x-post-media/99/"
                        + "b" * 64
                        + ".jpg"
                    },
                ],
            },
            {"id": "13", "media_assets": []},
        ]
        result = XCrawlerSettings(db).delete_creator("@FinancialJuice")
        self.assertEqual(result, {"username": "financialjuice", "posts": 2, "media": 1})
        self.assertEqual(calls[0], "x_crawl_sources")
        [row] = tables["x_crawl_sources"].upsert.call_args.args[0]
        self.assertEqual((row["username"], row["enabled"]), ("financialjuice", False))
        self.assertTrue(row["deleted_at"])
        db.storage.from_.return_value.remove.assert_called_once_with(["12/" + "a" * 64 + ".jpg"])
        tables["x_posts"].delete.return_value.eq.assert_called_once_with(
            "author_username", "financialjuice"
        )
        tables["x_creators"].delete.return_value.eq.assert_called_once_with(
            "username", "financialjuice"
        )
        self.assertEqual(calls[-1], "x_creators")
        with self.assertRaises(ValueError):
            XCrawlerSettings(Mock()).delete_creator("not valid!")

    def test_delete_needs_the_deleted_at_migration_and_then_deletes_nothing(self):
        db = Mock()
        db.table.return_value.upsert.return_value.execute.side_effect = RuntimeError(
            "{'code': 'PGRST204', 'message': \"Could not find the 'deleted_at' column\"}"
        )
        with self.assertRaises(CrawlTablesMissing):
            XCrawlerSettings(db).delete_creator("other")
        db.table.return_value.delete.assert_not_called()
        db.storage.from_.return_value.remove.assert_not_called()

    def test_adding_works_before_the_deleted_at_migration(self):
        db = Mock()
        db.table.return_value.upsert.return_value.execute.side_effect = [
            RuntimeError("PGRST204 deleted_at"),
            Mock(data=[{"username": "other"}]),
        ]
        self.assertEqual(
            XCrawlerSettings(db).save_sources(["other"]), {"sources": [{"username": "other"}]}
        )
        retried = db.table.return_value.upsert.call_args.args[0]
        self.assertEqual([sorted(row) for row in retried], [["enabled", "updated_at", "username"]])

    def test_list_reports_deleted_at_even_before_migration(self):
        db = Mock()
        db.table.return_value.select.return_value.order.return_value.execute.return_value.data = [
            {"username": "a", "enabled": True}
        ]
        db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
        self.assertEqual(
            XCrawlerSettings(db).get()["sources"],
            [{"deleted_at": None, "username": "a", "enabled": True}],
        )

    def test_media_failure_keeps_posts_for_a_retry(self):
        db = Mock()
        db.table.return_value.upsert.return_value.execute.return_value.data = [{}]
        db.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value.data = [
            {
                "id": "12",
                "media_assets": [{"url": "https://p.co/x-post-media/12/" + "a" * 64 + ".mp4"}],
            }
        ]
        db.storage.from_.return_value.remove.side_effect = RuntimeError("storage offline")
        with self.assertRaises(RuntimeError):
            XCrawlerSettings(db).delete_creator("other")
        db.table.return_value.delete.assert_not_called()

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


class ProfileTests(unittest.TestCase):
    AVATAR = "https://pbs.twimg.com/profile_images/1016847534080155648/NGnyajkE_200x200.jpg"

    def fill(self, current, profile):
        db = Mock()
        db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = current
        fields = XContentService(db).fill_profile(profile)
        update = db.table.return_value.update
        return fields, (update.call_args.args[0] if update.called else None)

    def test_fills_only_empty_fields(self):
        profile = {
            "username": "ElerianM",
            "display_name": "Mohamed A. El-Erian",
            "bio": "Wharton",
            "avatar_url": self.AVATAR,
        }
        fields, row = self.fill(
            [{"display_name": "elerianm", "bio": "", "avatar_url": None}], profile
        )
        self.assertEqual(fields, ["avatar_url", "bio", "display_name"])
        self.assertEqual(
            row,
            {"avatar_url": self.AVATAR, "display_name": "Mohamed A. El-Erian", "bio": "Wharton"},
        )

    def test_never_overwrites_admin_values(self):
        profile = {
            "username": "elerianm",
            "display_name": "New",
            "bio": "New",
            "avatar_url": self.AVATAR,
        }
        current = [
            {
                "display_name": "Set by admin",
                "bio": "Admin bio",
                "avatar_url": "https://example.com/a.png",
            }
        ]
        self.assertEqual(self.fill(current, profile), ([], None))

    def test_rejects_untrusted_avatar_and_unknown_creator(self):
        bad = {"username": "elerianm", "avatar_url": "https://evil.example/profile_images/1/a.jpg"}
        self.assertEqual(
            self.fill([{"display_name": "Set", "bio": "x", "avatar_url": None}], bad), ([], None)
        )
        self.assertEqual(
            self.fill([], {"username": "elerianm", "avatar_url": self.AVATAR}), ([], None)
        )
        with self.assertRaises(ValueError):
            self.fill([], {"username": "not valid!"})


class ActivityTests(unittest.TestCase):
    def test_counts_posts_per_creator_since_a_recent_time(self):
        from datetime import datetime, timedelta, timezone

        db = Mock()
        query = db.table.return_value.select.return_value.gte.return_value.order.return_value
        query.order.return_value.range.return_value.execute.return_value.data = [
            {"author_username": "b"},
            {"author_username": "a"},
            {"author_username": "b"},
        ]
        now = datetime(2026, 11, 27, 12, tzinfo=timezone.utc)
        result = XContentService(db).activity(now - timedelta(hours=36), now)
        self.assertEqual(result["counts"], {"b": 2, "a": 1})
        self.assertEqual(result["order"], ["b", "a"])
        for bad in (now - timedelta(days=4), now + timedelta(hours=1), datetime(2026, 11, 27)):
            with self.assertRaises(ValueError):
                XContentService(db).activity(bad, now)


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
            ("delete", "/x-crawler/creators/other", None),
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
        self.store.delete_creator.assert_not_called()

    def test_admin_can_read_and_write(self):
        self.login(True)
        self.store.get.return_value = {"sources": [], "settings": {}}
        self.store.save_settings.return_value = {"settings": {}}
        self.store.save_source.return_value = {"source": {}}
        self.store.save_sources.return_value = {"sources": []}
        self.store.delete_creator.return_value = {"username": "other", "posts": 3, "media": 1}
        for method, path, body in self.requests():
            self.assertEqual(
                getattr(self.client, method)(path, **({"json": body} if body else {})).status_code,
                200,
            )
        self.store.save_source.assert_called_once_with("other", True)
        self.store.save_sources.assert_called_once_with(["a", "b"])
        self.store.delete_creator.assert_called_once_with("other")
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
