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


def test_ignores_other_tools_errors_and_garbage():
    assert extract_web_sources("get_stock_quote", PAYLOAD) == []
    assert extract_web_sources("web_search", json.dumps({"error": "x"})) == []
    assert extract_web_sources("web_search", "not json") == []


def test_merge_keeps_first_seen_url():
    merged: dict = {}
    merge_web_sources(merged, [{"url": "u", "title": "1"}])
    merge_web_sources(merged, [{"url": "u", "title": "2"}])
    assert merged["u"]["title"] == "1"
