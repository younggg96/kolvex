import asyncio
import time
import unittest
from unittest.mock import AsyncMock, patch
import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.routes.reddit_opinions import router
from app.services.reddit_opinions import RedditOpinionService, parse_ranking


def row(**values):
    return {"ticker": "AAPL", "name": "Apple &amp; Co", "rank": "1", "mentions": "20", "upvotes": "10", "rank_24h_ago": None, "mentions_24h_ago": "0", **values}


class ParserTests(unittest.TestCase):
    def test_baselines_and_zero_are_preserved(self):
        result = parse_ranking({"results": [row()]})[0]
        self.assertIsNone(result["previousRank"])
        self.assertEqual(result["previousMentions"], 0)
        self.assertEqual(result["name"], "Apple & Co")

    def test_invalid_values_and_duplicates_are_rejected(self):
        for rows in ([row(), row()], [row(rank=True)], [row(mentions="NaN")], [row(ticker="../escape")]):
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                parse_ranking({"results": rows})


class CacheTests(unittest.IsolatedAsyncioTestCase):
    async def test_concurrent_reads_share_snapshot_and_actual_fetch_time(self):
        service = RedditOpinionService()
        service._download = AsyncMock(return_value=[{"ticker": "AAPL"}])
        first, second = await asyncio.gather(service.get("all-stocks"), service.get("all-stocks"))
        self.assertEqual(first, second)
        service._download.assert_awaited_once()
        await service.get("stocks")
        self.assertEqual(service._download.await_count, 2)
        service.fetched["all-stocks"] = time.monotonic() - 301
        await service.get("all-stocks")
        self.assertEqual(service._download.await_count, 3)

    async def test_arbitrary_community_never_reaches_upstream(self):
        service = RedditOpinionService()
        service._download = AsyncMock()
        with self.assertRaises(ValueError):
            await service.get("../../metadata")
        service._download.assert_not_awaited()


class RouteTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    def test_public_reader_and_community_validation(self):
        with patch("app.api.routes.reddit_opinions.reddit_opinion_service.get", new=AsyncMock(return_value={"results": [], "community": "stocks", "fetchedAt": "2026-11-01T00:00:00Z"})) as get:
            response = self.client.get("/reddit-opinions?community=stocks")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["community"], "stocks")
            self.assertEqual(self.client.get("/reddit-opinions?community=https://evil.test").status_code, 422)
            get.assert_awaited_once_with("stocks")

    def test_upstream_errors_remain_generic(self):
        with patch("app.api.routes.reddit_opinions.reddit_opinion_service.get", new=AsyncMock(side_effect=httpx.ReadTimeout("private trace"))):
            response = self.client.get("/reddit-opinions")
            self.assertEqual(response.status_code, 502)
            self.assertNotIn("private", response.text)
