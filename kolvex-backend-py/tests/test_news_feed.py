"""Run: python -m unittest discover -s tests -p test_news_feed.py"""
import asyncio
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, patch

spec = importlib.util.spec_from_file_location("news_feed", Path(__file__).parents[1] / "app/services/news_feed.py")
news = importlib.util.module_from_spec(spec)
spec.loader.exec_module(news)

def item(guid="1", title="FinancialJuice: $AMZN earnings", link="https://www.financialjuice.com/News/1/story.aspx?xy=rss", date="Tue, 20 Oct 2026 12:00:00 GMT"):
    return f"<item><guid>{guid}</guid><title>{title}</title><link>{link}</link><pubDate>{date}</pubDate></item>"
def rss(items):
    return f"<rss><channel>{items}</channel></rss>".encode()

class ParserTests(unittest.TestCase):
    def test_normalization_and_corrections(self):
        articles = news.parse_feed(rss(item() + item(title="FinancialJuice: $AMZN corrected earnings")))
        self.assertEqual(len(articles), 1)
        self.assertEqual(articles[0]["id"], "financialjuice:1")
        self.assertEqual(articles[0]["title"], "$AMZN corrected earnings")
        self.assertEqual(articles[0]["symbols"], ["AMZN"])
        self.assertEqual(articles[0]["link"], "https://www.financialjuice.com/News/1/story.aspx")
        self.assertIsInstance(articles[0]["publish_time"], int)
    def test_rejects_unsafe_links_and_xml(self):
        for link in ["javascript:alert(1)", "https://evil.example/News/1", "https://www.financialjuice.com.evil.example/News/1", "https://user@www.financialjuice.com/News/1", "https://www.financialjuice.com:444/News/1"]:
            self.assertEqual(news.parse_feed(rss(item(link=link))), [])
        for payload in [b'<!DOCTYPE rss [<!ENTITY x "text">]><rss><channel/></rss>', b'x' * (news.MAX_BYTES + 1), b'<html/>']:
            with self.assertRaises(ValueError):
                news.parse_feed(payload)
    def test_bad_dates_and_bounded_results(self):
        self.assertIsNone(news.parse_feed(rss(item(date="invalid")))[0]["publish_time"])
        self.assertEqual(len(news.parse_feed(rss(''.join(item(guid=str(i)) for i in range(150))))), 100)
        self.assertEqual(news.parse_feed(rss('')), [])

class CacheTests(unittest.IsolatedAsyncioTestCase):
    async def test_single_fetch_for_concurrent_requests(self):
        service = news.NewsFeedService()
        service._download = AsyncMock(return_value=[])
        responses = await asyncio.gather(*(service.get_feed() for _ in range(10)))
        self.assertEqual(service._download.await_count, 1)
        self.assertEqual(responses[0]["delivery"], "delayed")
        self.assertFalse(responses[0]["stale"])
    async def test_stale_retry_cooldown_and_expiration(self):
        service = news.NewsFeedService()
        service._download = AsyncMock(return_value=[])
        with patch.object(news.time, "monotonic", return_value=1000):
            initial = await service.get_feed()
        service._download.side_effect = ValueError("provider failure")
        with patch.object(news.time, "monotonic", return_value=1061):
            stale = await service.get_feed()
            self.assertTrue(stale["stale"])
            self.assertEqual(stale["fetched_at"], initial["fetched_at"])
            await service.get_feed()
            self.assertEqual(service._download.await_count, 2)
        with patch.object(news.time, "monotonic", return_value=1901):
            with self.assertRaises(RuntimeError):
                await service.get_feed()
    async def test_no_cache_failure_has_cooldown(self):
        service = news.NewsFeedService()
        service._download = AsyncMock(side_effect=ValueError("bad xml"))
        for _ in range(2):
            with self.assertRaises(RuntimeError):
                await service.get_feed()
        self.assertEqual(service._download.await_count, 1)

if __name__ == '__main__':
    unittest.main()
