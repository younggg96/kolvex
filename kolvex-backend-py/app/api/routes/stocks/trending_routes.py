"""
趋势股票 API 路由（性能优化版）

优化策略：
1. TTL 内存缓存（60s）— 避免每次请求全量扫表，后续请求毫秒级响应
2. 数据库层面 NOT NULL 过滤 — 减少无效数据传输
3. asyncio.gather 并行查询 — profiles 和 company names 同时获取
4. 预计算 + 循环优化 — 减少 Python 层面重复计算
"""

import asyncio
import time
from typing import Optional

from fastapi import APIRouter, Query, HTTPException

from app.core.supabase import get_supabase_service
from .schemas import TrendingStock, TrendingStocksResponse, TopAuthor
from .utils import parse_tickers_from_raw

router = APIRouter()


# ============================================================
# 内存缓存
# ============================================================


class TrendingStocksCache:
    """
    趋势股票内存缓存

    趋势数据变化缓慢（依赖新推文入库），
    缓存 60 秒可将 16s 的全量查询降为 <1ms 的内存读取。
    """

    def __init__(self, ttl_seconds: int = 60):
        self.ttl_seconds = ttl_seconds
        self._cached_stocks: Optional[list] = None
        self._cached_at: float = 0
        self._lock = asyncio.Lock()

    @property
    def is_valid(self) -> bool:
        return (
            self._cached_stocks is not None
            and (time.time() - self._cached_at) < self.ttl_seconds
        )

    def get(self) -> Optional[list]:
        if self.is_valid:
            return self._cached_stocks
        return None

    def set(self, stocks: list):
        self._cached_stocks = stocks
        self._cached_at = time.time()

    def invalidate(self):
        self._cached_stocks = None
        self._cached_at = 0


# 全局缓存实例，TTL 60 秒
_trending_cache = TrendingStocksCache(ttl_seconds=60)


# ============================================================
# 数据获取函数（优化版）
# ============================================================


def _fetch_tweets_batch_sync(supabase, offset: int, batch_size: int) -> list:
    """
    同步获取一批推文数据（供 asyncio.to_thread 使用）
    在数据库层面过滤 ai_tickers IS NOT NULL，减少传输量
    """
    response = (
        supabase.table("kol_tweets")
        .select(
            "ai_tickers, username, avatar_url, platform, "
            "ai_sentiment, ai_sentiment_confidence, "
            "like_count, retweet_count, reply_count, created_at"
        )
        .not_.is_("ai_tickers", "null")
        .range(offset, offset + batch_size - 1)
        .execute()
    )
    return response.data or []


async def _fetch_all_tweets_with_tickers(supabase) -> list:
    """
    分批获取所有带有 tickers 的推文数据（优化版）

    优化点：
    - 数据库层面过滤 NULL（减少 ~30-50% 传输量）
    - 使用 asyncio.to_thread 避免阻塞事件循环
    - Python 中只过滤空字符串/空数组等边缘情况
    """
    all_data = []
    batch_size = 1000
    offset = 0

    while True:
        batch_data = await asyncio.to_thread(
            _fetch_tweets_batch_sync, supabase, offset, batch_size
        )

        if not batch_data:
            break

        # 仅过滤空字符串/空数组（NULL 已在数据库层面过滤）
        for row in batch_data:
            tickers = row.get("ai_tickers")
            if tickers and tickers != "" and tickers != "[]" and tickers != []:
                all_data.append(row)

        if len(batch_data) < batch_size:
            break

        offset += batch_size

    return all_data


def _fetch_profiles_sync(supabase, usernames: list) -> dict:
    """同步批量获取 KOL profiles（供 asyncio.to_thread 使用）"""
    if not usernames:
        return {}

    profiles_map = {}
    batch_size = 100

    for i in range(0, len(usernames), batch_size):
        batch = usernames[i : i + batch_size]
        try:
            response = (
                supabase.table("kol_profiles")
                .select("username, display_name, avatar_url")
                .in_("username", batch)
                .execute()
            )
            for p in response.data:
                profiles_map[p["username"]] = p
        except Exception as e:
            print(f"Error fetching profiles: {e}")

    return profiles_map


def _fetch_company_names_sync(supabase, tickers: list) -> dict:
    """同步批量获取公司名称（供 asyncio.to_thread 使用）"""
    if not tickers:
        return {}

    company_names = {}
    batch_size = 100

    for i in range(0, len(tickers), batch_size):
        batch = tickers[i : i + batch_size]
        try:
            response = (
                supabase.table("institutional_holdings")
                .select("ticker, company_name")
                .in_("ticker", batch)
                .not_.is_("company_name", "null")
                .execute()
            )
            for row in response.data:
                ticker = row.get("ticker")
                name = row.get("company_name")
                if ticker and name and ticker not in company_names:
                    company_names[ticker] = name
        except Exception as e:
            print(f"Error fetching company names: {e}")

    return company_names


