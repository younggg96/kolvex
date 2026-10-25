import unittest
import asyncio
from unittest.mock import Mock, patch

from app.api.routes.market_data import get_stock_news
from app.services.yfinance.client import YFinanceService


class StockNewsTests(unittest.TestCase):
    def test_news_normalizes_nested_articles_and_omits_unsafe_links(self):
        service = YFinanceService()
        ticker = Mock()
        ticker.get_news.return_value = [
            {
                "id": "older",
                "content": {
                    "title": "Earlier report",
                    "summary": "Company announced its latest results.",
                    "provider": {"displayName": "Publisher A"},
                    "canonicalUrl": {"url": "https://example.com/earlier"},
                    "pubDate": "2026-10-07T12:00:00Z",
                },
            },
            {
                "id": "unsafe",
                "title": "Unsafe link",
                "link": "javascript:alert(1)",
            },
            {
                "id": "unrelated",
                "title": "Another stock",
                "link": "https://example.com/other",
                "relatedTickers": ["AAPL"],
            },
            {
                "id": "newer",
                "title": "Latest report",
                "publisher": "Publisher B",
                "link": "https://example.com/latest",
                "providerPublishTime": 1791460800,
            },
        ]
        service.get_ticker = Mock(return_value=ticker)

        news = service.get_news("nvda", limit=4)

        self.assertEqual([item["uuid"] for item in news], ["newer", "older"])
        self.assertEqual(news[0]["related_tickers"], ["NVDA"])
        self.assertEqual(news[1]["publisher"], "Publisher A")
        self.assertEqual(news[1]["summary"], "Company announced its latest results.")
        self.assertIsNone(news[0]["summary"])
        ticker.get_news.assert_called_once_with(count=4)

    @patch("app.services.yfinance.client.yf.Search")
    def test_news_falls_back_to_search_when_ticker_has_no_articles(self, search):
        service = YFinanceService()
        ticker = Mock()
        ticker.get_news.return_value = []
        service.get_ticker = Mock(return_value=ticker)
        search.return_value.news = [{
            "uuid": "search-result",
            "title": "Search article",
            "publisher": "Publisher",
            "link": "https://example.com/search",
            "providerPublishTime": 1791460800,
        }]

        news = service.get_news("nvda", limit=3)

        self.assertEqual(news[0]["publisher"], "Publisher")
        self.assertEqual(news[0]["uuid"], "search-result")
        search.assert_called_once_with("NVDA", news_count=3, include_research=False, timeout=4)

    def test_alphabet_share_classes_match_and_links_are_deduplicated(self):
        articles = [{
            "title": "Alphabet report", "link": "https://example.com/alphabet",
            "relatedTickers": [{"symbol": "GOOG"}],
        }] * 2
        self.assertEqual(len(YFinanceService._normalize_news(articles, "GOOGL", 8)), 1)
        self.assertEqual(YFinanceService._normalize_news(articles, "AAPL", 8), [])

    @patch("app.services.yfinance.client.yf.Search")
    def test_filtered_results_still_trigger_search(self, search):
        service = YFinanceService()
        service.get_ticker = Mock()
        service.get_ticker.return_value.get_news.return_value = [{"title": "No link"}]
        search.return_value.news = [{"title": "Alphabet", "link": "https://example.com/google"}]
        self.assertEqual(len(service.get_news("GOOGL")), 1)
        search.assert_called_once()

    @patch("app.services.yfinance.client.yf.Search")
    def test_empty_json_sources_fall_back_to_rss_and_failures_are_not_empty(self, search):
        service = YFinanceService()
        service.get_ticker = Mock()
        service.get_ticker.return_value.get_news.return_value = []
        search.return_value.news = []
        service._get_news_rss = Mock(return_value=[{
            "title": "RSS article", "link": "https://example.com/rss",
        }])
        self.assertEqual(service.get_news("GOOGL")[0]["title"], "RSS article")
        service._get_news_rss.assert_called_once_with("GOOGL")
        service._get_news_rss.return_value = []
        self.assertEqual(service.get_news("GOOGL"), [])
        service.get_ticker.return_value.get_news.side_effect = RuntimeError("upstream")
        with self.assertRaisesRegex(RuntimeError, "sources unavailable"):
            service.get_news("GOOGL")

    @patch("app.services.yfinance.client.httpx.Client")
    def test_rss_parsing_and_invalid_response_detection(self, client):
        response = client.return_value.__enter__.return_value.get.return_value
        response.content = b"""<rss><channel><item><title>Alphabet earnings</title>
            <link>https://example.com/earnings</link><guid>rss-1</guid>
            <pubDate>Sun, 25 Oct 2026 12:00:00 GMT</pubDate><source>Publisher</source>
            </item></channel></rss>"""
        articles = YFinanceService._get_news_rss("GOOGL")
        result = YFinanceService._normalize_news(articles, "GOOGL", 8)
        self.assertEqual(result[0]["uuid"], "rss-1")
        self.assertEqual(result[0]["publisher"], "Publisher")
        self.assertIsInstance(result[0]["publish_time"], int)
        for payload in (b"<html>Unavailable</html>", b"<!DOCTYPE rss><rss><channel/></rss>"):
            response.content = payload
            with self.assertRaises(ValueError):
                YFinanceService._get_news_rss("GOOGL")

    @patch("app.api.routes.market_data.get_yfinance_service")
    def test_market_news_route_returns_stock_scoped_items(self, service):
        service.return_value.get_news.return_value = [{
            "uuid": "item-1",
            "title": "Company news",
            "publisher": "Publisher",
            "link": "https://example.com/news",
            "publish_time": 1791460800,
            "related_tickers": ["NVDA"],
        }]

        response = asyncio.run(get_stock_news("nvda"))

        self.assertEqual(response.symbol, "NVDA")
        self.assertEqual(response.count, 1)
        self.assertEqual(response.news[0].title, "Company news")
        service.return_value.get_news.assert_called_once_with("nvda")


if __name__ == "__main__":
    unittest.main()
