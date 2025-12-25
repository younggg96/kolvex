"""
小红书爬虫状态与统计 API 路由
提供爬虫状态检查和数据库统计功能
"""

from fastapi import APIRouter, HTTPException
from typing import Dict
from datetime import datetime, timezone, timedelta

from app.services.xiaohongshu import (
    get_supabase_client,
    get_stats,
    COOKIES_FILE,
    DEFAULT_KEYWORDS,
)
from app.services.xiaohongshu.scraper import load_cookies

router = APIRouter()


# ============================================================
# 状态与统计端点
# ============================================================


@router.get("/status", response_model=Dict)
def get_scraper_status():
    """
    📊 获取小红书爬虫状态

    检查：
    - Cookies 是否存在（登录状态）
    - Supabase 连接状态
    - 数据库中的帖子数量
    - 默认关键词列表
    """
    cookies = load_cookies()
    supabase = get_supabase_client()
    
    # 检查登录状态
    is_logged_in = cookies is not None and len(cookies) > 0

    # 获取数据库中的帖子数量
    posts_count = 0
    stock_related_count = 0
    if supabase:
        try:
            result = (
                supabase.table("xhs_posts")
                .select("id", count="exact")
                .execute()
            )
            posts_count = result.count or 0

            # 股票相关帖子数量
            result_stock = (
                supabase.table("xhs_posts")
                .select("id", count="exact")
                .eq("ai_is_stock_related", True)
                .execute()
            )
            stock_related_count = result_stock.count or 0
        except:
            pass

    return {
        "platform": "xiaohongshu",
        "is_logged_in": is_logged_in,
        "cookies_available": cookies is not None,
        "cookies_count": len(cookies) if cookies else 0,
        "cookies_file": str(COOKIES_FILE),
        "supabase_connected": supabase is not None,
        "total_posts": posts_count,
        "stock_related_posts": stock_related_count,
        "default_keywords": DEFAULT_KEYWORDS,
        "login_required_message": None if is_logged_in else "请先在服务器上运行登录命令: python -m app.services.xiaohongshu --login",
    }


@router.get("/login-status", response_model=Dict)
def check_login_status():
    """
    🔑 检查小红书登录状态
    
    返回：
    - is_logged_in: 是否已登录
    - message: 状态信息
    - login_command: 登录命令（如果需要登录）
    """
    cookies = load_cookies()
    is_logged_in = cookies is not None and len(cookies) > 0
    
    if is_logged_in:
        return {
            "is_logged_in": True,
            "message": "✅ 已登录，可以开始爬取",
            "cookies_count": len(cookies),
            "login_command": None,
        }
    else:
        return {
            "is_logged_in": False,
            "message": "❌ 未登录，请先执行登录命令",
            "cookies_count": 0,
            "login_command": "python -m app.services.xiaohongshu --login",
        }


@router.get("/stats", response_model=Dict)
def get_database_stats():
    """
    📊 获取数据库统计信息

    返回：
    - 总帖子数
    - 股票相关帖子数
    - 按关键词统计
    - 按情感统计
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    stats = get_stats(supabase)

    # 获取情感分析统计
    try:
        sentiment_result = (
            supabase.table("xhs_posts")
            .select("ai_sentiment")
            .execute()
        )
        sentiment_counts = {}
        for post in sentiment_result.data:
            sentiment = post.get("ai_sentiment") or "未分析"
            sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
        stats["by_sentiment"] = sentiment_counts
    except Exception:
        stats["by_sentiment"] = {}

    # 获取作者统计
    try:
        author_result = (
            supabase.table("xhs_posts")
            .select("author_name")
            .execute()
        )
        author_counts = {}
        for post in author_result.data:
            author = post.get("author_name") or "未知"
            author_counts[author] = author_counts.get(author, 0) + 1
        # 只返回前 20 个作者
        stats["top_authors"] = dict(
            sorted(author_counts.items(), key=lambda x: x[1], reverse=True)[:20]
        )
    except Exception:
        stats["top_authors"] = {}

    return stats


@router.get("/posts/date-stats", response_model=Dict)
def get_posts_date_stats():
    """
    📊 查看帖子日期分布统计

    用于诊断数据库中帖子的时间分布
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    try:
        # 获取所有帖子的 scraped_at
        result = supabase.table("xhs_posts").select("scraped_at, created_at").execute()
        posts = result.data or []

        # 统计
        total = len(posts)
        null_dates = 0
        by_date = {}
        recent_7_days = 0
        recent_30_days = 0

        now = datetime.now(timezone.utc)
        cutoff_7 = now - timedelta(days=7)
        cutoff_30 = now - timedelta(days=30)

        for post in posts:
            scraped_at = post.get("scraped_at")
            if not scraped_at:
                null_dates += 1
                continue

            try:
                # 解析时间
                if isinstance(scraped_at, str):
                    post_time = datetime.fromisoformat(
                        scraped_at.replace("Z", "+00:00")
                    )
                else:
                    post_time = scraped_at

                date_str = post_time.strftime("%Y-%m-%d")
                by_date[date_str] = by_date.get(date_str, 0) + 1

                if post_time.tzinfo is None:
                    post_time = post_time.replace(tzinfo=timezone.utc)

                if post_time >= cutoff_7:
                    recent_7_days += 1
                if post_time >= cutoff_30:
                    recent_30_days += 1
            except:
                null_dates += 1

        # 按日期排序
        by_date_sorted = dict(sorted(by_date.items(), reverse=True)[:30])

        return {
            "total_posts": total,
            "null_dates": null_dates,
            "recent_7_days": recent_7_days,
            "recent_30_days": recent_30_days,
            "older_than_7_days": total - recent_7_days - null_dates,
            "by_date": by_date_sorted,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/tickers/stats", response_model=Dict)
def get_tickers_stats():
    """
    📈 获取股票代码统计

    返回被提及最多的股票代码
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    try:
        result = (
            supabase.table("xhs_posts")
            .select("ai_tickers")
            .eq("ai_is_stock_related", True)
            .execute()
        )
        posts = result.data or []

        ticker_counts = {}
        for post in posts:
            tickers = post.get("ai_tickers") or []
            if isinstance(tickers, list):
                for ticker in tickers:
                    ticker_counts[ticker] = ticker_counts.get(ticker, 0) + 1

        # 按数量排序
        sorted_tickers = dict(
            sorted(ticker_counts.items(), key=lambda x: x[1], reverse=True)[:30]
        )

        return {
            "total_stock_related_posts": len(posts),
            "unique_tickers": len(ticker_counts),
            "top_tickers": sorted_tickers,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")

