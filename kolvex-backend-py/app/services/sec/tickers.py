"""CUSIP -> US ticker via OpenFIGI's free mapping API, cached permanently.

13F information tables identify securities by CUSIP only. OpenFIGI allows 25
requests per minute (10 CUSIPs each) without a key, or 25 per 6 seconds (100
each) with OPENFIGI_API_KEY. Requests that would exceed the window are left to
a background fill instead of making the caller wait.
"""
import asyncio
import logging
import os
import re
import time
from collections import deque

import httpx

from app.core.redis import get_redis

logger = logging.getLogger(__name__)
URL = "https://api.openfigi.com/v3/mapping"
CACHE_KEY = "sec:cusip-tickers:v1"
CACHE_TTL = 90 * 86400
MISS_RETRY = 30 * 86400
CUSIP = re.compile(r"^[0-9A-Z]{8}[0-9]$")


def normalize_ticker(value):
    """OpenFIGI writes share classes as BRK/B; quotes and logos use BRK.B."""
    ticker = (value or "").strip().upper().replace("/", ".")
    return ticker if re.fullmatch(r"[A-Z][A-Z0-9.\-]{0,9}", ticker) else None


def pick_ticker(result):
    rows = (result or {}).get("data") or []
    preferred = [r for r in rows if r.get("marketSector") == "Equity"] or rows
    for row in preferred:
        ticker = normalize_ticker(row.get("ticker"))
        if ticker:
            return ticker
    return None


class CusipTickers:
    def __init__(self, key=None, transport=None):
        self.key = os.getenv("OPENFIGI_API_KEY", "") if key is None else key
        self._transport = transport
        self.batch = 100 if self.key else 10
        self.window = 6.0 if self.key else 60.0
        self.limit = 25
        self._sent = deque()
        self._map = None  # cusip -> [ticker | None, resolved_at]
        self._load = asyncio.Lock()
        self._send = asyncio.Lock()
        self._pending = set()
        self._task = None

    async def _cache(self):
        if self._map is None:
            async with self._load:
                if self._map is None:
                    try:
                        self._map = await get_redis().get_json(CACHE_KEY) or {}
                    except Exception:
                        self._map = {}
        return self._map

    async def _save(self):
        try:
            await get_redis().set_json(CACHE_KEY, self._map, ttl=CACHE_TTL)
        except Exception:
            logger.debug("CUSIP ticker cache not persisted", exc_info=True)

    def _room(self):
        now = time.monotonic()
        while self._sent and now - self._sent[0] >= self.window:
            self._sent.popleft()
        return self.limit - len(self._sent)

    async def _request(self, cusips):
        headers = {"Content-Type": "application/json"}
        if self.key:
            headers["X-OPENFIGI-APIKEY"] = self.key
        self._sent.append(time.monotonic())
        async with httpx.AsyncClient(timeout=15.0, transport=self._transport) as client:
            response = await client.post(URL, headers=headers, json=[{"idType": "ID_CUSIP", "idValue": c, "exchCode": "US"} for c in cusips])
        if response.status_code == 429:
            # Treat the window as spent so neither path retries immediately.
            self._sent.extend([time.monotonic()] * self.limit)
            return False
        response.raise_for_status()
        now = int(time.time())
        for cusip, result in zip(cusips, response.json()):
            self._map[cusip] = [pick_ticker(result), now]
        return True

    def _unknown(self, cusips):
        now = time.time()
        seen, result = set(), []
        for cusip in cusips:
            cusip = (cusip or "").upper()
            if not CUSIP.match(cusip) or cusip in seen:
                continue
            seen.add(cusip)
            hit = self._map.get(cusip)
            if hit is None or (hit[0] is None and now - hit[1] > MISS_RETRY):
                result.append(cusip)
        return result

    def remember(self, known):
        """Seeds the cache with tickers known elsewhere (the stored holdings) so they are never re-requested."""
        if self._map is None or not known:
            return
        now = int(time.time())
        for cusip, ticker in known.items():
            hit = self._map.get(cusip)
            if ticker and (hit is None or hit[0] is None):
                self._map[cusip] = [ticker, now]

    def pending(self, cusips):
        """CUSIPs not yet sent to OpenFIGI (or due for a retry)."""
        return self._unknown(cusips) if self._map is not None else [c for c in cusips if c]

    async def load(self):
        await self._cache()

    async def resolve(self, cusips, wait=False):
        """Map what the rate window allows now (or everything, when wait=True).

        The send lock covers one request at a time and is never held while waiting for the
        window, so a caller that cannot wait is never stuck behind a background fill."""
        await self._cache()
        todo = self._unknown(cusips)
        changed = False
        for start in range(0, len(todo), self.batch):
            while True:
                async with self._send:
                    if self._room() > 0:
                        batch = [c for c in todo[start:start + self.batch] if c not in self._map]
                        try:
                            changed = (await self._request(batch) if batch else False) or changed
                            sent = True
                        except (httpx.HTTPError, ValueError):
                            logger.warning("OpenFIGI mapping failed", exc_info=True)
                            sent = None
                        break
                    pause = max(0.5, self.window - (time.monotonic() - self._sent[0])) if self._sent else self.window
                if not wait:
                    sent = None
                    break
                await asyncio.sleep(pause)
            if sent is None:
                break
        if changed:
            await self._save()
        return {c: self._map[c][0] for c in cusips if c and c in self._map}

    def fill_later(self, cusips):
        """Resolve the remainder without holding up the response."""
        self._pending.update(c for c in cusips if c)
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._drain())

    async def _drain(self):
        while self._pending:
            batch = list(self._pending)[: self.batch * 5]
            self._pending.difference_update(batch)
            try:
                await self.resolve(batch, wait=True)
            except Exception:
                logger.warning("Background CUSIP mapping stopped", exc_info=True)
                return

    async def attach(self, holdings, now=100):
        """Adds `ticker` to each holding; the largest `now` are mapped before returning."""
        ordered = sorted(holdings, key=lambda r: r.get("value") or 0, reverse=True)
        await self.resolve([r.get("cusip") for r in ordered[:now]])
        cache = self._map or {}
        for row in holdings:
            row["ticker"] = (cache.get((row.get("cusip") or "").upper()) or [None])[0]
        missing = self._unknown(r.get("cusip") for r in holdings)
        if missing:
            self.fill_later(missing)
        return holdings


cusip_tickers = CusipTickers()
