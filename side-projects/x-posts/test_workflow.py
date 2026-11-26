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
            ("sync.post_process", {"analysis": {"analyzed": 0}, "media": {"archived": 0}}),
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

    def test_run_without_new_posts_still_retries_analysis_and_media(self):
        with patch.object(workflow, "collect", return_value=0):
            result = workflow.run_once(root=self.root)
        workflow.sync.post_process.assert_called_once()
        self.assertEqual(result["analysis"], {"analyzed": 0})
        self.assertEqual(result["media"], {"archived": 0})

    def test_scheduler_custom_interval(self):
        with (
            patch.object(workflow.sys, "platform", "darwin"),
            patch.object(workflow.Path, "home", return_value=self.root),
            patch.object(workflow, "deploy_runtime", return_value=self.root),
            patch.object(workflow.subprocess, "run"),
        ):
            workflow.schedule("install", 45)
        path = self.root / "Library" / "LaunchAgents" / f"{workflow.LABEL}.plist"
        self.assertEqual(plistlib.loads(path.read_bytes())["StartInterval"], 2700)

    def test_daily_browser_mode_is_remembered_and_passed_to_collector(self):
        self.assertEqual(workflow.browser_mode(self.root), "dedicated")
        with (
            patch.object(workflow.sys, "platform", "darwin"),
            patch.object(workflow.Path, "home", return_value=self.root),
            patch.object(workflow, "deploy_runtime", return_value=self.root),
            patch.object(workflow.subprocess, "run"),
        ):
            workflow.schedule("install", 120, "daily")
            workflow.schedule("install", 120)
        self.assertEqual(workflow.browser_mode(self.root), "daily")
        daemon = self.root / "Library" / "LaunchAgents" / f"{workflow.DAEMON_LABEL}.plist"
        config = plistlib.loads(daemon.read_bytes())
        self.assertEqual(config["ProgramArguments"][-1], "serve")
        self.assertTrue(config["KeepAlive"])
        directory = self.root / "run"
        directory.mkdir()
        process = Mock(returncode=0)
        with patch.object(workflow.subprocess, "Popen", return_value=process) as popen:
            workflow.collect(directory, 5, self.root)
        self.assertEqual(popen.call_args.kwargs["env"]["KOLVEX_X_BROWSER"], "daily")

    def test_dedicated_mode_removes_daemon_and_pause_stops_both(self):
        daemon = self.root / "Library" / "LaunchAgents" / f"{workflow.DAEMON_LABEL}.plist"
        with (
            patch.object(workflow.sys, "platform", "darwin"),
            patch.object(workflow.Path, "home", return_value=self.root),
            patch.object(workflow, "deploy_runtime", return_value=self.root),
            patch.object(workflow.subprocess, "run") as run,
        ):
            workflow.schedule("install", 120, "daily")
            self.assertTrue(daemon.exists())
            run.reset_mock()
            workflow.schedule("pause")
            stopped = [call.args[0][-1] for call in run.call_args_list]
            workflow.schedule("install", 120, "dedicated")
        self.assertFalse(daemon.exists())
        self.assertIn(f"gui/{workflow.os.getuid()}/{workflow.DAEMON_LABEL}", stopped)
        self.assertIn(f"gui/{workflow.os.getuid()}/{workflow.LABEL}", stopped)

    def test_scheduler_uses_shell_every_two_hours_without_a_model(self):
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
        self.assertEqual(config["StartInterval"], 7200)
        self.assertEqual(
            config["ProgramArguments"], ["/bin/bash", str(self.root / "run.sh"), "run"]
        )
        self.assertFalse(config["RunAtLoad"])
        commands = [call.args[0][1] for call in run.call_args_list]
        self.assertEqual(commands[-2:], ["enable", "bootstrap"])


if __name__ == "__main__":
    unittest.main()
