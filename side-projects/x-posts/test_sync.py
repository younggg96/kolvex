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


if __name__ == "__main__":
    unittest.main()
