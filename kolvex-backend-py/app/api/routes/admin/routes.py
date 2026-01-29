"""
Admin API routes - 管理员专用接口
提供系统统计、爬虫状态、用户管理等功能
"""

from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone, timedelta

from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase
from supabase import Client

from app.services.scraper import (
    get_supabase_client as get_scraper_supabase,
    get_stats as get_twitter_stats,
    load_cookies as load_twitter_cookies,
    COOKIES_FILE as TWITTER_COOKIES_FILE,
)
from app.services.xiaohongshu import (
    get_supabase_client as get_xhs_supabase,
    get_stats as get_xhs_stats,
    COOKIES_FILE as XHS_COOKIES_FILE,
    DEFAULT_KEYWORDS as XHS_DEFAULT_KEYWORDS,
)
from app.services.xiaohongshu.scraper import load_cookies as load_xhs_cookies

router = APIRouter()


# ============================================================
# 系统概览
# ============================================================


@router.get("/overview", response_model=Dict[str, Any])
async def get_admin_overview(
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase),
):
    """
    获取系统概览数据
    
    包含：
    - 用户统计
    - 帖子统计
    - KOL 统计
    - 新闻统计
    """
    try:
        # 用户统计
        users_response = (
            supabase.table("user_profiles")
            .select("id", count="exact")
            .execute()
        )
        total_users = users_response.count or 0

        # 今日新增用户
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        new_users_response = (
            supabase.table("user_profiles")
            .select("id", count="exact")
            .gte("created_at", today.isoformat())
            .execute()
        )
        new_users_today = new_users_response.count or 0

        # KOL 统计 (Twitter)
        kol_response = (
            supabase.table("kol_profiles")
            .select("id", count="exact")
            .eq("is_active", True)
            .execute()
        )
        total_kols = kol_response.count or 0

        # 推文统计
        tweets_response = (
            supabase.table("kol_tweets")
            .select("id", count="exact")
            .execute()
        )
        total_tweets = tweets_response.count or 0

        # 小红书帖子统计
        xhs_response = (
            supabase.table("xhs_posts")
            .select("id", count="exact")
            .execute()
        )
        total_xhs_posts = xhs_response.count or 0

        # 小红书股票相关帖子
        xhs_stock_response = (
            supabase.table("xhs_posts")
            .select("id", count="exact")
            .eq("ai_is_stock_related", True)
            .execute()
        )
        xhs_stock_posts = xhs_stock_response.count or 0

        # 新闻统计
        news_response = (
            supabase.table("news_articles")
            .select("id", count="exact")
            .execute()
        )
        total_news = news_response.count or 0

        # 股票追踪统计
        tracking_response = (
            supabase.table("user_stock_tracking")
            .select("id", count="exact")
            .execute()
        )
        total_trackings = tracking_response.count or 0

        # KOL 订阅统计
        subscriptions_response = (
            supabase.table("kol_subscriptions")
            .select("id", count="exact")
            .execute()
        )
        total_subscriptions = subscriptions_response.count or 0

        return {
            "users": {
                "total": total_users,
                "new_today": new_users_today,
            },
            "twitter": {
                "total_kols": total_kols,
                "total_tweets": total_tweets,
            },
            "xiaohongshu": {
                "total_posts": total_xhs_posts,
                "stock_related_posts": xhs_stock_posts,
            },
            "news": {
                "total_articles": total_news,
            },
            "engagement": {
                "stock_trackings": total_trackings,
                "kol_subscriptions": total_subscriptions,
            },
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get overview: {str(e)}",
        )


# ============================================================
# 爬虫状态
# ============================================================


