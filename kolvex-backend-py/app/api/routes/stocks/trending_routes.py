"""
趋势股票 API 路由
"""

from fastapi import APIRouter, Query, HTTPException

from app.core.supabase import get_supabase_service
from .schemas import TrendingStock, TrendingStocksResponse, TopAuthor
from .utils import parse_tickers_from_raw

router = APIRouter()


async def fetch_all_tweets_with_tickers(supabase) -> list:
    """
    分批获取所有带有 tickers 的推文数据
    Supabase 默认限制 1000 条，需要分页获取全部数据
    """
    all_data = []
    batch_size = 1000
    offset = 0

    while True:
        # 只获取数据，不在数据库层面做 JSON 字段过滤（避免 JSON 类型比较问题）
        response = (
            supabase.table("kol_tweets")
            .select(
                "ai_tickers, username, avatar_url, ai_sentiment, ai_sentiment_confidence, "
                "like_count, retweet_count, reply_count, created_at"
            )
            .range(offset, offset + batch_size - 1)
            .execute()
        )

        if not response.data:
            break

        # 在 Python 中过滤空值（避免 JSON 类型比较问题）
        filtered_data = []
        for row in response.data:
            tickers = row.get("ai_tickers")
            # 过滤掉 None、空字符串、空数组和无效值
            if tickers is None:
                continue
            if tickers == "" or tickers == "[]" or tickers == []:
                continue
            filtered_data.append(row)

        all_data.extend(filtered_data)

        # 如果返回的数据少于 batch_size，说明已经获取完毕
        if len(response.data) < batch_size:
            break

        offset += batch_size

    return all_data


async def fetch_kol_profiles(supabase, usernames: list) -> dict:
    """
    批量获取 KOL profiles
    """
    if not usernames:
        return {}

    profiles_map = {}
    # 分批获取 profiles（Supabase in_ 有限制）
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
):
    """
    获取趋势股票列表

    从所有 KOL 推文中提取的股票代码统计，包含所有被提及的股票

    - **min_mentions=0**: 显示所有被 KOL 提及的股票
    - **min_mentions=1+**: 过滤出至少被提及 N 次的股票
    """
    try:
        supabase = get_supabase_service()

        # 分批获取所有带有 tickers 的推文数据
        all_tweets = await fetch_all_tweets_with_tickers(supabase)

        if not all_tweets:
            return TrendingStocksResponse(
                stocks=[], total=0, page=page, page_size=page_size, has_more=False
            )

        # 在 Python 中处理聚合，统计所有 KOL 提到的股票
        ticker_stats: dict = {}

        for row in all_tweets:
            tickers_raw = row.get("ai_tickers")
            if not tickers_raw:
                continue

            # 解析 tickers
            tickers = parse_tickers_from_raw(tickers_raw)

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
                        "author_stats": {},  # username -> {tweet_count, sentiment_sum, sentiment_count, avatar_url}
                        "sentiment_sum": 0,
                        "sentiment_count": 0,
                        "total_engagement": 0,
                        "last_seen_at": None,
                        "first_seen_at": None,
                    }

                stats = ticker_stats[ticker]
                stats["mention_count"] += 1
                username = row.get("username", "")
                stats["unique_authors"].add(username)

                # 收集每个作者的统计数据
                if username:
                    if username not in stats["author_stats"]:
                        stats["author_stats"][username] = {
                            "tweet_count": 0,
                            "sentiment_sum": 0,
                            "sentiment_count": 0,
                            "avatar_url": row.get("avatar_url"),
                        }
                    author_stat = stats["author_stats"][username]
                    author_stat["tweet_count"] += 1
                    # 更新 avatar_url（如果之前为空）
                    if not author_stat["avatar_url"] and row.get("avatar_url"):
                        author_stat["avatar_url"] = row.get("avatar_url")

                # 情感分数
                sentiment = row.get("ai_sentiment")
                confidence = row.get("ai_sentiment_confidence") or 0.5
                if sentiment:
                    if sentiment.lower() == "bullish":
                        stats["sentiment_sum"] += confidence * 100
                        stats["sentiment_count"] += 1
                        if username and username in stats["author_stats"]:
                            stats["author_stats"][username]["sentiment_sum"] += 1
                            stats["author_stats"][username]["sentiment_count"] += 1
                    elif sentiment.lower() == "bearish":
                        stats["sentiment_sum"] -= confidence * 100
                        stats["sentiment_count"] += 1
                        if username and username in stats["author_stats"]:
                            stats["author_stats"][username]["sentiment_sum"] -= 1
                            stats["author_stats"][username]["sentiment_count"] += 1

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

        # 获取所有相关的 KOL profiles
        all_usernames = set()
        for stats in ticker_stats.values():
            all_usernames.update(stats["unique_authors"])
        profiles_map = await fetch_kol_profiles(supabase, list(all_usernames))

        # 过滤最小提及次数 (min_mentions=0 时显示所有 KOL 提到的股票)
        if min_mentions > 0:
            filtered_stats = {
                k: v
                for k, v in ticker_stats.items()
                if v["mention_count"] >= min_mentions
            }
        else:
            filtered_stats = ticker_stats

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

            # 构建 top_authors 列表（按推文数量排序，取前 5 个）
            top_authors = []
            author_list = sorted(
                stats["author_stats"].items(),
                key=lambda x: x[1]["tweet_count"],
                reverse=True,
            )[:5]

            for username, author_data in author_list:
                profile = profiles_map.get(username, {})
                # 计算作者情感
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
                        username=username,
                        display_name=profile.get("display_name"),
                        avatar_url=author_data["avatar_url"]
                        or profile.get("avatar_url"),
                        tweet_count=author_data["tweet_count"],
                        sentiment=author_sentiment,
                    )
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
                    top_authors=top_authors,
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
