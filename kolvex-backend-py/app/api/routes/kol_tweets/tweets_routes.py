"""
KOL 帖子 API 路由
支持多平台统一数据结构 (Twitter, Xiaohongshu, Reddit, YouTube)
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from app.core.supabase import get_supabase_service
from .schemas import KOLPostsResponse
from .utils import convert_row_to_post, POST_SELECT_FIELDS

router = APIRouter()


@router.get("/", response_model=KOLPostsResponse)
async def get_kol_posts(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    platform: Optional[str] = Query(
        None, description="Filter by platform: twitter, xiaohongshu, reddit, youtube"
    ),
    username: Optional[str] = Query(None, description="Filter by single username"),
    usernames: Optional[str] = Query(
        None, description="Filter by multiple usernames (comma-separated)"
    ),
    search: Optional[str] = Query(None, description="Search keyword"),
    sentiment: Optional[str] = Query(
        None, description="Filter by sentiment: bullish, bearish, neutral"
    ),
    stock_related: Optional[bool] = Query(
        None, description="Filter by stock-related posts"
    ),
    ticker: Optional[str] = Query(None, description="Filter by stock ticker"),
):
    """
    获取 KOL 帖子列表（支持多平台）

    - **page**: 页码，从 1 开始
    - **page_size**: 每页数量，默认 20，最大 100
    - **platform**: 可选，平台筛选 (twitter, xiaohongshu, reddit, youtube)
    - **username**: 可选，按单个用户名筛选
    - **usernames**: 可选，按多个用户名筛选（逗号分隔）
    - **search**: 可选，搜索帖子内容
    - **sentiment**: 可选，按情感筛选 (bullish, bearish, neutral)
    - **stock_related**: 可选，是否股票相关
    - **ticker**: 可选，按股票代码筛选
    """
    try:
        supabase = get_supabase_service()
        offset = (page - 1) * page_size

        # 查询 kol_tweets 表（数据库表名保持不变）
        query = supabase.table("kol_tweets").select(
            POST_SELECT_FIELDS,
            count="exact",
        )

        # 平台筛选
        if platform:
            query = query.eq("platform", platform)

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

        # 情感筛选
        if sentiment:
            query = query.eq("ai_sentiment", sentiment)

        # 股票相关筛选
        if stock_related is True:
            query = query.eq("ai_is_stock_related", True)
        elif stock_related is False:
            query = query.eq("ai_is_stock_related", False)

        # 股票代码筛选
        if ticker:
            query = query.contains("ai_tickers", [ticker.upper()])

        # 按帖子创建时间排序（优先），scraped_at 作为备用
        result = (
            query.order("created_at", desc=True, nullsfirst=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        raw_posts = result.data

        # 获取所有用户名以查询 profile 信息
        # 需要按平台分组查询
        profiles_map = {}
        if raw_posts:
            try:
                # 构建 (platform, username/platform_user_id) 对
                twitter_usernames = list(
                    set(
                        row["username"]
                        for row in raw_posts
                        if row.get("platform") == "twitter" or not row.get("platform")
                    )
                )
                xhs_user_ids = list(
                    set(
                        row.get("author_platform_id")
                        for row in raw_posts
                        if row.get("platform") == "xiaohongshu"
                        and row.get("author_platform_id")
                    )
                )

                # 查询 Twitter 用户
                if twitter_usernames:
                    profiles_result = (
                        supabase.table("kol_profiles")
                        .select("username, display_name, avatar_url, platform")
                        .eq("platform", "twitter")
                        .in_("username", twitter_usernames)
                        .execute()
                    )
                    for p in profiles_result.data:
                        profiles_map[("twitter", p["username"])] = p

                # 查询小红书用户
                if xhs_user_ids:
                    profiles_result = (
                        supabase.table("kol_profiles")
                        .select("platform_user_id, display_name, avatar_url, platform")
                        .eq("platform", "xiaohongshu")
                        .in_("platform_user_id", xhs_user_ids)
                        .execute()
                    )
                    for p in profiles_result.data:
                        profiles_map[("xiaohongshu", p["platform_user_id"])] = p

            except Exception:
                # kol_profiles 表可能不存在，忽略错误
                pass

        # 转换数据格式
        def get_profile_for_row(row):
            platform_val = row.get("platform", "twitter")
            if platform_val == "xiaohongshu":
                return profiles_map.get(
                    ("xiaohongshu", row.get("author_platform_id")), {}
                )
            return profiles_map.get(("twitter", row["username"]), {})

        posts = [
            convert_row_to_post(row, get_profile_for_row(row)) for row in raw_posts
        ]

        total = result.count or 0
        has_more = offset + len(posts) < total

        return KOLPostsResponse(
            posts=posts,
            total=total,
            page=page,
            page_size=page_size,
            has_more=has_more,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get posts: {str(e)}")


@router.get("/user/{username}", response_model=KOLPostsResponse)
async def get_user_posts(
    username: str,
    platform: Optional[str] = Query(None, description="Platform: twitter, xiaohongshu"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    获取特定用户的帖子
    """
    return await get_kol_posts(
        page=page, page_size=page_size, platform=platform, username=username
    )
