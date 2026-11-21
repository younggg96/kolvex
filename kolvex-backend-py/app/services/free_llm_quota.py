"""Free weekly model allowance on the server's DeepSeek key.

A signed-in user who has not saved their own key for the chosen provider is
answered by FREE_MODEL on the server key, and every call is charged against a
weekly budget in yuan (FREE_LLM_WEEKLY_LIMIT_YUAN, default 1). Spend is the
real cost of each call, worked out from the token usage DeepSeek returns and
its published prices. Redis keeps the running total per user per Beijing week,
which every call checks; the table free_llm_usage_events keeps one row per
charged call, so spend can be audited, the Redis total rebuilt when Redis
loses it, and the limit enforced from the ledger alone when Redis is down (migration 20261121050000_free_llm_usage_events.sql).

The billed user is a context variable set by authentication
(app/api/dependencies/auth.py), so every model call made while serving a
signed-in request is metered, including background tasks started from it.
Work with no signed-in user (scheduled jobs, admin imports) is not metered.
"""

from __future__ import annotations

import asyncio
import logging
import math
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from langchain_core.callbacks import AsyncCallbackHandler

from app.core.config import settings

logger = logging.getLogger(__name__)

FREE_PROVIDER = "deepseek"
FREE_MODEL = "deepseek-flash"

BEIJING = ZoneInfo("Asia/Shanghai")
MICRO = 1_000_000  # spend is stored in millionths of a yuan

# USD per 1M tokens at peak hours, from https://api-docs.deepseek.com/quick_start/pricing
# (read 2026-11-20). Off-peak is half. Keep in step with the official page.
PEAK_USD_PER_M = {"cache_hit": 0.006, "cache_miss": 0.30, "output": 1.20}
# Peak: Mon-Fri 01:00-04:00 and 06:00-10:00 UTC. Chinese public holidays are
# off-peak on DeepSeek's side; they are charged at peak here, which only ever
# charges a user more than DeepSeek charges us, never less.
PEAK_UTC_HOURS = {1, 2, 3, 6, 7, 8, 9}

_billed_user: ContextVar[Optional[str]] = ContextVar("free_llm_billed_user", default=None)


class FreeQuotaExceeded(Exception):
    """The user's free allowance for this week is used up."""

    code = "free_quota_exceeded"


class FreeQuotaUnavailable(Exception):
    """Spend cannot be read, so the free model is refused rather than left unmetered."""

    code = "free_quota_unavailable"


class FreeTierNotSupported(Exception):
    """A feature that the free allowance does not cover was asked for without the user's own key."""

    code = "own_key_required"


def weekly_limit_micro() -> int:
    return round(settings.FREE_LLM_WEEKLY_LIMIT_YUAN * MICRO)


def bill_to(user_id: Optional[str]) -> None:
    """Meter model calls made from here on (in this request and tasks it starts) to user_id."""
    _billed_user.set(user_id)


def billed_user() -> Optional[str]:
    return _billed_user.get()


def is_peak(now: datetime) -> bool:
    utc = now.astimezone(timezone.utc)
    return utc.weekday() < 5 and utc.hour in PEAK_UTC_HOURS


