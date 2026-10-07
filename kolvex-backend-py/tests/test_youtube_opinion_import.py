import asyncio
from copy import deepcopy
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.routes.youtube_opinions import router, get_service
from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase, get_supabase_service

from app.services.youtube_stock_opinions import YouTubeStockOpinionService


def sample_payload():
    return {
        "channel": {"id": "creator-1", "title": "Creator"},
        "video": {"id": "video-1", "title": "Market views", "published_at": "2026-10-05T15:00:00Z"},
        "opinions": [{"ticker": "nvda", "sentiment": "bullish", "summary": "Growth expected", "direction_score": 60, "confidence": 0.8}],
    }


class YouTubeImportTests(unittest.TestCase):
    def setUp(self):
        self.client = Mock()
        self.service = YouTubeStockOpinionService(self.client)

    def test_preview_normalizes_without_writing(self):
        preview = self.service.validate_payload(sample_payload())
        self.assertEqual(preview["opinions"][0]["ticker"], "NVDA")
        self.assertEqual(preview["opinions"][0]["opinion_date"], "2026-10-05")
        self.client.table.assert_not_called()

    def test_duplicate_tickers_rejected_case_insensitively(self):
        payload = sample_payload()
        payload["opinions"].append({**payload["opinions"][0], "ticker": "NVDA"})
        with self.assertRaisesRegex(ValueError, "duplicates"):
            self.service.validate_payload(payload)

    def test_invalid_fields_rejected(self):
        for field, value in (("sentiment", "unknown"), ("direction_score", 101), ("confidence", 80), ("confidence", True), ("summary", ""), ("risks", "risk"), ("price_targets", [{"value": -1}]), ("opinion_date", "2026-02-30")):
            with self.subTest(field=field, value=value):
                payload = sample_payload()
                payload["opinions"][0][field] = value
                with self.assertRaises(ValueError):
                    self.service.validate_payload(payload)

    def test_publication_requires_timezone(self):
        payload = sample_payload()
        payload["video"]["published_at"] = "2026-10-05T15:00:00"
        with self.assertRaisesRegex(ValueError, "timezone"):
            self.service.validate_payload(payload)

    def test_score_uses_declared_hundred_point_scale(self):
        payload = sample_payload()
        payload["opinions"][0]["direction_score"] = 1
        preview = self.service.validate_payload(payload)
        self.assertEqual(preview["opinions"][0]["direction_score"], 1)

    def test_invalid_later_row_prevents_all_writes(self):
        payload = sample_payload()
        payload["opinions"].append({"ticker": "TSLA", "sentiment": "invalid", "summary": "View"})
        with self.assertRaises(ValueError):
            asyncio.run(self.service.upload_import(payload, "admin"))
        self.client.table.assert_not_called()

    def test_upload_uses_one_batch_upsert(self):
        payload = sample_payload()
        payload["opinions"].append({**deepcopy(payload["opinions"][0]), "ticker": "TSLA"})
        table = self.client.table.return_value
        table.upsert.return_value.execute.return_value = SimpleNamespace(data=[{"ticker": "NVDA"}, {"ticker": "TSLA"}])
        result = asyncio.run(self.service.upload_import(payload, "admin"))
        self.assertEqual(result["inserted_count"], 2)
        self.assertEqual(result["video_count"], 1)
        self.client.table.assert_called_once_with("youtube_stock_opinions")
        table.upsert.assert_called_once()
        self.assertEqual(len(table.upsert.call_args.args[0]), 2)
        self.assertEqual(table.upsert.call_args.args[0][0]["uploaded_by"], "admin")

    def test_batch_preview_reports_every_rejected_video(self):
        broken = sample_payload()
        broken["video"]["id"] = "video-2"
        broken["opinions"][0]["sentiment"] = "unknown"
        preview = self.service.validate_import([sample_payload(), broken])
        self.assertEqual(preview["video_count"], 2)
        self.assertEqual(preview["count"], 1)
        self.assertEqual([video["video_id"] for video in preview["videos"]], ["video-1"])
        self.assertEqual([error["index"] for error in preview["errors"]], [1])
        self.client.table.assert_not_called()

    def test_batch_rejects_the_same_video_twice(self):
        preview = self.service.validate_import([sample_payload(), sample_payload()])
        self.assertRegex(preview["errors"][0]["message"], "duplicates")
        with self.assertRaisesRegex(ValueError, r"videos\[1\]"):
            asyncio.run(self.service.upload_import([sample_payload(), sample_payload()], "admin"))
        self.client.table.assert_not_called()

    def test_batch_writes_every_video_in_one_upsert(self):
        second = sample_payload()
        second["video"]["id"] = "video-2"
        second["opinions"][0]["ticker"] = "TSLA"
        table = self.client.table.return_value
        table.upsert.return_value.execute.return_value = SimpleNamespace(data=[{"ticker": "NVDA"}, {"ticker": "TSLA"}])
        result = asyncio.run(self.service.upload_import([sample_payload(), second], "admin"))
        self.assertEqual(result["video_count"], 2)
        self.assertEqual(result["inserted_count"], 2)
        self.assertEqual([video["tickers"] for video in result["videos"]], [["NVDA"], ["TSLA"]])
        table.upsert.assert_called_once()
        self.assertEqual([row["video_id"] for row in table.upsert.call_args.args[0]], ["video-1", "video-2"])

    def test_batch_size_and_shape_are_bounded(self):
        for body in ([], [sample_payload()] * 51, "payload", [sample_payload(), "video"]):
            with self.subTest(body=type(body)):
                with self.assertRaises(ValueError):
                    self.service.validate_import(body)

    def test_import_routes_reject_anonymous_and_non_admin(self):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_service] = lambda: self.service
        app.dependency_overrides[get_supabase] = lambda: self.client
        app.dependency_overrides[get_supabase_service] = lambda: self.client
        client = TestClient(app)
        for endpoint in ("validate", "upload"):
            self.assertEqual(client.post(f"/youtube-opinions/{endpoint}", json=sample_payload()).status_code, 401)
        app.dependency_overrides[get_current_user_id] = lambda: "ordinary-user"
        self.client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = SimpleNamespace(data={"is_admin": False})
        for endpoint in ("validate", "upload"):
            self.assertEqual(client.post(f"/youtube-opinions/{endpoint}", json=sample_payload()).status_code, 403)

    def test_validate_route_accepts_single_and_batch_bodies(self):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_service] = lambda: self.service
        app.dependency_overrides[get_supabase] = lambda: self.client
        app.dependency_overrides[get_supabase_service] = lambda: self.client
        app.dependency_overrides[get_current_user_id] = lambda: "admin"
        self.client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = SimpleNamespace(data={"is_admin": True})
        client = TestClient(app)
        second = sample_payload()
        second["video"]["id"] = "video-2"
        for body, expected in ((sample_payload(), 1), ([sample_payload(), second], 2)):
            with self.subTest(videos=expected):
                response = client.post("/youtube-opinions/validate", json=body)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()["video_count"], expected)
                self.assertEqual(response.json()["errors"], [])


if __name__ == "__main__":
    unittest.main()
