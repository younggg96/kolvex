"""Pages a turn's web_search calls returned, kept so the answer can list its sources."""

import json
from typing import Any
from urllib.parse import urlparse

SNIPPET_LIMIT = 200
MAX_SOURCES = 40


def _domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host.removeprefix("www.")


def extract_web_sources(tool_name: str, output: object) -> list[dict[str, Any]]:
    """Results of one web_search call, as {url, domain, title, snippet, query, published_date}."""
    if tool_name != "web_search":
        return []
    text = getattr(output, "content", output)
    if not isinstance(text, str):
        return []
    try:
        payload = json.loads(text)
    except ValueError:
        return []
    if not isinstance(payload, dict) or payload.get("error"):
        return []

    query = str(payload.get("query") or "")
    sources: list[dict[str, Any]] = []
    for item in payload.get("results") or []:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "")
        # Only real web pages are listed; the model never writes these fields.
        if urlparse(url).scheme not in {"http", "https"} or not _domain(url):
            continue
        source: dict[str, Any] = {
            "url": url,
            "domain": _domain(url),
            "title": str(item.get("title") or "").strip() or _domain(url),
            "snippet": str(item.get("content") or "").strip()[:SNIPPET_LIMIT],
            "query": query,
        }
        if item.get("published_date"):
            source["published_date"] = str(item["published_date"])
        sources.append(source)
    return sources


def merge_web_sources(merged: dict[str, dict[str, Any]], sources: list[dict[str, Any]]) -> None:
    """Add sources by URL; the first call that found a page keeps it."""
    for source in sources:
        if len(merged) >= MAX_SOURCES:
            return
        merged.setdefault(source["url"], source)
