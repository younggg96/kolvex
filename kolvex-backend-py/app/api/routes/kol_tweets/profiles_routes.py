"""
KOL Profile API 路由
支持多平台统一数据结构 (Twitter, Xiaohongshu, Reddit, YouTube)
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from app.core.supabase import get_supabase_service
from .schemas import (
    KOLProfile,
    KOLProfilesResponse,
    KOLProfileDetail,
)
from .utils import convert_row_to_tweet, TWEET_SELECT_FIELDS

router = APIRouter()


def _convert_row_to_profile(row: dict) -> KOLProfile:
    """将数据库行转换为 KOLProfile 对象"""
    # 处理 tags 字段（可能是 JSONB）
    tags = row.get("tags")
    if isinstance(tags, str):
        import json
        try:
            tags = json.loads(tags)
        except:
            tags = []
    
    return KOLProfile(
        id=row["id"],
        platform=row.get("platform", "twitter"),
        platform_user_id=row.get("platform_user_id"),
        username=row["username"],
        display_name=row.get("display_name"),
        avatar_url=row.get("avatar_url"),
        banner_url=row.get("banner_url"),
        bio=row.get("bio"),
        location=row.get("location"),
        website=row.get("website"),
        profile_url=row.get("profile_url"),
        is_verified=row.get("is_verified", False),
        verification_type=row.get("verification_type", "None"),
        verified_info=row.get("verified_info"),
        followers_count=row.get("followers_count", 0) or 0,
        following_count=row.get("following_count", 0) or 0,
        posts_count=row.get("posts_count", 0) or 0,
        likes_count=row.get("likes_count", 0) or 0,
        collected_count=row.get("collected_count", 0) or 0,
        rest_id=row.get("rest_id"),
        join_date=row.get("join_date"),
        red_id=row.get("red_id"),
        gender=row.get("gender"),
        tags=tags if isinstance(tags, list) else [],
        category=row.get("category"),
        source_keyword=row.get("source_keyword"),
        source_note_id=row.get("source_note_id"),
        is_active=row.get("is_active", True),
        scraped_at=row.get("scraped_at"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


@router.get("/profiles", response_model=KOLProfilesResponse)
async def get_kol_profiles(
    platform: Optional[str] = Query(None, description="Filter by platform: twitter, xiaohongshu, reddit, youtube"),
    sort_by: str = Query("followers_count", description="Sort by field"),
    sort_order: str = Query("desc", description="Sort order: asc/desc"),
):
    """
    获取 KOL 列表（完整 profile 数据，支持多平台）

    - **platform**: 平台筛选 (twitter, xiaohongshu, reddit, youtube)
    - **sort_by**: 排序字段 (followers_count, posts_count, updated_at)
    - **sort_order**: asc 或 desc
    """
    try:
        supabase = get_supabase_service()

        # 直接查询 kol_profiles 表获取所有字段
        query = supabase.table("kol_profiles").select(
            "id, platform, platform_user_id, username, display_name, "
            "followers_count, following_count, posts_count, likes_count, collected_count, "
            "avatar_url, banner_url, is_active, is_verified, verification_type, verified_info, "
            "rest_id, join_date, location, website, bio, profile_url, "
            "red_id, gender, tags, category, source_keyword, source_note_id, "
            "scraped_at, created_at, updated_at",
            count="exact",
        )

        # 平台筛选
        if platform:
            query = query.eq("platform", platform)

        # 排序
        is_desc = sort_order.lower() == "desc"
        if sort_by in [
            "followers_count",
            "posts_count",
            "following_count",
            "likes_count",
            "updated_at",
            "created_at",
        ]:
            query = query.order(sort_by, desc=is_desc)
        else:
            query = query.order("followers_count", desc=True)

        result = query.execute()

        profiles = [_convert_row_to_profile(row) for row in result.data]

        return KOLProfilesResponse(
            profiles=profiles, total=result.count or len(profiles)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get KOL list: {str(e)}")


@router.get("/profile/{username}", response_model=KOLProfileDetail)
async def get_kol_profile_detail(
    username: str,
    platform: Optional[str] = Query(None, description="Platform: twitter, xiaohongshu, reddit, youtube"),
    include_tweets: bool = Query(True, description="Include recent tweets/posts"),
    tweet_limit: int = Query(10, ge=1, le=50, description="Number of recent tweets/posts"),
):
    """
    获取特定 KOL 的完整 Profile 信息（支持多平台）

    - **username**: KOL 用户名/ID
    - **platform**: 平台 (twitter, xiaohongshu, reddit, youtube)
    - **include_tweets**: 是否包含最近推文/帖子
    - **tweet_limit**: 返回的最近推文/帖子数量
    """
    try:
        supabase = get_supabase_service()

        # 查询 profile
        query = supabase.table("kol_profiles").select(
            "id, platform, platform_user_id, username, display_name, "
            "followers_count, following_count, posts_count, likes_count, collected_count, "
            "avatar_url, banner_url, is_active, is_verified, verification_type, verified_info, "
            "rest_id, join_date, location, website, bio, profile_url, "
            "red_id, gender, tags, category, source_keyword, source_note_id, "
            "scraped_at, created_at, updated_at"
        )
        
        # 根据 platform 决定用哪个字段查询
        if platform == "xiaohongshu":
            # 小红书使用 platform_user_id 查询
            query = query.eq("platform", "xiaohongshu").eq("platform_user_id", username)
        elif platform:
            query = query.eq("platform", platform).eq("username", username)
        else:
            # 未指定平台时，先尝试 username 匹配
            query = query.eq("username", username)

        profile_result = query.execute()

        if not profile_result.data:
            raise HTTPException(status_code=404, detail=f"KOL '{username}' not found")

        row = profile_result.data[0]
        profile = _convert_row_to_profile(row)

        # 获取最近推文/帖子（仅当 include_tweets=True 时）
        recent_tweets = []
        if include_tweets:
            tweet_query = (
                supabase.table("kol_tweets")
                .select(TWEET_SELECT_FIELDS)
            )
            
            # 根据 platform 使用不同的关联字段
            current_platform = profile.platform
            if current_platform == "xiaohongshu":
                tweet_query = tweet_query.eq("platform", "xiaohongshu").eq("author_platform_id", profile.platform_user_id)
            else:
                tweet_query = tweet_query.eq("platform", current_platform).eq("username", username)
            
            tweets_result = (
                tweet_query
                .order("created_at", desc=True, nullsfirst=False)
                .limit(tweet_limit)
                .execute()
            )

            # 为 convert_row_to_tweet 准备 profile 信息
            profile_info = {
                "display_name": profile.display_name,
                "avatar_url": profile.avatar_url,
            }

            recent_tweets = [
                convert_row_to_tweet(t, profile_info) for t in tweets_result.data
            ]

        return KOLProfileDetail(
            profile=profile,
            recent_tweets=recent_tweets,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get KOL info: {str(e)}")
