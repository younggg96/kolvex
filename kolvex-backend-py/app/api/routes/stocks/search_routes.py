"""
股票搜索 API 路由
使用 yfinance.Search 进行股票搜索
"""

import yfinance as yf
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.core.supabase import get_supabase_service
from .utils import parse_tickers_from_raw

router = APIRouter()

# 线程池用于运行同步的 yfinance 调用
_executor = ThreadPoolExecutor(max_workers=4)


class StockSearchResult(BaseModel):
    """股票搜索结果"""

    symbol: str
    name: Optional[str] = None
    sector: Optional[str] = None
    exchange: Optional[str] = None
    type: str = "equity"  # equity, crypto（只支持美股和加密货币）
    mention_count: Optional[int] = None  # KOL 提及次数


class StockSearchResponse(BaseModel):
    """搜索响应"""

    results: List[StockSearchResult]
    total: int
    query: str


# 资产类型映射（只保留股票和加密货币）
TYPE_MAPPING = {
    "EQUITY": "equity",
    "ETF": "etf",
    "CRYPTOCURRENCY": "crypto",
}

# 美国交易所列表
US_EXCHANGES = {
    "NYSE",
    "NYQ",
    "NMS",  # NASDAQ Global Select
    "NGM",  # NASDAQ Global Market
    "NCM",  # NASDAQ Capital Market
    "NASDAQ",
    "AMEX",
    "ASE",
    "PCX",  # NYSE Arca
    "BTS",  # BATS
    "IEXG",  # IEX
    "PNK",  # OTC Pink (可选，一些小盘股)
    "OTC",  # OTC Markets
}


def _search_yfinance_sync(
    query: str,
    max_results: int = 20,
    include_crypto: bool = True,
) -> List[dict]:
    """
        同步调用 yfinance.Search（将在线程池中运行）
        只返回美股股票、ETF和加密货币

    Args:
        query: 搜索关键词
        max_results: 返回结果数量
        include_crypto: 是否包含加密货币

    Returns:
        搜索结果列表
    """
    try:
        # 请求更多结果以便过滤后仍有足够数量
        search = yf.Search(
            query,
            max_results=max_results * 5,
            news_count=0,  # 不需要新闻
            enable_fuzzy_query=True,
            raise_errors=False,
        )

        results = []
        for quote in search.quotes:
            quote_type = quote.get("quoteType", "EQUITY")
            asset_type = TYPE_MAPPING.get(quote_type)
            exchange = quote.get("exchange", "")

            # 只接受映射中存在的类型（equity 和 crypto）
            if asset_type is None:
                continue

            # 处理加密货币
            if asset_type == "crypto":
                if not include_crypto:
                    continue
            else:
                # 股票必须是美国交易所
                if exchange not in US_EXCHANGES:
                    continue

            results.append(
                {
                    "symbol": quote.get("symbol", ""),
                    "name": quote.get("shortname") or quote.get("longname"),
                    "exchange": exchange,
                    "type": asset_type,
                    "sector": quote.get("sector"),
                }
            )

            # 达到所需数量后停止
            if len(results) >= max_results:
                break

        return results

    except Exception as e:
        print(f"yfinance search error: {e}")
        return []


