import unittest
from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase, get_supabase_service
from app.api.routes.youtube_opinions import get_service, router
from app.services.youtube_stock_opinions import YouTubeStockOpinionService


CHANNEL_ID = "UC" + "a" * 22
OPINION_ID = "11111111-1111-1111-1111-111111111111"
VIDEO_URL = "https://www.youtube.com/watch?v=abcdefghijk"


def identity(**extra):
    return {
        "id": OPINION_ID,
        "channel_id": CHANNEL_ID,
        "channel_title": "老A聊美股",
        "channel_handle": "@acestockpicks",
        "channel_url": "https://www.youtube.com/channel/" + CHANNEL_ID,
        "channel_avatar_url": "https://example.com/avatar.png",
        "video_id": "abcdefghijk",
        "video_title": "原视频",
        "ticker": "NVDA",
        "sentiment": "bullish",
        "direction_score": 60,
        "summary": "原来的观点",
        "opinion_date": "2026-10-06",
        "raw_payload": {"video": {"title": "原视频"}},
        **extra,
    }


def payload(**extra):
    body = {
        "ticker": "aapl",
        "company_name": "Apple",
        "sentiment": "bearish",
        "direction_score": -40,
        "confidence": 0.8,
        "summary": "需求放缓",
        "thesis": "服务增长不够抵消硬件下滑",
        "key_points": ["服务增速放缓"],
        "risks": ["回购支撑估值"],
        "price_targets": [{"label": "base", "value": 180}],
        "opinion_date": "2026-10-08",
        "video_title": "本周美股",
        "video_url": VIDEO_URL,
        "video_published_at": "2026-10-08",
    }
    body.update(extra)
    return body


class OpinionAdminServiceTests(unittest.TestCase):
    def setUp(self):
        self.db = Mock()
        self.table = self.db.table.return_value
        self.service = YouTubeStockOpinionService(self.db)
        self.service._fetch_rows = Mock(return_value=[identity()])
        self.unique = self.table.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute
        self.unique.return_value.data = []
        self.by_id = self.table.select.return_value.eq.return_value.limit.return_value.execute
        self.by_id.return_value.data = [identity()]

    def test_lists_opinion_content(self):
        result = self.service.list_creator_opinions(CHANNEL_ID)
        self.assertEqual(result["opinions"][0]["summary"], "原来的观点")
        self.assertEqual(result["opinions"][0]["ticker"], "NVDA")
        self.assertNotIn("raw_payload", result["opinions"][0])
        self.assertNotIn("channel_title", result["opinions"][0])

    def test_create_keeps_existing_creator_profile(self):
        self.table.insert.return_value.execute.return_value.data = [{**identity(), "id": "new", "ticker": "AAPL"}]
        result = self.service.create_opinion(CHANNEL_ID, payload(), uploaded_by="admin-1")
        written = self.table.insert.call_args.args[0]
        self.assertEqual(written["channel_title"], "老A聊美股")
        self.assertEqual(written["channel_handle"], "@acestockpicks")
        self.assertEqual(written["channel_avatar_url"], "https://example.com/avatar.png")
        self.assertEqual(written["ticker"], "AAPL")
        self.assertEqual(written["video_id"], "abcdefghijk")
        self.assertEqual(written["summary"], "需求放缓")
        self.assertEqual(result["opinion"]["ticker"], "AAPL")

    def test_rejects_profile_edits_and_invalid_opinion(self):
        for values in [
            {**payload(), "channel_title": "改名"},
            {**payload(), "channel_handle": "@other"},
            {**payload(), "ticker": "!!!"},
            {**payload(), "sentiment": "buy"},
            {**payload(), "summary": "  "},
            {**payload(), "direction_score": 140},
            {**payload(), "video_url": "javascript:alert(1)"},
        ]:
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.service.create_opinion(CHANNEL_ID, values)
        self.table.insert.assert_not_called()

    def test_duplicate_video_ticker_is_rejected(self):
        self.unique.return_value.data = [{"id": "other"}]
        with self.assertRaises(ValueError):
            self.service.create_opinion(CHANNEL_ID, payload())
        self.table.insert.assert_not_called()

    def test_update_changes_opinion_not_profile(self):
        self.table.update.return_value.eq.return_value.execute.return_value.data = [identity(summary="更新后")]
        result = self.service.update_opinion(OPINION_ID, payload(summary="更新后"))
        changes = self.table.update.call_args.args[0]
        self.assertEqual(changes["summary"], "更新后")
        self.assertEqual(changes["ticker"], "AAPL")
        self.assertNotIn("channel_title", changes)
        self.assertNotIn("channel_handle", changes)
        self.assertNotIn("channel_avatar_url", changes)
        self.assertEqual(result["opinion"]["summary"], "更新后")

    def test_delete_removes_one_opinion(self):
        self.table.delete.return_value.eq.return_value.execute.return_value.data = [identity()]
        result = self.service.delete_opinion(OPINION_ID)
        self.table.delete.return_value.eq.assert_called_once_with("id", OPINION_ID)
        self.assertEqual(result, {"success": True, "id": OPINION_ID})

    def test_unknown_opinion(self):
        self.by_id.return_value.data = []
        with self.assertRaises(LookupError):
            self.service.update_opinion(OPINION_ID, payload())
        with self.assertRaises(LookupError):
            self.service.delete_opinion(OPINION_ID)
        self.table.update.assert_not_called()
        self.table.delete.assert_not_called()


