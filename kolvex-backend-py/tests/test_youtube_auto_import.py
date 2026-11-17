import asyncio
import unittest
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies.auth import verify_admin
from app.api.routes import youtube_auto_import as routes
from app.services import youtube_auto_import as auto

VIDEO = {
    "video_id": "abcdefghijk",
    "title": "英伟达可以抄底了吗？",
    "published_at": "2026-11-16T21:48:02Z",
    "channel_id": "UC" + "a" * 22,
    "channel_title": "老A聊美股",
    "channel_handle": "@acestockpicks",
    "channel_url": "https://www.youtube.com/channel/UC" + "a" * 22,
}


def utc(text):
    return datetime.fromisoformat(text).replace(tzinfo=timezone.utc)


class ScheduleTests(unittest.TestCase):
    def setUp(self):
        patcher = patch.multiple(
            auto.settings,
            YOUTUBE_IMPORT_SCHEDULE_TIME="21:00",
            YOUTUBE_IMPORT_TIMEZONE="America/Los_Angeles",
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_not_due_before_nine_pm_local(self):
        # 2026-11-17 04:59 UTC = 2026-11-16 20:59 PST
        self.assertIsNone(auto.schedule_due(utc("2026-11-17T04:59:00")))

    def test_due_after_nine_pm_uses_local_date(self):
        self.assertEqual(auto.schedule_due(utc("2026-11-17T05:00:00")), date(2026, 11, 16))

    def test_next_run_rolls_to_tomorrow_after_run_time(self):
        self.assertEqual(
            auto.next_scheduled_at(utc("2026-11-16T20:00:00")).isoformat(),
            "2026-11-16T21:00:00-08:00",
        )
        self.assertEqual(
            auto.next_scheduled_at(utc("2026-11-17T06:00:00")).isoformat(),
            "2026-11-17T21:00:00-08:00",
        )


class PayloadTests(unittest.TestCase):
    def test_parses_fenced_json(self):
        self.assertEqual(
            auto.parse_model_json('```json\n{"summary": "x", "opinions": []}\n```')["summary"], "x"
        )

    def test_rejects_non_json(self):
        with self.assertRaises(auto.AnalysisError):
            auto.parse_model_json("没有观点")

    def test_identity_comes_from_worker_not_model(self):
        analysis = {
            "channel": {"id": "UCinvented", "title": "假名字"},
            "video": {"id": "zzzzzzzzzzz", "published_at": "2020-01-01T00:00:00Z"},
            "summary": "宏观偏谨慎",
            "opinions": [{"ticker": "NVDA", "sentiment": "bullish", "summary": "看好"}],
        }
        payload = auto.build_payload(VIDEO, analysis, "deepseek-v4-pro", utc("2026-11-17T05:01:00"))
        self.assertEqual(payload["channel"]["id"], VIDEO["channel_id"])
        self.assertEqual(payload["video"]["id"], "abcdefghijk")
        self.assertEqual(payload["video"]["published_at"], VIDEO["published_at"])
        self.assertEqual(payload["model"], "deepseek-v4-pro")
        self.assertEqual(payload["opinions"][0]["ticker"], "NVDA")


class FakeStore:
    def __init__(self, run=None):
        self.run = run
        self.appended = []
        self.created = []

    def get_run(self, run_id):
        return self.run if self.run and self.run["id"] == run_id else None

    def append_video(self, run, result, now):
        self.appended.append(result)

    def create_run(self, trigger, requested_by=None, scheduled_for=None):
        if self.run and self.run["status"] in ("queued", "running"):
            raise auto.RunConflict()
        self.created.append(trigger)
        return {"id": "new", "trigger": trigger, "status": "queued"}


class ImportVideoTests(unittest.TestCase):
    def test_imports_analysis(self):
        store = FakeStore()
        opinions = Mock()
        opinions.upload_import = AsyncMock(return_value={"videos": [{"tickers": ["NVDA"]}]})
        with patch.object(
            auto, "analyze_transcript", AsyncMock(return_value={"summary": "s", "opinions": []})
        ):
            result = asyncio.run(
                auto.import_video(
                    store, opinions, {"id": "r", "requested_by": "admin"}, VIDEO, "字幕" * 20
                )
            )
        self.assertEqual(result["status"], "imported")
        self.assertEqual(result["tickers"], ["NVDA"])
        self.assertEqual(opinions.upload_import.await_args.kwargs["uploaded_by"], "admin")
        self.assertEqual(
            opinions.upload_import.await_args.kwargs["known_publications"],
            {"abcdefghijk": VIDEO["published_at"]},
        )
        self.assertEqual(store.appended, [result])

    def test_records_analysis_failure_without_writing(self):
        store = FakeStore()
        opinions = Mock()
        opinions.upload_import = AsyncMock()
        with patch.object(
            auto,
            "analyze_transcript",
            AsyncMock(side_effect=auto.AnalysisError("DeepSeek 返回 500")),
        ):
            result = asyncio.run(
                auto.import_video(store, opinions, {"id": "r"}, VIDEO, "字幕" * 20)
            )
        self.assertEqual(result["status"], "failed")
        self.assertIn("500", result["error"])
        opinions.upload_import.assert_not_awaited()


class PublicationFallbackTests(unittest.TestCase):
    def correct(self, verified, known):
        from app.services import youtube_stock_opinions as opinions_module

        service = opinions_module.YouTubeStockOpinionService(Mock())
        rows = [{"video_id": "abcdefghijk", "raw_payload": {"video": {}, "opinions": []}}]
        with patch.object(
            opinions_module.channel_profiles,
            "publications_for_videos",
            AsyncMock(return_value=verified),
        ):
            asyncio.run(service.correct_publication_times(rows, known))
        return rows[0]

    def test_known_time_used_only_when_youtube_unverified(self):
        row = self.correct({}, {"abcdefghijk": "2026-11-16T21:48:02Z"})
        self.assertEqual(row["opinion_date"], "2026-11-16")
        row = self.correct(
            {"abcdefghijk": "2026-11-15T10:00:00Z"}, {"abcdefghijk": "2026-11-16T21:48:02Z"}
        )
        self.assertEqual(row["video_published_at"], "2026-11-15T10:00:00Z")

    def test_without_any_time_import_is_rejected(self):
        with self.assertRaises(ValueError):
            self.correct({}, None)


class FinishTests(unittest.TestCase):
    def finish(self, videos, error=None, failures=()):
        store = auto.YouTubeAutoImportStore(Mock())
        store._update = Mock(side_effect=lambda run_id, values, status=None: values)
        return store.finish(
            {"id": "r", "videos": videos}, utc("2026-11-17T06:00:00"), error, list(failures)
        )

    def test_all_imported_succeeds(self):
        self.assertEqual(
            self.finish([{"video_id": "a", "status": "imported"}])["status"], "succeeded"
        )

    def test_transcript_failure_makes_partial(self):
        result = self.finish(
            [{"video_id": "a", "status": "imported"}], failures=[{"video_id": "b", "error": "429"}]
        )
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["videos"][1]["status"], "transcript_failed")

    def test_empty_run_succeeds_and_worker_error_fails(self):
        self.assertEqual(self.finish([])["status"], "succeeded")
        self.assertEqual(self.finish([], error="网站接口失败")["status"], "failed")


