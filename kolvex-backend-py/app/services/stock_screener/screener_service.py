"""
Core stock screening service.
Loads cached financial data, applies user-defined or strategy-based filters,
and returns sorted + paginated results.
"""

import logging
import json
import math
import asyncio
from typing import Any, Dict, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor

from app.core.redis import get_redis
from app.services.yfinance.client import YFinanceService, _safe_float
from app.services.stock_screener.symbols import SP500_SYMBOLS

logger = logging.getLogger(__name__)

SP500_CACHE_KEY = "screener:sp500:universe"
STOCK_DATA_KEY_PREFIX = "screener:stock:"
CACHE_TTL = 3 * 86400
UNIVERSE_CACHE_TTL = 14 * 86400

_yf = YFinanceService()
_executor = ThreadPoolExecutor(max_workers=20)

SECTOR_LIST = [
    "Technology", "Health Care", "Financials", "Consumer Discretionary",
    "Communication Services", "Industrials", "Consumer Staples",
    "Energy", "Utilities", "Real Estate", "Materials",
]

# Fields that support range filters
FILTERABLE_FIELDS = {
    "pe_ratio", "forward_pe", "peg_ratio", "price_to_book", "price_to_sales",
    "ev_to_revenue", "ev_to_ebitda",
    "profit_margins", "operating_margins", "gross_margins",
    "return_on_assets", "return_on_equity",
    "revenue_growth", "earnings_growth",
    "quarterly_earnings_growth", "quarterly_revenue_growth",
    "debt_to_equity", "current_ratio",
    "market_cap", "dividend_yield",
    "change_percent", "change_percent_5d",
    "pct_from_52w_high", "pct_from_52w_low",
}

SORTABLE_FIELDS = FILTERABLE_FIELDS | {
    "symbol", "name", "current_price", "volume",
    "eps_trailing", "free_cash_flow",
}


