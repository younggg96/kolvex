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
from .utils import convert_row_to_post, POST_SELECT_FIELDS

router = APIRouter()


def _convert_row_to_profile(row: dict) -> KOLProfile:
    """将数据库行转换为 KOLProfile 对象"""
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
        followers_count=row.get("followers_count", 0) or 0,
        following_count=row.get("following_count", 0) or 0,
        likes_count=row.get("likes_count", 0) or 0,
        collected_count=row.get("collected_count", 0) or 0,
        rest_id=row.get("rest_id"),
        join_date=row.get("join_date"),
        red_id=row.get("red_id"),
        is_active=row.get("is_active", True),
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
    - **sort_by**: 排序字段 (followers_count, following_count, likes_count, updated_at)
    - **sort_order**: asc 或 desc
    """
    try:
        supabase = get_supabase_service()

        # 直接查询 kol_profiles 表获取所有字段
        query = supabase.table("kol_profiles").select(
            "id, platform, platform_user_id, username, display_name, "
            "followers_count, following_count, likes_count, collected_count, "
            "avatar_url, banner_url, is_active, is_verified, verification_type, "
            "rest_id, join_date, location, website, bio, profile_url, "
            "red_id, created_at, updated_at",
            count="exact",
        )

        # 平台筛选
        if platform:
            query = query.eq("platform", platform)

        # 排序
        is_desc = sort_order.lower() == "desc"
        if sort_by in [
            "followers_count",
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
    include_posts: bool = Query(True, description="Include recent posts"),
    post_limit: int = Query(10, ge=1, le=50, description="Number of recent posts"),
):
    """
    获取特定 KOL 的完整 Profile 信息（支持多平台）

    - **username**: KOL 用户名/ID
    - **platform**: 平台 (twitter, xiaohongshu, reddit, youtube)
    - **include_posts**: 是否包含最近帖子
    - **post_limit**: 返回的最近帖子数量
    """
    try:
        supabase = get_supabase_service()

        # 查询 profile
        query = supabase.table("kol_profiles").select(
            "id, platform, platform_user_id, username, display_name, "
            "followers_count, following_count, likes_count, collected_count, "
            "avatar_url, banner_url, is_active, is_verified, verification_type, "
            "rest_id, join_date, location, website, bio, profile_url, "
            "red_id, created_at, updated_at"
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

        # 获取最近帖子（仅当 include_posts=True 时）
        recent_posts = []
        if include_posts:
            post_query = (
                supabase.table("kol_tweets")  # 数据库表名保持不变
                .select(POST_SELECT_FIELDS)
            )
            
            # 根据 platform 使用不同的关联字段
            current_platform = profile.platform
            if current_platform == "xiaohongshu":
                post_query = post_query.eq("platform", "xiaohongshu").eq("author_platform_id", profile.platform_user_id)
            else:
                post_query = post_query.eq("platform", current_platform).eq("username", username)
            
            posts_result = (
                post_query
                .order("created_at", desc=True, nullsfirst=False)
                .limit(post_limit)
                .execute()
            )

            # 为 convert_row_to_post 准备 profile 信息
            profile_info = {
                "display_name": profile.display_name,
                "avatar_url": profile.avatar_url,
            }

            recent_posts = [
                convert_row_to_post(t, profile_info) for t in posts_result.data
            ]

        return KOLProfileDetail(
            profile=profile,
            recent_posts=recent_posts,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get KOL info: {str(e)}")
