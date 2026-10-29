import unittest
from unittest.mock import AsyncMock, Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.youtube_opinions import get_service, router
from app.services.youtube_stock_opinions import YouTubeStockOpinionService


def opinion(video, creator, ticker, published, **extra):
    return {
        "id": f"{video}-{ticker}", "video_id": video, "channel_id": creator,
        "channel_title": creator, "ticker": ticker, "video_title": video,
        "video_published_at": published, "opinion_date": published[:10],
        "direction_score": 60, "sentiment": "bullish", "confidence": .9,
        "summary": "Source summary", "raw_payload": {"private": "payload"},
        **extra,
    }


class VideoFeedTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.service = YouTubeStockOpinionService(Mock())
        self.service._fill_missing_avatars = AsyncMock()
        self.rows = [
            opinion("new-a", "a", f"STOCK{i}", "2026-10-28T15:00:00Z")
            for i in range(45)
        ] + [
            opinion("older-a", "a", "TSLA", "2026-10-27T15:00:00Z"),
            opinion("new-b", "b", "NVDA", "2026-10-27T14:00:00Z"),
        ]
        self.service._fetch_rows = Mock(return_value=self.rows)

    async def test_pagination_keeps_large_video_complete(self):
        first = await self.service.get_video_feed(limit=1)
        self.assertEqual(first["pagination"], {"offset": 0, "limit": 1, "total": 3, "has_more": True})
        self.assertEqual(len(first["videos"][0]["opinions"]), 45)
        self.assertEqual(first["videos"][0]["opinions"][0]["channel_title"], "a")
        self.assertNotIn("raw_payload", first["videos"][0]["opinions"][0])
        rest = await self.service.get_video_feed(limit=2, offset=1)
        self.assertEqual([g["videoId"] for g in rest["videos"]], ["older-a", "new-b"])
        self.assertFalse(rest["pagination"]["has_more"])

    async def test_preview_uses_each_creators_newest_video_from_entire_dataset(self):
        groups = self.service._build_video_groups(list(reversed(self.rows)), distinct_creators=True)
        self.assertEqual([g["videoId"] for g in groups], ["new-a", "new-b"])
        self.assertEqual(len(groups[0]["opinions"]), 45)

    async def test_dashboard_preview_is_independent_of_individual_opinion_page(self):
        self.service._fetch_rows.return_value = self.rows + [
            opinion(f"video-{i}", f"creator-{i}", "AAPL", "2026-10-26T15:00:00Z")
            for i in range(6)
        ]
        result = await self.service.get_dashboard(limit=1)
        self.assertEqual(len(result["latest"]), 1)
        self.assertEqual(len(result["latest_videos"]), 5)
        self.assertEqual(len(result["latest_videos"][0]["opinions"]), 45)
        self.assertEqual(len({g["opinions"][0]["channel_id"] for g in result["latest_videos"]}), 5)

    async def test_sort_uses_publication_instant_instead_of_import_time(self):
        rows = [
            opinion("older", "a", "AAPL", "2026-10-28T14:00:00Z", created_at="2026-10-29"),
            opinion("newer", "b", "NVDA", "2026-10-28T10:01:00-04:00", created_at="2026-10-28"),
        ]
        self.assertEqual([g["videoId"] for g in self.service._build_video_groups(rows)], ["newer", "older"])

    async def test_empty_and_out_of_range_pages(self):
        self.service._fetch_rows.return_value = []
        empty = await self.service.get_video_feed()
        self.assertEqual(empty["videos"], [])
        self.assertEqual(empty["pagination"]["total"], 0)
        self.assertFalse(empty["pagination"]["has_more"])
        self.service._fetch_rows.return_value = self.rows
        self.assertEqual((await self.service.get_video_feed(offset=100))["videos"], [])


class VideoFeedRouteTests(unittest.TestCase):
    def test_public_feed_validates_and_forwards_video_pagination(self):
        app = FastAPI()
        app.include_router(router)
        service = Mock()
        service.get_video_feed = AsyncMock(return_value={"videos": [], "pagination": {"total": 0}})
        app.dependency_overrides[get_service] = lambda: service
        client = TestClient(app)
        self.assertEqual(client.get("/youtube-opinions/videos?limit=2&offset=3").status_code, 200)
        service.get_video_feed.assert_awaited_once_with(limit=2, offset=3)
        for query in ("limit=0", "limit=41", "offset=-1"):
            self.assertEqual(client.get(f"/youtube-opinions/videos?{query}").status_code, 422)


if __name__ == "__main__":
    unittest.main()