@router.get("/scrapers/status", response_model=Dict[str, Any])
async def get_all_scrapers_status(
    admin_id: str = Depends(verify_admin),
):
    """
    获取所有爬虫的状态
    """
    # Twitter 爬虫状态
    twitter_cookies = load_twitter_cookies()
    scraper_supabase = get_scraper_supabase()
    
    twitter_kol_count = 0
    if scraper_supabase:
        try:
            result = (
                scraper_supabase.table("kol_profiles")
                .select("id", count="exact")
                .eq("is_active", True)
                .execute()
            )
            twitter_kol_count = result.count or 0
        except:
            pass

    # 小红书爬虫状态
    xhs_cookies = load_xhs_cookies()
    xhs_supabase = get_xhs_supabase()
    
    xhs_posts_count = 0
    xhs_stock_count = 0
    if xhs_supabase:
        try:
            result = (
                xhs_supabase.table("xhs_posts")
                .select("id", count="exact")
                .execute()
            )
            xhs_posts_count = result.count or 0

            result_stock = (
                xhs_supabase.table("xhs_posts")
                .select("id", count="exact")
                .eq("ai_is_stock_related", True)
                .execute()
            )
            xhs_stock_count = result_stock.count or 0
        except:
            pass

    return {
        "twitter": {
            "platform": "twitter",
            "cookies_available": twitter_cookies is not None,
            "cookies_file": str(TWITTER_COOKIES_FILE),
            "supabase_connected": scraper_supabase is not None,
            "active_kol_count": twitter_kol_count,
            "status": "ready" if twitter_cookies else "needs_login",
        },
        "xiaohongshu": {
            "platform": "xiaohongshu",
            "is_logged_in": xhs_cookies is not None and len(xhs_cookies) > 0,
            "cookies_available": xhs_cookies is not None,
            "cookies_count": len(xhs_cookies) if xhs_cookies else 0,
            "cookies_file": str(XHS_COOKIES_FILE),
            "supabase_connected": xhs_supabase is not None,
            "total_posts": xhs_posts_count,
            "stock_related_posts": xhs_stock_count,
            "default_keywords": XHS_DEFAULT_KEYWORDS,
            "status": "ready" if (xhs_cookies and len(xhs_cookies) > 0) else "needs_login",
        },
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/scrapers/twitter/stats", response_model=Dict[str, Any])
async def get_twitter_scraper_stats(
    admin_id: str = Depends(verify_admin),
):
    """
    获取 Twitter 爬虫详细统计
    """
    return get_twitter_stats()


@router.get("/scrapers/xiaohongshu/stats", response_model=Dict[str, Any])
async def get_xhs_scraper_stats(
    admin_id: str = Depends(verify_admin),
):
    """
    获取小红书爬虫详细统计
    """
    return get_xhs_stats()


# ============================================================
# 用户管理
# ============================================================


@router.get("/users", response_model=Dict[str, Any])
async def list_all_users(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（邮箱或用户名）"),
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase),
):
    """
    获取用户列表（管理员功能）
    """
    try:
        offset = (page - 1) * page_size

        query = supabase.table("user_profiles").select("*", count="exact")

        if search:
            query = query.or_(f"email.ilike.%{search}%,username.ilike.%{search}%")

        response = (
            query
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        return {
            "users": response.data or [],
            "total": response.count or 0,
            "page": page,
            "page_size": page_size,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list users: {str(e)}",
        )


@router.patch("/users/{user_id}/admin", response_model=Dict[str, Any])
async def toggle_user_admin(
    user_id: str,
    is_admin: bool,
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase),
):
    """
    设置或取消用户的管理员权限
    """
    # 不能修改自己的权限
    if user_id == admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own admin status",
        )

    try:
        response = (
            supabase.table("user_profiles")
            .update({"is_admin": is_admin})
            .eq("id", user_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        return {
            "success": True,
            "user_id": user_id,
            "is_admin": is_admin,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user: {str(e)}",
        )


# ============================================================
# 数据库统计
# ============================================================


@router.get("/database/stats", response_model=Dict[str, Any])
async def get_database_stats(
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase),
):
    """
    获取数据库详细统计信息
    """
    tables = [
        "user_profiles",
        "kol_profiles",
        "kol_tweets",
        "xhs_posts",
        "xhs_kols",
        "news_articles",
        "user_stock_tracking",
        "kol_subscriptions",
        "notifications",
        "user_follows",
        "snaptrade_connections",
        "snaptrade_positions",
        "chat_conversations",
    ]

    stats = {}
    for table in tables:
        try:
            response = (
                supabase.table(table)
                .select("id", count="exact")
                .execute()
            )
            stats[table] = response.count or 0
        except:
            stats[table] = "N/A"

    return {
        "tables": stats,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
