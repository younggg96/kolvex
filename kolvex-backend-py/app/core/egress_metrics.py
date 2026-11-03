"""Process-local traffic counters, emitted as bounded-cardinality JSON logs.

Never record query strings, credentials, user IDs, or response contents.
Decoded body bytes are an application estimate, not Supabase billing bytes.
"""
import asyncio
import json
import logging
import os
import threading
from collections import defaultdict

logger = logging.getLogger(__name__)


class TrafficMetrics:
    def __init__(self):
        self._lock = threading.Lock()
        self._values = defaultdict(lambda: defaultdict(int))

    def add(self, source, endpoint, **values):
        with self._lock:
            counters = self._values[(source, endpoint)]
            for name, value in values.items():
                counters[name] += value

    def snapshot(self, reset=False):
        with self._lock:
            rows = []
            for (source, endpoint), counters in self._values.items():
                row = dict(source=source, endpoint=endpoint, **counters)
                hits, misses = row.get("cache_hits", 0), row.get("cache_misses", 0)
                if hits + misses:
                    row["cache_hit_ratio"] = hits / (hits + misses)
                rows.append(row)
            if reset:
                self._values.clear()
            return rows


traffic_metrics = TrafficMetrics()


def instrument_postgrest(client):
    """Attach to the pinned supabase-py 2.7 / postgrest 0.16 HTTPX session."""
    def endpoint(request):
        # Only table/RPC names; never query filters or private row identifiers.
        parts = request.url.path.split("/rest/v1/", 1)[-1].strip("/").split("/")
        return "/".join(parts[:2] if parts[0] == "rpc" else parts[:1])

    def requested(request):
        traffic_metrics.add("supabase", endpoint(request), requests=1)

    def responded(response):
        body = response.read()
        traffic_metrics.add("supabase", endpoint(response.request), responses=1,
                            response_bytes=len(body), errors=int(response.status_code >= 400))

    hooks = client.postgrest.session.event_hooks
    hooks.setdefault("request", []).append(requested)
    hooks.setdefault("response", []).append(responded)
    return client


def log_traffic_metrics():
    for row in traffic_metrics.snapshot(reset=True):
        logger.info("egress_metrics %s", json.dumps({"pid": os.getpid(), **row}, sort_keys=True))


async def run_traffic_reporter():
    try:
        while True:
            await asyncio.sleep(60)
            log_traffic_metrics()
    finally:
        log_traffic_metrics()


class RequestMetricsMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        size, status = 0, 500

        async def measured(message):
            nonlocal size, status
            if message["type"] == "http.response.start":
                status = message["status"]
            elif message["type"] == "http.response.body":
                size += len(message.get("body", b""))
            await send(message)

        try:
            await self.app(scope, receive, measured)
        finally:
            route = scope.get("route")
            traffic_metrics.add("api", scope.get("state", {}).get("public_cache_endpoint") or getattr(route, "path", "unmatched"), requests=1,
                                response_bytes=size, errors=int(status >= 400))
