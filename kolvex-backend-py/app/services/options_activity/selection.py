"""Picks the symbols one options-activity run scans.

The fixed core watchlist is always scanned; it is the only part whose market
totals are compared with earlier runs. On top of it each run adds symbols that
are in play right now:

- earnings: largest companies reporting within the next week (Yahoo earnings calendar)
- mover:  biggest moves of the latest session (Yahoo gainers/losers)
- active: highest volume versus their 3-month average (Yahoo most actives)
- kol:    most discussed by creators (Reddit ranking, X cashtags, YouTube opinions)

Every source is optional: if one fails the run goes ahead with the others.
"""

import asyncio
import logging
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable, Optional, Union

from app.services.options_activity.universe import (
    ACTIVE_LIMIT,
    EARNINGS_DAYS,
    EARNINGS_LIMIT,
    EARNINGS_MIN_MARKET_CAP,
    KOL_LIMIT,
    KOL_MIN_CREATORS,
    KOL_MIN_PLATFORMS,
    KOL_WINDOW_DAYS,
    MANUAL_LIMIT,
    MAX_UNIVERSE,
    MIN_DOLLAR_VOLUME,
    MOVERS_LIMIT,
    UNIVERSE,
)

logger = logging.getLogger(__name__)
# US option underlyings: plain 1-5 letter tickers. Skips class shares (BRK.B), foreign listings (9984.T).
OPTIONABLE = re.compile(r"[A-Z]{1,5}")
SOURCE_TIMEOUT = 20
KOL_PLATFORMS = ("reddit", "x", "youtube")
# Foreign OTC lines (TCEHY, BABAF) duplicate a US listing or have thin options.
OTC_FOREIGN = re.compile(r"[A-Z]{4}[FY]")

# Market sources return ranked tickers; KOL sources return ranked (ticker, distinct creators).
Pick = Union[str, tuple[str, int]]
Fetch = Callable[[], Awaitable[list[Pick]]]


def _symbol(value) -> Optional[str]:
    symbol = (value or "").strip().upper().removeprefix("$")
    return symbol if OPTIONABLE.fullmatch(symbol) else None


def _clean(picks: list[Pick]) -> list[tuple[str, int]]:
    """Valid, de-duplicated (symbol, creators) in rank order. Plain tickers count as one creator."""
    out: dict[str, int] = {}
    for pick in picks:
        ticker, creators = pick if isinstance(pick, tuple) else (pick, 1)
        symbol = _symbol(ticker)
        if symbol and symbol not in out:
            out[symbol] = creators
    return list(out.items())


def interleave(*lists: list[str]) -> list[str]:
    """Round-robin merge so no single platform fills the whole KOL slot."""
    merged: list[str] = []
    for i in range(max((len(l) for l in lists), default=0)):
        for l in lists:
            if i < len(l) and l[i] not in merged:
                merged.append(l[i])
    return merged


def kol_picks(by_platform: dict[str, list[tuple[str, int]]]) -> list[str]:
    """Creator-discussed tickers confirmed by several platforms or several creators."""
    platforms: dict[str, int] = defaultdict(int)
    creators: dict[str, int] = defaultdict(int)
    for name in KOL_PLATFORMS:
        for symbol, count in by_platform.get(name, []):
            platforms[symbol] += 1
            if name != "reddit":  # ApeWisdom counts mentions, not distinct people
                creators[symbol] = max(creators[symbol], count)
    confirmed = {s for s in platforms if platforms[s] >= KOL_MIN_PLATFORMS or creators[s] >= KOL_MIN_CREATORS}
    ranked = [[s for s, _ in by_platform.get(name, []) if s in confirmed] for name in KOL_PLATFORMS]
    return interleave(*ranked)


# ---- sources -----------------------------------------------------------------

async def _discovery() -> dict:
    from app.services.stock_discovery import get_stock_discovery

    return await asyncio.to_thread(get_stock_discovery)


def liquid(items: list[dict]) -> list[str]:
    return [i["symbol"] for i in items if (i.get("price") or 0) * (i.get("volume") or 0) >= MIN_DOLLAR_VOLUME]


async def fetch_movers() -> list[Pick]:
    return liquid((await _discovery())["movers"]["items"])  # sorted by |change %|


async def fetch_active() -> list[Pick]:
    return liquid((await _discovery())["active"]["items"])  # sorted by volume multiple


def earnings_picks(rows: list[dict], now: datetime) -> list[str]:
    """US listings that report after `now` and within EARNINGS_DAYS, largest market cap first.
    rows: {symbol, market_cap, starts_at (aware datetime)} from the earnings calendar."""
    end = now + timedelta(days=EARNINGS_DAYS)
    upcoming = [
        r for r in rows
        if isinstance(r.get("symbol"), str) and not OTC_FOREIGN.fullmatch(r["symbol"])
        and isinstance(r.get("starts_at"), datetime) and now < r["starts_at"] <= end
        and (r.get("market_cap") or 0) >= EARNINGS_MIN_MARKET_CAP
    ]
    return [r["symbol"] for r in sorted(upcoming, key=lambda r: -r["market_cap"])]


