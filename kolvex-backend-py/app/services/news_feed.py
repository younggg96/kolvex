"""Bounded, cached ingestion of FinancialJuice's public RSS feed.

RSS does not carry the website's editorial tags or real-time entitlement.
Only explicit $TICKER mentions are exposed as stock symbols.
"""
import asyncio
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit, urlunsplit
from xml.etree import ElementTree

import httpx

RSS_URL = "https://www.financialjuice.com/feed.ashx?xy=rss"
MAX_BYTES = 1_000_000
TTL = 60
MAX_STALE = 900


def parse_feed(payload: bytes) -> list[dict]:
    if len(payload) > MAX_BYTES or re.search(br"<!\s*(DOCTYPE|ENTITY)\b", payload, re.I):
        raise ValueError("Unsupported RSS document")
    # UTF-8 only: disallow encoded DTD declarations bypassing the byte check.
    text = payload.decode("utf-8-sig")
    root = ElementTree.fromstring(text)
    channel = root.find("channel")
    if root.tag != "rss" or channel is None:
        raise ValueError("Invalid RSS response")
    articles = {}
    for item in channel.findall("item")[:200]:
        title = (item.findtext("title") or "").removeprefix("FinancialJuice:").strip()
        raw_link = (item.findtext("link") or "").strip()
        try:
            url = urlsplit(raw_link)
            if url.scheme != "https" or url.hostname not in {"www.financialjuice.com", "financialjuice.com"} or url.username or url.password or url.port not in (None, 443):
                continue
            if not url.path.startswith("/News/"):
                continue
            link = urlunsplit((url.scheme, url.netloc, url.path, "", ""))
        except ValueError:
            continue
        if not title:
            continue
        published = None
        try:
            date = parsedate_to_datetime(item.findtext("pubDate") or "")
            published = int(date.replace(tzinfo=date.tzinfo or timezone.utc).timestamp())
        except (ValueError, TypeError, OverflowError):
            pass
        guid = (item.findtext("guid") or "").strip()
        article_id = "financialjuice:" + (guid if re.fullmatch(r"\d{1,24}", guid) else link)
        articles[article_id] = {
            "id": article_id, "title": title[:4000], "publisher": "FinancialJuice",
            "link": link, "publish_time": published,
            "symbols": sorted(set(re.findall(r"\$([A-Z][A-Z0-9]{0,5}(?:[.-][A-Z])?)\b", title))),
        }
    return sorted(articles.values(), key=lambda a: (a["publish_time"] or 0, a["id"]), reverse=True)[:100]


class NewsFeedService:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._cached = None
        self._fetched = 0.0
        self._retry_after = 0.0

    async def _download(self):
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            async with client.stream("GET", RSS_URL, headers={"Accept": "application/rss+xml, application/xml"}) as response:
                response.raise_for_status()
                chunks, size = [], 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise ValueError("RSS response too large")
                    chunks.append(chunk)
        return parse_feed(b"".join(chunks))

    async def get_feed(self):
        async with self._lock:
            now = time.monotonic()
            if self._cached is not None and now - self._fetched < TTL:
                return {**self._cached, "stale": False}
            if now < self._retry_after:
                if self._cached is not None and now - self._fetched < MAX_STALE:
                    return {**self._cached, "stale": True}
                raise RuntimeError("News temporarily unavailable")
            try:
                articles = await self._download()
            except (httpx.HTTPError, ValueError, ElementTree.ParseError, UnicodeError) as error:
                self._retry_after = time.monotonic() + TTL
                if self._cached is not None and now - self._fetched < MAX_STALE:
                    return {**self._cached, "stale": True}
                raise RuntimeError("News temporarily unavailable") from error
            self._fetched = time.monotonic()
            self._retry_after = 0.0
            self._cached = {
                "articles": articles,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "source": "FinancialJuice RSS", "delivery": "delayed",
                "refresh_seconds": TTL,
            }
            return {**self._cached, "stale": False}


news_feed_service = NewsFeedService()
