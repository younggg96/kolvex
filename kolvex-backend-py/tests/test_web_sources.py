import json

from app.agent.web_sources import extract_web_sources, merge_web_sources

PAYLOAD = json.dumps(
    {
        "query": "hot stocks",
        "results": [
            {"title": "A", "url": "https://www.tradingview.com/x", "content": "c" * 500},
            {"title": "bad", "url": "javascript:alert(1)", "content": ""},
            {
                "title": "",
                "url": "https://reuters.com/y",
                "content": "d",
                "published_date": "2026-11-20",
            },
        ],
    }
)


def test_extracts_only_http_pages_with_domain_and_clipped_snippet():
    rows = extract_web_sources("web_search", PAYLOAD)
    assert [r["domain"] for r in rows] == ["tradingview.com", "reuters.com"]
    assert len(rows[0]["snippet"]) == 200
    assert rows[1]["title"] == "reuters.com"
    assert rows[1]["published_date"] == "2026-11-20"
    assert rows[0]["query"] == "hot stocks"
    assert rows[0]["tool"] == "web_search"


def test_kolvex_tools_with_links_become_sources():
    news = json.dumps(
        {
            "headlines": [
                {
                    "title": "Fed holds",
                    "link": "https://financialjuice.com/a",
                    "time_utc": "2026-11-22 10:00",
                }
            ]
        }
    )
    creator = json.dumps(
        {
            "opinions": [
                {
                    "creator": "Meet Kevin",
                    "video_title": "NVDA after earnings",
                    "video_url": "https://www.youtube.com/watch?v=1",
                    "thesis": "Still bullish",
                }
            ]
        }
    )
    buzz = json.dumps(
        {"latest_posts": [{"author": "someone", "text": "$NVDA", "url": "https://x.com/s/1"}]}
    )

    [n] = extract_web_sources("search_news_flashes", news)
    assert (n["title"], n["query"], n["tool"]) == ("Fed holds", "", "search_news_flashes")
    [c] = extract_web_sources("get_creator_opinions", creator)
    assert c["title"] == "Meet Kevin · NVDA after earnings"
    assert c["domain"] == "youtube.com" and c["snippet"] == "Still bullish"
    [b] = extract_web_sources("get_market_buzz", buzz)
    assert b["title"] == "@someone" and b["snippet"] == "$NVDA"


def test_ignores_linkless_errors_and_garbage():
    assert extract_web_sources("get_stock_quote", json.dumps({"price": 1})) == []
    assert extract_web_sources("web_search", json.dumps({"error": "x"})) == []
    assert extract_web_sources("web_search", "not json") == []


def test_merge_keeps_first_seen_url():
    merged: dict = {}
    merge_web_sources(merged, [{"url": "u", "title": "1"}])
    merge_web_sources(merged, [{"url": "u", "title": "2"}])
    assert merged["u"]["title"] == "1"
