import asyncio
import unittest
from unittest.mock import AsyncMock, Mock, patch
import httpx

from app.services.youtube_channel_profiles import YouTubeChannelProfiles, channel_identity, channel_link, parse_youtube_time, public_count
from app.services.youtube_stock_opinions import YouTubeStockOpinionService, compare_upload_coverage


CHANNEL_ID = "UC" + "a" * 22


class ChannelProfileTests(unittest.TestCase):
    def test_public_identifiers_and_links(self):
        self.assertEqual(channel_identity(CHANNEL_ID), {"id": CHANNEL_ID})
        self.assertEqual(channel_identity("imported-id", channel_url="https://www.youtube.com/@example"), {"forHandle": "@example"})
        self.assertIsNone(channel_identity("imported-id", channel_url="https://evil.test/@example"))
        self.assertIsNone(channel_link("javascript:alert(1)"))

    def test_counts_do_not_fabricate_missing_or_hidden_subscribers(self):
        data = YouTubeChannelProfiles.normalize({"id": CHANNEL_ID, "statistics": {"subscriberCount": "123", "hiddenSubscriberCount": True, "videoCount": "0"}})
        self.assertIsNone(data["subscriber_count"])
        self.assertIsNone(data["view_count"])
        self.assertEqual(data["video_count"], 0)
        self.assertIsNone(public_count(True))
        self.assertIsNone(public_count(-1))

    def test_unconfigured_key_has_graceful_fallback(self):
        service = YouTubeChannelProfiles(api_key="")
        self.assertEqual(asyncio.run(service.get_profile(CHANNEL_ID))["profile_status"], "not_configured")

    def test_imported_profile_is_retained_when_lookup_is_unavailable(self):
        service = YouTubeStockOpinionService(Mock())
        service._fetch_rows = Mock(return_value=[{
            "channel_id": CHANNEL_ID, "channel_title": "Imported creator", "channel_handle": "@example",
            "ticker": "NVDA", "sentiment": "bullish", "direction_score": 60,
            "raw_payload": {"channel": {"description": "Public description", "subscriber_count": "500"}},
        }])
        with patch("app.services.youtube_stock_opinions.channel_profiles.get_profile", AsyncMock(return_value={"profile_status": "not_configured"})):
            data = asyncio.run(service.get_creator_profile(CHANNEL_ID))
        self.assertEqual(data["channel_title"], "Imported creator")
        self.assertEqual(data["subscriber_count"], 500)
        self.assertEqual(data["profile_source"], "imported")
        self.assertEqual(data["description"], "Public description")

    def test_unknown_creator_does_not_query_youtube(self):
        service = YouTubeStockOpinionService(Mock())
        service._fetch_rows = Mock(return_value=[])
        with patch("app.services.youtube_stock_opinions.channel_profiles.get_profile", AsyncMock()) as lookup:
            with self.assertRaises(LookupError):
                asyncio.run(service.get_creator_profile("unknown"))
            lookup.assert_not_awaited()

    def test_profile_is_cached_and_credential_is_not_in_url(self):
        async def exercise():
            service = YouTubeChannelProfiles(api_key="test-key")
            response = httpx.Response(200, json={"items": [{"id": CHANNEL_ID, "snippet": {"title": "Creator", "thumbnails": {"high": {"url": "https://yt3.ggpht.com/avatar"}}}, "statistics": {"subscriberCount": "1234"}}]})
            get = AsyncMock(return_value=response)
            with patch("httpx.AsyncClient.get", get):
                first = await service.get_profile(CHANNEL_ID)
                second = await service.get_profile(CHANNEL_ID)
                self.assertEqual(first, second)
                self.assertEqual(first["subscriber_count"], 1234)
                self.assertEqual(first["channel_title"], "Creator")
                get.assert_awaited_once()
                self.assertNotIn("key", get.call_args.kwargs["params"])
        asyncio.run(exercise())

    def test_video_lookup_returns_channel_id_without_exposing_credential(self):
        async def exercise():
            service = YouTubeChannelProfiles(api_key="test-key")
            response = httpx.Response(200, json={"items": [{"snippet": {"channelId": CHANNEL_ID}}]})
            get = AsyncMock(return_value=response)
            with patch("httpx.AsyncClient.get", get):
                self.assertEqual(await service.channel_id_for_video("abcdefghijk"), CHANNEL_ID)
                self.assertIsNone(await service.channel_id_for_video("short"))
                get.assert_awaited_once()
                self.assertNotIn("key", get.call_args.kwargs["params"])
        asyncio.run(exercise())

    def test_latest_uploads_skip_private_videos_and_keep_the_key_out_of_the_url(self):
        async def exercise():
            service = YouTubeChannelProfiles(api_key="test-key")
            channels = httpx.Response(200, json={"items": [{"id": CHANNEL_ID, "contentDetails": {"relatedPlaylists": {"uploads": "UU" + "a" * 22}}}]})
            playlist = httpx.Response(200, json={"items": [
                {"snippet": {"title": "New video", "resourceId": {"kind": "youtube#video", "videoId": "aaaaaaaaaaa"}}, "contentDetails": {"videoId": "aaaaaaaaaaa", "videoPublishedAt": "2026-10-08T00:00:00Z"}},
                {"snippet": {"title": "Private video", "resourceId": {"videoId": "ccccccccccc"}}, "contentDetails": {"videoId": "ccccccccccc"}},
                {"snippet": {"title": "Older", "resourceId": {"videoId": "bbbbbbbbbbb"}}, "contentDetails": {"videoId": "bbbbbbbbbbb", "videoPublishedAt": "2026-10-01T00:00:00Z"}},
            ]})
            get = AsyncMock(side_effect=[channels, playlist])
            with patch("httpx.AsyncClient.get", get):
                first = await service.latest_uploads({CHANNEL_ID: "2026-10-02T00:00:00Z", "not-a-channel": "2026-10-02T00:00:00Z"})
                second = await service.latest_uploads({CHANNEL_ID: "2026-10-02T00:00:00Z"})
            self.assertEqual([video["video_id"] for video in first[CHANNEL_ID]["videos"]], ["aaaaaaaaaaa"])
            self.assertTrue(first[CHANNEL_ID]["reached_cutoff"])
            self.assertEqual(first["not-a-channel"]["status"], "invalid_identity")
            self.assertEqual(second[CHANNEL_ID]["videos"][0]["title"], "New video")
            self.assertEqual(get.await_count, 2)
            for call in get.await_args_list:
                self.assertNotIn("key", call.kwargs["params"])
        asyncio.run(exercise())

    def test_upload_lookup_stops_when_quota_is_exhausted(self):
        async def exercise():
            service = YouTubeChannelProfiles(api_key="test-key")
            get = AsyncMock(return_value=httpx.Response(403, json={"error": {"message": "quota"}}))
            with patch("httpx.AsyncClient.get", get):
                first = await service.latest_uploads({CHANNEL_ID: "2026-10-02T00:00:00Z"})
                second = await service.latest_uploads({"UC" + "b" * 22: "2026-10-02T00:00:00Z"})
            self.assertEqual(first[CHANNEL_ID]["status"], "unavailable")
            self.assertEqual(second["UC" + "b" * 22]["status"], "unavailable")
            get.assert_awaited_once()
        asyncio.run(exercise())

    def test_quota_errors_are_backed_off_across_channels(self):
        async def exercise():
            service = YouTubeChannelProfiles(api_key="test-key")
            get = AsyncMock(return_value=httpx.Response(403, json={"error": {"message": "quota"}}))
            with patch("httpx.AsyncClient.get", get):
                self.assertEqual((await service.get_profile(CHANNEL_ID))["profile_status"], "unavailable")
                self.assertEqual((await service.get_profile("UC" + "b" * 22))["profile_status"], "unavailable")
                get.assert_awaited_once()
        asyncio.run(exercise())


