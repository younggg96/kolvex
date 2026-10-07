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
            asyncio.run(self.service.upload_payload(payload, "admin"))
        self.client.table.assert_not_called()

    def test_upload_uses_one_batch_upsert(self):
        payload = sample_payload()
        payload["opinions"].append({**deepcopy(payload["opinions"][0]), "ticker": "TSLA"})
        table = self.client.table.return_value
        table.upsert.return_value.execute.return_value = SimpleNamespace(data=[{"ticker": "NVDA"}, {"ticker": "TSLA"}])
        result = asyncio.run(self.service.upload_payload(payload, "admin"))
        self.assertEqual(result["inserted_count"], 2)
        self.client.table.assert_called_once_with("youtube_stock_opinions")
        table.upsert.assert_called_once()
        self.assertEqual(len(table.upsert.call_args.args[0]), 2)
        self.assertEqual(table.upsert.call_args.args[0][0]["uploaded_by"], "admin")

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


if __name__ == "__main__":
    unittest.main()
