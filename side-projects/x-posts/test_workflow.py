import json
import plistlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import workflow


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "sources.json").write_text(json.dumps({"usernames": ["testuser"]}))
        self.service = Mock()
        self.service.upload.return_value = {"inserted": 1, "skipped": 0}
        for name, value in (
            ("node_binary", "node"),
            ("sync.database", Mock()),
            ("sync.XContentService", self.service),
        ):
            context = patch("workflow." + name, return_value=value)
            context.start()
            self.addCleanup(context.stop)

    def export(self, directory, timeout, root):
        workflow.sync.atomic_json(
            directory / "testuser-export.json",
            {
                "posts": [
                    {
                        "id": "10",
                        "author_username": "testuser",
                        "text": "Public source",
                        "published_at": "2026-11-17T12:00:00Z",
                    }
                ],
                "scan_complete": True,
                "stop_reason": "initial_window",
            },
        )
        workflow.sync.atomic_json(
            directory / "testuser-summary.json",
            {
                "handle": "testuser",
                "complete": True,
                "reason": "initial_window",
            },
        )
        return 0

    def test_failed_collector_still_commits_valid_exports(self):
        def timeout_after_export(*args):
            self.export(*args)
            return 124

        with patch.object(workflow, "collect", side_effect=timeout_after_export):
            result = workflow.run_once(root=self.root)
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["inserted"], 1)
        self.assertEqual(workflow.sync.state_for(self.root, "testuser")["boundary_ids"], ["10"])

    def test_collector_exit_zero_with_missing_sources_is_partial(self):
        with patch.object(workflow, "collect", return_value=0):
            result = workflow.run_once(root=self.root)
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["sources"][0]["reason"], "collection_interrupted")
        self.service.upload.assert_not_called()

    def test_commit_failure_preserves_exports_for_next_run(self):
        self.service.upload.side_effect = RuntimeError("secret provider details")
        with patch.object(workflow, "collect", side_effect=self.export):
            result = workflow.run_once(root=self.root)
        self.assertEqual(result["status"], "failed")
        self.assertNotIn("secret", json.dumps(result))
        self.assertTrue((Path(result["directory"]) / "testuser-export.json").exists())
        self.assertFalse((self.root / "state" / "testuser.json").exists())
        self.service.upload.side_effect = None
        with patch.object(workflow, "collect", return_value=0):
            recovered = workflow.run_once(root=self.root)
        self.assertEqual(recovered["inserted"], 1)
        self.assertEqual(workflow.sync.state_for(self.root, "testuser")["synced_post_ids"], ["10"])

    def test_full_run_lock_prevents_overlap(self):
        with workflow.workflow_lock(self.root):
            with self.assertRaises(BlockingIOError):
                workflow.run_once(root=self.root)
        self.service.upload.assert_not_called()

    def test_database_connection_failure_is_persisted(self):
        with patch.object(workflow.sync, "database", side_effect=OSError("private connection")):
            result = workflow.run_once(root=self.root)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error"], "OSError")
        self.assertEqual(workflow.sync.read_json(self.root / "state" / "workflow.json"), result)
        self.assertNotIn("private", json.dumps(result))

    def test_scheduler_uses_shell_every_thirty_minutes_without_a_model(self):
        with (
            patch.object(workflow.sys, "platform", "darwin"),
            patch.object(workflow.Path, "home", return_value=self.root),
            patch.object(workflow, "ROOT", self.root),
            patch.object(workflow, "deploy_runtime", return_value=self.root),
            patch.object(workflow.subprocess, "run") as run,
        ):
            self.assertEqual(workflow.schedule("install"), 0)
        path = self.root / "Library" / "LaunchAgents" / f"{workflow.LABEL}.plist"
        config = plistlib.loads(path.read_bytes())
        self.assertEqual(config["StartInterval"], 1800)
        self.assertEqual(
            config["ProgramArguments"], ["/bin/bash", str(self.root / "run.sh"), "run"]
        )
        self.assertFalse(config["RunAtLoad"])
        self.assertEqual(run.call_args.args[0][1], "bootstrap")


if __name__ == "__main__":
    unittest.main()
