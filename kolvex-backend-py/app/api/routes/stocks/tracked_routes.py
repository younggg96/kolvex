"""
用户追踪股票 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.supabase import get_supabase_service
from app.api.dependencies.auth import get_current_user_id
from .schemas import (
    TrackedStockCreate,
    TrackedStockUpdate,
    TrackedStockResponse,
    TrackedStocksListResponse,
    MessageResponse,
    StockTrackedCheckResponse,
    TopAuthor,
)
from .utils import parse_tickers_from_raw

router = APIRouter()


async def get_stock_kol_stats(supabase, symbols: list[str]) -> dict:
    """
    获取指定股票的 KOL 统计数据
    返回 {symbol: {mention_count, sentiment_score, top_authors, ...}}
    """
    if not symbols:
        return {}

    # 获取所有带有这些 tickers 的推文
    all_data = []
    batch_size = 1000
    offset = 0

    while True:
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

        # 过滤有效的 tickers
        for row in response.data:
            tickers = row.get("ai_tickers")
            if tickers is None or tickers == "" or tickers == "[]" or tickers == []:
                continue
            all_data.append(row)

        if len(response.data) < batch_size:
            break

        offset += batch_size

    # 统计每个追踪股票的数据
    symbols_upper = {s.upper() for s in symbols}
    ticker_stats: dict = {
        s: {
            "mention_count": 0,
            "unique_authors": set(),
            "author_stats": {},
            "sentiment_sum": 0,
            "sentiment_count": 0,
            "total_engagement": 0,
            "last_seen_at": None,
        }
        for s in symbols_upper
    }

    for row in all_data:
        tickers_raw = row.get("ai_tickers")
        if not tickers_raw:
            continue

        tickers = parse_tickers_from_raw(tickers_raw)

        for ticker in tickers:
            ticker = ticker.strip().upper()
            if ticker.startswith("$"):
                ticker = ticker[1:]
            if not ticker or ticker not in symbols_upper:
                continue

            stats = ticker_stats[ticker]
            stats["mention_count"] += 1
            username = row.get("username", "")
            stats["unique_authors"].add(username)

            # 收集作者统计
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
                if stats["last_seen_at"] is None or created_at > stats["last_seen_at"]:
                    stats["last_seen_at"] = created_at

    # 获取 KOL profiles
    all_usernames = set()
    for stats in ticker_stats.values():
        all_usernames.update(stats["unique_authors"])

    profiles_map = {}
    if all_usernames:
        batch_size = 100
        for i in range(0, len(all_usernames), batch_size):
            batch = list(all_usernames)[i : i + batch_size]
            try:
                response = (
                    supabase.table("kol_profiles")
                    .select("username, display_name, avatar_url")
                    .in_("username", batch)
                    .execute()
                )
                for p in response.data:
                    profiles_map[p["username"]] = p
            except Exception:
                pass

    # 构建结果
    result = {}
    for symbol, stats in ticker_stats.items():
        avg_sentiment = None
        if stats["sentiment_count"] > 0:
            avg_sentiment = round(stats["sentiment_sum"] / stats["sentiment_count"], 2)

        trending_score = round(
            stats["mention_count"] * 10 + stats["total_engagement"] * 0.01, 2
        )

        # 构建 top_authors
        top_authors = []
        author_list = sorted(
            stats["author_stats"].items(),
            key=lambda x: x[1]["tweet_count"],
            reverse=True,
        )[:5]

        for username, author_data in author_list:
            profile = profiles_map.get(username, {})
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
                    avatar_url=author_data["avatar_url"] or profile.get("avatar_url"),
                    tweet_count=author_data["tweet_count"],
                    sentiment=author_sentiment,
                )
            )

        result[symbol] = {
            "mention_count": stats["mention_count"],
            "sentiment_score": avg_sentiment,
            "trending_score": trending_score,
            "engagement_score": stats["total_engagement"],
            "unique_authors_count": len(stats["unique_authors"]),
            "top_authors": top_authors,
            "last_seen_at": stats["last_seen_at"],
        }

    return result


@router.get(
    "/tracked",
    response_model=TrackedStocksListResponse,
    summary="获取用户追踪的股票列表",
)
async def get_tracked_stocks(
    current_user_id: str = Depends(get_current_user_id),
):
    """
    获取当前用户追踪的所有股票（包含 KOL 数据）

    需要认证：Bearer token
    """
    try:
        supabase = get_supabase_service()
        response = (
            supabase.table("stock_tracking")
            .select("*")
            .eq("user_id", current_user_id)
            .order("created_at", desc=True)
            .execute()
        )

        tracked_rows = response.data or []
        if not tracked_rows:
            return TrackedStocksListResponse(stocks=[], total=0)

        # 获取所有追踪股票的 symbols
        symbols = [row["symbol"] for row in tracked_rows]

        # 获取 KOL 统计数据
        kol_stats = await get_stock_kol_stats(supabase, symbols)

        stocks = []
        for row in tracked_rows:
            symbol = row["symbol"].upper()
            stats = kol_stats.get(symbol, {})

            stocks.append(
                TrackedStockResponse(
                    id=row["id"],
                    user_id=row["user_id"],
                    symbol=row["symbol"],
                    company_name=row.get("company_name"),
                    logo_url=row.get("logo_url"),
                    notify=row.get("notify", True),
                    created_at=row["created_at"],
                    # KOL 数据
                    mention_count=stats.get("mention_count", 0),
                    sentiment_score=stats.get("sentiment_score"),
                    trending_score=stats.get("trending_score"),
                    engagement_score=stats.get("engagement_score"),
                    unique_authors_count=stats.get("unique_authors_count", 0),
                    top_authors=stats.get("top_authors", []),
                    last_seen_at=stats.get("last_seen_at"),
                )
            )

        return TrackedStocksListResponse(stocks=stocks, total=len(stocks))

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取追踪股票失败: {str(e)}",
        )


@router.post(
    "/tracked",
    response_model=TrackedStockResponse,
    status_code=status.HTTP_201_CREATED,
    summary="添加追踪股票",
)
async def create_tracked_stock(
    stock_data: TrackedStockCreate,
    current_user_id: str = Depends(get_current_user_id),
):
    """
    添加新的追踪股票

    需要认证：Bearer token
    """
    try:
        supabase = get_supabase_service()

        # 检查是否已经追踪该股票
        existing = (
            supabase.table("stock_tracking")
            .select("id")
            .eq("user_id", current_user_id)
            .eq("symbol", stock_data.symbol.upper())
            .execute()
        )

        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该股票已在追踪列表中",
            )

        # 插入新记录
        insert_data = {
            "user_id": current_user_id,
            "symbol": stock_data.symbol.upper(),
            "company_name": stock_data.company_name,
            "logo_url": stock_data.logo_url,
            "notify": stock_data.notify,
        }

        response = supabase.table("stock_tracking").insert(insert_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="添加追踪股票失败",
            )

        row = response.data[0]
        return TrackedStockResponse(
            id=row["id"],
            user_id=row["user_id"],
            symbol=row["symbol"],
            company_name=row.get("company_name"),
            logo_url=row.get("logo_url"),
            notify=row.get("notify", True),
            created_at=row["created_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"添加追踪股票失败: {str(e)}",
        )


@router.patch(
    "/tracked/{stock_id}",
    response_model=TrackedStockResponse,
    summary="更新追踪股票设置",
)
async def update_tracked_stock(
    stock_id: str,
    stock_update: TrackedStockUpdate,
    current_user_id: str = Depends(get_current_user_id),
):
    """
    更新追踪股票设置（如通知开关）

    需要认证：Bearer token
    """
    try:
        supabase = get_supabase_service()

        # 验证所有权
        existing = (
            supabase.table("stock_tracking")
            .select("*")
            .eq("id", stock_id)
            .eq("user_id", current_user_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="追踪股票未找到",
            )

        # 更新记录
        update_data = {}
        if stock_update.notify is not None:
            update_data["notify"] = stock_update.notify

        if update_data:
            response = (
                supabase.table("stock_tracking")
                .update(update_data)
                .eq("id", stock_id)
                .execute()
            )
            row = response.data[0] if response.data else existing.data
        else:
            row = existing.data

        return TrackedStockResponse(
            id=row["id"],
            user_id=row["user_id"],
            symbol=row["symbol"],
            company_name=row.get("company_name"),
            logo_url=row.get("logo_url"),
            notify=row.get("notify", True),
            created_at=row["created_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新追踪股票失败: {str(e)}",
        )


@router.delete(
    "/tracked/{stock_id}",
    response_model=MessageResponse,
    summary="删除追踪股票",
)
async def delete_tracked_stock(
    stock_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """
    删除追踪股票

    需要认证：Bearer token
    """
    try:
        supabase = get_supabase_service()

        # 验证所有权并删除
        response = (
            supabase.table("stock_tracking")
            .delete()
            .eq("id", stock_id)
            .eq("user_id", current_user_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="追踪股票未找到",
            )

        return MessageResponse(message="追踪股票已删除", success=True)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除追踪股票失败: {str(e)}",
        )


@router.get(
    "/tracked/check/{symbol}",
    response_model=StockTrackedCheckResponse,
    summary="检查股票是否已追踪",
)
async def check_stock_tracked(
    symbol: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """
    检查某个股票是否已在追踪列表中

    需要认证：Bearer token
    """
    try:
        supabase = get_supabase_service()

        response = (
            supabase.table("stock_tracking")
            .select("id")
            .eq("user_id", current_user_id)
            .eq("symbol", symbol.upper())
            .execute()
        )

        is_tracked = bool(response.data)
        stock_id = response.data[0]["id"] if response.data else None

        return StockTrackedCheckResponse(
            symbol=symbol.upper(),
            is_tracked=is_tracked,
            stock_id=stock_id,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"检查追踪状态失败: {str(e)}",
        )
