from unittest.mock import AsyncMock

import httpx
import pytest

from app.services.content_translation import enrich_headlines, enrich_posts, pretranslate, translate


class MemoryCache:
    def __init__(self):
        self.values = {}

    async def mget(self, keys):
        return {key: self.values.get(key) for key in keys}

    async def set(self, key, value, ttl):
        self.values[key] = value
        return True


@pytest.mark.asyncio
async def test_translates_once_and_enriches_only_matching_source():
    cache = MemoryCache()
    provider = AsyncMock(side_effect=["市场新闻", "股票上涨", "引用"])
    articles = [{"title": "Market news"}, {"title": "Market news"}]
    posts = [{"text": "Shares rise", "quoted_texts": ["Quote"]}]
    await pretranslate(cache, [item["title"] for item in articles], provider)
    await pretranslate(cache, ["Shares rise", "Quote"], provider)
    await pretranslate(cache, ["Shares rise", "Quote", "Market news"], provider)

    assert provider.await_count == 3
    enriched = await enrich_headlines(cache, articles)
    assert [item["title_zh"] for item in enriched] == ["市场新闻", "市场新闻"]
    assert "title_zh" not in articles[0]
    corrected = await enrich_headlines(cache, [{"title": "Corrected news"}])
    assert corrected == [{"title": "Corrected news"}]
    assert (await enrich_posts(cache, posts))[0]["translation_zh"] == {
        "text": "股票上涨",
        "quoted_texts": ["引用"],
    }
    assert "translation_zh" not in posts[0]


@pytest.mark.asyncio
async def test_reads_original_until_all_post_parts_are_available():
    cache = MemoryCache()
    provider = AsyncMock(side_effect=["股票上涨", None])
    posts = [{"text": "Shares rise", "quoted_texts": ["Quote"]}]
    await pretranslate(cache, ["Shares rise", "Quote"], provider)
    assert await enrich_posts(cache, posts) == posts
    await pretranslate(cache, ["Shares rise", "Quote"], provider)
    assert provider.await_count == 2

    # Simulate the retry cooldown expiring without discarding the body translation.
    cache.values = {key: value for key, value in cache.values.items() if value != "retry"}
    provider.side_effect = ["引用"]
    await pretranslate(cache, ["Shares rise", "Quote"], provider)
    assert provider.await_count == 3
    assert (await enrich_posts(cache, posts))[0]["translation_zh"]["quoted_texts"] == ["引用"]


@pytest.mark.asyncio
async def test_provider_fallback_preserves_cashtags_and_urls():
    origins = []

    def upstream(request):
        origins.append(request.url.host)
        if len(origins) == 1:
            return httpx.Response(429)
        assert request.url.params["q"] == "Buy ⟨0⟩ at ⟨1⟩"
        return httpx.Response(200, json=[[["买入 ⟨0⟩"]]])

    async with httpx.AsyncClient(transport=httpx.MockTransport(upstream)) as client:
        result = await translate(client, "Buy $ABC at https://example.com")
    assert result == "买入 $ABC https://example.com"
    assert origins == ["translate.googleapis.com", "translate.google.com"]


@pytest.mark.asyncio
async def test_public_routes_attach_prepared_translations_without_a_provider_request(monkeypatch):
    from fastapi import FastAPI

    from app.api.routes import news_feed, x_content

    cache = MemoryCache()
    provider = AsyncMock(side_effect=["市场新闻", "股价上涨"])
    await pretranslate(cache, ["Market news", "Shares rise"], provider)
    monkeypatch.setattr(news_feed, "get_redis", lambda: cache)
    monkeypatch.setattr(x_content, "get_redis", lambda: cache)
    monkeypatch.setattr(
        news_feed.news_feed_service,
        "get_feed",
        AsyncMock(return_value={"articles": [{"title": "Market news"}, {"title": "Untranslated"}]}),
    )

    class MockXService:
        def posts(self, author, ticker, limit, offset):
            return {"posts": [{"text": "Shares rise", "quoted_texts": []}], "total": 1}

    app = FastAPI()
    app.include_router(news_feed.router)
    app.include_router(x_content.router)
    app.dependency_overrides[x_content.get_service] = MockXService
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://example.test"
    ) as client:
        headlines = (await client.get("/news/feed")).json()["articles"]
        posts = (await client.get("/x-content/posts")).json()["posts"]
    assert headlines == [
        {"title": "Market news", "title_zh": "市场新闻"},
        {"title": "Untranslated"},
    ]
    assert posts == [
        {
            "text": "Shares rise",
            "quoted_texts": [],
            "translation_zh": {"text": "股价上涨", "quoted_texts": []},
        }
    ]
    assert provider.await_count == 2


@pytest.mark.asyncio
async def test_cache_timeout_returns_original_content():
    cache = MemoryCache()
    cache.mget = AsyncMock(side_effect=TimeoutError)
    assert await enrich_headlines(cache, [{"title": "Market news"}]) == [{"title": "Market news"}]
    assert await enrich_posts(cache, [{"text": "Shares rise"}]) == [{"text": "Shares rise"}]
