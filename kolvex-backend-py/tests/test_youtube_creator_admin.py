import asyncio
import unittest
from unittest.mock import AsyncMock, Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase, get_supabase_service
from app.api.routes.youtube_opinions import get_service, router
from app.services.youtube_stock_opinions import YouTubeStockOpinionService


CHANNEL_ID = "UC" + "a" * 22


def opinion(ticker):
    return {"channel_id": CHANNEL_ID, "channel_title": "Old", "ticker": ticker,
            "sentiment": "bullish", "direction_score": 50, "raw_payload": {"video": {"title": "Original"}}}


class CreatorUpdateTests(unittest.TestCase):
    def setUp(self):
        self.db = Mock()
        self.query = self.db.table.return_value
        self.query.update.return_value.eq.return_value.execute.return_value.data = [opinion("NVDA")]
        self.service = YouTubeStockOpinionService(self.db)

    def test_updates_only_selected_channel_and_keeps_opinion_payload(self):
        values = {"channel_title": " Updated ", "channel_handle": "@updated", "channel_url": "https://www.youtube.com/@updated", "channel_avatar_url": None}
        rows = [{**opinion(ticker), **values, "channel_title": "Updated"} for ticker in ["NVDA", "AAPL"]]
        self.service._fetch_rows = Mock(return_value=rows)
        result = self.service.update_creator(CHANNEL_ID, values)
        self.query.update.assert_called_once_with({**values, "channel_title": "Updated"})
        self.query.update.return_value.eq.assert_called_once_with("channel_id", CHANNEL_ID)
        self.assertEqual(result["creator"]["total_opinions"], 2)
        self.assertEqual(result["creator"]["channel_url"], values["channel_url"])
        self.assertEqual(rows[0]["raw_payload"]["video"]["title"], "Original")

    def test_rejects_invalid_values_before_writing(self):
        for values in [{}, {"channel_id": "other"}, {"channel_title": " "},
                       {"channel_handle": "not-a-handle"}, {"channel_url": "https://evil.test"},
                       {"channel_avatar_url": "javascript:alert(1)"}, {"channel_title": 123},
                       {"channel_avatar_url": "https://user:password@example.com/avatar"}]:
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.service.update_creator(CHANNEL_ID, values)
        self.query.update.assert_not_called()

    def test_unknown_creator(self):
        self.query.update.return_value.eq.return_value.execute.return_value.data = []
        with self.assertRaises(LookupError):
            self.service.update_creator("unknown", {"channel_title": "Updated"})

    def test_public_profile_keeps_saved_identity(self):
        self.service._fetch_rows = Mock(return_value=[{**opinion("NVDA"), "channel_avatar_url": "https://example.com/saved.png"}])
        with patch("app.services.youtube_stock_opinions.channel_profiles.get_profile", AsyncMock(return_value={"channel_title": "Remote", "subscriber_count": 500})):
            result = asyncio.run(self.service.get_creator_profile(CHANNEL_ID))
        self.assertEqual(result["channel_title"], "Old")
        self.assertEqual(result["subscriber_count"], 500)


class CreatorAdminRouteTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.db = Mock()
        self.service = Mock()
        app.dependency_overrides[get_supabase] = lambda: self.db
        app.dependency_overrides[get_supabase_service] = lambda: self.db
        app.dependency_overrides[get_service] = lambda: self.service
        self.app = app
        self.client = TestClient(app)

    def login(self, admin):
        self.app.dependency_overrides[get_current_user_id] = lambda: "test-user"
        self.db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"is_admin": admin}

    def test_anonymous_and_non_admin_cannot_read_or_write(self):
        for expected, admin in [(401, None), (403, False)]:
            if admin is not None:
                self.login(admin)
            self.assertEqual(self.client.get("/youtube-opinions/creators").status_code, expected)
            self.assertEqual(self.client.patch(f"/youtube-opinions/creators/{CHANNEL_ID}", json={"channel_title": "Updated"}).status_code, expected)
        self.service.list_creators.assert_not_called()
        self.service.update_creator.assert_not_called()

    def test_admin_save_and_validation_errors(self):
        self.login(True)
        self.service.update_creator.return_value = {"success": True, "creator": {"channel_id": CHANNEL_ID}}
        self.assertEqual(self.client.patch(f"/youtube-opinions/creators/{CHANNEL_ID}", json={"channel_title": "Updated"}).status_code, 200)
        self.assertEqual(self.client.patch(f"/youtube-opinions/creators/{CHANNEL_ID}", json={"channel_id": "changed"}).status_code, 422)
        self.service.update_creator.side_effect = LookupError()
        self.assertEqual(self.client.patch("/youtube-opinions/creators/unknown", json={"channel_title": "Updated"}).status_code, 404)
        self.service.update_creator.side_effect = ValueError("Invalid URL")
        self.assertEqual(self.client.patch(f"/youtube-opinions/creators/{CHANNEL_ID}", json={"channel_url": "invalid"}).status_code, 400)
