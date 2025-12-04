"""
KOL Tweets API 路由
提供 KOL 推文数据的 RESTful API
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
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


class KOLTweet(BaseModel):
    """KOL 推文模型"""

    id: int
    username: str
    display_name: Optional[str] = None
    kol_description: Optional[str] = None
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
    category: Optional[str] = None

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
    summary_en: Optional[str] = None
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
    description: Optional[str] = None
    category: Optional[str] = None
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
    """KOL 详细信息（含统计）"""

    profile: KOLProfile
    tweet_count: int = 0
    total_likes: int = 0
    total_retweets: int = 0
    recent_tweets: List[KOLTweet] = []


class CategoryStats(BaseModel):
    """类别统计模型"""

    category: str
    kol_count: int
    tweet_count: int
    total_likes: int
    last_scraped_at: Optional[datetime] = None


class StatsResponse(BaseModel):
    """统计响应"""

    total_tweets: int
    total_kols: int
    categories: List[CategoryStats]


# ============================================================
# API 路由
# ============================================================


@router.get("/", response_model=KOLTweetsResponse)
async def get_kol_tweets(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    category: Optional[str] = Query(None, description="类别筛选"),
    username: Optional[str] = Query(None, description="用户名筛选"),
    search: Optional[str] = Query(None, description="搜索关键词"),
):
    """
    获取 KOL 推文列表

    - **page**: 页码，从 1 开始
    - **page_size**: 每页数量，默认 20，最大 100
    - **category**: 可选，按类别筛选 (news_flow, short_macro, charts_data, institutional, retail_meme)
    - **username**: 可选，按用户名筛选
    - **search**: 可选，搜索推文内容
    """
    try:
        supabase = get_supabase_service()
        offset = (page - 1) * page_size

        # 查询 kol_tweets 表（不使用关系查询，避免外键依赖）
        query = supabase.table("kol_tweets").select(
            "id, username, tweet_text, created_at, permalink, "
            "avatar_url, media_urls, is_repost, original_author, "
            "like_count, retweet_count, reply_count, bookmark_count, views_count, "
            "scraped_at, category, "
            # AI 分析字段
            "ai_sentiment, ai_sentiment_confidence, ai_sentiment_reasoning, "
            "ai_tickers, ai_tags, ai_trading_signal, "
            "ai_summary, ai_summary_en, ai_analyzed_at, ai_model",
            count="exact",
        )

        # 应用筛选条件
        if category:
            query = query.eq("category", category)
        if username:
            query = query.eq("username", username)
        if search:
            query = query.ilike("tweet_text", f"%{search}%")

        # 按推文创建时间排序（优先），scraped_at 作为备用
        result = (
            query.order("created_at", desc=True, nullsfirst=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        # 获取所有用户名以查询 profile 信息
        usernames = list(set(row["username"] for row in result.data))

        # 单独查询 kol_profiles 表获取用户信息
        profiles_map = {}
        if usernames:
            try:
                profiles_result = (
                    supabase.table("kol_profiles")
                    .select("username, display_name, description, avatar_url")
                    .in_("username", usernames)
                    .execute()
                )
                profiles_map = {p["username"]: p for p in profiles_result.data}
            except Exception:
                # kol_profiles 表可能不存在，忽略错误
                pass

        # 转换数据格式
        tweets = []
        for row in result.data:
            profile = profiles_map.get(row["username"], {})

            # 解析 media_urls (可能是 JSON 字符串或已解析的列表)
            media_urls_raw = row.get("media_urls")
            media_urls = None
            if media_urls_raw:
                if isinstance(media_urls_raw, str):
                    import json

                    try:
                        media_urls = json.loads(media_urls_raw)
                    except:
                        media_urls = None
                elif isinstance(media_urls_raw, list):
                    media_urls = media_urls_raw

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

            trading_signal = None
            if row.get("ai_trading_signal"):
                signal_data = row.get("ai_trading_signal")
                if isinstance(signal_data, str):
                    import json

                    try:
                        signal_data = json.loads(signal_data)
                    except:
                        signal_data = None
                if signal_data:
                    trading_signal = TradingSignal(**signal_data)

            # 解析 tickers 和 tags (JSONB 字段)
            ai_tickers = row.get("ai_tickers") or []
            ai_tags = row.get("ai_tags") or []
            if isinstance(ai_tickers, str):
                import json

                try:
                    ai_tickers = json.loads(ai_tickers)
                except:
                    ai_tickers = []
            if isinstance(ai_tags, str):
                import json

                try:
                    ai_tags = json.loads(ai_tags)
                except:
                    ai_tags = []

            tweets.append(
                KOLTweet(
                    id=row["id"],
                    username=row["username"],
                    display_name=profile.get("display_name"),
                    kol_description=profile.get("description"),
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
                    category=row.get("category"),
                    # AI 分析字段
                    sentiment=sentiment,
                    tickers=ai_tickers,
                    tags=ai_tags,
                    trading_signal=trading_signal,
                    summary=row.get("ai_summary"),
                    summary_en=row.get("ai_summary_en"),
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
    category: Optional[str] = Query(None, description="类别筛选"),
    sort_by: str = Query("followers_count", description="排序字段"),
    sort_order: str = Query("desc", description="排序顺序 asc/desc"),
):
    """
    获取 KOL 列表（完整 profile 数据）

    - **category**: 可选，按类别筛选
    - **sort_by**: 排序字段 (followers_count, posts_count, updated_at)
    - **sort_order**: asc 或 desc
    """
    try:
        supabase = get_supabase_service()

        # 直接查询 kol_profiles 表获取所有字段
        query = supabase.table("kol_profiles").select(
            "id, username, display_name, description, category, "
            "followers_count, following_count, posts_count, "
            "avatar_url, banner_url, is_active, is_verified, verification_type, "
            "rest_id, join_date, location, website, bio, created_at, updated_at",
            count="exact",
        )

        # 筛选条件
        if category:
            query = query.eq("category", category)

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

        profiles = [
            KOLProfile(
                id=row["id"],
                username=row["username"],
                display_name=row.get("display_name"),
                description=row.get("description"),
                category=row.get("category"),
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
            for row in result.data
        ]

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

        # 尝试使用类别统计视图
        categories = []
        try:
            cat_result = supabase.table("v_category_stats").select("*").execute()
            categories = [
                CategoryStats(
                    category=row["category"],
                    kol_count=row.get("kol_count", 0),
                    tweet_count=row.get("tweet_count", 0),
                    total_likes=row.get("total_likes", 0),
                    last_scraped_at=row.get("last_scraped_at"),
                )
                for row in cat_result.data
            ]
        except Exception:
            # 视图不存在，手动聚合
            pass

        return StatsResponse(
            total_tweets=total_tweets,
            total_kols=total_kols,
            categories=categories,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")


@router.get("/categories")
async def get_categories():
    """
    获取所有类别
    """
    return {
        "categories": [
            {
                "id": "news_flow",
                "name": "News & Flow",
                "icon": "🚨",
                "description": "速度最快的数据源",
            },
            {
                "id": "short_macro",
                "name": "Short & Macro",
                "icon": "📉",
                "description": "宏观与空头",
            },
            {
                "id": "charts_data",
                "name": "Charts & Data",
                "icon": "📊",
                "description": "硬核数据派",
            },
            {
                "id": "institutional",
                "name": "Institutional",
                "icon": "🐂",
                "description": "主流声音",
            },
            {
                "id": "retail_meme",
                "name": "Retail & Meme",
                "icon": "🦍",
                "description": "散户风向标",
            },
        ]
    }


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
                "id, username, display_name, description, category, "
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
            description=row.get("description"),
            category=row.get("category"),
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

        # 统计该 KOL 的推文数据（始终查询）
        stats_result = (
            supabase.table("kol_tweets")
            .select("id, like_count, retweet_count")
            .eq("username", username)
            .execute()
        )

        tweet_count = len(stats_result.data)
        total_likes = sum(t.get("like_count", 0) or 0 for t in stats_result.data)
        total_retweets = sum(t.get("retweet_count", 0) or 0 for t in stats_result.data)

        # 获取最近推文（仅当 include_tweets=True 时）
        recent_tweets = []
        if include_tweets:
            tweets_result = (
                supabase.table("kol_tweets")
                .select(
                    "id, username, tweet_text, created_at, permalink, "
                    "avatar_url, media_urls, is_repost, original_author, "
                    "like_count, retweet_count, reply_count, bookmark_count, views_count, "
                    "scraped_at, category, "
                    "ai_sentiment, ai_sentiment_confidence, ai_sentiment_reasoning, "
                    "ai_tickers, ai_tags, ai_trading_signal, "
                    "ai_summary, ai_summary_en, ai_analyzed_at, ai_model"
                )
                .eq("username", username)
                .order("created_at", desc=True, nullsfirst=False)
                .limit(tweet_limit)
                .execute()
            )

            for t in tweets_result.data:
                # 解析 media_urls
                media_urls_raw = t.get("media_urls")
                media_urls = None
                if media_urls_raw:
                    if isinstance(media_urls_raw, str):
                        import json

                        try:
                            media_urls = json.loads(media_urls_raw)
                        except:
                            media_urls = None
                    elif isinstance(media_urls_raw, list):
                        media_urls = media_urls_raw

                # 解析 AI 分析字段
                sentiment = None
                if t.get("ai_sentiment"):
                    sentiment = SentimentAnalysis(
                        value=t.get("ai_sentiment"),
                        confidence=t.get("ai_sentiment_confidence"),
                        reasoning=t.get("ai_sentiment_reasoning"),
                    )

                trading_signal = None
                if t.get("ai_trading_signal"):
                    signal_data = t.get("ai_trading_signal")
                    if isinstance(signal_data, str):
                        import json

                        try:
                            signal_data = json.loads(signal_data)
                        except:
                            signal_data = None
                    if signal_data:
                        trading_signal = TradingSignal(**signal_data)

                ai_tickers = t.get("ai_tickers") or []
                ai_tags = t.get("ai_tags") or []
                if isinstance(ai_tickers, str):
                    import json

                    try:
                        ai_tickers = json.loads(ai_tickers)
                    except:
                        ai_tickers = []
                if isinstance(ai_tags, str):
                    import json

                    try:
                        ai_tags = json.loads(ai_tags)
                    except:
                        ai_tags = []

                recent_tweets.append(
                    KOLTweet(
                        id=t["id"],
                        username=t["username"],
                        display_name=profile.display_name,
                        kol_description=profile.description,
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
                        category=t.get("category"),
                        # AI 分析字段
                        sentiment=sentiment,
                        tickers=ai_tickers,
                        tags=ai_tags,
                        trading_signal=trading_signal,
                        summary=t.get("ai_summary"),
                        summary_en=t.get("ai_summary_en"),
                        ai_analyzed_at=t.get("ai_analyzed_at"),
                        ai_model=t.get("ai_model"),
                    )
                )

        return KOLProfileDetail(
            profile=profile,
            tweet_count=tweet_count,
            total_likes=total_likes,
            total_retweets=total_retweets,
            recent_tweets=recent_tweets,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取 KOL 信息失败: {str(e)}")
