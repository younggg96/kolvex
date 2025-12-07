"""
爬虫状态与统计 API 路由
提供爬虫状态检查和数据库统计功能
"""

from fastapi import APIRouter, HTTPException
from typing import Dict
from datetime import datetime, timezone, timedelta

from app.services.scraper import (
    get_supabase_client,
    get_stats,
    load_cookies,
    COOKIES_FILE,
)

router = APIRouter()


# ============================================================
# 状态与统计端点
# ============================================================


@router.get("/status", response_model=Dict)
def get_scraper_status():
    """
    获取爬虫状态

    检查：
    - Cookies 是否存在
    - Supabase 连接状态
    - 数据库中的 KOL 数量
    """
    cookies = load_cookies()
    supabase = get_supabase_client()

    # 获取数据库中的 KOL 数量
    kol_count = 0
    if supabase:
        try:
            result = (
                supabase.table("kol_profiles")
                .select("id", count="exact")
                .eq("is_active", True)
                .execute()
            )
            kol_count = result.count or 0
        except:
            pass

    return {
        "cookies_available": cookies is not None,
        "cookies_file": str(COOKIES_FILE),
        "supabase_connected": supabase is not None,
        "active_kol_count": kol_count,
    }


@router.get("/stats", response_model=Dict)
def get_database_stats():
    """
    获取数据库统计信息

    返回：
    - 总推文数
    - 按用户统计
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    stats = get_stats(supabase)

    # 获取 KOL profiles 统计
    try:
        profiles_result = (
            supabase.table("kol_profiles")
            .select("username, verification_type", count="exact")
            .execute()
        )
        total_profiles = profiles_result.count or 0

        # 按认证类型统计
        verified_counts = {}
        for profile in profiles_result.data:
            v_type = profile.get("verification_type") or "None"
            verified_counts[v_type] = verified_counts.get(v_type, 0) + 1

        stats["total_profiles"] = total_profiles
        stats["by_verification"] = verified_counts
    except Exception:
        stats["total_profiles"] = 0
        stats["by_verification"] = {}

    return stats


@router.get("/tweets/date-stats", response_model=Dict)
def get_tweets_date_stats():
    """
    📊 查看推文日期分布统计

    用于诊断数据库中推文的时间分布
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    try:
        # 获取所有推文的 created_at
        result = supabase.table("kol_tweets").select("created_at").execute()
        tweets = result.data or []

        # 统计
        total = len(tweets)
        null_dates = 0
        by_year = {}
        recent_7_days = 0
        recent_30_days = 0

        now = datetime.now(timezone.utc)
        cutoff_7 = now - timedelta(days=7)
        cutoff_30 = now - timedelta(days=30)

        for tweet in tweets:
            created_at = tweet.get("created_at")
            if not created_at:
                null_dates += 1
                continue

            try:
                # 解析时间
                if isinstance(created_at, str):
                    tweet_time = datetime.fromisoformat(
                        created_at.replace("Z", "+00:00")
                    )
                else:
                    tweet_time = created_at

                year = tweet_time.year
                by_year[year] = by_year.get(year, 0) + 1

                if tweet_time.tzinfo is None:
                    tweet_time = tweet_time.replace(tzinfo=timezone.utc)

                if tweet_time >= cutoff_7:
                    recent_7_days += 1
                if tweet_time >= cutoff_30:
                    recent_30_days += 1
            except:
                null_dates += 1

        # 按年份排序
        by_year_sorted = dict(sorted(by_year.items(), reverse=True))

        return {
            "total_tweets": total,
            "null_dates": null_dates,
            "recent_7_days": recent_7_days,
            "recent_30_days": recent_30_days,
            "older_than_7_days": total - recent_7_days - null_dates,
            "by_year": by_year_sorted,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")
