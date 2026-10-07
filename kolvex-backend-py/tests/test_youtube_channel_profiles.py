import asyncio
import unittest
from unittest.mock import AsyncMock, Mock, patch
import httpx

from app.services.youtube_channel_profiles import YouTubeChannelProfiles, channel_identity, channel_link, public_count
from app.services.youtube_stock_opinions import YouTubeStockOpinionService


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

    def test_quota_errors_are_backed_off_across_channels(self):
        async def exercise():
            service = YouTubeChannelProfiles(api_key="test-key")
            get = AsyncMock(return_value=httpx.Response(403, json={"error": {"message": "quota"}}))
            with patch("httpx.AsyncClient.get", get):
                self.assertEqual((await service.get_profile(CHANNEL_ID))["profile_status"], "unavailable")
                self.assertEqual((await service.get_profile("UC" + "b" * 22))["profile_status"], "unavailable")
                get.assert_awaited_once()
        asyncio.run(exercise())


if __name__ == "__main__":
    unittest.main()
