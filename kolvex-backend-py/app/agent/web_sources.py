"""Linkable pages a turn's tools returned, kept so the answer can list its sources.

web_search results carry the search query; other tools (news flashes, creator videos, X posts,
macro releases, the market calendar) are grouped by tool. Only http(s) links from tool output
are kept; the model never writes these fields.
"""

import json
from typing import Any, Iterator
from urllib.parse import urlparse

SNIPPET_LIMIT = 200
TITLE_LIMIT = 160
MAX_SOURCES = 40
MAX_DEPTH = 4

URL_KEYS = ("url", "link", "video_url", "source_url")
TITLE_KEYS = ("title", "video_title", "name_zh", "name_en", "source_name", "source")
SNIPPET_KEYS = ("content", "thesis", "summary", "text")
DATE_KEYS = ("published_date", "published_at", "time_utc", "date")


def _domain(url: str) -> str:
    return urlparse(url).netloc.lower().removeprefix("www.")


def _text(value: object, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit]


def _first(item: dict, keys: tuple[str, ...]) -> str:
    for key in keys:
        if item.get(key):
            return str(item[key])
    return ""


def _linked_items(value: object, depth: int = 0) -> Iterator[tuple[dict, str]]:
    """Every dict in the payload that holds an http(s) link, with that link."""
    if depth > MAX_DEPTH:
        return
    if isinstance(value, dict):
        for key in URL_KEYS:
            url = value.get(key)
            if isinstance(url, str) and urlparse(url).scheme in {"http", "https"} and _domain(url):
                yield value, url
                return
        for child in value.values():
            yield from _linked_items(child, depth + 1)
    elif isinstance(value, list):
        for child in value:
            yield from _linked_items(child, depth + 1)


def extract_web_sources(tool_name: str, output: object) -> list[dict[str, Any]]:
    """Linked items in one tool result, as {url, domain, title, snippet, query, tool, published_date?}."""
    text = getattr(output, "content", output)
    if not tool_name or not isinstance(text, str):
        return []
    try:
        payload = json.loads(text)
    except ValueError:
        return []
    if not isinstance(payload, (dict, list)):
        return []
    if isinstance(payload, dict) and payload.get("error"):
        return []

    query = str(payload.get("query") or "") if tool_name == "web_search" else ""
    sources: list[dict[str, Any]] = []
    for item, url in _linked_items(payload):
        title = _first(item, TITLE_KEYS)
        if not title and item.get("author"):
            title = f"@{item['author']}"
        if item.get("creator") and title:
            title = f"{item['creator']} · {title}"
        source: dict[str, Any] = {
            "url": url,
            "domain": _domain(url),
            "title": _text(title, TITLE_LIMIT) or _domain(url),
            "snippet": _text(_first(item, SNIPPET_KEYS), SNIPPET_LIMIT),
            "query": query,
            "tool": tool_name,
        }
        if date := _first(item, DATE_KEYS):
            source["published_date"] = date[:19]
        sources.append(source)
    return sources


def merge_web_sources(merged: dict[str, dict[str, Any]], sources: list[dict[str, Any]]) -> None:
    """Add sources by URL; the first call that found a page keeps it."""
    for source in sources:
        if len(merged) >= MAX_SOURCES:
            return
        merged.setdefault(source["url"], source)
