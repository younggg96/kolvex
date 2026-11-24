"""
Scan universe for Trade OS (PRD §7.2).

Four sources, merged and de-duplicated, each symbol keeping every source that named it:
  core     the original 25 liquid growth leaders
  sector   large liquid names across the other industries
  etf      non-leveraged, non-inverse ETFs (PRD §2.3, §7.3)
  youtube  stocks several KOL channels discussed in the last 7 days
  reddit   the Reddit mention ranking (ApeWisdom, via reddit_opinions)

core + sector + etf are fixed lists. youtube + reddit change every day, so they are
resolved when a scan starts. If one of them can't be fetched the scan still runs on the
others and reports which source is missing; nothing is substituted or invented.

Backtests use ONLY the fixed lists (``static_universe``): today's trending stocks are
today's winners, and replaying them over the past would be look-ahead bias (PRD §13.4).
Liquidity, price and trend filters in the scanner still apply to every symbol, so a
meme stock that fails them shows up as "filtered out" instead of being traded.
"""

import asyncio
import logging
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

CORE_STOCKS: Tuple[str, ...] = (
    "NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "AMD", "QCOM",
    "NFLX", "PLTR", "CRM", "AMAT", "MU", "LRCX", "PANW", "NOW", "UBER", "COIN",
    "ARM", "LLY", "ORCL", "ADBE", "INTU",
)  # fmt: skip

# Industry -> liquid large/mid caps. Shown to the user only as a source tag, not a score.
SECTOR_STOCKS: Dict[str, Tuple[str, ...]] = {
    "financials": ("JPM", "BAC", "GS", "MS", "WFC", "C", "SCHW", "BLK", "V", "MA", "AXP", "PYPL", "HOOD", "SOFI"),
    "healthcare": ("UNH", "JNJ", "ABBV", "MRK", "PFE", "TMO", "ISRG", "VRTX", "REGN", "AMGN", "GILD", "DHR", "BSX"),
    "consumer": ("COST", "WMT", "HD", "LOW", "MCD", "SBUX", "NKE", "LULU", "CMG", "TGT", "BKNG", "ABNB", "DIS"),
    "industrials": ("CAT", "DE", "GE", "HON", "UNP", "UPS", "LMT", "RTX", "BA", "ETN", "GEV"),
    "energy": ("XOM", "CVX", "COP", "SLB", "OXY", "EOG"),
    "materials": ("LIN", "FCX", "NEM", "SHW"),
    "utilities": ("NEE", "CEG", "VST", "SO"),
    "real_estate": ("PLD", "AMT", "EQIX"),
    "communication": ("T", "VZ", "TMUS", "SPOT", "RBLX"),
    "tech_other": ("INTC", "TXN", "TSM", "ASML", "SMCI", "CRWD", "FTNT", "ZS", "DDOG", "SNOW", "NET", "SHOP", "MSTR", "ANET", "MRVL", "KLAC", "CDNS", "SNPS", "WDAY"),
    "autos": ("F", "GM"),
}  # fmt: skip

# Non-leveraged, non-inverse. Exempt from the earnings filter (PRD §7.6).
ETFS: Tuple[str, ...] = (
    "SPY", "QQQ", "IWM", "DIA",
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLP", "XLI", "XLU", "XLB", "XLRE", "XLC",
    "SMH", "SOXX", "IGV", "CIBR", "IBB", "XBI", "KRE", "XHB", "ITA", "URA", "ARKK",
    "GLD", "SLV", "USO", "TLT", "HYG", "EEM", "EFA", "FXI", "VNQ",
)  # fmt: skip
ETF_SET = frozenset(ETFS)

# PRD excludes leveraged and inverse products. Reddit lists are full of them.
LEVERAGED_OR_INVERSE = frozenset(
    {
        "TQQQ", "SQQQ", "SOXL", "SOXS", "UPRO", "SPXU", "SPXS", "SDS", "SSO", "QLD", "QID",
        "UVXY", "SVXY", "VXX", "VIXY", "TNA", "TZA", "LABU", "LABD", "FNGU", "FNGD",
        "TSLL", "TSLQ", "TSLS", "NVDL", "NVDD", "NVDX", "NVDS", "CONL", "CONI", "MSTU", "MSTZ",
        "AMDL", "AAPU", "AAPD", "GGLL", "MSFU", "AMZU", "METAU", "BITX", "BITI", "SBIT",
        "ETHU", "ETHD", "YINN", "YANG", "NUGT", "DUST", "JNUG", "JDST", "UCO", "SCO",
        "BOIL", "KOLD", "TMF", "TMV", "TECL", "TECS", "FAS", "FAZ", "ARKG",
    }
)  # fmt: skip

