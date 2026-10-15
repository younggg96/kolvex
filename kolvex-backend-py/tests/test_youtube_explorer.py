import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.routes.youtube_opinions import get_service, router

from app.services.youtube_stock_opinions import YouTubeStockOpinionService


def opinion(index):
    return {"id": str(index), "ticker": f"STK{index % 12}", "channel_id": f"creator{index % 11}",
            "channel_title": f"Creator {index % 11}", "video_id": str(index),
            "video_published_at": "2026-10-05T00:00:00Z", "opinion_date": "2026-10-05",
            "sentiment": "bullish", "direction_score": 60, "created_at": "2026-10-05T00:00:00Z"}


class ExplorerTests(unittest.TestCase):
    def test_share_reads_complete_latest_video_by_publication_not_import_time(self):
        service = YouTubeStockOpinionService(Mock())
        latest = [{**opinion(i), "video_id": "newest", "video_published_at": "2026-10-09T23:07:18Z",
                   "raw_payload": {"private": "not public"}, "uploaded_by": "admin"} for i in range(125)]
        older = {**opinion(200), "video_id": "older", "video_published_at": "2026-10-08T23:00:00Z", "created_at": "2026-10-10T23:00:00Z"}
        service._fetch_rows = Mock(return_value=[older, *latest])
        result = service.get_creator_latest_video("creator1")
        self.assertEqual(result["video"]["video_id"], "newest")
        self.assertEqual(len(result["opinions"]), 125)
        self.assertTrue(all(row["video_id"] == "newest" for row in result["opinions"]))
        self.assertNotIn("raw_payload", result["opinions"][0])
        self.assertNotIn("uploaded_by", result["opinions"][0])
        service._fetch_rows.assert_called_once_with(channel_id="creator1")

    def test_share_has_an_explicit_empty_result(self):
        service = YouTubeStockOpinionService(Mock())
        service._fetch_rows = Mock(return_value=[])
        self.assertEqual(service.get_creator_latest_video("missing"), {"creator": None, "video": None, "opinions": []})

    def test_latest_video_route_is_read_only_and_public_like_the_dashboard(self):
        service = YouTubeStockOpinionService(Mock())
        service._fetch_rows = Mock(return_value=[opinion(0)])
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_service] = lambda: service
        response = TestClient(app).get("/youtube-opinions/creators/creator0/latest-video")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["creator"]["channel_id"], "creator0")
        service.supabase.table.assert_not_called()

    def test_directory_is_not_truncated_by_opinion_pagination(self):
        service = YouTubeStockOpinionService(Mock())
        service._fetch_rows = Mock(return_value=[opinion(i) for i in range(85)])
        result = asyncio.run(service.get_dashboard(limit=40, offset=40))
        self.assertEqual(len(result["stocks"]), 12)
        self.assertEqual(len(result["creators"]), 11)
        self.assertEqual(result["latest"][0]["id"], "40")
        self.assertEqual(result["latest"][-1]["id"], "79")
        self.assertTrue(result["pagination"]["has_more"])
        last = asyncio.run(service.get_dashboard(limit=40, offset=80))
        self.assertEqual(len(last["latest"]), 5)
        self.assertFalse(last["pagination"]["has_more"])
        self.assertEqual(last["pagination"]["total"], 85)

    def test_stock_creator_and_date_filters_are_combined(self):
        service = YouTubeStockOpinionService(Mock())
        service._fetch_rows = Mock(return_value=[])
        result = asyncio.run(service.get_dashboard(ticker="NVDA", channel_id="creator1", date_from="2026-10-01", date_to="2026-10-07", sentiment="bearish"))
        service._fetch_rows.assert_called_once_with(ticker="NVDA", channel_id="creator1", date_from="2026-10-01", date_to="2026-10-07", sentiment="bearish")
        self.assertEqual(result["stocks"], [])
        self.assertFalse(result["pagination"]["has_more"])

    def test_fetch_reads_all_pages_even_with_lower_server_row_cap(self):
        query = Mock()
        for method in ("select", "order", "eq", "gte", "lte", "range"):
            getattr(query, method).return_value = query
        query.execute.side_effect = [SimpleNamespace(data=[opinion(0), opinion(1)], count=5),
                                     SimpleNamespace(data=[opinion(2), opinion(3)], count=5),
                                     SimpleNamespace(data=[opinion(4)], count=5)]
        client = Mock()
        client.table.return_value = query
        rows = YouTubeStockOpinionService(client)._fetch_rows(ticker="nvda", channel_id="creator1")
        self.assertEqual(len(rows), 5)
        self.assertEqual(client.table.call_count, 3)
        self.assertEqual([call.args for call in query.range.call_args_list], [(0, 999), (2, 1001), (4, 1003)])
        query.eq.assert_any_call("ticker", "NVDA")
        query.eq.assert_any_call("channel_id", "creator1")
        query.order.assert_any_call("id")

    def test_filtered_stock_lists_count_all_creators_across_pages(self):
        query = Mock()
        for method in ("select", "in_", "order", "range"):
            getattr(query, method).return_value = query
        client = Mock()
        client.table.return_value = query
        service = YouTubeStockOpinionService(client)
        rows = [{**opinion(i), "ticker": "NVDA", "channel_id": "creator1"} for i in range(3)]
        service._fetch_rows = Mock(return_value=rows)
        service._fill_missing_avatars = AsyncMock()
        # A repeated creator on different pages counts once; empty ids do not count.
        pages = [SimpleNamespace(data=[{"ticker": "NVDA", "channel_id": channel} for channel in channels], count=5)
                 for channels in (("creator1", "creator1"), ("creator2", "creator1"), (None,))]
        for filters in ({"channel_id": "creator1"}, {"sentiment": "bullish"},
                        {"date_from": "2026-10-01", "date_to": "2026-10-07"}):
            with self.subTest(filters=filters):
                query.reset_mock()
                query.execute.side_effect = pages
                result = asyncio.run(service.get_dashboard(**filters, limit=1))
                self.assertEqual(result["stocks"][0]["creator_count"], 2)
                self.assertEqual(result["stocks"][0]["total_opinions"], 3)
                self.assertEqual(result["summary"]["total_creators"], 1)
                self.assertEqual(len(result["latest"]), 1)
                query.select.assert_called_with("ticker,channel_id", count="exact")
                query.in_.assert_called_with("ticker", ["NVDA"])
                self.assertEqual([call.args for call in query.range.call_args_list],
                                 [(0, 999), (2, 1001), (4, 1003)])

    def test_unfiltered_stock_counts_are_deduplicated_without_extra_query(self):
        service = YouTubeStockOpinionService(Mock())
        service._fetch_rows = Mock(return_value=[
            {**opinion(i), "ticker": "NVDA", "channel_id": channel}
            for i, channel in enumerate(("creator1", "creator1", "creator2"))
        ])
        service._fill_missing_avatars = AsyncMock()
        result = asyncio.run(service.get_dashboard(limit=1))
        self.assertEqual(result["stocks"][0]["creator_count"], 2)
        self.assertEqual(result["stocks"][0]["total_opinions"], 3)
        service.supabase.table.assert_not_called()

    def test_missing_avatars_are_filled_from_youtube_and_stored(self):
        client = Mock()
        update = client.table.return_value.update.return_value
        update.eq.return_value = update
        service = YouTubeStockOpinionService(client)
        row = opinion(0)
        row["channel_handle"] = "@example"
        service._fetch_rows = Mock(return_value=[row])
        avatar = "https://yt3.ggpht.com/avatar"
        with patch(
            "app.services.youtube_stock_opinions.channel_profiles.get_profile",
            AsyncMock(return_value={"channel_avatar_url": avatar, "profile_status": "available"}),
        ) as lookup:
            result = asyncio.run(service.get_dashboard())
        lookup.assert_awaited_once()
        self.assertEqual(result["creators"][0]["channel_avatar_url"], avatar)
        self.assertEqual(result["latest"][0]["channel_avatar_url"], avatar)
        client.table.return_value.update.assert_called_once_with({"channel_avatar_url": avatar})
        update.eq.assert_called_once_with("channel_id", row["channel_id"])

    def test_avatar_falls_back_to_the_video_channel(self):
        client = Mock()
        update = client.table.return_value.update.return_value
        update.eq.return_value = update
        service = YouTubeStockOpinionService(client)
        row = opinion(0)
        row["video_id"] = "abcdefghijk"
        row["channel_handle"] = "@missing"
        service._fetch_rows = Mock(return_value=[row])
        avatar = "https://yt3.ggpht.com/from-video"
        resolved = "UC" + "b" * 22

        async def profile(channel_id, handle=None, channel_url=None):
            if channel_id == resolved:
                return {"channel_avatar_url": avatar}
            return {"profile_status": "not_found"}

        with patch("app.services.youtube_stock_opinions.channel_profiles.get_profile", AsyncMock(side_effect=profile)), \
             patch("app.services.youtube_stock_opinions.channel_profiles.channel_id_for_video", AsyncMock(return_value=resolved)):
            result = asyncio.run(service.get_dashboard())
        self.assertEqual(result["creators"][0]["channel_avatar_url"], avatar)

    def test_existing_https_avatar_skips_youtube_lookup(self):
        service = YouTubeStockOpinionService(Mock())
        row = opinion(0)
        row["channel_avatar_url"] = "https://yt3.ggpht.com/existing"
        service._fetch_rows = Mock(return_value=[row])
        with patch(
            "app.services.youtube_stock_opinions.channel_profiles.get_profile",
            AsyncMock(),
        ) as lookup:
            result = asyncio.run(service.get_dashboard())
        lookup.assert_not_awaited()
        self.assertEqual(result["creators"][0]["channel_avatar_url"], "https://yt3.ggpht.com/existing")

    def test_empty_database_stops_paging(self):
        query = Mock()
        for method in ("select", "order", "range"):
            getattr(query, method).return_value = query
        query.execute.return_value = SimpleNamespace(data=[], count=0)
        client = Mock()
        client.table.return_value = query
        self.assertEqual(YouTubeStockOpinionService(client)._fetch_rows(), [])
        query.execute.assert_called_once()


if __name__ == "__main__":
    unittest.main()
