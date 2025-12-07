"""
股票相关 API 路由
提供趋势股票数据
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Any
from pydantic import BaseModel
from datetime import datetime
import json

from app.core.supabase import get_supabase_service

router = APIRouter(prefix="/stocks", tags=["Stocks"])


# ============================================================
# Pydantic 模型
# ============================================================


class TrendingStock(BaseModel):
    """趋势股票模型"""

    ticker: str
    company_name: Optional[str] = None
    platform: str = "TWITTER"
    mention_count: int = 0
    sentiment_score: Optional[float] = None  # -100 to 100
    trending_score: Optional[float] = None
    engagement_score: Optional[float] = None
    unique_authors_count: int = 0
    last_seen_at: Optional[datetime] = None
    first_seen_at: Optional[datetime] = None


class TrendingStocksResponse(BaseModel):
    """趋势股票列表响应"""

    stocks: List[TrendingStock]
    total: int
    page: int
    page_size: int
    has_more: bool


# ============================================================
# 股票讨论相关模型
# ============================================================


class MediaItem(BaseModel):
    """媒体项模型"""

    type: str
    url: Optional[str] = None
    poster: Optional[str] = None


class SentimentAnalysis(BaseModel):
    """情感分析结果"""

    value: Optional[str] = None
    confidence: Optional[float] = None
    reasoning: Optional[str] = None


class TradingSignal(BaseModel):
    """投资信号"""

    action: Optional[str] = None
    tickers: List[str] = []
    confidence: Optional[float] = None


class StockTweet(BaseModel):
    """股票相关推文"""

    id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    tweet_text: str
    created_at: Optional[datetime] = None
    permalink: Optional[str] = None
    media_urls: Optional[List[MediaItem]] = None
    is_repost: bool = False
    original_author: Optional[str] = None
    like_count: int = 0
    retweet_count: int = 0
    reply_count: int = 0
    bookmark_count: int = 0
    views_count: int = 0
    # AI 分析字段
    sentiment: Optional[SentimentAnalysis] = None
    tickers: List[str] = []
    tags: List[str] = []
    trading_signal: Optional[TradingSignal] = None
    summary: Optional[str] = None
    ai_analyzed_at: Optional[datetime] = None
    ai_model: Optional[str] = None


class KOLSummary(BaseModel):
    """讨论股票的 KOL 摘要"""

    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    followers_count: int = 0
    is_verified: bool = False
    tweet_count: int = 0
    avg_sentiment: Optional[float] = None
    latest_tweet_at: Optional[datetime] = None


class StockDiscussionsResponse(BaseModel):
    """股票讨论响应"""

    ticker: str
    total_tweets: int
    total_kols: int
    kols: List[KOLSummary]
    tweets: List[StockTweet]
    page: int
    page_size: int
    has_more: bool


# ============================================================
# 辅助函数
# ============================================================


def calculate_sentiment_score(
    sentiment_value: Optional[str], confidence: Optional[float]
) -> Optional[float]:
    """
    计算情感分数 (-100 到 100)
    bullish -> positive, bearish -> negative, neutral -> 0
    """
    if not sentiment_value:
        return None

    conf = confidence or 0.5

    if sentiment_value.lower() == "bullish":
        return conf * 100
    elif sentiment_value.lower() == "bearish":
        return conf * -100
    else:
        return 0


def parse_json_field(value: Any, default: Any = None) -> Any:
    """解析可能是 JSON 字符串或已解析对象的字段"""
    if value is None:
        return default
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return value


def normalize_ticker(ticker: str) -> str:
    """标准化股票代码"""
    ticker = ticker.strip().upper()
    if ticker.startswith("$"):
        ticker = ticker[1:]
    return ticker


def tweet_contains_ticker(tickers_raw: Any, target_ticker: str) -> bool:
    """检查推文是否包含目标股票代码"""
    if not tickers_raw:
        return False

    tickers = []
    if isinstance(tickers_raw, list):
        tickers = tickers_raw
    elif isinstance(tickers_raw, str):
        if tickers_raw.startswith("["):
            try:
                tickers = json.loads(tickers_raw)
            except:
                tickers = [t.strip() for t in tickers_raw.split(",") if t.strip()]
        else:
            tickers = [t.strip() for t in tickers_raw.split(",") if t.strip()]

    for ticker in tickers:
        if normalize_ticker(ticker) == target_ticker:
            return True
    return False


# ============================================================
# API 路由
# ============================================================


@router.get(
    "/trending", response_model=TrendingStocksResponse, summary="获取趋势股票列表"
)
async def get_trending_stocks(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: str = Query(
        "mention_count",
        description="排序字段: mention_count, sentiment_score, trending_score",
    ),
    sort_direction: str = Query("desc", description="排序方向: asc, desc"),
    min_mentions: int = Query(1, ge=1, description="最小提及次数"),
):
    """
    获取趋势股票列表

    从 KOL 推文中提取的股票代码统计
    """
    try:
        supabase = get_supabase_service()

        # 查询所有有 tickers 的推文
        # 使用 SQL 聚合来统计每个 ticker 的数据
        query = """
        SELECT 
            ticker,
            COUNT(*) as mention_count,
            COUNT(DISTINCT username) as unique_authors_count,
            AVG(CASE 
                WHEN ai_sentiment = 'bullish' THEN ai_sentiment_confidence * 100
                WHEN ai_sentiment = 'bearish' THEN ai_sentiment_confidence * -100
                ELSE 0 
            END) as avg_sentiment,
            SUM(like_count + retweet_count + reply_count) as total_engagement,
            MAX(created_at) as last_seen_at,
            MIN(created_at) as first_seen_at
        FROM kol_tweets,
        LATERAL unnest(string_to_array(ai_tickers, ',')) as ticker
        WHERE ai_tickers IS NOT NULL 
          AND ai_tickers != ''
          AND ai_tickers != '[]'
        GROUP BY ticker
        HAVING COUNT(*) >= :min_mentions
        ORDER BY mention_count DESC
        LIMIT 500
        """

        # 使用简单查询获取推文数据
        response = (
            supabase.table("kol_tweets")
            .select(
                "ai_tickers, username, ai_sentiment, ai_sentiment_confidence, "
                "like_count, retweet_count, reply_count, created_at"
            )
            .not_.is_("ai_tickers", "null")
            .execute()
        )

        if not response.data:
            return TrendingStocksResponse(
                stocks=[], total=0, page=page, page_size=page_size, has_more=False
            )

        # 在 Python 中处理聚合
        ticker_stats: dict = {}

        for row in response.data:
            tickers_raw = row.get("ai_tickers")
            if not tickers_raw:
                continue

            # 解析 tickers (可能是 JSON 数组字符串或逗号分隔)
            tickers = []
            if isinstance(tickers_raw, list):
                tickers = tickers_raw
            elif isinstance(tickers_raw, str):
                # 尝试解析 JSON
                if tickers_raw.startswith("["):
                    try:
                        import json

                        tickers = json.loads(tickers_raw)
                    except:
                        tickers = [
                            t.strip() for t in tickers_raw.split(",") if t.strip()
                        ]
                else:
                    tickers = [t.strip() for t in tickers_raw.split(",") if t.strip()]

            for ticker in tickers:
                ticker = ticker.strip().upper()
                if ticker.startswith("$"):
                    ticker = ticker[1:]
                if not ticker or ticker == "[]":
                    continue

                if ticker not in ticker_stats:
                    ticker_stats[ticker] = {
                        "ticker": ticker,
                        "mention_count": 0,
                        "unique_authors": set(),
                        "sentiment_sum": 0,
                        "sentiment_count": 0,
                        "total_engagement": 0,
                        "last_seen_at": None,
                        "first_seen_at": None,
                    }

                stats = ticker_stats[ticker]
                stats["mention_count"] += 1
                stats["unique_authors"].add(row.get("username", ""))

                # 情感分数
                sentiment = row.get("ai_sentiment")
                confidence = row.get("ai_sentiment_confidence") or 0.5
                if sentiment:
                    if sentiment.lower() == "bullish":
                        stats["sentiment_sum"] += confidence * 100
                        stats["sentiment_count"] += 1
                    elif sentiment.lower() == "bearish":
                        stats["sentiment_sum"] -= confidence * 100
                        stats["sentiment_count"] += 1

                # 互动数据
                stats["total_engagement"] += (
                    (row.get("like_count") or 0)
                    + (row.get("retweet_count") or 0)
                    + (row.get("reply_count") or 0)
                )

                # 时间
                created_at = row.get("created_at")
                if created_at:
                    if (
                        stats["last_seen_at"] is None
                        or created_at > stats["last_seen_at"]
                    ):
                        stats["last_seen_at"] = created_at
                    if (
                        stats["first_seen_at"] is None
                        or created_at < stats["first_seen_at"]
                    ):
                        stats["first_seen_at"] = created_at

        # 过滤最小提及次数
        filtered_stats = {
            k: v for k, v in ticker_stats.items() if v["mention_count"] >= min_mentions
        }

        # 构建结果列表
        stocks_list = []
        for ticker, stats in filtered_stats.items():
            avg_sentiment = None
            if stats["sentiment_count"] > 0:
                avg_sentiment = stats["sentiment_sum"] / stats["sentiment_count"]

            # 计算趋势分数 (基于提及数和互动)
            trending_score = (
                stats["mention_count"] * 10 + stats["total_engagement"] * 0.01
            )

            stocks_list.append(
                TrendingStock(
                    ticker=ticker,
                    platform="TWITTER",
                    mention_count=stats["mention_count"],
                    sentiment_score=(
                        round(avg_sentiment, 2) if avg_sentiment is not None else None
                    ),
                    trending_score=round(trending_score, 2),
                    engagement_score=stats["total_engagement"],
                    unique_authors_count=len(stats["unique_authors"]),
                    last_seen_at=stats["last_seen_at"],
                    first_seen_at=stats["first_seen_at"],
                )
            )

        # 排序
        reverse = sort_direction.lower() == "desc"
        if sort_by == "mention_count":
            stocks_list.sort(key=lambda x: x.mention_count or 0, reverse=reverse)
        elif sort_by == "sentiment_score":
            stocks_list.sort(key=lambda x: x.sentiment_score or 0, reverse=reverse)
        elif sort_by == "trending_score":
            stocks_list.sort(key=lambda x: x.trending_score or 0, reverse=reverse)
        elif sort_by == "engagement_score":
            stocks_list.sort(key=lambda x: x.engagement_score or 0, reverse=reverse)

        # 分页
        total = len(stocks_list)
        start = (page - 1) * page_size
        end = start + page_size
        paginated = stocks_list[start:end]

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


@router.get("/tickers", summary="获取所有股票代码")
async def get_all_tickers():
    """
    获取数据库中所有提及的股票代码列表
    """
    try:
        supabase = get_supabase_service()

        response = (
            supabase.table("kol_tweets")
            .select("ai_tickers")
            .not_.is_("ai_tickers", "null")
            .execute()
        )

        all_tickers = set()

        for row in response.data or []:
            tickers_raw = row.get("ai_tickers")
            if not tickers_raw:
                continue

            tickers = []
            if isinstance(tickers_raw, list):
                tickers = tickers_raw
            elif isinstance(tickers_raw, str):
                if tickers_raw.startswith("["):
                    try:
                        tickers = json.loads(tickers_raw)
                    except:
                        tickers = [
                            t.strip() for t in tickers_raw.split(",") if t.strip()
                        ]
                else:
                    tickers = [t.strip() for t in tickers_raw.split(",") if t.strip()]

            for ticker in tickers:
                ticker = ticker.strip().upper()
                # 移除 $ 前缀 (如 $NVDA -> NVDA)
                if ticker.startswith("$"):
                    ticker = ticker[1:]
                if ticker and ticker != "[]":
                    all_tickers.add(ticker)

        return {"tickers": sorted(list(all_tickers)), "count": len(all_tickers)}

    except Exception as e:
        print(f"Error fetching tickers: {e}")
        raise HTTPException(status_code=500, detail=f"获取股票代码失败: {str(e)}")


@router.get(
    "/{ticker}/discussions",
    response_model=StockDiscussionsResponse,
    summary="获取股票相关讨论",
)
async def get_stock_discussions(
    ticker: str,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: str = Query("created_at", description="排序字段: created_at, engagement"),
    sort_direction: str = Query("desc", description="排序方向: asc, desc"),
):
    """
    获取讨论特定股票的 KOL 列表和相关推文

    - **ticker**: 股票代码 (如 NVDA, AAPL)
    - **page**: 页码
    - **page_size**: 每页数量
    - **sort_by**: 排序方式
    """
    try:
        supabase = get_supabase_service()
        target_ticker = normalize_ticker(ticker)

        # 查询所有包含该 ticker 的推文
        response = (
            supabase.table("kol_tweets")
            .select(
                "id, username, tweet_text, created_at, permalink, "
                "avatar_url, media_urls, is_repost, original_author, "
                "like_count, retweet_count, reply_count, bookmark_count, views_count, "
                "scraped_at, "
                "ai_sentiment, ai_sentiment_confidence, ai_sentiment_reasoning, "
                "ai_tickers, ai_tags, ai_trading_signal, "
                "ai_summary, ai_analyzed_at, ai_model"
            )
            .not_.is_("ai_tickers", "null")
            .execute()
        )

        if not response.data:
            return StockDiscussionsResponse(
                ticker=target_ticker,
                total_tweets=0,
                total_kols=0,
                kols=[],
                tweets=[],
                page=page,
                page_size=page_size,
                has_more=False,
            )

        # 过滤包含目标 ticker 的推文
        matching_tweets = []
        for row in response.data:
            if tweet_contains_ticker(row.get("ai_tickers"), target_ticker):
                matching_tweets.append(row)

        if not matching_tweets:
            return StockDiscussionsResponse(
                ticker=target_ticker,
                total_tweets=0,
                total_kols=0,
                kols=[],
                tweets=[],
                page=page,
                page_size=page_size,
                has_more=False,
            )

        # 获取所有相关用户名
        usernames = list(set(row["username"] for row in matching_tweets))

        # 查询 KOL profiles
        profiles_map = {}
        if usernames:
            try:
                profiles_result = (
                    supabase.table("kol_profiles")
                    .select(
                        "username, display_name, avatar_url, followers_count, is_verified"
                    )
                    .in_("username", usernames)
                    .execute()
                )
                profiles_map = {p["username"]: p for p in profiles_result.data}
            except Exception:
                pass

        # 统计每个 KOL 的数据
        kol_stats: dict = {}
        for row in matching_tweets:
            username = row["username"]
            if username not in kol_stats:
                profile = profiles_map.get(username, {})
                kol_stats[username] = {
                    "username": username,
                    "display_name": profile.get("display_name"),
                    "avatar_url": row.get("avatar_url") or profile.get("avatar_url"),
                    "followers_count": profile.get("followers_count", 0) or 0,
                    "is_verified": profile.get("is_verified", False),
                    "tweet_count": 0,
                    "sentiment_sum": 0,
                    "sentiment_count": 0,
                    "latest_tweet_at": None,
                }

            stats = kol_stats[username]
            stats["tweet_count"] += 1

            # 情感统计
            sentiment = row.get("ai_sentiment")
            confidence = row.get("ai_sentiment_confidence") or 0.5
            if sentiment:
                if sentiment.lower() == "bullish":
                    stats["sentiment_sum"] += confidence * 100
                    stats["sentiment_count"] += 1
                elif sentiment.lower() == "bearish":
                    stats["sentiment_sum"] -= confidence * 100
                    stats["sentiment_count"] += 1

            # 最新推文时间
            created_at = row.get("created_at")
            if created_at:
                if (
                    stats["latest_tweet_at"] is None
                    or created_at > stats["latest_tweet_at"]
                ):
                    stats["latest_tweet_at"] = created_at

        # 构建 KOL 列表
        kols = []
        for username, stats in kol_stats.items():
            avg_sentiment = None
            if stats["sentiment_count"] > 0:
                avg_sentiment = round(
                    stats["sentiment_sum"] / stats["sentiment_count"], 2
                )

            kols.append(
                KOLSummary(
                    username=stats["username"],
                    display_name=stats["display_name"],
                    avatar_url=stats["avatar_url"],
                    followers_count=stats["followers_count"],
                    is_verified=stats["is_verified"],
                    tweet_count=stats["tweet_count"],
                    avg_sentiment=avg_sentiment,
                    latest_tweet_at=stats["latest_tweet_at"],
                )
            )

        # 按推文数量排序 KOL
        kols.sort(key=lambda x: x.tweet_count, reverse=True)

        # 排序推文
        reverse = sort_direction.lower() == "desc"
        if sort_by == "engagement":
            matching_tweets.sort(
                key=lambda x: (x.get("like_count", 0) or 0)
                + (x.get("retweet_count", 0) or 0),
                reverse=reverse,
            )
        else:  # created_at
            matching_tweets.sort(
                key=lambda x: x.get("created_at") or "",
                reverse=reverse,
            )

        # 分页
        total_tweets = len(matching_tweets)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_tweets = matching_tweets[start:end]

        # 转换推文格式
        tweets = []
        for row in paginated_tweets:
            profile = profiles_map.get(row["username"], {})

            # 解析 media_urls
            media_urls = parse_json_field(row.get("media_urls"))

            # 解析 AI 分析字段
            sentiment = None
            if row.get("ai_sentiment"):
                sentiment = SentimentAnalysis(
                    value=row.get("ai_sentiment"),
                    confidence=row.get("ai_sentiment_confidence"),
                    reasoning=row.get("ai_sentiment_reasoning"),
                )

            # 解析交易信号
            signal_data = parse_json_field(row.get("ai_trading_signal"))
            trading_signal = TradingSignal(**signal_data) if signal_data else None

            # 解析 tickers 和 tags
            ai_tickers = parse_json_field(row.get("ai_tickers"), [])
            ai_tags = parse_json_field(row.get("ai_tags"), [])

            tweets.append(
                StockTweet(
                    id=row["id"],
                    username=row["username"],
                    display_name=profile.get("display_name"),
                    avatar_url=row.get("avatar_url") or profile.get("avatar_url"),
                    tweet_text=row["tweet_text"],
                    created_at=row.get("created_at"),
                    permalink=row.get("permalink"),
                    media_urls=(
                        [MediaItem(**m) for m in media_urls] if media_urls else None
                    ),
                    is_repost=row.get("is_repost", False) or False,
                    original_author=row.get("original_author"),
                    like_count=row.get("like_count", 0) or 0,
                    retweet_count=row.get("retweet_count", 0) or 0,
                    reply_count=row.get("reply_count", 0) or 0,
                    bookmark_count=row.get("bookmark_count", 0) or 0,
                    views_count=row.get("views_count", 0) or 0,
                    sentiment=sentiment,
                    tickers=ai_tickers if isinstance(ai_tickers, list) else [],
                    tags=ai_tags if isinstance(ai_tags, list) else [],
                    trading_signal=trading_signal,
                    summary=row.get("ai_summary"),
                    ai_analyzed_at=row.get("ai_analyzed_at"),
                    ai_model=row.get("ai_model"),
                )
            )

        return StockDiscussionsResponse(
            ticker=target_ticker,
            total_tweets=total_tweets,
            total_kols=len(kols),
            kols=kols,
            tweets=tweets,
            page=page,
            page_size=page_size,
            has_more=end < total_tweets,
        )

    except Exception as e:
        print(f"Error fetching stock discussions: {e}")
        raise HTTPException(status_code=500, detail=f"获取股票讨论失败: {str(e)}")