class UploadCoverageTests(unittest.TestCase):
    def test_counts_videos_published_after_the_last_tracked_one(self):
        since = parse_youtube_time("2026-10-01T00:00:00Z")
        compared = compare_upload_coverage([
            {"video_id": "aaaaaaaaaaa", "title": "Newest", "published_at": "2026-10-08T00:00:00Z"},
            {"video_id": "ddddddddddd", "title": "In between", "published_at": "2026-10-05T00:00:00Z"},
            {"video_id": "bbbbbbbbbbb", "title": "Last tracked", "published_at": "2026-10-01T00:00:00Z"},
            {"video_id": "eeeeeeeeeee", "title": "Older and missing", "published_at": "2026-09-01T00:00:00Z"},
        ], {"bbbbbbbbbbb"}, since, False)
        self.assertEqual([video["title"] for video in compared["untracked"]], ["Newest", "In between"])
        self.assertEqual(compared["untracked_count"], 2)
        self.assertFalse(compared["truncated"])
        self.assertIsNotNone(compared["since"])

        caught_up = compare_upload_coverage([
            {"video_id": "bbbbbbbbbbb", "title": "Last tracked", "published_at": "2026-10-01T00:00:00Z"},
        ], {"bbbbbbbbbbb"}, since, False)
        self.assertEqual(caught_up["untracked_count"], 0)

    def test_coverage_uses_real_channel_uploads_without_calling_youtube_when_unconfigured(self):
        service = YouTubeStockOpinionService(Mock())
        service._tracked_video_index = Mock(return_value=[
            {"channel_id": CHANNEL_ID, "video_id": "bbbbbbbbbbb", "video_published_at": "2026-10-01T00:00:00Z"},
        ])
        with patch("app.services.youtube_stock_opinions.channel_profiles.api_key", ""):
            with patch("app.services.youtube_stock_opinions.channel_profiles.latest_uploads", AsyncMock()) as uploads:
                report = asyncio.run(service.get_upload_coverage())
        uploads.assert_not_awaited()
        self.assertEqual(report["status"], "not_configured")
        self.assertEqual(report["creators"][0]["untracked_count"], 0)
        self.assertIsNotNone(report["creators"][0]["since"])

    def test_coverage_counts_only_uploads_after_the_last_update(self):
        service = YouTubeStockOpinionService(Mock())
        service._tracked_video_index = Mock(return_value=[
            {"channel_id": CHANNEL_ID, "video_id": "bbbbbbbbbbb", "video_published_at": "2026-10-01T12:00:00Z"},
            {"channel_id": CHANNEL_ID, "video_id": "bbbbbbbbbbb", "video_published_at": "2026-10-01T12:00:00Z"},
        ])
        uploads = AsyncMock(return_value={
            CHANNEL_ID: {"status": "available", "reached_cutoff": True, "videos": [
                {"video_id": "aaaaaaaaaaa", "title": "Newest", "published_at": "2026-10-08T00:00:00Z"},
                {"video_id": "ddddddddddd", "title": "In between", "published_at": "2026-10-05T00:00:00Z"},
            ]},
        })
        with patch("app.services.youtube_stock_opinions.channel_profiles.api_key", "test-key"), \
             patch("app.services.youtube_stock_opinions.channel_profiles.latest_uploads", uploads):
            report = asyncio.run(service.get_upload_coverage())
        self.assertEqual(report["status"], "available")
        creator = report["creators"][0]
        self.assertEqual(creator["untracked_count"], 2)
        self.assertEqual(creator["latest_video_id"], "aaaaaaaaaaa")
        self.assertFalse(creator["truncated"])
        cutoff = uploads.await_args.args[0][CHANNEL_ID]
        self.assertTrue(cutoff.startswith("2026-10-01T12:00:00"))


if __name__ == "__main__":
    unittest.main()
