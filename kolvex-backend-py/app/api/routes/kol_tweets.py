"""
KOL Tweets API 路由
提供 KOL 推文数据的 RESTful API
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import json

from app.core.supabase import get_supabase_service

router = APIRouter(prefix="/kol-tweets", tags=["KOL Tweets"])


# ============================================================
# Pydantic 模型
# ============================================================


class MediaItem(BaseModel):
    """媒体项模型"""

    type: str  # "photo", "video", "gif", "card"
    url: Optional[str] = None
    poster: Optional[str] = None


class SentimentAnalysis(BaseModel):
    """情感分析结果"""

    value: Optional[str] = None  # "bullish", "bearish", "neutral"
    confidence: Optional[float] = None  # 0.0 - 1.0
    reasoning: Optional[str] = None


class TradingSignal(BaseModel):
    """投资信号"""

    action: Optional[str] = None  # "buy", "sell", "hold"
    tickers: List[str] = []
    confidence: Optional[float] = None  # 0.0 - 1.0


class StockRelatedInfo(BaseModel):
    """股市相关性信息"""

    is_related: bool = False
    confidence: Optional[float] = None  # 0.0 - 1.0
    reason: Optional[str] = None


class KOLTweet(BaseModel):
    """KOL 推文模型"""

    id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    tweet_text: str
    created_at: Optional[datetime] = None
    permalink: Optional[str] = None
    # 媒体
    media_urls: Optional[List[MediaItem]] = None
    # 转发信息
    is_repost: bool = False
    original_author: Optional[str] = None
    # 互动数据
    like_count: int = 0
    retweet_count: int = 0
    reply_count: int = 0
    bookmark_count: int = 0
    views_count: int = 0
    # 元数据
    scraped_at: Optional[datetime] = None

    # ========== AI 分析字段 ==========
    # 情感分析
    sentiment: Optional[SentimentAnalysis] = None
    # 股票代码
    tickers: List[str] = []
    # AI 标签
    tags: List[str] = []
    # 投资信号
    trading_signal: Optional[TradingSignal] = None
    # 摘要
    summary: Optional[str] = None
    # 股市相关性
    is_stock_related: Optional[StockRelatedInfo] = None
    # AI 分析元数据
    ai_analyzed_at: Optional[datetime] = None
    ai_model: Optional[str] = None


class KOLTweetsResponse(BaseModel):
    """KOL 推文列表响应"""

    tweets: List[KOLTweet]
    total: int
    page: int
    page_size: int
    has_more: bool


class KOLProfile(BaseModel):
    """KOL 完整 Profile 模型 - 匹配 kol_profiles 表"""

    id: int
    username: str
    display_name: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    is_active: bool = True
    is_verified: bool = False
    verification_type: Optional[str] = "None"
    rest_id: Optional[str] = None
    join_date: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    bio: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class KOLProfilesResponse(BaseModel):
    """KOL 列表响应"""

    profiles: List[KOLProfile]
    total: int


class KOLProfileDetail(BaseModel):
    """KOL 详细信息"""

    profile: KOLProfile
    recent_tweets: List[KOLTweet] = []


class StatsResponse(BaseModel):
    """统计响应"""

    total_tweets: int
    total_kols: int


# ============================================================
# 辅助函数
# ============================================================


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


# ============================================================
# API 路由
# ============================================================


@router.get("/", response_model=KOLTweetsResponse)
async def get_kol_tweets(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    username: Optional[str] = Query(None, description="用户名筛选（单个）"),
    usernames: Optional[str] = Query(None, description="用户名筛选（多个，逗号分隔）"),
    search: Optional[str] = Query(None, description="搜索关键词"),
):
    """
    获取 KOL 推文列表

    - **page**: 页码，从 1 开始
    - **page_size**: 每页数量，默认 20，最大 100
    - **username**: 可选，按单个用户名筛选
    - **usernames**: 可选，按多个用户名筛选（逗号分隔）
    - **search**: 可选，搜索推文内容
    """
    try:
        supabase = get_supabase_service()
        offset = (page - 1) * page_size

        # 查询 kol_tweets 表
        query = supabase.table("kol_tweets").select(
            "id, username, tweet_text, created_at, permalink, "
            "avatar_url, media_urls, is_repost, original_author, "
            "like_count, retweet_count, reply_count, bookmark_count, views_count, "
            "scraped_at, "
            # AI 分析字段
            "ai_sentiment, ai_sentiment_confidence, ai_sentiment_reasoning, "
            "ai_tickers, ai_tags, ai_trading_signal, "
            "ai_summary, "
            "ai_is_stock_related, ai_stock_related_confidence, ai_stock_related_reason, "
            "ai_analyzed_at, ai_model",
            count="exact",
        )

        # 应用筛选条件
        if username:
            query = query.eq("username", username)
        elif usernames:
            # 支持多个用户名筛选（逗号分隔）
            username_list = [u.strip() for u in usernames.split(",") if u.strip()]
            if username_list:
                query = query.in_("username", username_list)
        if search:
            query = query.ilike("tweet_text", f"%{search}%")

        # 按推文创建时间排序（优先），scraped_at 作为备用
        result = (
            query.order("created_at", desc=True, nullsfirst=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        raw_tweets = result.data

        # 获取所有用户名以查询 profile 信息
        usernames = list(set(row["username"] for row in raw_tweets))

        # 单独查询 kol_profiles 表获取用户信息
        profiles_map = {}
        if usernames:
            try:
                profiles_result = (
                    supabase.table("kol_profiles")
                    .select("username, display_name, avatar_url")
                    .in_("username", usernames)
                    .execute()
                )
                profiles_map = {p["username"]: p for p in profiles_result.data}
            except Exception:
                # kol_profiles 表可能不存在，忽略错误
                pass

        # 转换数据格式
        tweets = []
        for row in raw_tweets:
            profile = profiles_map.get(row["username"], {})

            # 解析 media_urls (可能是 JSON 字符串或已解析的列表)
            media_urls = parse_json_field(row.get("media_urls"))

            # 优先使用推文中的 avatar_url，如果没有则使用 profile 中的
            avatar_url = row.get("avatar_url") or profile.get("avatar_url")

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

            # 解析 tickers 和 tags (JSONB 字段)
            ai_tickers = parse_json_field(row.get("ai_tickers"), [])
            ai_tags = parse_json_field(row.get("ai_tags"), [])

            # 解析股市相关性字段
            stock_related = None
            if row.get("ai_is_stock_related") is not None:
                stock_related = StockRelatedInfo(
                    is_related=row.get("ai_is_stock_related", False),
                    confidence=row.get("ai_stock_related_confidence"),
                    reason=row.get("ai_stock_related_reason"),
                )

            tweets.append(
                KOLTweet(
                    id=row["id"],
                    username=row["username"],
                    display_name=profile.get("display_name"),
                    avatar_url=avatar_url,
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
                    scraped_at=row.get("scraped_at"),
                    # AI 分析字段
                    sentiment=sentiment,
                    tickers=ai_tickers,
                    tags=ai_tags,
                    trading_signal=trading_signal,
                    summary=row.get("ai_summary"),
                    is_stock_related=stock_related,
                    ai_analyzed_at=row.get("ai_analyzed_at"),
                    ai_model=row.get("ai_model"),
                )
            )

        total = result.count or 0
        has_more = offset + len(tweets) < total

        return KOLTweetsResponse(
            tweets=tweets,
            total=total,
            page=page,
            page_size=page_size,
            has_more=has_more,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取推文失败: {str(e)}")


@router.get("/profiles", response_model=KOLProfilesResponse)
async def get_kol_profiles(
    sort_by: str = Query("followers_count", description="排序字段"),
    sort_order: str = Query("desc", description="排序顺序 asc/desc"),
):
    """
    获取 KOL 列表（完整 profile 数据，包含推文互动统计）

    - **sort_by**: 排序字段 (followers_count, posts_count, updated_at)
    - **sort_order**: asc 或 desc
    """
    try:
        supabase = get_supabase_service()

        # 直接查询 kol_profiles 表获取所有字段
        query = supabase.table("kol_profiles").select(
            "id, username, display_name, "
            "followers_count, following_count, posts_count, "
            "avatar_url, banner_url, is_active, is_verified, verification_type, "
            "rest_id, join_date, location, website, bio, created_at, updated_at",
            count="exact",
        )

        # 排序
        is_desc = sort_order.lower() == "desc"
        if sort_by in [
            "followers_count",
            "posts_count",
            "following_count",
            "updated_at",
            "created_at",
        ]:
            query = query.order(sort_by, desc=is_desc)
        else:
            query = query.order("followers_count", desc=True)

        result = query.execute()

        profiles = []
        for row in result.data:

            profiles.append(
                KOLProfile(
                    id=row["id"],
                    username=row["username"],
                    display_name=row.get("display_name"),
                    followers_count=row.get("followers_count", 0) or 0,
                    following_count=row.get("following_count", 0) or 0,
                    posts_count=row.get("posts_count", 0) or 0,
                    avatar_url=row.get("avatar_url"),
                    banner_url=row.get("banner_url"),
                    is_active=row.get("is_active", True),
                    is_verified=row.get("is_verified", False),
                    verification_type=row.get("verification_type", "None"),
                    rest_id=row.get("rest_id"),
                    join_date=row.get("join_date"),
                    location=row.get("location"),
                    website=row.get("website"),
                    bio=row.get("bio"),
                    created_at=row.get("created_at"),
                    updated_at=row.get("updated_at"),
                )
            )

        return KOLProfilesResponse(
            profiles=profiles, total=result.count or len(profiles)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取 KOL 列表失败: {str(e)}")


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """
    获取统计信息
    """
    try:
        supabase = get_supabase_service()

        # 总推文数
        tweets_result = (
            supabase.table("kol_tweets").select("id", count="exact").execute()
        )
        total_tweets = tweets_result.count or 0

        # 总 KOL 数
        try:
            kols_result = (
                supabase.table("kol_profiles").select("id", count="exact").execute()
            )
            total_kols = kols_result.count or 0
        except Exception:
            # 表可能不存在
            total_kols = 0

        return StatsResponse(
            total_tweets=total_tweets,
            total_kols=total_kols,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")


@router.get("/user/{username}", response_model=KOLTweetsResponse)
async def get_user_tweets(
    username: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    获取特定用户的推文
    """
    return await get_kol_tweets(page=page, page_size=page_size, username=username)


