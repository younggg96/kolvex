"""Bounded public ApeWisdom snapshots; never receives account data."""
import asyncio
import html
import json
import math
import re
import time
from datetime import datetime, timezone
import httpx

COMMUNITIES = frozenset({"all-stocks", "wallstreetbets", "stocks", "investing", "options"})


def integer(value, nonnegative=True):
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        return None
    try:
        number = float(value)
        if not math.isfinite(number) or not number.is_integer() or abs(number) > 2**53 - 1 or (nonnegative and number < 0):
            return None
        return int(number)
    except (ValueError, OverflowError):
        return None


def parse_ranking(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
        raise ValueError("Invalid ranking")
    seen, rows = set(), []
    for value in payload["results"][:100]:
        if not isinstance(value, dict):
            raise ValueError("Invalid row")
        ticker, name = value.get("ticker"), value.get("name")
        rank, mentions, upvotes = integer(value.get("rank")), integer(value.get("mentions")), integer(value.get("upvotes"), False)
        if not isinstance(ticker, str) or not re.fullmatch(r"[A-Z0-9.^-]{1,20}", ticker) or ticker in seen or not isinstance(name, str) or not name.strip() or not rank or mentions is None or upvotes is None:
            raise ValueError("Invalid ranking values")
        seen.add(ticker)
        rows.append({"rank": rank, "ticker": ticker, "name": html.unescape(name), "mentions": mentions, "upvotes": upvotes,
                     "previousRank": integer(value.get("rank_24h_ago")) or None, "previousMentions": integer(value.get("mentions_24h_ago"))})
    return sorted(rows, key=lambda row: row["rank"])


class RedditOpinionService:
    def __init__(self):
        self.snapshots = {}
        self.fetched = {}
        self.locks = {name: asyncio.Lock() for name in COMMUNITIES}

    async def _download(self, community):
        async with httpx.AsyncClient(timeout=12, follow_redirects=False) as client:
            async with client.stream("GET", f"https://apewisdom.io/api/v1.0/filter/{community}/page/1", headers={"Accept": "application/json"}) as response:
                response.raise_for_status()
                chunks, size = [], 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > 1_000_000:
                        raise ValueError("Ranking too large")
                    chunks.append(chunk)
        return parse_ranking(json.loads(b"".join(chunks)))

    async def get(self, community):
        if community not in COMMUNITIES:
            raise ValueError("Unsupported community")
        async with self.locks[community]:
            if community in self.snapshots and time.monotonic() - self.fetched[community] < 300:
                return self.snapshots[community]
            result = {"results": await self._download(community), "community": community, "fetchedAt": datetime.now(timezone.utc).isoformat()}
            self.snapshots[community] = result
            self.fetched[community] = time.monotonic()
            return result


reddit_opinion_service = RedditOpinionService()
