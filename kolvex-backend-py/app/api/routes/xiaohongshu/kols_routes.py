"""
小红书 KOL API 路由
获取 KOL 博主信息和帖子数据
使用统一的 kol_profiles 和 kol_tweets 表
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List, Optional
import json

from app.services.xiaohongshu import get_supabase_client

router = APIRouter()

# 平台标识
PLATFORM_XHS = "xiaohongshu"


def _format_kol(kol: Dict) -> Dict:
    """
    格式化 KOL 数据（从统一 kol_profiles 表读取）
    """
    return {
        "id": kol.get("id"),
        "user_id": kol.get("platform_user_id") or kol.get("user_id"),
        "nickname": kol.get("display_name") or kol.get("nickname"),
        "red_id": kol.get("red_id"),
        "avatar_url": kol.get("avatar_url"),
        "description": kol.get("bio") or kol.get("description"),
        "location": kol.get("location"),
        "is_verified": kol.get("is_verified", False),
        "verified_type": kol.get("verification_type") or kol.get("verified_type"),
        "followers_count": kol.get("followers_count", 0),
        "following_count": kol.get("following_count", 0),
        "likes_count": kol.get("likes_count", 0),
        "collected_count": kol.get("collected_count", 0),
        "profile_url": kol.get("profile_url"),
        "updated_at": kol.get("updated_at"),
    }


def _format_post(post: Dict, author_avatar: str = None) -> Dict:
    """
    格式化单个帖子数据（从统一 kol_tweets 表读取）
    
    Args:
        post: 帖子数据
        author_avatar: 作者头像 URL（从 kol_profiles 表获取）
    """

    def parse_jsonb(value):
        if value is None:
            return []
        if isinstance(value, str):
            try:
                return json.loads(value)
            except:
                return []
        return value if isinstance(value, list) else []

    # 获取 title 和 content
    title = post.get("title") or ""
    content = post.get("tweet_text") or post.get("content") or ""
    
    # 如果 title 和 content 一样，content 返回为空（避免重复显示）
    if title.strip() == content.strip():
        content = ""

    return {
        "id": post.get("id"),
        "note_id": post.get("platform_post_id") or post.get("note_id"),
        "title": title or None,
        "content": content or None,
        "note_type": post.get("post_type") or post.get("note_type", "normal"),
        "permalink": post.get("permalink"),
        "author_name": post.get("username") or post.get("author_name"),
        "author_id": post.get("author_platform_id") or post.get("author_id"),
        "author_avatar": author_avatar,  # 从 kol_profiles 表获取
        "cover_url": post.get("cover_url"),
        "image_urls": parse_jsonb(post.get("media_urls") or post.get("image_urls")),
        "video_url": post.get("video_url"),
        "like_count": post.get("like_count", 0),
        "collect_count": post.get("collect_count", 0),
        "comment_count": post.get("reply_count") or post.get("comment_count", 0),
        "share_count": post.get("share_count", 0),
        "tags": parse_jsonb(post.get("tags")),
        "ai_sentiment": post.get("ai_sentiment"),
        "ai_tickers": parse_jsonb(post.get("ai_tickers")),
        "ai_tags": parse_jsonb(post.get("ai_tags")),
        "ai_summary": post.get("ai_summary"),
        "ai_is_stock_related": post.get("ai_is_stock_related", False),
        "created_at": post.get("created_at"),
        "scraped_at": post.get("scraped_at"),
    }


@router.get("/kols", response_model=Dict)
def get_xhs_kols(
    limit: int = Query(20, ge=1, le=100, description="返回数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    min_followers: int = Query(0, ge=0, description="最小粉丝数"),
    sort_by: str = Query("followers_count", description="排序字段"),
    sort_desc: bool = Query(True, description="是否降序"),
):
    """
    📋 获取小红书 KOL 列表（从统一 kol_profiles 表）
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库未连接")

    try:
        query = (
            supabase.table("kol_profiles")
            .select("*", count="exact")
            .eq("platform", PLATFORM_XHS)
            .gte("followers_count", min_followers)
        )

        query = query.order(sort_by, desc=sort_desc)
        query = query.range(offset, offset + limit - 1)

        result = query.execute()
        kols = result.data or []
        total = result.count or 0

        return {
            "success": True,
            "data": [_format_kol(k) for k in kols],
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(kols) < total,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/kols/{user_id}", response_model=Dict)
def get_xhs_kol_detail(
    user_id: str,
    include_posts: bool = Query(False, description="是否包含帖子"),
    post_limit: int = Query(20, ge=1, le=50, description="帖子数量限制"),
):
    """
    📄 获取单个 KOL 详情（从统一 kol_profiles 和 kol_tweets 表）

    根据小红书用户 ID 获取 KOL 信息，可选择包含其帖子列表。
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库未连接")

    try:
        # 从统一 kol_profiles 表查询
        kol_result = (
            supabase.table("kol_profiles")
            .select("*")
            .eq("platform", PLATFORM_XHS)
            .eq("platform_user_id", user_id)
            .limit(1)
            .execute()
        )

        kol_data = None
        if kol_result.data:
            kol_data = _format_kol(kol_result.data[0])
        else:
            # 如果 kol_profiles 表中没有，尝试从 kol_tweets 表获取作者信息
            posts_result = (
                supabase.table("kol_tweets")
                .select("author_platform_id, username")
                .eq("platform", PLATFORM_XHS)
                .eq("author_platform_id", user_id)
                .limit(1)
                .execute()
            )

            if posts_result.data:
                post = posts_result.data[0]
                # 构建一个基础的 KOL 信息
                kol_data = {
                    "id": None,
                    "user_id": user_id,
                    "nickname": post.get("username"),
                    "red_id": None,
                    "avatar_url": None,  # 头像统一从 kol_profiles 表获取
                    "description": None,
                    "location": None,
                    "is_verified": False,
                    "verified_type": None,
                    "followers_count": 0,
                    "following_count": 0,
                    "likes_count": 0,
                    "collected_count": 0,
                    "profile_url": f"https://www.xiaohongshu.com/user/profile/{user_id}",
                    "updated_at": None,
                }
            else:
                raise HTTPException(status_code=404, detail=f"KOL 不存在: {user_id}")

        # 获取帖子（从统一 kol_tweets 表）
        posts = []
        if include_posts:
            posts_result = (
                supabase.table("kol_tweets")
                .select("*")
                .eq("platform", PLATFORM_XHS)
                .eq("author_platform_id", user_id)
                .order("created_at", desc=True)
                .limit(post_limit)
                .execute()
            )
            # 使用 KOL 的头像作为所有帖子的作者头像
            kol_avatar = kol_data.get("avatar_url") if kol_data else None
            posts = [_format_post(p, kol_avatar) for p in (posts_result.data or [])]

        return {
            "success": True,
            "profile": kol_data,
            "recent_posts": posts if include_posts else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")