# Reddit and YouTube tickers are scraped from cashtags, so ordinary words and acronyms
# show up as "tickers". Only applied to the trending sources; the fixed lists are curated.
NOISE_WORDS = frozenset(
    {"ALL", "AM", "CIA", "IT", "HR", "PR", "UP", "YOU", "MAGA", "NYT", "DTE", "ARE", "ON", "FOR",
     "NOW", "CAN", "HAS", "ONE", "OUT", "BIG", "NEW", "TOP", "USA", "CEO", "EPS", "IPO", "ATH", "DD"}
)  # fmt: skip

YOUTUBE_LIMIT = 30
REDDIT_LIMIT = 30
YOUTUBE_WINDOW_DAYS = 7
YOUTUBE_MIN_CHANNELS = 2  # one channel mentioning a ticker is not "hot"
MAX_UNIVERSE = 220
SOURCE_TIMEOUT = 25

TICKER = re.compile(r"[A-Z]{1,5}")
OTC_FOREIGN = re.compile(r"[A-Z]{4}[FY]")  # TCEHY, BABAF: duplicate a US listing

Fetch = Callable[[], Awaitable[List[Tuple[str, int]]]]


def is_etf(symbol: str) -> bool:
    return symbol.upper() in ETF_SET


def _clean(value: Any) -> Optional[str]:
    symbol = str(value or "").strip().upper().removeprefix("$")
    if not TICKER.fullmatch(symbol) or OTC_FOREIGN.fullmatch(symbol):
        return None
    if symbol in LEVERAGED_OR_INVERSE:
        return None
    return symbol


def sector_of(symbol: str) -> Optional[str]:
    for name, members in SECTOR_STOCKS.items():
        if symbol in members:
            return name
    return None


def static_universe() -> List[str]:
    """Fixed lists only, in a stable order. This is what backtests use."""
    seen: Dict[str, None] = {}
    for symbol in (
        *CORE_STOCKS,
        *(s for members in SECTOR_STOCKS.values() for s in members),
        *ETFS,
    ):
        seen.setdefault(symbol, None)
    return list(seen)


# ---- dynamic sources ---------------------------------------------------------


async def fetch_youtube_hot(
    db: Any = None, now: Optional[datetime] = None
) -> List[Tuple[str, int]]:
    """(ticker, distinct channels) from KOL videos in the last 7 days, most channels first."""
    from app.services.options_activity.selection import rank_youtube

    since = (now or datetime.now(timezone.utc)) - timedelta(days=YOUTUBE_WINDOW_DAYS)
    if db is None:
        from app.core.supabase import get_supabase_service

        db = get_supabase_service()
    query = (
        db.table("youtube_stock_opinions")
        .select("ticker,channel_id")
        .gte("video_published_at", since.isoformat())
        .neq("ticker", "")
        .limit(5000)
    )
    rows = (await asyncio.to_thread(query.execute)).data or []
    return [(t, n) for t, n in rank_youtube(rows) if n >= YOUTUBE_MIN_CHANNELS]


async def fetch_reddit_hot() -> List[Tuple[str, int]]:
    """Reddit mention ranking, best first. The count slot is the rank position."""
    from app.services.reddit_opinions import reddit_opinion_service

    ranking = await reddit_opinion_service.get("all-stocks")
    return [(row["ticker"], i + 1) for i, row in enumerate(ranking["results"])]


DEFAULT_FETCHERS: Dict[str, Fetch] = {"youtube": fetch_youtube_hot, "reddit": fetch_reddit_hot}
LIMITS = {"youtube": YOUTUBE_LIMIT, "reddit": REDDIT_LIMIT}