class RouteTests(unittest.TestCase):
    def setUp(self):
        patcher = patch.object(routes.settings, "YOUTUBE_IMPORT_WORKER_TOKEN", "secret-token")
        patcher.start()
        self.addCleanup(patcher.stop)
        self.store = FakeStore({"id": "run-1", "status": "running", "videos": []})
        app = FastAPI()
        app.include_router(routes.admin_router, prefix="/admin")
        app.include_router(routes.worker_router)
        app.dependency_overrides[routes.get_store] = lambda: self.store
        app.dependency_overrides[routes.get_opinions] = lambda: Mock()
        app.dependency_overrides[verify_admin] = lambda: "admin-1"
        self.client = TestClient(app)

    def test_worker_requires_token(self):
        self.assertEqual(
            self.client.post("/youtube-auto-import/worker/claim", json={}).status_code, 401
        )
        response = self.client.post(
            "/youtube-auto-import/worker/claim", json={}, headers={"X-Worker-Token": "wrong"}
        )
        self.assertEqual(response.status_code, 401)

    def test_non_ascii_configured_token_is_rejected_not_crashed(self):
        with patch.object(routes.settings, "YOUTUBE_IMPORT_WORKER_TOKEN", "密钥"):
            response = self.client.post(
                "/youtube-auto-import/worker/claim",
                json={},
                headers={"X-Worker-Token": "secret-token"},
            )
        self.assertEqual(response.status_code, 401)

    def test_run_now_conflicts_with_active_run(self):
        self.assertEqual(self.client.post("/admin/youtube-auto-import/run").status_code, 409)
        self.store.run["status"] = "succeeded"
        response = self.client.post("/admin/youtube-auto-import/run")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.store.created, ["manual"])

    def test_status_reports_missing_tables(self):
        with patch.object(auto, "admin_status", side_effect=Exception("{'code': 'PGRST205'}")):
            response = self.client.get("/admin/youtube-auto-import/status")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "tables_missing")

    def test_video_upload_rejects_finished_run(self):
        self.store.run["status"] = "succeeded"
        response = self.client.post(
            "/youtube-auto-import/worker/runs/run-1/videos",
            json={**VIDEO, "transcript": "字幕" * 20},
            headers={"X-Worker-Token": "secret-token"},
        )
        self.assertEqual(response.status_code, 409)


if __name__ == "__main__":
    unittest.main()
