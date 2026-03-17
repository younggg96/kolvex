"""
Admin API routes - 管理员专用接口
提供系统统计、爬虫状态、用户管理等功能
"""

import asyncio
from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone, timedelta

from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service
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

# Import task managers
from app.api.routes.scraper.task_manager import list_tasks as list_twitter_tasks
from app.api.routes.xiaohongshu.task_manager import list_tasks as list_xhs_tasks
from .ai_task_manager import (
    generate_task_id,
    create_ai_task,
    get_ai_task,
    set_ai_task_running,
    set_ai_task_completed,
    set_ai_task_failed,
    update_ai_task_progress,
    list_ai_tasks,
    get_running_ai_tasks,
    cancel_ai_task,
    AITaskStatus,
)

# Import services for triggering actions
from fastapi import BackgroundTasks

router = APIRouter()


# ============================================================
# 系统概览
# ============================================================


@router.get("/overview", response_model=Dict[str, Any])
async def get_admin_overview(
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    获取系统概览数据

    包含：
    - 用户统计
    - 帖子统计
    - KOL 统计
    - 新闻统计
    """

    # Helper function to safely count table rows
    def safe_count(table_name: str, filters: Dict[str, Any] = None) -> int:
        try:
            query = supabase.table(table_name).select("id", count="exact")
            if filters:
                for key, value in filters.items():
                    if key == "gte":
                        for col, val in value.items():
                            query = query.gte(col, val)
                    else:
                        query = query.eq(key, value)
            response = query.execute()
            return response.count or 0
        except Exception:
            return 0  # Table doesn't exist or other error

    try:
        # 用户统计
        total_users = safe_count("user_profiles")

        # 今日新增用户
        today = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        new_users_today = safe_count(
            "user_profiles", {"gte": {"created_at": today.isoformat()}}
        )

        # KOL 统计 (Twitter)
        total_kols = safe_count("kol_profiles", {"is_active": True})

        # 推文统计
        total_tweets = safe_count("kol_tweets")

        # 小红书帖子统计
        total_xhs_posts = safe_count("xhs_posts")
        xhs_stock_posts = safe_count("xhs_posts", {"ai_is_stock_related": True})

        # 新闻统计
        total_news = safe_count("news_articles")

        # 股票追踪统计
        total_trackings = safe_count("user_stock_tracking")

        # KOL 订阅统计
        total_subscriptions = safe_count("kol_subscriptions")

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
                xhs_supabase.table("xhs_posts").select("id", count="exact").execute()
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
            "status": (
                "ready" if (xhs_cookies and len(xhs_cookies) > 0) else "needs_login"
            ),
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


@router.get("/scrapers/tasks", response_model=Dict[str, Any])
async def get_all_scraper_tasks(
    limit: int = 10,
    admin_id: str = Depends(verify_admin),
):
    """
    获取所有爬虫的最近任务
    """
    twitter_tasks = list_twitter_tasks(limit)
    xhs_tasks = list_xhs_tasks(limit)

    # Add platform label to each task
    for task in twitter_tasks:
        task["platform"] = "twitter"
    for task in xhs_tasks:
        task["platform"] = "xiaohongshu"

    # Combine and sort by created_at
    all_tasks = twitter_tasks + xhs_tasks
    all_tasks.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return {
        "tasks": all_tasks[:limit],
        "twitter_count": len(twitter_tasks),
        "xiaohongshu_count": len(xhs_tasks),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================
# Admin Actions - 手动触发功能
# ============================================================


@router.post("/actions/scrape-twitter", response_model=Dict[str, Any])
async def trigger_twitter_scrape(
    max_posts: int = Query(10, description="每个用户最多爬取的帖子数"),
    background_tasks: BackgroundTasks = None,
    admin_id: str = Depends(verify_admin),
):
    """
    触发 Twitter KOL 爬取任务
    """
    from app.api.routes.scraper.scrape_routes import scrape_all_kol_profiles

    try:
        result = scrape_all_kol_profiles(
            max_posts_per_user=max_posts,
            platform="twitter",
            background_tasks=background_tasks,
        )
        return {
            "success": True,
            "message": "Twitter scraping started",
            "task_id": result.task_id if hasattr(result, "task_id") else None,
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
        }


@router.post("/actions/scrape-xiaohongshu", response_model=Dict[str, Any])
async def trigger_xhs_scrape(
    max_posts: int = Query(20, description="每个关键词最多爬取的帖子数"),
    background_tasks: BackgroundTasks = None,
    admin_id: str = Depends(verify_admin),
):
    """
    触发小红书爬取任务（使用默认关键词）
    """
    from app.api.routes.xiaohongshu.scrape_routes import scrape_default_keywords

    try:
        result = scrape_default_keywords(
            max_posts=max_posts,
            fetch_details=True,
            background_tasks=background_tasks,
        )
        return {
            "success": True,
            "message": "Xiaohongshu scraping started",
            "task_id": result.task_id if hasattr(result, "task_id") else None,
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
        }


@router.post("/actions/scrape-youtube", response_model=Dict[str, Any])
async def trigger_youtube_scrape(
    max_videos: int = Query(5, description="每个频道最多爬取的视频数"),
    admin_id: str = Depends(verify_admin),
):
    """
    触发 YouTube KOL 视频爬取任务
    """
    try:
        from app.services.youtube import YouTubeScraper
        from app.services.youtube.database import get_supabase_client as get_yt_supabase

        supabase_yt = get_yt_supabase()
        if not supabase_yt:
            return {"success": False, "message": "Supabase unavailable"}

        profiles_result = (
            supabase_yt.table("kol_profiles")
            .select("username, platform_user_id, display_name")
            .eq("is_active", True)
            .eq("platform", "youtube")
            .execute()
        )
        yt_kols = profiles_result.data or []

        if not yt_kols:
            YouTubeScraper.seed_default_kols()
            profiles_result = (
                supabase_yt.table("kol_profiles")
                .select("username, platform_user_id, display_name")
                .eq("is_active", True)
                .eq("platform", "youtube")
                .execute()
            )
            yt_kols = profiles_result.data or []

        kol_list = [
            {
                "channel_id": p["platform_user_id"],
                "handle": p.get("username", ""),
                "display_name": p.get("display_name", ""),
            }
            for p in yt_kols
        ]

        scraper = YouTubeScraper(max_videos=max_videos)
        stats = scraper.batch_scrape(kols=kol_list)

        return {
            "success": True,
            "message": "YouTube scraping completed",
            "stats": stats,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.post("/actions/analyze-news", response_model=Dict[str, Any])
async def trigger_news_analysis(
    limit: int = Query(50, description="分析的新闻数量限制"),
    admin_id: str = Depends(verify_admin),
):
    """
    触发新闻 AI 分析
    """
    from app.services.news_ai_service import NewsAIService

    try:
        service = NewsAIService()
        result = await service.analyze_unanalyzed_news(limit=limit)
        return {
            "success": True,
            "message": "News analysis completed",
            "analyzed": result.get("analyzed", 0),
            "failed": result.get("failed", 0),
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
        }


@router.post("/actions/analyze-posts", response_model=Dict[str, Any])
async def trigger_posts_analysis(
    platform: str = Query("all", description="平台: twitter, xiaohongshu, all"),
    limit: int = Query(50, ge=1, le=500, description="分析的帖子数量限制"),
    background_tasks: BackgroundTasks = None,
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    触发帖子 AI 分析（后台任务）

    - platform: twitter, xiaohongshu, all
    - limit: 最多分析的帖子数量
    """
    try:
        # Get unanalyzed posts count first
        count_query = (
            supabase.table("kol_tweets")
            .select("id", count="exact")
            .is_("ai_analyzed_at", "null")
        )
        if platform != "all":
            count_query = count_query.eq("platform", platform)
        count_response = count_query.execute()
        total_unanalyzed = count_response.count or 0

        if total_unanalyzed == 0:
            return {
                "success": True,
                "message": "No unanalyzed posts found",
                "total_unanalyzed": 0,
                "to_analyze": 0,
            }

        # Get posts to analyze
        query = (
            supabase.table("kol_tweets")
            .select("id, tweet_text, title, platform")
            .is_("ai_analyzed_at", "null")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if platform != "all":
            query = query.eq("platform", platform)

        response = query.execute()
        posts = response.data or []

        if not posts:
            return {
                "success": True,
                "message": "No posts to analyze",
                "total_unanalyzed": total_unanalyzed,
                "to_analyze": 0,
            }

        # Start background analysis task
        if background_tasks:
            background_tasks.add_task(_analyze_posts_batch, posts, supabase)

        return {
            "success": True,
            "message": f"Started analyzing {len(posts)} posts in background",
            "total_unanalyzed": total_unanalyzed,
            "to_analyze": len(posts),
            "status": "processing",
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
        }


async def _analyze_posts_batch(posts: List[Dict], supabase: Client):
    """
    后台批量分析帖子
    """
    from app.services.ai import TweetAnalyzer, OllamaClient

    analyzed = 0
    failed = 0

    try:
        async with OllamaClient() as client:
            analyzer = TweetAnalyzer(client)

            for post in posts:
                try:
                    content = post.get("tweet_text", "")
                    title = post.get("title", "")
                    full_text = f"{title}\n\n{content}" if title else content

                    if not full_text.strip():
                        continue

                    print(f"🤖 Analyzing post #{post['id']}: {full_text[:50]}...")

                    analysis = await analyzer.full_analysis(full_text)

                    # 检查是否是分析失败的默认结果
                    if analysis and not analysis.get("analysis_failed"):
                        sentiment_data = analysis.get("sentiment", {})
                        is_stock_data = analysis.get("is_stock_related", {})
                        trading_signal = analysis.get("trading_signal", {})

                        supabase.table("kol_tweets").update(
                            {
                                "ai_sentiment": sentiment_data.get(
                                    "sentiment", "neutral"
                                ),
                                "ai_sentiment_confidence": sentiment_data.get(
                                    "confidence", 0.0
                                ),
                                "ai_sentiment_reasoning": sentiment_data.get(
                                    "reasoning", ""
                                ),
                                "ai_tickers": analysis.get("tickers", []),
                                "ai_tags": analysis.get("tags", []),
                                "ai_summary": analysis.get("summary", ""),
                                "ai_trading_signal": (
                                    trading_signal if trading_signal else None
                                ),
                                "ai_is_stock_related": is_stock_data.get(
                                    "is_stock_related", False
                                ),
                                "ai_stock_related_confidence": is_stock_data.get(
                                    "confidence", 0.0
                                ),
                                "ai_stock_related_reason": is_stock_data.get(
                                    "reason", ""
                                ),
                                "ai_analyzed_at": datetime.now(
                                    timezone.utc
                                ).isoformat(),
                                "ai_model": analysis.get("model", "unknown"),
                            }
                        ).eq("id", post["id"]).execute()

                        analyzed += 1
                        sentiment = sentiment_data.get("sentiment", "neutral")
                        is_stock = is_stock_data.get("is_stock_related", False)
                        tickers = analysis.get("tickers", [])
                        print(
                            f"  ✅ Done | Stock: {is_stock} | Sentiment: {sentiment} | Tickers: {tickers}"
                        )
                    elif analysis and analysis.get("analysis_failed"):
                        print(
                            f"  ⚠️ AI analysis failed for post #{post['id']}, skipping db update"
                        )
                        failed += 1

                except Exception as e:
                    print(f"  ❌ Failed to analyze post #{post['id']}: {e}")
                    failed += 1

    except Exception as e:
        print(f"❌ Batch analysis failed: {e}")

    print(f"\n📊 Batch analysis complete: {analyzed} analyzed, {failed} failed")


@router.post("/actions/analyze-all-posts", response_model=Dict[str, Any])
async def trigger_analyze_all_posts(
    platform: str = Query("all", description="平台: twitter, xiaohongshu, all"),
    batch_size: int = Query(100, ge=10, le=1000, description="每批次分析数量"),
    max_posts: int = Query(None, description="最大分析数量（不设置则分析所有）"),
    background_tasks: BackgroundTasks = None,
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    🤖 分析所有未分析的帖子（后台任务）

    此功能会在后台批量分析所有未分析的帖子。
    - platform: twitter, xiaohongshu, all
    - batch_size: 每批次处理数量
    - max_posts: 最大处理数量（None = 全部）

    返回 task_id 用于查询进度
    """
    try:
        # Check if there's already a running task
        running_tasks = get_running_ai_tasks()
        if running_tasks:
            return {
                "success": False,
                "message": "An AI analysis task is already running",
                "running_task": running_tasks[0],
            }

        # Get total unanalyzed posts count
        count_query = (
            supabase.table("kol_tweets")
            .select("id", count="exact")
            .is_("ai_analyzed_at", "null")
        )
        if platform != "all":
            count_query = count_query.eq("platform", platform)
        count_response = count_query.execute()
        total_unanalyzed = count_response.count or 0

        if total_unanalyzed == 0:
            return {
                "success": True,
                "message": "No unanalyzed posts found",
                "total_unanalyzed": 0,
                "status": "completed",
            }

        # Calculate how many posts to analyze
        posts_to_analyze = (
            min(total_unanalyzed, max_posts) if max_posts else total_unanalyzed
        )

        # Create task with tracking
        task_id = generate_task_id("ai_analyze")
        create_ai_task(
            task_id=task_id,
            task_type="analyze_all_posts",
            platform=platform,
            total_posts=posts_to_analyze,
            batch_size=batch_size,
        )

        # Start background task
        if background_tasks:
            background_tasks.add_task(
                _analyze_all_posts_task,
                task_id=task_id,
                platform=platform,
                batch_size=batch_size,
                max_posts=posts_to_analyze,
            )

        return {
            "success": True,
            "message": f"Started background analysis of {posts_to_analyze} posts",
            "task_id": task_id,
            "total_unanalyzed": total_unanalyzed,
            "posts_to_analyze": posts_to_analyze,
            "batch_size": batch_size,
            "platform": platform,
            "status": "processing",
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
        }


async def _analyze_all_posts_task(
    task_id: str,
    platform: str,
    batch_size: int,
    max_posts: int,
):
    """
    后台任务：分析所有帖子（带进度跟踪）
    """
    from app.services.ai import TweetAnalyzer, OllamaClient
    from app.core.supabase import get_supabase_service

    supabase = get_supabase_service()
    total_analyzed = 0
    total_failed = 0
    total_skipped = 0
    current_batch = 0

    # Mark task as running
    set_ai_task_running(task_id)

    print(
        f"\n🚀 Starting analysis of up to {max_posts} posts (platform: {platform}, task: {task_id})"
    )

    try:
        async with OllamaClient() as client:
            analyzer = TweetAnalyzer(client)

            while total_analyzed + total_failed + total_skipped < max_posts:
                # Check if task was cancelled
                task = get_ai_task(task_id)
                if task and task.get("status") == AITaskStatus.CANCELLED:
                    print(f"🛑 Task {task_id} was cancelled")
                    break

                current_batch += 1

                # Fetch next batch of unanalyzed posts
                query = (
                    supabase.table("kol_tweets")
                    .select("id, tweet_text, title, platform")
                    .is_("ai_analyzed_at", "null")
                    .order("created_at", desc=True)
                    .limit(batch_size)
                )
                if platform != "all":
                    query = query.eq("platform", platform)

                response = query.execute()
                posts = response.data or []

                if not posts:
                    print(f"📭 No more posts to analyze")
                    break

                print(
                    f"\n📦 Batch {current_batch}: {len(posts)} posts (analyzed: {total_analyzed})"
                )

                for post in posts:
                    if total_analyzed + total_failed + total_skipped >= max_posts:
                        break

                    try:
                        content = post.get("tweet_text", "")
                        title = post.get("title", "")
                        full_text = f"{title}\n\n{content}" if title else content

                        if not full_text.strip():
                            total_skipped += 1
                            continue

                        analysis = await analyzer.full_analysis(full_text)

                        # 检查是否是分析失败的默认结果
                        if analysis and not analysis.get("analysis_failed"):
                            sentiment_data = analysis.get("sentiment", {})
                            is_stock_data = analysis.get("is_stock_related", {})
                            trading_signal = analysis.get("trading_signal", {})

                            supabase.table("kol_tweets").update(
                                {
                                    "ai_sentiment": sentiment_data.get(
                                        "sentiment", "neutral"
                                    ),
                                    "ai_sentiment_confidence": sentiment_data.get(
                                        "confidence", 0.0
                                    ),
                                    "ai_sentiment_reasoning": sentiment_data.get(
                                        "reasoning", ""
                                    ),
                                    "ai_tickers": analysis.get("tickers", []),
                                    "ai_tags": analysis.get("tags", []),
                                    "ai_summary": analysis.get("summary", ""),
                                    "ai_trading_signal": (
                                        trading_signal if trading_signal else None
                                    ),
                                    "ai_is_stock_related": is_stock_data.get(
                                        "is_stock_related", False
                                    ),
                                    "ai_stock_related_confidence": is_stock_data.get(
                                        "confidence", 0.0
                                    ),
                                    "ai_stock_related_reason": is_stock_data.get(
                                        "reason", ""
                                    ),
                                    "ai_analyzed_at": datetime.now(
                                        timezone.utc
                                    ).isoformat(),
                                    "ai_model": analysis.get("model", "unknown"),
                                }
                            ).eq("id", post["id"]).execute()

                            total_analyzed += 1
                        elif analysis and analysis.get("analysis_failed"):
                            total_failed += 1

                    except Exception as e:
                        print(f"  ❌ Failed post #{post['id']}: {e}")
                        total_failed += 1

                    # Update progress every 5 posts
                    if (total_analyzed + total_failed + total_skipped) % 5 == 0:
                        update_ai_task_progress(
                            task_id,
                            analyzed=total_analyzed,
                            failed=total_failed,
                            skipped=total_skipped,
                            current_batch=current_batch,
                        )

                # Update progress after each batch
                update_ai_task_progress(
                    task_id,
                    analyzed=total_analyzed,
                    failed=total_failed,
                    skipped=total_skipped,
                    current_batch=current_batch,
                )

                # Small delay between batches to avoid overwhelming the API
                await asyncio.sleep(0.5)

        # Mark task as completed
        set_ai_task_completed(
            task_id,
            {
                "analyzed_count": total_analyzed,
                "failed_count": total_failed,
                "skipped_count": total_skipped,
            },
        )

    except Exception as e:
        print(f"❌ Analysis task failed: {e}")
        set_ai_task_failed(task_id, str(e))

    print(f"\n✅ Analysis complete! (task: {task_id})")
    print(f"   📊 Total analyzed: {total_analyzed}")
    print(f"   ❌ Total failed: {total_failed}")
    print(f"   ⏭️ Total skipped: {total_skipped}")


@router.post("/actions/sync-investors", response_model=Dict[str, Any])
async def trigger_investor_sync(
    background_tasks: BackgroundTasks = None,
    admin_id: str = Depends(verify_admin),
):
    """
    触发超级投资者数据同步
    """
    from app.api.routes.dataroma.sync_routes import sync_all_api

    try:
        result = sync_all_api(background_tasks=background_tasks)
        return {
            "success": True,
            "message": "Investor sync started",
            "details": result,
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
        }


@router.post("/actions/sync-holdings", response_model=Dict[str, Any])
async def trigger_holdings_sync(
    admin_id: str = Depends(verify_admin),
):
    """
    触发用户持仓同步
    """
    from app.services.scheduler_service import SchedulerService
    from app.core.supabase import get_supabase_service

    try:
        supabase = get_supabase_service()
        scheduler = SchedulerService(supabase=supabase)
        result = await scheduler.trigger_sync_now()
        return {
            "success": True,
            "message": "Holdings sync completed",
            "details": result,
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
        }


@router.post("/actions/fetch-news", response_model=Dict[str, Any])
async def trigger_news_fetch(
    days: int = Query(1, description="获取最近几天的新闻"),
    limit: int = Query(100, description="获取数量限制"),
    admin_id: str = Depends(verify_admin),
):
    """
    触发新闻获取
    """
    from app.api.routes.news import scheduled_fetch_bulk_news

    try:
        await scheduled_fetch_bulk_news(days=days, batch_size=limit)
        return {
            "success": True,
            "message": f"News fetch completed for last {days} days",
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
        }


@router.post("/actions/portfolio-snapshot", response_model=Dict[str, Any])
async def trigger_portfolio_snapshot(
    sync_first: bool = Query(True, description="先同步持仓数据再记录快照"),
    admin_id: str = Depends(verify_admin),
):
    """
    📸 为所有用户记录 Portfolio 快照

    此功能会立即为所有已连接券商账户的用户保存当前的投资组合快照。
    用于生成用户的盈利曲线。

    Args:
        sync_first: 是否先同步持仓数据（默认 True）

    Returns:
        操作结果摘要
    """
    import logging

    logger = logging.getLogger(__name__)

    from app.services.snaptrade.service import SnapTradeService
    from app.services.portfolio_snapshot_service import get_portfolio_snapshot_service

    try:
        supabase = get_supabase_service()
        snaptrade_service = SnapTradeService(supabase=supabase)
        snapshot_service = get_portfolio_snapshot_service()

        logger.info(f"📸 Starting portfolio snapshot (sync_first={sync_first})")

        # 获取所有已连接的用户
        result = (
            supabase.table("snaptrade_connections")
            .select("user_id, snaptrade_user_id, is_connected")
            .eq("is_connected", True)
            .execute()
        )

        if not result.data:
            logger.warning("No connected users found in snaptrade_connections")
            return {
                "success": True,
                "message": "No connected users found",
                "total_users": 0,
                "snapshot_success": 0,
                "snapshot_failed": 0,
            }

        total_users = len(result.data)
        logger.info(f"Found {total_users} connected users")

        success_count = 0
        failed_count = 0
        details = []

        for connection in result.data:
            user_id = connection["user_id"]

            try:
                # 可选：先同步持仓数据
                if sync_first:
                    logger.info(f"Syncing data for user {user_id[:8]}...")
                    await snaptrade_service.sync_accounts(user_id)
                    await snaptrade_service.sync_positions(user_id)

                # 获取持仓数据计算快照
                holdings = await snaptrade_service.get_user_holdings(user_id)

                if not holdings or not holdings.get("accounts"):
                    logger.warning(f"No holdings data for user {user_id[:8]}")
                    details.append(
                        {
                            "user_id": user_id[:8] + "...",
                            "success": False,
                            "reason": "No holdings data",
                        }
                    )
                    failed_count += 1
                    continue

                total_value = 0.0
                total_cost_basis = 0.0
                total_pnl = 0.0
                positions_count = 0
                accounts_count = len(holdings["accounts"])

                for account in holdings["accounts"]:
                    positions = account.get("snaptrade_positions", [])
                    for pos in positions:
                        price = pos.get("price", 0) or 0
                        units = pos.get("units", 0) or 0
                        avg_cost = pos.get("average_purchase_price", 0) or 0
                        position_type = pos.get("position_type", "equity")

                        multiplier = 100 if position_type == "option" else 1
                        position_value = price * units * multiplier
                        cost_basis = avg_cost * units

                        total_value += position_value
                        total_cost_basis += cost_basis
                        positions_count += 1

                        if position_type == "option":
                            pnl = position_value - cost_basis
                        else:
                            pnl = pos.get("open_pnl") or (position_value - cost_basis)
                        total_pnl += pnl

                # 记录快照
                logger.info(
                    f"Recording snapshot for user {user_id[:8]}: value=${total_value:.2f}, positions={positions_count}"
                )
                snapshot_result = await snapshot_service.record_snapshot(
                    user_id=user_id,
                    total_value=total_value,
                    total_cost_basis=total_cost_basis,
                    unrealized_pnl=total_pnl,
                    positions_count=positions_count,
                    accounts_count=accounts_count,
                )
                logger.info(
                    f"✅ Snapshot recorded for user {user_id[:8]}: {snapshot_result}"
                )

                success_count += 1
                details.append(
                    {
                        "user_id": user_id[:8] + "...",
                        "success": True,
                        "value": round(total_value, 2),
                        "pnl": round(total_pnl, 2),
                        "positions": positions_count,
                    }
                )

            except Exception as e:
                logger.error(
                    f"❌ Failed to record snapshot for user {user_id[:8]}: {e}"
                )
                failed_count += 1
                details.append(
                    {"user_id": user_id[:8] + "...", "success": False, "reason": str(e)}
                )

        # 生成更详细的消息
        message = f"Completed: {success_count}/{total_users} users"
        if failed_count > 0:
            message += f" ({failed_count} failed)"

        logger.info(f"📸 Portfolio snapshot complete: {message}")

        return {
            "success": success_count > 0,
            "message": message,
            "total_users": total_users,
            "snapshot_success": success_count,
            "snapshot_failed": failed_count,
            "details": details,
        }

    except Exception as e:
        logger.error(f"❌ Portfolio snapshot error: {e}")
        return {
            "success": False,
            "message": f"Error: {str(e)}",
        }


# ============================================================
# 用户管理
# ============================================================


@router.get("/users", response_model=Dict[str, Any])
async def list_all_users(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（邮箱或用户名）"),
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
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
            query.order("created_at", desc=True)
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
    supabase: Client = Depends(get_supabase_service),
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
    supabase: Client = Depends(get_supabase_service),
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
            response = supabase.table(table).select("id", count="exact").execute()
            stats[table] = response.count or 0
        except:
            stats[table] = "N/A"

    return {
        "tables": stats,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================
# AI 分析功能
# ============================================================


@router.post("/ai/analyze-single/{post_id}", response_model=Dict[str, Any])
async def analyze_single_post(
    post_id: int,
    force: bool = Query(False, description="是否强制重新分析"),
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    🤖 AI 分析单个帖子

    对指定帖子进行 AI 分析
    """
    from app.services.ai import TweetAnalyzer, OllamaClient

    try:
        # 获取帖子
        result = (
            supabase.table("kol_tweets")
            .select("*")
            .eq("id", post_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            return {"success": False, "message": f"帖子不存在: {post_id}"}

        post = result.data[0]

        # 检查是否已分析
        if post.get("ai_analyzed_at") and not force:
            return {
                "success": True,
                "post_id": post_id,
                "message": "帖子已分析，使用 force=true 强制重新分析",
                "cached": True,
                "sentiment": post.get("ai_sentiment"),
                "is_stock_related": post.get("ai_is_stock_related"),
                "tickers": post.get("ai_tickers"),
            }

        content = post.get("tweet_text", "")
        title = post.get("title", "")
        full_text = f"{title}\n\n{content}" if title else content

        if not full_text.strip():
            return {"success": False, "message": "帖子内容为空"}

        # 执行 AI 分析
        async with OllamaClient() as client:
            analyzer = TweetAnalyzer(client)
            analysis = await analyzer.full_analysis(full_text)

        if analysis and not analysis.get("analysis_failed"):
            sentiment_data = analysis.get("sentiment", {})
            is_stock_data = analysis.get("is_stock_related", {})
            trading_signal = analysis.get("trading_signal", {})

            # 更新数据库
            supabase.table("kol_tweets").update(
                {
                    "ai_sentiment": sentiment_data.get("sentiment", "neutral"),
                    "ai_sentiment_confidence": sentiment_data.get("confidence", 0.0),
                    "ai_sentiment_reasoning": sentiment_data.get("reasoning", ""),
                    "ai_tickers": analysis.get("tickers", []),
                    "ai_tags": analysis.get("tags", []),
                    "ai_summary": analysis.get("summary", ""),
                    "ai_trading_signal": trading_signal if trading_signal else None,
                    "ai_is_stock_related": is_stock_data.get("is_stock_related", False),
                    "ai_stock_related_confidence": is_stock_data.get("confidence", 0.0),
                    "ai_stock_related_reason": is_stock_data.get("reason", ""),
                    "ai_analyzed_at": datetime.now(timezone.utc).isoformat(),
                    "ai_model": analysis.get("model", "unknown"),
                }
            ).eq("id", post_id).execute()

            return {
                "success": True,
                "post_id": post_id,
                "cached": False,
                "sentiment": sentiment_data.get("sentiment"),
                "sentiment_confidence": sentiment_data.get("confidence"),
                "is_stock_related": is_stock_data.get("is_stock_related"),
                "tickers": analysis.get("tickers"),
                "tags": analysis.get("tags"),
                "summary": analysis.get("summary"),
                "model": analysis.get("model"),
            }
        else:
            return {"success": False, "message": "AI 分析失败"}

    except Exception as e:
        return {"success": False, "message": str(e)}


@router.get("/ai/top-tickers", response_model=Dict[str, Any])
async def get_top_tickers(
    limit: int = Query(20, ge=1, le=100, description="返回数量"),
    platform: str = Query("all", description="平台: twitter, xiaohongshu, all"),
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    📈 获取热门股票代码

    返回被提及最多的股票代码及其帖子数量
    """
    try:
        query = (
            supabase.table("kol_tweets")
            .select("ai_tickers")
            .not_.is_("ai_tickers", "null")
        )

        if platform != "all":
            query = query.eq("platform", platform)

        result = query.execute()

        # 统计 ticker 出现次数
        ticker_counts = {}
        for row in result.data or []:
            tickers = row.get("ai_tickers", [])
            if tickers:
                for ticker in tickers:
                    ticker_counts[ticker] = ticker_counts.get(ticker, 0) + 1

        # 排序并取 top N
        sorted_tickers = sorted(
            ticker_counts.items(), key=lambda x: x[1], reverse=True
        )[:limit]

        return {
            "success": True,
            "tickers": [{"ticker": t[0], "count": t[1]} for t in sorted_tickers],
            "total_unique_tickers": len(ticker_counts),
            "platform": platform,
        }

    except Exception as e:
        return {"success": False, "message": str(e)}


@router.post("/ai/analyze-by-ids", response_model=Dict[str, Any])
async def analyze_posts_by_ids(
    post_ids: List[int],
    force: bool = Query(False, description="是否强制重新分析"),
    background_tasks: BackgroundTasks = None,
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    🤖 按 ID 列表分析帖子

    对指定的帖子 ID 列表进行 AI 分析（后台任务）
    """
    if not post_ids:
        return {"success": False, "message": "帖子 ID 列表不能为空"}

    try:
        # 查询指定的帖子
        result = (
            supabase.table("kol_tweets")
            .select("id, tweet_text, title, platform, ai_analyzed_at")
            .in_("id", post_ids)
            .execute()
        )

        posts = result.data or []

        if not posts:
            return {"success": True, "message": "未找到指定的帖子", "total": 0}

        # 过滤掉已分析的（除非 force）
        if not force:
            posts = [p for p in posts if not p.get("ai_analyzed_at")]

        if not posts:
            return {"success": True, "message": "所有帖子已分析完成", "total": 0}

        # 启动后台任务
        if background_tasks:
            background_tasks.add_task(_analyze_posts_batch, posts, supabase)

        return {
            "success": True,
            "message": f"已启动分析任务，共 {len(posts)} 个帖子",
            "total": len(posts),
            "status": "processing",
        }

    except Exception as e:
        return {"success": False, "message": str(e)}


@router.get("/ai/analysis-stats", response_model=Dict[str, Any])
async def get_ai_analysis_stats(
    platform: str = Query("all", description="平台: twitter, xiaohongshu, all"),
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    获取 AI 分析统计数据

    返回：
    - 总帖子数
    - 已分析数
    - 未分析数
    - 股票相关数
    - 情感分布
    - 分析覆盖率
    """

    def safe_count(query_builder) -> int:
        try:
            response = query_builder.execute()
            return response.count or 0
        except Exception:
            return 0

    try:
        # Base queries
        base = supabase.table("kol_tweets").select("id", count="exact")
        if platform != "all":
            base = base.eq("platform", platform)

        # Total posts
        total_count = safe_count(base)

        # Analyzed posts
        analyzed_query = (
            supabase.table("kol_tweets")
            .select("id", count="exact")
            .not_.is_("ai_analyzed_at", "null")
        )
        if platform != "all":
            analyzed_query = analyzed_query.eq("platform", platform)
        analyzed_count = safe_count(analyzed_query)

        # Unanalyzed posts
        unanalyzed_query = (
            supabase.table("kol_tweets")
            .select("id", count="exact")
            .is_("ai_analyzed_at", "null")
        )
        if platform != "all":
            unanalyzed_query = unanalyzed_query.eq("platform", platform)
        unanalyzed_count = safe_count(unanalyzed_query)

        # Stock related posts
        stock_query = (
            supabase.table("kol_tweets")
            .select("id", count="exact")
            .eq("ai_is_stock_related", True)
        )
        if platform != "all":
            stock_query = stock_query.eq("platform", platform)
        stock_related_count = safe_count(stock_query)

        # Sentiment distribution
        def count_sentiment(sentiment: str) -> int:
            query = (
                supabase.table("kol_tweets")
                .select("id", count="exact")
                .eq("ai_sentiment", sentiment)
            )
            if platform != "all":
                query = query.eq("platform", platform)
            return safe_count(query)

        bullish_count = count_sentiment("bullish")
        bearish_count = count_sentiment("bearish")
        neutral_count = count_sentiment("neutral")

        # Calculate analysis rate
        analysis_rate = (
            round(analyzed_count / total_count * 100, 2) if total_count > 0 else 0
        )

        return {
            "success": True,
            "platform": platform,
            "total_posts": total_count,
            "analyzed_posts": analyzed_count,
            "unanalyzed_posts": unanalyzed_count,
            "stock_related_posts": stock_related_count,
            "sentiment_distribution": {
                "bullish": bullish_count,
                "bearish": bearish_count,
                "neutral": neutral_count,
            },
            "analysis_rate": analysis_rate,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analysis stats: {str(e)}",
        )


# ============================================================
# AI 任务状态管理
# ============================================================


@router.get("/ai/tasks", response_model=Dict[str, Any])
async def get_ai_tasks(
    limit: int = Query(10, ge=1, le=50, description="返回数量"),
    status_filter: Optional[str] = Query(
        None, description="按状态筛选: running, completed, failed"
    ),
    admin_id: str = Depends(verify_admin),
):
    """
    📋 获取 AI 分析任务列表

    返回最近的 AI 分析任务及其状态
    """
    tasks = list_ai_tasks(limit=limit, status=status_filter)
    running_tasks = get_running_ai_tasks()

    return {
        "success": True,
        "tasks": tasks,
        "total": len(tasks),
        "has_running": len(running_tasks) > 0,
        "running_count": len(running_tasks),
    }


@router.get("/ai/tasks/running/current", response_model=Dict[str, Any])
async def get_current_running_task(
    admin_id: str = Depends(verify_admin),
):
    """
    🔄 获取当前正在运行的 AI 任务

    如果有正在运行的任务，返回其状态；否则返回空
    """
    running_tasks = get_running_ai_tasks()

    if not running_tasks:
        return {
            "success": True,
            "has_running": False,
            "task": None,
        }

    return {
        "success": True,
        "has_running": True,
        "task": running_tasks[0],
    }


@router.get("/ai/tasks/{task_id}", response_model=Dict[str, Any])
async def get_ai_task_status(
    task_id: str,
    admin_id: str = Depends(verify_admin),
):
    """
    📊 获取 AI 分析任务详情

    返回指定任务的详细状态和进度
    """
    task = get_ai_task(task_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found: {task_id}",
        )

    return {
        "success": True,
        "task": task,
    }


@router.post("/ai/tasks/{task_id}/cancel", response_model=Dict[str, Any])
async def cancel_running_ai_task(
    task_id: str,
    admin_id: str = Depends(verify_admin),
):
    """
    🛑 取消正在运行的 AI 任务
    """
    task = get_ai_task(task_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found: {task_id}",
        )

    if task.get("status") != AITaskStatus.RUNNING:
        return {
            "success": False,
            "message": f"Task is not running (status: {task.get('status')})",
        }

    success = cancel_ai_task(task_id)

    return {
        "success": success,
        "message": (
            "Task cancellation requested" if success else "Failed to cancel task"
        ),
        "task_id": task_id,
    }


# ============================================================
# KOL 管理 (CRUD)
# ============================================================


@router.get("/kols", response_model=Dict[str, Any])
async def list_kols(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（用户名或昵称）"),
    platform: Optional[str] = Query(None, description="平台筛选: twitter, xiaohongshu"),
    is_active: Optional[bool] = Query(None, description="是否活跃"),
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    获取 KOL 列表（管理员 CRUD）

    支持分页、搜索、按平台/活跃状态筛选
    """
    try:
        offset = (page - 1) * page_size

        query = supabase.table("kol_profiles").select("*", count="exact")

        if search:
            query = query.or_(
                f"username.ilike.%{search}%,display_name.ilike.%{search}%"
            )
        if platform:
            query = query.eq("platform", platform)
        if is_active is not None:
            query = query.eq("is_active", is_active)

        response = (
            query.order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        # Fetch post counts per KOL
        kols = response.data or []
        for kol in kols:
            try:
                count_resp = (
                    supabase.table("kol_tweets")
                    .select("id", count="exact")
                    .eq("username", kol.get("username", ""))
                    .eq("platform", kol.get("platform", "twitter"))
                    .execute()
                )
                kol["posts_count"] = count_resp.count or 0
            except Exception:
                kol["posts_count"] = 0

            try:
                sub_resp = (
                    supabase.table("kol_subscriptions")
                    .select("id", count="exact")
                    .eq("kol_username", kol.get("username", ""))
                    .eq("platform", kol.get("platform", "twitter"))
                    .execute()
                )
                kol["subscribers_count"] = sub_resp.count or 0
            except Exception:
                kol["subscribers_count"] = 0

        return {
            "kols": kols,
            "total": response.count or 0,
            "page": page,
            "page_size": page_size,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list KOLs: {str(e)}",
        )


@router.get("/kols/{kol_id}", response_model=Dict[str, Any])
async def get_kol_detail(
    kol_id: int,
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    获取单个 KOL 详情
    """
    try:
        response = (
            supabase.table("kol_profiles")
            .select("*")
            .eq("id", kol_id)
            .single()
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"KOL not found: {kol_id}",
            )

        kol = response.data

        # Fetch recent posts
        posts_resp = (
            supabase.table("kol_tweets")
            .select("*")
            .eq("username", kol.get("username", ""))
            .eq("platform", kol.get("platform", "twitter"))
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )

        return {
            "kol": kol,
            "recent_posts": posts_resp.data or [],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get KOL: {str(e)}",
        )


@router.post("/kols", response_model=Dict[str, Any])
async def create_kol(
    kol_data: Dict[str, Any],
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    创建新 KOL

    必填字段: platform, username
    可选字段: display_name, avatar_url, bio, location, website, profile_url,
             is_verified, followers_count, following_count, platform_user_id,
             rest_id, red_id, banner_url
    """
    required_fields = ["platform", "username"]
    for field in required_fields:
        if field not in kol_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required field: {field}",
            )

    allowed_platforms = ["twitter", "xiaohongshu", "reddit", "youtube"]
    if kol_data["platform"] not in allowed_platforms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid platform. Must be one of: {', '.join(allowed_platforms)}",
        )

    try:
        # Check for duplicate
        existing = (
            supabase.table("kol_profiles")
            .select("id")
            .eq("platform", kol_data["platform"])
            .eq("username", kol_data["username"])
            .execute()
        )

        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"KOL already exists: {kol_data['username']} on {kol_data['platform']}",
            )

        allowed_fields = {
            "platform", "username", "display_name", "avatar_url", "banner_url",
            "bio", "location", "website", "profile_url", "platform_user_id",
            "is_verified", "verification_type", "followers_count", "following_count",
            "likes_count", "collected_count", "rest_id", "red_id", "is_active",
        }
        insert_data = {k: v for k, v in kol_data.items() if k in allowed_fields}
        insert_data.setdefault("is_active", True)
        insert_data["created_at"] = datetime.now(timezone.utc).isoformat()
        insert_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        response = supabase.table("kol_profiles").insert(insert_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create KOL",
            )

        return {
            "success": True,
            "message": f"KOL created: {kol_data['username']}",
            "kol": response.data[0],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create KOL: {str(e)}",
        )


@router.put("/kols/{kol_id}", response_model=Dict[str, Any])
async def update_kol(
    kol_id: int,
    kol_data: Dict[str, Any],
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    更新 KOL 信息
    """
    try:
        existing = (
            supabase.table("kol_profiles")
            .select("id")
            .eq("id", kol_id)
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"KOL not found: {kol_id}",
            )

        allowed_fields = {
            "username", "display_name", "avatar_url", "banner_url", "bio",
            "location", "website", "profile_url", "platform_user_id",
            "is_verified", "verification_type", "followers_count", "following_count",
            "likes_count", "collected_count", "rest_id", "red_id", "is_active",
        }
        update_data = {k: v for k, v in kol_data.items() if k in allowed_fields}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields to update",
            )

        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        response = (
            supabase.table("kol_profiles")
            .update(update_data)
            .eq("id", kol_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update KOL",
            )

        return {
            "success": True,
            "message": "KOL updated successfully",
            "kol": response.data[0],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update KOL: {str(e)}",
        )


@router.delete("/kols/{kol_id}", response_model=Dict[str, Any])
async def delete_kol(
    kol_id: int,
    delete_posts: bool = Query(False, description="是否同时删除该 KOL 的所有帖子"),
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    删除 KOL

    可选择同时删除该 KOL 的所有帖子
    """
    try:
        existing = (
            supabase.table("kol_profiles")
            .select("id, username, platform")
            .eq("id", kol_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"KOL not found: {kol_id}",
            )

        kol = existing.data
        deleted_posts_count = 0

        if delete_posts:
            posts_resp = (
                supabase.table("kol_tweets")
                .delete()
                .eq("username", kol["username"])
                .eq("platform", kol["platform"])
                .execute()
            )
            deleted_posts_count = len(posts_resp.data) if posts_resp.data else 0

        # Delete subscriptions
        try:
            supabase.table("kol_subscriptions").delete().eq(
                "kol_username", kol["username"]
            ).eq("platform", kol["platform"]).execute()
        except Exception:
            pass

        # Delete the KOL profile
        supabase.table("kol_profiles").delete().eq("id", kol_id).execute()

        return {
            "success": True,
            "message": f"KOL deleted: {kol['username']}",
            "deleted_posts_count": deleted_posts_count,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete KOL: {str(e)}",
        )


@router.patch("/kols/{kol_id}/toggle-active", response_model=Dict[str, Any])
async def toggle_kol_active(
    kol_id: int,
    is_active: bool = Query(..., description="是否激活"),
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    切换 KOL 的活跃状态
    """
    try:
        response = (
            supabase.table("kol_profiles")
            .update({
                "is_active": is_active,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", kol_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"KOL not found: {kol_id}",
            )

        return {
            "success": True,
            "kol_id": kol_id,
            "is_active": is_active,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle KOL active status: {str(e)}",
        )