async def build_universe(fetchers: Optional[Dict[str, Fetch]] = None) -> Dict[str, Any]:
    """
    Returns {"symbols": [...], "sources": {symbol: [source, ...]}, "counts": {...},
    "errors": {source: message}}. A source that fails is listed in ``errors`` and skipped.
    """
    fetchers = DEFAULT_FETCHERS if fetchers is None else fetchers
    sources: Dict[str, List[str]] = defaultdict(list)

    def add(symbol: Optional[str], source: str) -> None:
        if symbol and source not in sources[symbol]:
            sources[symbol].append(source)

    for symbol in CORE_STOCKS:
        add(symbol, "core")
    for members in SECTOR_STOCKS.values():
        for symbol in members:
            add(symbol, "sector")
    for symbol in ETFS:
        add(symbol, "etf")

    errors: Dict[str, str] = {}

    async def run(name: str, fetch: Fetch) -> Tuple[str, List[Tuple[str, int]]]:
        try:
            return name, await asyncio.wait_for(fetch(), SOURCE_TIMEOUT)
        except Exception as err:  # noqa: BLE001 — a missing source is reported, never faked
            logger.warning("Universe source %s failed: %s", name, err)
            errors[name] = str(err)[:200] or err.__class__.__name__
            return name, []

    results = await asyncio.gather(*(run(n, f) for n, f in fetchers.items()))
    for name, picks in results:
        taken = 0
        for ticker, _count in picks:
            symbol = _clean(ticker)
            if symbol is None:
                continue
            # "NOW" and "ON" are also real stocks: keep them when a fixed list already has them.
            if symbol in NOISE_WORDS and symbol not in sources:
                continue
            add(symbol, name)
            taken += 1
            if taken >= LIMITS.get(name, 30):
                break

    ordered = sorted(sources, key=lambda s: (_rank(sources[s]), s))
    if len(ordered) > MAX_UNIVERSE:
        # Fixed lists are never dropped; trim trending-only names last-ranked first.
        keep = [s for s in ordered if set(sources[s]) & {"core", "sector", "etf"}]
        extra = [s for s in ordered if s not in set(keep)]
        ordered = keep + extra[: max(0, MAX_UNIVERSE - len(keep))]

    counts = {
        name: sum(1 for s in ordered if name in sources[s])
        for name in ("core", "sector", "etf", *fetchers)
    }
    counts["total"] = len(ordered)
    return {
        "symbols": ordered,
        "sources": {s: sources[s] for s in ordered},
        "counts": counts,
        "errors": errors,
    }


def _rank(tags: List[str]) -> int:
    """Trending names first (they are why you opened the page), then core, sector, ETF."""
    order = {"youtube": 0, "reddit": 1, "core": 2, "sector": 3, "etf": 4}
    return min(order.get(t, 9) for t in tags)


# ---- product type for symbols outside the fixed lists --------------------------

_LEVERAGED_NAME = re.compile(
    r"\b(2X|3X|-1X|-2X|-3X|ULTRA|ULTRAPRO|ULTRASHORT|BULL|BEAR|INVERSE|LEVERAGED)\b", re.I
)


def default_product_lookup(symbol: str) -> Dict[str, bool]:
    """
    {"is_etf", "leveraged"} for a symbol. Fixed-list symbols need no network. Others are
    looked up once; if Yahoo can't say, the symbol is treated as a stock (so it has to pass
    the earnings-date check) and never as an ETF.
    """
    sym = symbol.upper()
    if sym in LEVERAGED_OR_INVERSE:
        return {"is_etf": True, "leveraged": True}
    if sym in ETF_SET:
        return {"is_etf": True, "leveraged": False}
    if sym in _FIXED_STOCKS:
        return {"is_etf": False, "leveraged": False}
    try:
        from app.services.yfinance.client import get_yfinance_service

        info = get_yfinance_service().get_info(sym) or {}
        is_etf_type = str(info.get("quoteType", "")).upper() in {"ETF", "MUTUALFUND"}
        name = f"{info.get('longName') or ''} {info.get('shortName') or ''}"
        return {
            "is_etf": is_etf_type,
            "leveraged": is_etf_type and bool(_LEVERAGED_NAME.search(name)),
        }
    except Exception as err:  # noqa: BLE001
        logger.warning("Product lookup failed for %s: %s", sym, err)
        return {"is_etf": False, "leveraged": False}


_FIXED_STOCKS = frozenset(CORE_STOCKS) | frozenset(s for m in SECTOR_STOCKS.values() for s in m)


# Core stocks that are not tech/growth by business; everything else in CORE_STOCKS is "tech".
_CORE_GROUP_OVERRIDES = {
    "LLY": "healthcare",
    "COIN": "financials",
    "UBER": "consumer",
    "TSLA": "autos",
}


def group_of(symbol: str) -> str:
    """Concentration group for position caps: ETFs share one group; stocks go by industry."""
    sym = symbol.upper()
    if sym in ETF_SET:
        return "etf"
    if sym in _CORE_GROUP_OVERRIDES:
        return _CORE_GROUP_OVERRIDES[sym]
    sector = sector_of(sym)
    if sector:
        return "tech" if sector == "tech_other" else sector
    return "tech" if sym in CORE_STOCKS else "other"