# ============================================================
# 核心聚合逻辑
# ============================================================


def _aggregate_ticker_stats(all_tweets: list) -> dict:
    """
    聚合推文数据为 ticker 统计（纯 CPU 计算，无 I/O）

    优化点：
    - 预计算 per-row 的公共值，避免在 ticker 内循环中重复计算
    - 减少 dict.get 调用次数
    """
    ticker_stats: dict = {}

    for row in all_tweets:
        tickers_raw = row.get("ai_tickers")
        if not tickers_raw:
            continue

        tickers = parse_tickers_from_raw(tickers_raw)
        if not tickers:
            continue

        # 预计算 per-row 公共值（避免在 ticker 循环中重复计算）
        username = row.get("username", "")
        avatar_url = row.get("avatar_url")
        platform = row.get("platform") or "twitter"
        created_at = row.get("created_at")
        engagement = (
            (row.get("like_count") or 0)
            + (row.get("retweet_count") or 0)
            + (row.get("reply_count") or 0)
        )

        # 预计算情感值
        sentiment = row.get("ai_sentiment")
        confidence = row.get("ai_sentiment_confidence") or 0.5
        sentiment_value = 0.0
        sentiment_direction = 0  # 1=bullish, -1=bearish, 0=none
        if sentiment:
            s_lower = sentiment.lower()
            if s_lower == "bullish":
                sentiment_value = confidence * 100
                sentiment_direction = 1
            elif s_lower == "bearish":
                sentiment_value = -(confidence * 100)
                sentiment_direction = -1

        for raw_ticker in tickers:
            ticker = raw_ticker.strip().upper()
            if ticker.startswith("$"):
                ticker = ticker[1:]
            if not ticker or ticker == "[]":
                continue

            if ticker not in ticker_stats:
                ticker_stats[ticker] = {
                    "ticker": ticker,
                    "mention_count": 0,
                    "unique_authors": set(),
                    "author_stats": {},
                    "sentiment_sum": 0.0,
                    "sentiment_count": 0,
                    "total_engagement": 0,
                    "last_seen_at": None,
                    "first_seen_at": None,
                }

            stats = ticker_stats[ticker]
            stats["mention_count"] += 1
            stats["unique_authors"].add(username)
            stats["total_engagement"] += engagement

            # 作者统计
            if username:
                author_stats = stats["author_stats"]
                if username not in author_stats:
                    author_stats[username] = {
                        "tweet_count": 0,
                        "sentiment_sum": 0,
                        "sentiment_count": 0,
                        "avatar_url": avatar_url,
                        "platform": platform,
                    }
                author_stat = author_stats[username]
                author_stat["tweet_count"] += 1
                if not author_stat["avatar_url"] and avatar_url:
                    author_stat["avatar_url"] = avatar_url
                if sentiment_direction != 0:
                    author_stat["sentiment_sum"] += sentiment_direction
                    author_stat["sentiment_count"] += 1

            # 情感
            if sentiment_direction != 0:
                stats["sentiment_sum"] += sentiment_value
                stats["sentiment_count"] += 1

            # 时间范围
            if created_at:
                if stats["last_seen_at"] is None or created_at > stats["last_seen_at"]:
                    stats["last_seen_at"] = created_at
                if (
                    stats["first_seen_at"] is None
                    or created_at < stats["first_seen_at"]
                ):
                    stats["first_seen_at"] = created_at

    return ticker_stats


def _build_stocks_list(
    ticker_stats: dict, profiles_map: dict, company_names_map: dict
) -> list:
    """将聚合统计转换为 TrendingStock 列表"""
    stocks_list = []

    for ticker, stats in ticker_stats.items():
        avg_sentiment = None
        if stats["sentiment_count"] > 0:
            avg_sentiment = round(
                stats["sentiment_sum"] / stats["sentiment_count"], 2
            )

        trending_score = round(
            stats["mention_count"] * 10 + stats["total_engagement"] * 0.01, 2
        )

        # 构建 top_authors（按推文数量排序，取前 5）
        top_authors = []
        author_list = sorted(
            stats["author_stats"].items(),
            key=lambda x: x[1]["tweet_count"],
            reverse=True,
        )[:5]

        for uname, author_data in author_list:
            profile = profiles_map.get(uname, {})
            author_sentiment = None
            if author_data["sentiment_count"] > 0:
                avg = author_data["sentiment_sum"] / author_data["sentiment_count"]
                if avg > 0.3:
                    author_sentiment = "bullish"
                elif avg < -0.3:
                    author_sentiment = "bearish"
                else:
                    author_sentiment = "neutral"

            top_authors.append(
                TopAuthor(
                    username=uname,
                    display_name=profile.get("display_name"),
                    avatar_url=author_data["avatar_url"]
                    or profile.get("avatar_url"),
                    platform=author_data.get("platform"),
                    tweet_count=author_data["tweet_count"],
                    sentiment=author_sentiment,
                )
            )

        stocks_list.append(
            TrendingStock(
                ticker=ticker,
                company_name=company_names_map.get(ticker),
                platform="twitter",
                mention_count=stats["mention_count"],
                sentiment_score=avg_sentiment,
                trending_score=trending_score,
                engagement_score=stats["total_engagement"],
                unique_authors_count=len(stats["unique_authors"]),
                top_authors=top_authors,
                last_seen_at=stats["last_seen_at"],
                first_seen_at=stats["first_seen_at"],
            )
        )

    return stocks_list