def week_start(now: datetime) -> datetime:
    """Monday 00:00 Beijing time of the week containing now."""
    local = now.astimezone(BEIJING)
    return (local - timedelta(days=local.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def week_id(now: datetime) -> str:
    return week_start(now).strftime("%Y-%m-%d")


def spend_key(user_id: str, now: datetime) -> str:
    return f"free_llm_spend:{user_id}:{week_id(now)}"


def cost_micro_yuan(cache_hit: int, cache_miss: int, output: int, now: datetime) -> int:
    """Cost of one call, rounded up to the next millionth of a yuan."""
    factor = 1.0 if is_peak(now) else 0.5
    usd = (
        (
            cache_hit * PEAK_USD_PER_M["cache_hit"]
            + cache_miss * PEAK_USD_PER_M["cache_miss"]
            + output * PEAK_USD_PER_M["output"]
        )
        * factor
        / 1_000_000
    )
    return math.ceil(usd * settings.FREE_LLM_USD_CNY * MICRO)


def usage_of(result: Any) -> Optional[tuple[int, int, int]]:
    """(cache_hit, cache_miss, output) tokens from an LLMResult, or None when absent."""
    for batch in getattr(result, "generations", None) or []:
        for generation in batch:
            usage = getattr(getattr(generation, "message", None), "usage_metadata", None)
            if usage:
                prompt = int(usage.get("input_tokens") or 0)
                hit = int((usage.get("input_token_details") or {}).get("cache_read") or 0)
                return hit, max(prompt - hit, 0), int(usage.get("output_tokens") or 0)
    raw = (getattr(result, "llm_output", None) or {}).get("token_usage") or {}
    if raw:
        prompt = int(raw.get("prompt_tokens") or 0)
        hit = int(raw.get("prompt_cache_hit_tokens") or 0)
        return hit, max(prompt - hit, 0), int(raw.get("completion_tokens") or 0)
    return None


USAGE_FIELDS = (
    "cost_micro_yuan",
    "cache_hit_tokens",
    "cache_miss_tokens",
    "output_tokens",
    "calls",
)
SPEND_TTL_SECONDS = int(timedelta(days=8).total_seconds())  # a day past the week


def _store():
    from app.core.redis import get_redis

    return get_redis()


class Ledger:
    """free_llm_usage_events through the service client (the table is backend-only)."""

    def _db(self):
        from app.core.supabase import get_supabase_service

        return get_supabase_service()

    async def insert(self, row: dict) -> bool:
        try:
            await asyncio.to_thread(
                lambda: self._db().table("free_llm_usage_events").insert(row).execute()
            )
            return True
        except Exception:
            logger.exception("Free model ledger row for %s was not saved", row.get("user_id"))
            return False

    async def week_usage(self, user_id: str, week: str) -> Optional[dict]:
        """{cost_micro_yuan, cache_hit_tokens, cache_miss_tokens, output_tokens, calls}, or None."""
        try:
            result = await asyncio.to_thread(
                lambda: self._db()
                .rpc("free_llm_week_usage", {"p_user_id": user_id, "p_week_start": week})
                .execute()
            )
            row = (result.data or [{}])[0]
            return {key: int(row.get(key) or 0) for key in USAGE_FIELDS}
        except Exception:
            logger.exception("Free model ledger totals for %s could not be read", user_id)
            return None

    async def week_spend(self, user_id: str, week: str) -> Optional[int]:
        usage = await self.week_usage(user_id, week)
        return None if usage is None else usage["cost_micro_yuan"]


_default_ledger = Ledger()


def _ledger() -> Ledger:
    return _default_ledger


async def spent_micro(user_id: str, now: Optional[datetime] = None, store=None, ledger=None) -> int:
    """This week's spend. Raises FreeQuotaUnavailable when it cannot be read.

    Redis is a fast copy of the ledger total. A missing Redis total (a new week, or Redis lost
    its data) is rebuilt from the ledger, and without Redis the ledger is read directly.
    """
    now = now or datetime.now(timezone.utc)
    store = store or _store()
    ledger = ledger or _ledger()
    if not store.is_connected:
        total = await ledger.week_spend(user_id, week_id(now))
        if total is None:
            raise FreeQuotaUnavailable()
        return total
    key = spend_key(user_id, now)
    value = await store.get(key)
    if value is not None:
        return int(value)
    total = await ledger.week_spend(user_id, week_id(now))
    if total is None:
        raise FreeQuotaUnavailable()
    # Only if still absent: a call finishing meanwhile has already added its own spend.
    await store.set_if_absent(key, total, SPEND_TTL_SECONDS)
    return total


async def ensure_allowance(
    user_id: str, now: Optional[datetime] = None, store=None, ledger=None
) -> None:
    if await spent_micro(user_id, now, store, ledger) >= weekly_limit_micro():
        raise FreeQuotaExceeded()


async def record_spend(
    user_id: str,
    amount: int,
    now: Optional[datetime] = None,
    store=None,
    *,
    ledger=None,
    usage: Optional[tuple[int, int, int]] = None,
    estimated: bool = False,
) -> Optional[int]:
    """Add one call's cost to the week's total, writing its ledger row first."""
    now = now or datetime.now(timezone.utc)
    store = store or _store()
    ledger = ledger or _ledger()
    hit, miss, output = usage or (0, 0, 0)
    saved = await ledger.insert(
        {
            "user_id": user_id,
            "week_start": week_id(now),
            "model": FREE_MODEL,
            "cache_hit_tokens": hit,
            "cache_miss_tokens": miss,
            "output_tokens": output,
            "cost_micro_yuan": amount,
            "estimated": estimated,
            "peak": is_peak(now),
        }
    )
    if not saved:
        logger.error("Free model spend of %s µ¥ for %s is missing from the ledger", amount, user_id)
    if not store.is_connected:
        # The ledger row is the record; the next check reads the ledger total directly.
        return None
    key = spend_key(user_id, now)
    total = await store.incr(key, amount)
    if total is None:
        logger.error("Free model spend of %s µ¥ for %s was not added in Redis", amount, user_id)
        return None
    await store.expire(key, SPEND_TTL_SECONDS)
    if total == amount and saved:
        # This call created the key, so earlier spend this week (if Redis lost it) is missing.
        earlier = await ledger.week_spend(user_id, week_id(now))
        if earlier is not None and earlier > total:
            total = await store.incr(key, earlier - total) or total
    return total


async def allowance(user_id: str, now: Optional[datetime] = None, store=None, ledger=None) -> dict:
    """What the user is shown: the share of the week's allowance used and the real token counts.

    Money stays internal; the limit is enforced in yuan but users see tokens. Tokens come from
    the ledger and are None when it cannot be read (the share still comes from Redis).
    """
    now = now or datetime.now(timezone.utc)
    ledger = ledger or _ledger()
    used = await spent_micro(user_id, now, store, ledger)
    limit = weekly_limit_micro()
    week = await ledger.week_usage(user_id, week_id(now))
    tokens = None
    if week is not None:
        tokens = {
            "input_tokens": week["cache_hit_tokens"] + week["cache_miss_tokens"],
            "cached_input_tokens": week["cache_hit_tokens"],
            "output_tokens": week["output_tokens"],
            "model_calls": week["calls"],
        }
    return {
        "model": FREE_MODEL,
        # Rounded up so "100" only ever means spent and a single call never reads as 0.
        "used_percent": min(100, math.ceil(used * 100 / limit)) if limit else 100,
        "exhausted": used >= limit,
        "resets_at": (week_start(now) + timedelta(days=7)).isoformat(),
        "tokens": tokens,
    }


class FreeQuotaCallback(AsyncCallbackHandler):
    """Refuses a call once the week's allowance is spent, and charges each finished call."""

    raise_error = True

    def __init__(self, user_id: str):
        self.user_id = user_id
        self._prompt_chars: dict[Any, int] = {}

    async def on_chat_model_start(self, serialized, messages, *, run_id=None, **kwargs) -> None:
        await ensure_allowance(self.user_id)
        self._prompt_chars[run_id] = sum(
            len(str(message.content)) for batch in messages for message in batch
        )

    async def on_llm_end(self, response, *, run_id=None, **kwargs) -> None:
        now = datetime.now(timezone.utc)
        prompt_chars = self._prompt_chars.pop(run_id, 0)
        usage = usage_of(response)
        estimated = usage is None
        if usage is None:
            # Never let a call go uncharged: one token per character is above the real
            # count for both Chinese and English text.
            logger.error("Free model call for %s returned no token usage; estimating", self.user_id)
            output = sum(
                len(generation.text or "") for batch in response.generations for generation in batch
            )
            usage = (0, prompt_chars, output)
        await record_spend(
            self.user_id, cost_micro_yuan(*usage, now), now, usage=usage, estimated=estimated
        )

    async def on_llm_error(self, error, *, run_id=None, **kwargs) -> None:
        self._prompt_chars.pop(run_id, None)


# Shown in chat when a turn stops; the web and app translate by `code`.
FREE_QUOTA_MESSAGES = {
    FreeQuotaExceeded.code: "Your free AI allowance for this week is used up. "
    "It resets on Monday, or add your own API key in Settings.",
    FreeQuotaUnavailable.code: "The free AI allowance cannot be checked right now. Please try again later.",
}