async def search_yfinance(
    query: str,
    max_results: int = 20,
    include_crypto: bool = False,
) -> List[dict]:
    """
    异步包装器，在线程池中运行 yfinance.Search

    Args:
        query: 搜索关键词
        max_results: 返回结果数量
        include_crypto: 是否包含加密货币

    Returns:
        搜索结果列表
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _executor,
        _search_yfinance_sync,
        query,
        max_results,
        include_crypto,
    )


async def get_kol_mentioned_tickers(supabase) -> dict:
    """
    获取 KOL 提及的股票代码及其提及次数
    使用缓存减少数据库查询
    """
    ticker_counts = {}
    batch_size = 1000
    offset = 0

    while True:
        response = (
            supabase.table("kol_tweets")
            .select("ai_tickers")
            .not_.is_("ai_tickers", "null")
            .range(offset, offset + batch_size - 1)
            .execute()
        )

        if not response.data:
            break

        for row in response.data:
            tickers_raw = row.get("ai_tickers")
            if not tickers_raw:
                continue

            tickers = parse_tickers_from_raw(tickers_raw)
            for ticker in tickers:
                ticker = ticker.strip().upper()
                if ticker.startswith("$"):
                    ticker = ticker[1:]
                if ticker and ticker != "[]":
                    ticker_counts[ticker] = ticker_counts.get(ticker, 0) + 1

        if len(response.data) < batch_size:
            break

        offset += batch_size

    return ticker_counts


@router.get("/search", response_model=StockSearchResponse, summary="搜索股票")
async def search_stocks(
    query: str = Query(..., min_length=1, description="搜索关键词"),
    limit: int = Query(10, ge=1, le=50, description="返回结果数量"),
    include_crypto: bool = Query(True, description="是否包含加密货币"),
    include_kol_mentions: bool = Query(True, description="是否包含 KOL 提及次数"),
):
    """
    搜索股票代码和公司名称（使用 yfinance.Search）
    只返回美股和加密货币

    - **query**: 搜索关键词（股票代码或公司名称）
    - **limit**: 返回结果数量上限
    - **include_crypto**: 是否包含加密货币结果
    - **include_kol_mentions**: 是否查询 KOL 提及次数
    """
    try:
        # 标准化搜索词
        search_term = query.strip()
        if search_term.startswith("$"):
            search_term = search_term[1:]

        # 并行执行搜索和获取 KOL 提及数据
        tasks = [search_yfinance(search_term, limit * 2, include_crypto)]

        if include_kol_mentions:
            supabase = get_supabase_service()
            tasks.append(get_kol_mentioned_tickers(supabase))

        task_results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理搜索结果
        yf_results = (
            task_results[0] if not isinstance(task_results[0], Exception) else []
        )
        kol_tickers = (
            task_results[1]
            if len(task_results) > 1 and not isinstance(task_results[1], Exception)
            else {}
        )

        results: List[StockSearchResult] = []
        seen_symbols = set()

        for item in yf_results:
            symbol = item.get("symbol", "")
            if not symbol or symbol in seen_symbols:
                continue

            if len(results) >= limit:
                break

            # 获取 KOL 提及次数
            base_symbol = symbol.replace("-USD", "").replace(".HK", "")
            mention_count = (
                kol_tickers.get(base_symbol, 0) if include_kol_mentions else None
            )

            results.append(
                StockSearchResult(
                    symbol=symbol,
                    name=item.get("name"),
                    sector=item.get("sector"),
                    exchange=item.get("exchange"),
                    type=item.get("type", "equity"),
                    mention_count=mention_count,
                )
            )
            seen_symbols.add(symbol)

        # 按 KOL 提及次数排序（有提及的优先）
        if include_kol_mentions:
            results.sort(key=lambda x: x.mention_count or 0, reverse=True)

        return StockSearchResponse(
            results=results[:limit],
            total=len(results),
            query=query,
        )

    except Exception as e:
        print(f"Error searching stocks: {e}")
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")


@router.get("/popular", response_model=StockSearchResponse, summary="获取热门股票")
async def get_popular_stocks(
    limit: int = Query(10, ge=1, le=50, description="返回结果数量"),
):
    """
    获取热门股票列表（基于 KOL 提及次数）
    """
    try:
        supabase = get_supabase_service()

        # 获取 KOL 提及的股票
        kol_tickers = await get_kol_mentioned_tickers(supabase)

        # 按提及次数排序
        sorted_tickers = sorted(kol_tickers.items(), key=lambda x: x[1], reverse=True)

        # 获取股票信息（批量搜索前几个）
        results: List[StockSearchResult] = []

        for ticker, count in sorted_tickers[:limit]:
            # 尝试从 yfinance 获取详细信息
            yf_results = await search_yfinance(ticker, 1, include_crypto=True)

            if yf_results:
                info = yf_results[0]
                results.append(
                    StockSearchResult(
                        symbol=ticker,
                        name=info.get("name"),
                        sector=info.get("sector"),
                        exchange=info.get("exchange"),
                        type=info.get("type", "equity"),
                        mention_count=count,
                    )
                )
            else:
                results.append(
                    StockSearchResult(
                        symbol=ticker,
                        type="equity",
                        mention_count=count,
                    )
                )

        return StockSearchResponse(
            results=results,
            total=len(results),
            query="",
        )

    except Exception as e:
        print(f"Error getting popular stocks: {e}")
        raise HTTPException(status_code=500, detail=f"获取热门股票失败: {str(e)}")


@router.get("/autocomplete", response_model=List[StockSearchResult], summary="自动补全")
async def autocomplete_stocks(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    limit: int = Query(5, ge=1, le=20, description="返回结果数量"),
    include_crypto: bool = Query(True, description="是否包含加密货币"),
):
    """
    股票自动补全（轻量级，用于搜索框）
    只返回美股和加密货币

    - 不查询 KOL 提及次数，响应更快
    - 适合实时输入时调用
    """
    try:
        search_term = q.strip()
        if search_term.startswith("$"):
            search_term = search_term[1:]

        yf_results = await search_yfinance(
            search_term, limit, include_crypto=include_crypto
        )

        results = []
        for item in yf_results[:limit]:
            results.append(
                StockSearchResult(
                    symbol=item.get("symbol", ""),
                    name=item.get("name"),
                    exchange=item.get("exchange"),
                    type=item.get("type", "equity"),
                )
            )

        return results

    except Exception as e:
        print(f"Error in autocomplete: {e}")
        raise HTTPException(status_code=500, detail=f"自动补全失败: {str(e)}")