class StockScreenerService:
    """Stateless service — operates on cached data + YFinance fallback."""

    _warm_task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Cache warming (called by scheduler)
    # ------------------------------------------------------------------

    @staticmethod
    async def warm_cache(symbols: List[str]) -> int:
        """Pre-fetch and cache financial snapshot for each symbol.
        Returns the number of successfully cached stocks."""
        redis = get_redis()
        cached = 0
        normalized_symbols = list(dict.fromkeys(sym.upper() for sym in symbols))

        # Publish the universe before the slower quote refresh so readers can
        # use any snapshots that have already been populated.
        await redis.set(
            SP500_CACHE_KEY,
            json.dumps(normalized_symbols),
            ttl=UNIVERSE_CACHE_TTL,
        )

        async def _fetch_one(sym: str) -> Optional[Dict[str, Any]]:
            loop = asyncio.get_event_loop()
            try:
                data = await loop.run_in_executor(
                    _executor, _build_stock_snapshot, sym
                )
                return data
            except Exception as e:
                logger.warning(f"Failed to fetch {sym}: {e}")
                return None

        batch_size = 20
        for i in range(0, len(normalized_symbols), batch_size):
            batch = normalized_symbols[i : i + batch_size]
            tasks = [_fetch_one(sym) for sym in batch]
            results = await asyncio.gather(*tasks)

            for sym, result in zip(batch, results):
                if result:
                    key = f"{STOCK_DATA_KEY_PREFIX}{sym}"
                    await redis.set_json(key, result, ttl=CACHE_TTL)
                    cached += 1

            if i + batch_size < len(normalized_symbols):
                await asyncio.sleep(0.25)

        logger.info(
            "Screener cache warmed: %s/%s stocks",
            cached,
            len(normalized_symbols),
        )
        return cached

    @classmethod
    def start_background_warm(cls) -> bool:
        """Start one cache rebuild in the current process."""
        if cls._warm_task and not cls._warm_task.done():
            return False

        cls._warm_task = asyncio.create_task(cls.warm_cache(SP500_SYMBOLS))
        cls._warm_task.add_done_callback(cls._log_warm_result)
        return True

    @staticmethod
    def _log_warm_result(task: asyncio.Task) -> None:
        try:
            task.result()
        except asyncio.CancelledError:
            logger.info("Background stock screener cache warm was cancelled")
        except Exception:
            logger.exception("Background stock screener cache warm failed")

    # ------------------------------------------------------------------
    # Screening
    # ------------------------------------------------------------------

    async def screen(
        self,
        filters: Dict[str, Any],
        sort_by: str = "market_cap",
        sort_direction: str = "desc",
        page: int = 1,
        page_size: int = 20,
        sectors: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Run a screening query and return paginated results."""
        all_stocks, cache_status = await self._load_universe()

        # Apply sector filter
        if sectors:
            sector_set = {s.lower() for s in sectors}
            all_stocks = [
                s for s in all_stocks
                if (s.get("sector") or "").lower() in sector_set
            ]

        # Apply range filters
        filtered = self._apply_filters(all_stocks, filters)

        # Sort
        filtered = self._sort(filtered, sort_by, sort_direction)

        total = len(filtered)
        start = (page - 1) * page_size
        end = start + page_size
        page_data = filtered[start:end]

        return {
            "results": page_data,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": math.ceil(total / page_size) if page_size else 0,
            "cache_status": cache_status,
            "message": (
                "Stock data is being prepared. Results will appear automatically."
                if cache_status == "warming"
                else None
            ),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _load_universe(self) -> Tuple[List[Dict[str, Any]], str]:
        """Load all stock data from Redis cache, falling back to live fetch."""
        redis = get_redis()

        symbols_raw = await redis.get(SP500_CACHE_KEY)
        if not symbols_raw:
            logger.warning("SP500 universe not cached; starting background warm")
            symbols = SP500_SYMBOLS
            await redis.set(
                SP500_CACHE_KEY,
                json.dumps(symbols),
                ttl=UNIVERSE_CACHE_TTL,
            )
            self.start_background_warm()
        else:
            try:
                symbols = json.loads(symbols_raw)
            except (TypeError, json.JSONDecodeError):
                symbols = SP500_SYMBOLS
                self.start_background_warm()

        keys = [f"{STOCK_DATA_KEY_PREFIX}{sym}" for sym in symbols]
        raw_map = await redis.mget(keys)

        stocks: List[Dict[str, Any]] = []
        for sym in symbols:
            raw = raw_map.get(f"{STOCK_DATA_KEY_PREFIX}{sym}")
            if raw:
                try:
                    data = json.loads(raw) if isinstance(raw, str) else raw
                    stocks.append(data)
                except Exception:
                    pass

        minimum_ready_count = min(20, len(symbols))
        if len(stocks) < minimum_ready_count:
            logger.warning(
                "Screener cache has only %s stocks; background warm requested",
                len(stocks),
            )
            self.start_background_warm()
            return stocks, "warming"

        return stocks, "ready"

    @staticmethod
    def _apply_filters(
        stocks: List[Dict[str, Any]], filters: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Apply min/max range filters."""
        if not filters:
            return stocks

        result = []
        for stock in stocks:
            match = True
            for field, condition in filters.items():
                if field not in FILTERABLE_FIELDS:
                    continue
                value = stock.get(field)
                if value is None:
                    match = False
                    break
                if isinstance(condition, dict):
                    lo = condition.get("min")
                    hi = condition.get("max")
                    if lo is not None and value < lo:
                        match = False
                        break
                    if hi is not None and value > hi:
                        match = False
                        break
            if match:
                result.append(stock)
        return result

    @staticmethod
    def _sort(
        stocks: List[Dict[str, Any]], sort_by: str, sort_direction: str
    ) -> List[Dict[str, Any]]:
        if sort_by not in SORTABLE_FIELDS:
            sort_by = "market_cap"

        reverse = sort_direction.lower() != "asc"

        def _key(s: Dict[str, Any]):
            v = s.get(sort_by)
            if v is None:
                return (1, 0)
            if isinstance(v, str):
                return (0, v.lower())
            return (0, v)

        return sorted(stocks, key=_key, reverse=reverse)


# ------------------------------------------------------------------
# Snapshot builder (runs in thread pool — blocking yfinance calls)
# ------------------------------------------------------------------

def _build_stock_snapshot(symbol: str) -> Dict[str, Any]:
    """Fetch quote + financials and merge into a single flat dict."""
    ticker = _yf.get_ticker(symbol)
    info = ticker.info

    current_price = info.get("currentPrice") or info.get("regularMarketPrice") or 0
    prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose") or 0
    high52 = info.get("fiftyTwoWeekHigh") or 0
    low52 = info.get("fiftyTwoWeekLow") or 0

    change_pct = 0.0
    if prev_close and current_price:
        change_pct = round(((current_price - prev_close) / prev_close) * 100, 2)

    pct_from_high = 0.0
    if high52 and current_price:
        pct_from_high = round(((high52 - current_price) / high52) * 100, 2)

    pct_from_low = 0.0
    if low52 and current_price and low52 > 0:
        pct_from_low = round(((current_price - low52) / low52) * 100, 2)

    # 5-day change — approximate via fast_info or short history
    change_pct_5d = _safe_float(info.get("52WeekChange"), 0.0)
    try:
        hist = ticker.history(period="5d")
        if len(hist) >= 2:
            first = float(hist["Close"].iloc[0])
            last = float(hist["Close"].iloc[-1])
            if first > 0:
                change_pct_5d = round(((last - first) / first) * 100, 2)
    except Exception:
        pass

    dividend_yield = _safe_float(info.get("dividendYield"), 0.0)

    return {
        "symbol": symbol.upper(),
        "name": info.get("shortName") or info.get("longName") or symbol,
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "current_price": _safe_float(current_price),
        "previous_close": _safe_float(prev_close),
        "change_percent": change_pct,
        "change_percent_5d": change_pct_5d,
        "volume": info.get("volume") or info.get("regularMarketVolume") or 0,
        "market_cap": info.get("marketCap") or 0,
        "fifty_two_week_high": _safe_float(high52),
        "fifty_two_week_low": _safe_float(low52),
        "pct_from_52w_high": pct_from_high,
        "pct_from_52w_low": pct_from_low,
        # Valuation
        "pe_ratio": _safe_float(info.get("trailingPE")),
        "forward_pe": _safe_float(info.get("forwardPE")),
        "peg_ratio": _safe_float(info.get("pegRatio")),
        "price_to_book": _safe_float(info.get("priceToBook")),
        "price_to_sales": _safe_float(info.get("priceToSalesTrailing12Months")),
        "ev_to_revenue": _safe_float(info.get("enterpriseToRevenue")),
        "ev_to_ebitda": _safe_float(info.get("enterpriseToEbitda")),
        # Profitability
        "profit_margins": _safe_float(info.get("profitMargins")),
        "operating_margins": _safe_float(info.get("operatingMargins")),
        "gross_margins": _safe_float(info.get("grossMargins")),
        "return_on_assets": _safe_float(info.get("returnOnAssets")),
        "return_on_equity": _safe_float(info.get("returnOnEquity")),
        # Growth
        "revenue_growth": _safe_float(info.get("revenueGrowth")),
        "earnings_growth": _safe_float(info.get("earningsGrowth")),
        "quarterly_earnings_growth": _safe_float(info.get("earningsQuarterlyGrowth")),
        "quarterly_revenue_growth": _safe_float(info.get("revenueQuarterlyGrowth")),
        # Per share
        "eps_trailing": _safe_float(info.get("trailingEps")),
        "eps_forward": _safe_float(info.get("forwardEps")),
        "dividend_yield": dividend_yield,
        # Balance sheet
        "debt_to_equity": _safe_float(info.get("debtToEquity")),
        "current_ratio": _safe_float(info.get("currentRatio")),
        # Cash flow
        "free_cash_flow": _safe_float(info.get("freeCashflow")),
    }
