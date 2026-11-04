"""Bounded per-process cache for explicitly public GETs only.

Personal history, jobs, AI generation and all other endpoints always bypass it.
No browser/CDN caching is enabled. Concurrent misses share one upstream read.
"""
import asyncio
import hashlib
import re
from time import monotonic
from collections import OrderedDict

from app.core.egress_metrics import traffic_metrics


class PublicReadCacheMiddleware:
    MAX_ENTRIES = 128
    MAX_BYTES = 16 * 1024 * 1024
    MAX_BODY = 2 * 1024 * 1024
    PUBLIC = (
        (re.compile(r"^/api/v1/youtube-opinions/(dashboard|videos)$"), "youtube_opinions", 60),
        (re.compile(r"^/api/v1/youtube-opinions/stocks/[^/]+$"), "youtube_stock", 60),
        (re.compile(r"^/api/v1/youtube-opinions/creators/[^/]+/latest-video$"), "youtube_video", 60),
        (re.compile(r"^/api/v1/market/news/[A-Za-z0-9.\-^=]{1,20}$"), "stock_news", 60),
        (re.compile(r"^/api/v1/market/history/[A-Za-z0-9.\-^=]{1,20}$"), "stock_history", 60),
        (re.compile(r"^/api/v1/market/intraday/[A-Za-z0-9.\-^=]{1,20}$"), "stock_intraday", 30),
        (re.compile(r"^/api/v1/x-content/(creators|posts|summaries)$"), "x_content", 60),
    )

    def __init__(self, app):
        self.app = app
        self._entries = OrderedDict()
        self._bytes = 0
        self._generation = 0
        self._locks = [asyncio.Lock() for _ in range(32)]

    def _get(self, key):
        entry = self._entries.get(key)
        if entry is not None:
            if entry[0] > monotonic():
                self._entries.move_to_end(key)
                return entry
            self._bytes -= len(self._entries.pop(key)[2])
        return None

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope["path"]
        if (scope["method"] == "POST" and path in ("/api/v1/x-content/creators", "/api/v1/x-content/upload")) or (
            scope["method"] in ("POST", "PATCH", "DELETE") and path.startswith("/api/v1/youtube-opinions/")
        ):
            async def invalidate(message):
                if message["type"] == "http.response.start" and 200 <= message["status"] < 300:
                    self._generation += 1
                    self._entries.clear()
                    self._bytes = 0
                await send(message)
            return await self.app(scope, receive, invalidate)
        policy = next(((label, ttl) for pattern, label, ttl in self.PUBLIC if pattern.fullmatch(path)), None)
        if scope["method"] != "GET" or policy is None or len(scope.get("query_string", b"")) > 2048:
            return await self.app(scope, receive, send)
        label, ttl = policy
        # These handlers return the same public data irrespective of session headers.
        # Include the complete query so filters and pagination never share entries.
        key = hashlib.sha256(path.encode() + b"?" + scope.get("query_string", b"")).digest()
        scope.setdefault("state", {})["public_cache_endpoint"] = label
        async with self._locks[int.from_bytes(key[:2], "big") % len(self._locks)]:
            entry = self._get(key)
            if entry is not None:
                _, headers, body = entry
                traffic_metrics.add("cache", label, cache_hits=1)
                await send({"type": "http.response.start", "status": 200,
                            "headers": headers + [(b"x-server-cache", b"HIT")]})
                return await send({"type": "http.response.body", "body": body})
            traffic_metrics.add("cache", label, cache_misses=1)
            generation = self._generation
            headers, chunks, size, eligible, complete = [], [], 0, False, False

            async def capture(message):
                nonlocal headers, size, eligible, complete
                if message["type"] == "http.response.start":
                    headers = list(message.get("headers", []))
                    eligible = message["status"] == 200 and not any(
                        k.lower() in (b"set-cookie", b"vary") or
                        (k.lower() == b"cache-control" and (b"private" in v.lower() or b"no-store" in v.lower()))
                        for k, v in headers
                    )
                    message = {**message, "headers": headers + [(b"x-server-cache", b"MISS")]}
                elif message["type"] == "http.response.body":
                    size += len(message.get("body", b""))
                    if eligible and size <= self.MAX_BODY:
                        chunks.append(message.get("body", b""))
                    else:
                        eligible = False
                        chunks.clear()
                    complete = not message.get("more_body", False)
                await send(message)

            await self.app(scope, receive, capture)
            if eligible and complete and generation == self._generation:
                body = b"".join(chunks)
                while self._entries and (len(self._entries) >= self.MAX_ENTRIES or self._bytes + len(body) > self.MAX_BYTES):
                    self._bytes -= len(self._entries.popitem(last=False)[1][2])
                self._entries[key] = (monotonic() + ttl, headers, body)
                self._bytes += len(body)
