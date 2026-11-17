"""Pretranslate public X content and RSS headlines outside reader requests."""

import asyncio
import hashlib
import logging
import re
from collections.abc import Awaitable, Callable, Iterable
from urllib.parse import quote
from uuid import uuid4

import httpx

from app.core.redis import RedisService, get_redis
from app.core.supabase import get_supabase_service
from app.services.news_feed import news_feed_service

logger = logging.getLogger(__name__)
CACHE_TTL = 30 * 86400
RETRY_TTL = 300
MAX_TEXT_LENGTH = 5000
ENCODED_CHUNK_LIMIT = 6000
JOBS_PER_SOURCE = 12
ORIGINS = ("https://translate.googleapis.com", "https://translate.google.com")
IDENTIFIERS = re.compile(r"https?://[^\s]+|(?a:\$[A-Za-z][A-Za-z0-9.\-]{0,14}\b)")
PLACEHOLDER = re.compile(r"⟨([0-9]{1,5})⟩")
BROKEN_PLACEHOLDER = re.compile(r"⟨[0-9]*⟩?")


def translation_key(text: str) -> str | None:
    if len(text) > MAX_TEXT_LENGTH or not text.strip():
        return None
    digest = hashlib.sha256(text.encode()).hexdigest()
    return f"public_translation:v1:zh:{digest}"


def post_sources(post: dict) -> list[str]:
    return [post["text"], *(post.get("quoted_texts") or [])]


async def read_translations(
    cache: RedisService, keys: Iterable[str | None]
) -> dict[str, str | None]:
    # A slow cache should not hold up the public feed.
    try:
        async with asyncio.timeout(0.5):
            return await cache.mget(list(dict.fromkeys(key for key in keys if key is not None)))
    except TimeoutError:
        return {}


async def enrich_headlines(cache: RedisService, articles: list[dict]) -> list[dict]:
    keys = [translation_key(article["title"]) for article in articles]
    saved = await read_translations(cache, keys)
    return [
        {**article, "title_zh": saved[key]} if key and saved.get(key) else article
        for article, key in zip(articles, keys)
    ]


async def enrich_posts(cache: RedisService, posts: list[dict]) -> list[dict]:
    sources = [post_sources(post) for post in posts]
    keys = [[translation_key(text) for text in parts] for parts in sources]
    saved = await read_translations(cache, (key for row in keys for key in row))
    result = []
    for post, parts, row in zip(posts, sources, keys):
        translated = [
            saved.get(key) if key else (None if text.strip() else text)
            for text, key in zip(parts, row)
        ]
        if all(value is not None for value in translated):
            result.append(
                {**post, "translation_zh": {"text": translated[0], "quoted_texts": translated[1:]}}
            )
        else:
            result.append(post)
    return result


def chunks(text: str) -> Iterable[str]:
    start = 0
    while start < len(text):
        end = start
        size = 0
        boundary = start
        for match in re.finditer(r"⟨[0-9]+⟩|.", text[start:], re.DOTALL):
            token = match[0]
            size += len(quote(token, safe=""))
            if size > ENCODED_CHUNK_LIMIT:
                break
            end += len(token)
            if token.isspace() and size >= ENCODED_CHUNK_LIMIT // 2:
                boundary = end
        if end < len(text) and boundary > start:
            end = boundary
        yield text[start:end]
        start = end


async def translate_chunk(client: httpx.AsyncClient, text: str) -> str | None:
    for origin in ORIGINS:
        try:
            response = await client.get(
                f"{origin}/translate_a/single",
                params={"client": "gtx", "sl": "auto", "tl": "zh-CN", "dt": "t", "q": text},
            )
            response.raise_for_status()
            segments = response.json()[0]
            translated = "".join(
                item[0]
                for item in segments
                if isinstance(item, list) and item and isinstance(item[0], str)
            )
            if translated.strip():
                return translated.strip()
        except (httpx.HTTPError, ValueError, TypeError, IndexError, KeyError):
            continue
    return None


async def translate(client: httpx.AsyncClient, text: str) -> str | None:
    literals: list[str] = []

    def protect(match: re.Match[str]) -> str:
        literals.append(match[0])
        return f"⟨{len(literals) - 1}⟩"

    protected = IDENTIFIERS.sub(protect, text)
    results = []
    try:
        async with asyncio.timeout(12):
            for part in chunks(protected):
                source = part.strip()
                if not source:
                    results.append(part)
                    continue
                translated = await translate_chunk(client, source)
                if translated is None:
                    return None
                start = part.index(source)
                results.append(part[:start] + translated + part[start + len(source) :])
    except TimeoutError:
        return None

    # Strip broken placeholders before inserting original literal strings.
    translated = "".join(results)
    pieces = PLACEHOLDER.split(translated)
    restored = "".join(
        BROKEN_PLACEHOLDER.sub("", piece)
        if index % 2 == 0
        else (literals[int(piece)] if int(piece) < len(literals) else "")
        for index, piece in enumerate(pieces)
    )
    dropped = [literal for literal in dict.fromkeys(literals) if literal not in restored]
    return " ".join([restored.rstrip(), *dropped]).strip() or None


async def pretranslate(
    cache: RedisService, texts: Iterable[str], provider: Callable[[str], Awaitable[str | None]]
) -> None:
    sources = {key: text for text in texts if (key := translation_key(text)) is not None}
    retry_keys = {key: f"{key}:retry" for key in sources}
    saved = await cache.mget([*sources, *retry_keys.values()])
    work = [
        (key, text)
        for key, text in sources.items()
        if not saved.get(key) and not saved.get(retry_keys[key])
    ][:JOBS_PER_SOURCE]

    concurrency = asyncio.Semaphore(3)

    async def process(key: str, text: str) -> bool:
        async with concurrency:
            translated = await provider(text)
            if translated:
                return await cache.set(key, translated, CACHE_TTL)
            await cache.set(retry_keys[key], "retry", RETRY_TTL)
            return False

    results = await asyncio.gather(*(process(key, text) for key, text in work))
    if results:
        logger.info("Public translations prepared: %d/%d", sum(results), len(results))


def recent_post_sources() -> list[str]:
    response = (
        get_supabase_service()
        .table("x_posts")
        .select("text,quoted_texts")
        .order("published_at", desc=True)
        .order("id", desc=True)
        .limit(100)
        .execute()
    )
    return [part for post in response.data or [] for part in post_sources(post)]


async def recent_headlines() -> list[str]:
    feed = await news_feed_service.get_feed()
    return [article["title"] for article in feed["articles"]]


async def run_content_translation_worker() -> None:
    cache = get_redis()
    lease = "public_translation:worker"
    async with httpx.AsyncClient(timeout=5, follow_redirects=False) as client:

        async def provider(text: str) -> str | None:
            return await translate(client, text)

        async def prepare(load: Callable[[], Awaitable[list[str]]]) -> None:
            try:
                await pretranslate(cache, await load(), provider)
            except Exception:
                logger.exception("Public translation cycle failed for %s", load.__name__)

        async def load_posts() -> list[str]:
            return await asyncio.to_thread(recent_post_sources)

        while True:
            token = uuid4().hex
            if await cache.acquire_lock(lease, token, ttl=180):
                try:
                    async with asyncio.timeout(120):
                        await prepare(recent_headlines)
                        await prepare(load_posts)
                except TimeoutError:
                    logger.warning("Public translation cycle timed out")
                finally:
                    await cache.release_lock(lease, token)
            await asyncio.sleep(60)
