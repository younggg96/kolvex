import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

spec = importlib.util.spec_from_file_location("x_sync", Path(__file__).with_name("sync.py"))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def post(post_id="10", **values):
    return {"id": post_id, "author_username": "TestUser", "published_at": "2026-10-29T12:00:00Z", "text": "$TSLA", **values}


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "state").mkdir()
        self.service = Mock()
        self.service.upload.return_value = {"inserted": 1, "skipped": 0}
        # Default: crawler settings migration not applied yet.
        self.service.db.table.return_value.select.return_value.order.return_value.execute.side_effect = RuntimeError("PGRST205")

    def tearDown(self):
        self.temp.cleanup()

    def capture(self, payload):
        return Path(sync.ingest(self.root, payload)["file"])

    def test_capture_does_not_advance_checkpoint(self):
        self.capture({"posts": [post()], "scan_complete": True, "stop_reason": "initial_window"})
        self.assertFalse((self.root / "state" / "testuser.json").exists())

    def test_db_failure_keeps_data_and_checkpoint(self):
        file = self.capture({"posts": [post()], "scan_complete": True, "stop_reason": "initial_window"})
        self.service.upload.side_effect = RuntimeError("failure")
        with self.assertRaises(RuntimeError):
            sync.sync_file(self.root, file, self.service)
        self.assertTrue(file.exists())
        self.assertFalse((self.root / "state" / "testuser.json").exists())

    def test_success_advances_boundary_and_retry_does_not_resend(self):
        file = self.capture({"posts": [post()], "scan_complete": True, "stop_reason": "initial_window"})
        sync.sync_file(self.root, file, self.service)
        result = sync.sync_file(self.root, file, self.service)
        self.service.upload.assert_called_once()
        self.assertEqual(result["pending"], 0)
        state = sync.state_for(self.root, "testuser")
        self.assertEqual(state["boundary_ids"], ["10"])
        self.assertEqual(state["synced_post_ids"], ["10"])

    def test_limited_scan_does_not_hide_a_gap(self):
        sync.atomic_json(self.root / "state" / "testuser.json", {"boundary_ids": ["5"], "last_collected_post_id": "5"})
        file = self.capture({"posts": [post()], "scan_complete": False, "stop_reason": "limit"})
        sync.sync_file(self.root, file, self.service)
        state = sync.state_for(self.root, "testuser")
        self.assertEqual(state["boundary_ids"], ["5"])
        self.assertEqual(state["last_collected_post_id"], "5")
        self.assertIn("10", state["synced_post_ids"])

    def test_pinned_old_post_cannot_satisfy_checkpoint(self):
        sync.atomic_json(self.root / "state" / "testuser.json", {"boundary_ids": ["5"]})
        with self.assertRaises(ValueError):
            self.capture({"posts": [post(), post("5", pinned=True)], "scan_complete": True, "stop_reason": "checkpoint"})

    def test_existing_boundary_cannot_be_replaced_by_initial_window(self):
        sync.atomic_json(self.root / "state" / "testuser.json", {"boundary_ids": ["5"]})
        with self.assertRaises(ValueError):
            self.capture({"posts": [post()], "scan_complete": True, "stop_reason": "initial_window"})

    def test_long_posts_must_be_expanded_before_saving(self):
        with self.assertRaises(ValueError):
            self.capture({"posts": [post(truncated=True)]})
        self.service.upload.assert_not_called()

    def test_original_mixed_case_checkpoint_is_read(self):
        sync.atomic_json(self.root / "state" / "TestUser.json", {"seen_post_ids": ["5"]})
        self.assertEqual(sync.state_for(self.root, "testuser")["seen_post_ids"], ["5"])

    def test_database_lookup_failure_never_silently_drops_creators(self):
        sync.atomic_json(self.root / "sources.json", {"usernames": ["TestUser"], "include_database_creators": True})
        self.service.creators.side_effect = RuntimeError("offline")
        with self.assertRaises(RuntimeError):
            sync.plan(self.root, self.service)

    def test_plan_combines_database_and_config(self):
        sync.atomic_json(self.root / "sources.json", {"usernames": ["TestUser"], "include_database_creators": True})
        self.service.creators.return_value = {"creators": [{"username": "other"}, {"username": "testuser"}]}
        result = sync.plan(self.root, self.service)
        self.assertEqual([source["username"] for source in result["sources"]], ["other", "testuser"])

    def admin_settings(self, sources, max_posts=200, max_scrolls=20):
        query = self.service.db.table.return_value.select.return_value
        query.order.return_value.execute.side_effect = None
        query.order.return_value.execute.return_value.data = sources
        query.eq.return_value.limit.return_value.execute.return_value.data = [
            {"max_posts_per_creator": max_posts, "max_scrolls_per_creator": max_scrolls}]

    def test_plan_uses_admin_list_and_limits(self):
        sync.atomic_json(self.root / "sources.json", {"usernames": ["TestUser", "Paused", "LocalOnly"], "include_database_creators": True})
        self.admin_settings([{"username": "testuser", "enabled": True}, {"username": "paused", "enabled": False},
                             {"username": "added", "enabled": True}])
        result = sync.plan(self.root, self.service)
        self.assertEqual([s["username"] for s in result["sources"]], ["added", "localonly", "testuser"])
        self.assertEqual({(s["max_posts"], s["max_scrolls"]) for s in result["sources"]}, {(200, 20)})
        self.service.creators.assert_not_called()

    def test_admin_settings_failure_never_silently_drops_creators(self):
        sync.atomic_json(self.root / "sources.json", {"usernames": ["TestUser"], "include_database_creators": True})
        self.service.db.table.return_value.select.return_value.order.return_value.execute.side_effect = RuntimeError("offline")
        with self.assertRaises(RuntimeError):
            sync.plan(self.root, self.service)

    def test_add_normalizes_profile_urls_and_deduplicates(self):
        config = self.root / "sources.json"
        sync.atomic_json(config, {"usernames": ["TestUser"], "include_database_creators": True})
        result = sync.add_sources(self.root, ["@testuser", "https://x.com/Other?lang=en", "@other"])
        self.assertEqual(result, {"added": ["other"], "already_tracked_locally": ["testuser"]})
        self.assertEqual(sync.read_json(config)["usernames"], ["TestUser", "other"])
        with self.assertRaises(ValueError):
            sync.add_sources(self.root, ["https://x.com/other/status/123"])

    def test_finish_persists_all_exports_before_upload_and_prepare_retries(self):
        sync.atomic_json(self.root / "sources.json", {"usernames": ["TestUser", "Other"]})
        run = self.root / "run"
        sync.atomic_json(run / "plan.json", sync.plan(self.root))
        sync.atomic_json(run / "testuser-export.json", {"posts": [post()]})
        sync.atomic_json(run / "other-export.json", {
            "posts": [{**post("11"), "author_username": "Other"}],
            "scan_complete": True,
            "stop_reason": "initial_window",
        })
        self.service.upload.side_effect = RuntimeError("offline")
        with self.assertRaises(RuntimeError):
            sync.finish_run(self.root, run, self.service)
        self.assertEqual(len(list((self.root / "data").glob("*.json"))), 2)
        self.assertEqual(sync.state_for(self.root, "other"), {"username": "other"})
        self.service.upload.side_effect = None
        result = sync.prepare(self.root, self.service)
        self.assertEqual(result["retried"], 2)
        self.assertEqual(result["sources"][0]["stop_ids"], ["11"])
        self.assertEqual(sync.finish_run(self.root, run, self.service), {"files": []})


    def test_post_process_isolates_analysis_failure_from_media(self):
        from unittest.mock import patch
        with (
            patch("app.services.x_post_analysis.analyze_pending", side_effect=RuntimeError("key sk-secret")),
            patch("app.services.x_post_media.archive_media", return_value={"archived": 2}) as media,
        ):
            result = sync.post_process(self.root, self.service)
        self.assertEqual(result["analysis"], {"error": "RuntimeError"})
        self.assertEqual(result["media"], {"archived": 2})
        self.assertNotIn("secret", json.dumps(result))
        media.assert_called_once_with(self.service.db, self.root / "data" / "incoming")

    def test_finish_moves_checkpoint_when_every_post_was_already_imported(self):
        sync.atomic_json(self.root / "state" / "testuser.json", {
            "username": "testuser", "synced_post_ids": ["11", "10"], "boundary_ids": ["10"],
            "last_collected_post_id": "10",
        })
        run = self.root / "run"
        sync.atomic_json(run / "plan.json", {"sources": []})
        sync.atomic_json(run / "testuser-export.json", {
            "posts": [post("11"), post("10")], "scan_complete": True, "stop_reason": "checkpoint",
        })
        sync.finish_run(self.root, run, self.service)
        self.service.upload.assert_not_called()
        state = sync.state_for(self.root, "testuser")
        self.assertEqual(state["boundary_ids"], ["11", "10"])
        self.assertEqual(state["last_collected_post_id"], "11")
        # Re-running recovery on the same directory is a no-op once the checkpoint matches.
        self.assertEqual(sync.finish_run(self.root, run, self.service), {"files": []})

    def test_old_complete_export_does_not_rewind_a_newer_checkpoint(self):
        # A later run already moved the checkpoint to 20; an old run directory still holds 11/10.
        sync.atomic_json(self.root / "state" / "testuser.json", {
            "username": "testuser", "synced_post_ids": ["20", "11", "10"], "boundary_ids": ["20"],
            "last_collected_post_id": "20",
        })
        run = self.root / "old-run"
        sync.atomic_json(run / "plan.json", {"sources": []})
        sync.atomic_json(run / "testuser-export.json", {
            "posts": [post("11"), post("10")], "scan_complete": True, "stop_reason": "checkpoint",
        })
        self.assertEqual(sync.finish_run(self.root, run, self.service), {"files": []})
        self.service.upload.assert_not_called()
        self.assertEqual(sync.state_for(self.root, "testuser")["boundary_ids"], ["20"])

if __name__ == "__main__":
    unittest.main()