async def fetch_earnings(now: Optional[datetime] = None) -> list[Pick]:
    now = now or datetime.now(timezone.utc)

    def load() -> list[dict]:
        import yfinance as yf

        calendar = yf.Calendars(start=now.date(), end=(now + timedelta(days=EARNINGS_DAYS + 1)).date())
        frame = calendar.get_earnings_calendar(market_cap=EARNINGS_MIN_MARKET_CAP, filter_most_active=False, limit=100)
        if frame is None or frame.empty:
            return []
        return [
            {"symbol": symbol, "market_cap": row.get("Marketcap"), "starts_at": row.get("Event Start Date")}
            for symbol, row in frame.iterrows()
        ]

    rows = await asyncio.to_thread(load)
    for row in rows:  # pandas Timestamps -> plain aware datetimes
        if hasattr(row["starts_at"], "to_pydatetime"):
            row["starts_at"] = row["starts_at"].to_pydatetime()
    return earnings_picks(rows, now)


async def fetch_reddit() -> list[Pick]:
    from app.services.reddit_opinions import reddit_opinion_service

    ranking = await reddit_opinion_service.get("all-stocks")
    return [row["ticker"] for row in ranking["results"]]


def _db():
    from app.core.supabase import get_supabase_service

    return get_supabase_service()


async def fetch_x(db=None) -> list[Pick]:
    from app.services.x_content import XContentService

    heat = await asyncio.to_thread(XContentService(db or _db()).ticker_heat, KOL_WINDOW_DAYS)
    return [(row["ticker"], row["authors"]) for row in heat["tickers"]]


async def fetch_youtube(db=None, now: Optional[datetime] = None) -> list[Pick]:
    since = (now or datetime.now(timezone.utc)) - timedelta(days=KOL_WINDOW_DAYS)
    query = ((db or _db()).table("youtube_stock_opinions").select("ticker,channel_id")
             .gte("video_published_at", since.isoformat()).neq("ticker", "").limit(5000))
    rows = (await asyncio.to_thread(query.execute)).data or []
    return rank_youtube(rows)


def rank_youtube(rows: list[dict]) -> list[tuple[str, int]]:
    """(ticker, distinct channels): more channels first, then more videos."""
    channels: dict[str, set] = defaultdict(set)
    videos: dict[str, int] = defaultdict(int)
    for row in rows:
        ticker = row.get("ticker")
        if ticker:
            channels[ticker].add(row.get("channel_id"))
            videos[ticker] += 1
    ranked = sorted(channels, key=lambda t: (-len(channels[t]), -videos[t], t))
    return [(t, len(channels[t])) for t in ranked]


DEFAULT_SOURCES: dict[str, Fetch] = {
    "earnings": fetch_earnings,
    "movers": fetch_movers,
    "active": fetch_active,
    "reddit": fetch_reddit,
    "x": fetch_x,
    "youtube": fetch_youtube,
}


# ---- selection ---------------------------------------------------------------

async def _safe(name: str, fetch: Fetch) -> list[tuple[str, int]]:
    try:
        return _clean(await asyncio.wait_for(fetch(), timeout=SOURCE_TIMEOUT))
    except Exception as exc:
        logger.warning("Options activity universe source %s unavailable: %s", name, exc)
        return []


def combine(
    core: tuple[str, ...], movers: list[str], active: list[str], kol: list[str], earnings: Optional[list[str]] = None,
) -> tuple[list[str], dict[str, list[str]]]:
    """Core first, then each dynamic group up to its own limit. Returns (symbols, sources per symbol).
    A symbol can carry several reasons (e.g. a core name that is also a top mover)."""
    sources: dict[str, list[str]] = {s: ["core"] for s in core}
    order = list(core)
    groups = (("earnings", earnings or [], EARNINGS_LIMIT), ("mover", movers, MOVERS_LIMIT),
              ("active", active, ACTIVE_LIMIT), ("kol", kol, KOL_LIMIT))
    for name, picks, limit in groups:
        added = 0
        for symbol in picks:
            if symbol in sources:
                if name not in sources[symbol]:
                    sources[symbol].append(name)
                continue
            if added >= limit or len(order) >= MAX_UNIVERSE:
                continue
            sources[symbol] = [name]
            order.append(symbol)
            added += 1
    return order, {s: sources[s] for s in order}


def parse_manual(raw: Optional[str]) -> list[str]:
    """Admin-typed symbols ("LLY, xom $NVDA"). Raises ValueError on an invalid or excess entry."""
    symbols: list[str] = []
    for token in re.split(r"[\s,，]+", raw or ""):
        if not token:
            continue
        symbol = _symbol(token)
        if not symbol:
            raise ValueError(f"invalid symbol: {token[:12]}")
        if symbol not in symbols:
            symbols.append(symbol)
    if len(symbols) > MANUAL_LIMIT:
        raise ValueError(f"at most {MANUAL_LIMIT} symbols")
    return symbols


def add_manual(symbols: list[str], sources: dict[str, list[str]], manual: list[str]) -> tuple[list[str], dict[str, list[str]]]:
    symbols, sources = list(symbols), {s: list(v) for s, v in sources.items()}
    for symbol in manual:
        if symbol in sources:
            if "manual" not in sources[symbol]:
                sources[symbol].append("manual")
        else:
            symbols.append(symbol)
            sources[symbol] = ["manual"]
    return symbols, sources


async def select_universe(fetchers: Optional[dict[str, Fetch]] = None) -> tuple[list[str], dict[str, list[str]]]:
    fetchers = {**DEFAULT_SOURCES, **(fetchers or {})}
    names = list(fetchers)
    results = dict(zip(names, await asyncio.gather(*(_safe(n, fetchers[n]) for n in names))))
    tickers = lambda name: [s for s, _ in results.get(name, [])]
    symbols, sources = combine(UNIVERSE, tickers("movers"), tickers("active"), kol_picks(results), tickers("earnings"))
    logger.info("Options activity universe: %d symbols (%d core)", len(symbols), len(UNIVERSE))
    return symbols, sources
