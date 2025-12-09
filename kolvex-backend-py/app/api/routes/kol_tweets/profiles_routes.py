"""
KOL Profile API 路由
"""

from fastapi import APIRouter, Query, HTTPException

from app.core.supabase import get_supabase_service
from .schemas import (
    KOLProfile,
    KOLProfilesResponse,
    KOLProfileDetail,
)
from .utils import convert_row_to_tweet, TWEET_SELECT_FIELDS

router = APIRouter()


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

        profiles = [
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
            for row in result.data
        ]

        return KOLProfilesResponse(
            profiles=profiles, total=result.count or len(profiles)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取 KOL 列表失败: {str(e)}")


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
                .select(TWEET_SELECT_FIELDS)
                .eq("username", username)
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
        raise HTTPException(status_code=500, detail=f"获取 KOL 信息失败: {str(e)}")