@router.get("/profile/{username}", response_model=KOLProfileDetail)
async def get_kol_profile_detail(
    username: str,
    include_tweets: bool = Query(True, description="是否包含最近推文"),
    tweet_limit: int = Query(10, ge=1, le=50, description="最近推文数量"),
):
    """
    获取特定 KOL 的完整 Profile 信息

    - **username**: KOL 用户名
    - **include_tweets**: 是否包含最近推文
    - **tweet_limit**: 返回的最近推文数量
    """
    try:
        supabase = get_supabase_service()

        # 查询 profile
        profile_result = (
            supabase.table("kol_profiles")
            .select(
                "id, username, display_name, "
                "followers_count, following_count, posts_count, "
                "avatar_url, banner_url, is_active, is_verified, verification_type, "
                "rest_id, join_date, location, website, bio, created_at, updated_at"
            )
            .eq("username", username)
            .execute()
        )

        if not profile_result.data:
            raise HTTPException(status_code=404, detail=f"KOL '{username}' 不存在")

        row = profile_result.data[0]
        profile = KOLProfile(
            id=row["id"],
            username=row["username"],
            display_name=row.get("display_name"),
            followers_count=row.get("followers_count", 0) or 0,
            following_count=row.get("following_count", 0) or 0,
            posts_count=row.get("posts_count", 0) or 0,
            avatar_url=row.get("avatar_url"),
            banner_url=row.get("banner_url"),
            is_active=row.get("is_active", True),
            is_verified=row.get("is_verified", False),
            verification_type=row.get("verification_type", "None"),
            rest_id=row.get("rest_id"),
            join_date=row.get("join_date"),
            location=row.get("location"),
            website=row.get("website"),
            bio=row.get("bio"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )

        # 获取最近推文（仅当 include_tweets=True 时）
        recent_tweets = []
        if include_tweets:
            tweets_result = (
                supabase.table("kol_tweets")
                .select(
                    "id, username, tweet_text, created_at, permalink, "
                    "avatar_url, media_urls, is_repost, original_author, "
                    "like_count, retweet_count, reply_count, bookmark_count, views_count, "
                    "scraped_at, "
                    "ai_sentiment, ai_sentiment_confidence, ai_sentiment_reasoning, "
                    "ai_tickers, ai_tags, ai_trading_signal, "
                    "ai_summary, "
                    "ai_is_stock_related, ai_stock_related_confidence, ai_stock_related_reason, "
                    "ai_analyzed_at, ai_model"
                )
                .eq("username", username)
                .order("created_at", desc=True, nullsfirst=False)
                .limit(tweet_limit)
                .execute()
            )

            for t in tweets_result.data:
                # 解析 media_urls
                media_urls = parse_json_field(t.get("media_urls"))

                # 解析 AI 分析字段
                sentiment = None
                if t.get("ai_sentiment"):
                    sentiment = SentimentAnalysis(
                        value=t.get("ai_sentiment"),
                        confidence=t.get("ai_sentiment_confidence"),
                        reasoning=t.get("ai_sentiment_reasoning"),
                    )

                # 解析交易信号
                signal_data = parse_json_field(t.get("ai_trading_signal"))
                trading_signal = TradingSignal(**signal_data) if signal_data else None

                # 解析 tickers 和 tags
                ai_tickers = parse_json_field(t.get("ai_tickers"), [])
                ai_tags = parse_json_field(t.get("ai_tags"), [])

                # 解析股市相关性字段
                stock_related = None
                if t.get("ai_is_stock_related") is not None:
                    stock_related = StockRelatedInfo(
                        is_related=t.get("ai_is_stock_related", False),
                        confidence=t.get("ai_stock_related_confidence"),
                        reason=t.get("ai_stock_related_reason"),
                    )

                recent_tweets.append(
                    KOLTweet(
                        id=t["id"],
                        username=t["username"],
                        display_name=profile.display_name,
                        avatar_url=t.get("avatar_url") or profile.avatar_url,
                        tweet_text=t["tweet_text"],
                        created_at=t.get("created_at"),
                        permalink=t.get("permalink"),
                        media_urls=(
                            [MediaItem(**m) for m in media_urls] if media_urls else None
                        ),
                        is_repost=t.get("is_repost", False) or False,
                        original_author=t.get("original_author"),
                        like_count=t.get("like_count", 0) or 0,
                        retweet_count=t.get("retweet_count", 0) or 0,
                        reply_count=t.get("reply_count", 0) or 0,
                        bookmark_count=t.get("bookmark_count", 0) or 0,
                        views_count=t.get("views_count", 0) or 0,
                        scraped_at=t.get("scraped_at"),
                        # AI 分析字段
                        sentiment=sentiment,
                        tickers=ai_tickers,
                        tags=ai_tags,
                        trading_signal=trading_signal,
                        summary=t.get("ai_summary"),
                        is_stock_related=stock_related,
                        ai_analyzed_at=t.get("ai_analyzed_at"),
                        ai_model=t.get("ai_model"),
                    )
                )

        return KOLProfileDetail(
            profile=profile,
            recent_tweets=recent_tweets,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取 KOL 信息失败: {str(e)}")
