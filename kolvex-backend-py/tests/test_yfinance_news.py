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
        search.assert_called_once_with("NVDA", news_count=3, include_research=False, timeout=8)

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