class OpinionAdminRouteTests(unittest.TestCase):
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

    def test_anonymous_and_non_admin_cannot_change_opinions(self):
        for expected, admin in [(401, None), (403, False)]:
            if admin is not None:
                self.login(admin)
            self.assertEqual(self.client.get(f"/youtube-opinions/creators/{CHANNEL_ID}/opinions").status_code, expected)
            self.assertEqual(self.client.post(f"/youtube-opinions/creators/{CHANNEL_ID}/opinions", json=payload()).status_code, expected)
            self.assertEqual(self.client.patch(f"/youtube-opinions/opinions/{OPINION_ID}", json=payload()).status_code, expected)
            self.assertEqual(self.client.delete(f"/youtube-opinions/opinions/{OPINION_ID}").status_code, expected)
        self.service.list_creator_opinions.assert_not_called()
        self.service.create_opinion.assert_not_called()
        self.service.update_opinion.assert_not_called()
        self.service.delete_opinion.assert_not_called()

    def test_admin_can_write_opinions_and_profile_fields_are_rejected(self):
        self.login(True)
        self.service.create_opinion.return_value = {"success": True, "opinion": {"id": "new"}}
        self.service.update_opinion.return_value = {"success": True, "opinion": {"id": OPINION_ID}}
        self.service.delete_opinion.return_value = {"success": True, "id": OPINION_ID}
        self.assertEqual(self.client.post(f"/youtube-opinions/creators/{CHANNEL_ID}/opinions", json=payload()).status_code, 200)
        self.assertEqual(self.client.patch(f"/youtube-opinions/opinions/{OPINION_ID}", json=payload()).status_code, 200)
        self.assertEqual(self.client.delete(f"/youtube-opinions/opinions/{OPINION_ID}").status_code, 200)
        self.assertEqual(self.client.patch(f"/youtube-opinions/opinions/{OPINION_ID}", json={**payload(), "channel_title": "改名"}).status_code, 422)
        self.service.create_opinion.side_effect = LookupError()
        self.assertEqual(self.client.post("/youtube-opinions/creators/missing/opinions", json=payload()).status_code, 404)
        self.service.update_opinion.side_effect = ValueError("方向分数必须在 -100 到 100 之间。")
        self.assertEqual(self.client.patch(f"/youtube-opinions/opinions/{OPINION_ID}", json=payload(direction_score=140)).status_code, 400)
