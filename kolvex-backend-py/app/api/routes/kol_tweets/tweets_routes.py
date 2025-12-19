"""
KOL 推文 API 路由
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from app.core.supabase import get_supabase_service
from .schemas import KOLTweetsResponse
from .utils import convert_row_to_tweet, TWEET_SELECT_FIELDS

router = APIRouter()


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
            TWEET_SELECT_FIELDS,
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
        all_usernames = list(set(row["username"] for row in raw_tweets))

        # 单独查询 kol_profiles 表获取用户信息
        profiles_map = {}
        if all_usernames:
            try:
                profiles_result = (
                    supabase.table("kol_profiles")
                    .select("username, display_name, avatar_url")
                    .in_("username", all_usernames)
                    .execute()
                )
                profiles_map = {p["username"]: p for p in profiles_result.data}
            except Exception:
                # kol_profiles 表可能不存在，忽略错误
                pass

        # 转换数据格式
        tweets = [
            convert_row_to_tweet(row, profiles_map.get(row["username"], {}))
            for row in raw_tweets
        ]

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

















