"""
股票讨论 API 路由
"""

from fastapi import APIRouter, Query, HTTPException

from app.core.supabase import get_supabase_service
from .schemas import (
    StockDiscussionsResponse,
    StockTweet,
    KOLSummary,
    SentimentAnalysis,
    TradingSignal,
    MediaItem,
)
from .utils import normalize_ticker, tweet_contains_ticker, parse_json_field

router = APIRouter()


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