async def _build_trending_stocks(supabase) -> list:
    """
    构建完整的趋势股票列表（缓存 miss 时调用）

    流程：
    1. 全量获取推文 → 聚合统计（最耗时步骤）
    2. 并行获取 profiles + company names（asyncio.gather）
    3. 组装结果列表
    """
    # Step 1: 获取推文并聚合
    all_tweets = await _fetch_all_tweets_with_tickers(supabase)

    if not all_tweets:
        return []

    ticker_stats = _aggregate_ticker_stats(all_tweets)

    if not ticker_stats:
        return []

    # Step 2: 并行获取 profiles 和 company names
    all_usernames = set()
    for stats in ticker_stats.values():
        all_usernames.update(stats["unique_authors"])

    all_tickers_list = list(ticker_stats.keys())

    profiles_map, company_names_map = await asyncio.gather(
        asyncio.to_thread(_fetch_profiles_sync, supabase, list(all_usernames)),
        asyncio.to_thread(_fetch_company_names_sync, supabase, all_tickers_list),
    )

    # Step 3: 组装结果
    return _build_stocks_list(ticker_stats, profiles_map, company_names_map)


# ============================================================
# API 端点
# ============================================================

# 排序字段映射（避免在每次请求中重复创建 lambda）
_SORT_KEY_MAP = {
    "mention_count": lambda x: x.mention_count or 0,
    "sentiment_score": lambda x: x.sentiment_score or 0,
    "trending_score": lambda x: x.trending_score or 0,
    "engagement_score": lambda x: x.engagement_score or 0,
}


@router.get(
    "/trending", response_model=TrendingStocksResponse, summary="获取趋势股票列表"
)
async def get_trending_stocks(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: str = Query(
        "mention_count",
        description="排序字段: mention_count, sentiment_score, trending_score, engagement_score",
    ),
    sort_direction: str = Query("desc", description="排序方向: asc, desc"),
    min_mentions: int = Query(1, ge=0, description="最小提及次数，设为0显示所有"),
    query: str = Query(None, description="搜索关键词，按股票代码过滤"),
):
    """
    获取趋势股票列表（高性能缓存版）

    从所有 KOL 推文中提取的股票代码统计，包含所有被提及的股票。
    数据每 60 秒自动刷新，首次请求后后续请求 <1ms 响应。

    - **min_mentions=0**: 显示所有被 KOL 提及的股票
    - **min_mentions=1+**: 过滤出至少被提及 N 次的股票
    """
    try:
        # 尝试从缓存获取
        stocks_list = _trending_cache.get()

        if stocks_list is None:
            # 缓存未命中：加锁防止并发请求重复构建
            async with _trending_cache._lock:
                # Double-check：锁内再次检查（可能其他请求已构建完成）
                stocks_list = _trending_cache.get()
                if stocks_list is None:
                    supabase = get_supabase_service()
                    stocks_list = await _build_trending_stocks(supabase)
                    _trending_cache.set(stocks_list)

        if not stocks_list:
            return TrendingStocksResponse(
                stocks=[], total=0, page=page, page_size=page_size, has_more=False
            )

        # ---- 以下操作全在内存中，毫秒级完成 ----

        # 过滤：最小提及次数
        if min_mentions > 0:
            filtered = [s for s in stocks_list if s.mention_count >= min_mentions]
        else:
            filtered = list(stocks_list)

        # 过滤：搜索关键词
        if query:
            search_term = query.strip().upper()
            if search_term.startswith("$"):
                search_term = search_term[1:]
            filtered = [s for s in filtered if search_term in s.ticker.upper()]

        # 排序
        key_fn = _SORT_KEY_MAP.get(sort_by, _SORT_KEY_MAP["mention_count"])
        filtered.sort(key=key_fn, reverse=(sort_direction.lower() == "desc"))

        # 分页
        total = len(filtered)
        start = (page - 1) * page_size
        end = start + page_size
        paginated = filtered[start:end]

        return TrendingStocksResponse(
            stocks=paginated,
            total=total,
            page=page,
            page_size=page_size,
            has_more=end < total,
        )

    except Exception as e:
        print(f"Error fetching trending stocks: {e}")
        raise HTTPException(status_code=500, detail=f"获取趋势股票失败: {str(e)}")
