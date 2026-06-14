"""
Kolvex Backend API
FastAPI 应用入口
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
from datetime import datetime, timezone

# 导入路由和配置
from app.api.routes import api_router
from app.core.config import settings
from app.core.redis import init_redis, close_redis, get_redis

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# 定时任务调度器
scheduler = None
scheduler_job_health = {}


def setup_scheduler():
    """设置定时任务调度器"""
    global scheduler

    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        from apscheduler.triggers.cron import CronTrigger
        from apscheduler.events import (
            EVENT_JOB_ERROR,
            EVENT_JOB_EXECUTED,
            EVENT_JOB_MISSED,
        )

        scheduler = AsyncIOScheduler()

        def record_job_event(event):
            now = datetime.now(timezone.utc).isoformat()
            status = "success"
            error_message = None

            if event.code == EVENT_JOB_ERROR:
                status = "error"
                error_message = str(event.exception)
                logger.error(
                    "❌ [SCHEDULER] Job %s failed: %s",
                    event.job_id,
                    error_message,
                )
            elif event.code == EVENT_JOB_MISSED:
                status = "missed"
                error_message = "Job missed its scheduled run window"
                logger.warning("⚠️ [SCHEDULER] Job %s missed", event.job_id)
            else:
                logger.info("✅ [SCHEDULER] Job %s finished", event.job_id)

            scheduler_job_health[event.job_id] = {
                "last_status": status,
                "last_run_at": now,
                "last_error": error_message,
            }

        scheduler.add_listener(
            record_job_event,
            EVENT_JOB_EXECUTED | EVENT_JOB_ERROR | EVENT_JOB_MISSED,
        )

        # ============================================================
        # 任务 1: 每小时获取 KOL 标的新闻（按 ticker 查询）
        # ============================================================
        async def scheduled_kol_news_fetch():
            """定时任务：获取 KOL 标的新闻"""
            from app.api.routes.news import scheduled_fetch_kol_news

            logger.info("⏰ [KOL] 定时任务触发: 开始获取 KOL 标的新闻")
            try:
                await scheduled_fetch_kol_news(
                    limit_per_ticker=10,
                    days=7,
                    max_concurrent=3,
                )
            except Exception as e:
                logger.error(f"❌ [KOL] 定时任务执行失败: {e}")

        scheduler.add_job(
            scheduled_kol_news_fetch,
            IntervalTrigger(hours=1),
            id="fetch_kol_news",
            name="获取 KOL 标的新闻",
            replace_existing=True,
        )

        # ============================================================
        # 任务 2: 每小时获取全量新闻（不按 ticker 过滤）
        # ============================================================
        async def scheduled_bulk_news_fetch():
            """定时任务：获取全量新闻"""
            from app.api.routes.news import (
                scheduled_fetch_bulk_news,
                bulk_news_scheduler_status,
            )

            logger.info("⏰ [BULK] 定时任务触发: 开始获取全量新闻")
            try:
                await scheduled_fetch_bulk_news(days=1, batch_size=100)
            except Exception as e:
                logger.error(f"❌ [BULK] 定时任务执行失败: {e}")

        scheduler.add_job(
            scheduled_bulk_news_fetch,
            IntervalTrigger(hours=1),
            id="fetch_bulk_news",
            name="获取全量新闻",
            replace_existing=True,
        )

        # ============================================================
        # 任务 2b: 每 30 分钟爬取 FinancialJuice 新闻
        # ============================================================
        async def scheduled_financial_juice_fetch():
            """定时任务：Playwright 爬取 FinancialJuice 并触发 AI 分析"""
            import asyncio
            from app.services.financial_juice_scraper import scrape_financial_juice_news
            from app.api.routes.news import save_articles_to_db
            from app.services.news_ai_service import auto_analyze_news_after_scrape

            logger.info("⏰ [FJ] 定时任务触发: 开始爬取 FinancialJuice 新闻")
            try:
                loop = asyncio.get_event_loop()
                articles = await loop.run_in_executor(
                    None,
                    lambda: scrape_financial_juice_news(headless=True),
                )

                total_saved = 0
                if articles:
                    total_saved = await save_articles_to_db(
                        articles, source="financial_juice"
                    )

                if total_saved > 0:
                    await auto_analyze_news_after_scrape(
                        limit=min(20, total_saved),
                        max_concurrent=3,
                    )

                logger.info(
                    f"✅ [FJ] 完成: 获取 {len(articles)} 条, 保存 {total_saved} 条"
                )
            except Exception as e:
                logger.error(f"❌ [FJ] 定时任务执行失败: {e}")

        scheduler.add_job(
            scheduled_financial_juice_fetch,
            IntervalTrigger(minutes=30),
            id="fetch_financial_juice",
            name="爬取 FinancialJuice 新闻",
            replace_existing=True,
        )

        # ============================================================
        # 任务 3: 每 2 小时抓取 KOL 推文/帖子
        # ============================================================
        def scheduled_scrape_kol_tweets():
            """定时任务：抓取所有 KOL 的最新推文"""
            from app.services.scraper import BatchKOLScraper, load_cookies, get_supabase_client
            from app.services.xiaohongshu import XiaohongshuScraper
            from app.services.xiaohongshu.scraper import load_cookies as load_xhs_cookies

            logger.info("⏰ [SCRAPE] 定时任务触发: 开始抓取 KOL 推文/帖子")
            
            try:
                supabase = get_supabase_client()
                if not supabase:
                    logger.warning("❌ [SCRAPE] Supabase 未连接，跳过抓取")
                    return
                
                # 获取活跃的 KOL 列表
                profiles_result = (
                    supabase.table("kol_profiles")
                    .select("username, platform, platform_user_id")
                    .eq("is_active", True)
                    .execute()
                )
                kol_profiles = profiles_result.data or []
                
                if not kol_profiles:
                    logger.info("📭 [SCRAPE] 没有活跃的 KOL")
                    return
                
                # 按平台分组
                twitter_kols = []
                xhs_kols = []
                
                for profile in kol_profiles:
                    plat = profile.get("platform", "twitter")
                    if plat == "twitter":
                        twitter_kols.append(profile["username"])
                    elif plat == "xiaohongshu":
                        xhs_kols.append({
                            "username": profile["username"],
                            "user_id": profile.get("platform_user_id"),
                        })
                
                # 抓取 Twitter
                if twitter_kols and load_cookies():
                    logger.info(f"🐦 [SCRAPE] 抓取 Twitter: {len(twitter_kols)} 个 KOL")
                    try:
                        scraper = BatchKOLScraper(headless=True, max_posts_per_user=5)
                        stats = scraper.batch_scrape(usernames=twitter_kols)
                        logger.info(f"✅ [SCRAPE] Twitter 完成: {stats}")
                    except Exception as e:
                        logger.error(f"❌ [SCRAPE] Twitter 抓取失败: {e}")
                
                # 抓取小红书
                if xhs_kols and load_xhs_cookies():
                    logger.info(f"📕 [SCRAPE] 抓取小红书: {len(xhs_kols)} 个 KOL")
                    try:
                        xhs_scraper = XiaohongshuScraper(headless=True)
                        for kol in xhs_kols[:10]:
                            try:
                                xhs_scraper.scrape_user_posts(
                                    user_id=kol["user_id"],
                                    username=kol["username"],
                                    max_posts=5,
                                )
                            except Exception as e:
                                logger.warning(f"⚠️ [SCRAPE] 小红书 {kol['username']} 失败: {e}")
                        xhs_scraper.close()
                        logger.info("✅ [SCRAPE] 小红书完成")
                    except Exception as e:
                        logger.error(f"❌ [SCRAPE] 小红书抓取失败: {e}")
                
                logger.info("✅ [SCRAPE] 定时抓取任务完成")
                
            except Exception as e:
                logger.error(f"❌ [SCRAPE] 定时任务执行失败: {e}")

        # YouTube-specific scraper (runs on its own schedule)
        def scheduled_scrape_youtube():
            """定时任务：抓取 YouTube KOL 最新视频"""
            from app.services.youtube import YouTubeScraper
            from app.services.youtube.database import get_supabase_client as get_yt_supabase

            logger.info("⏰ [YOUTUBE] 定时任务触发: 开始抓取 YouTube KOL 视频")
            try:
                supabase = get_yt_supabase()
                if not supabase:
                    logger.warning("❌ [YOUTUBE] Supabase 未连接，跳过")
                    return

                # Fetch active YouTube KOLs from DB
                profiles_result = (
                    supabase.table("kol_profiles")
                    .select("username, platform, platform_user_id, display_name")
                    .eq("is_active", True)
                    .eq("platform", "youtube")
                    .execute()
                )
                yt_kols = profiles_result.data or []

                if not yt_kols:
                    logger.info("📭 [YOUTUBE] 没有活跃的 YouTube KOL，尝试 seed 默认列表")
                    YouTubeScraper.seed_default_kols()
                    # Re-fetch after seeding
                    profiles_result = (
                        supabase.table("kol_profiles")
                        .select("username, platform, platform_user_id, display_name")
                        .eq("is_active", True)
                        .eq("platform", "youtube")
                        .execute()
                    )
                    yt_kols = profiles_result.data or []

                if not yt_kols:
                    logger.info("📭 [YOUTUBE] 仍然没有 YouTube KOL，跳过")
                    return

                kol_list = [
                    {
                        "channel_id": p["platform_user_id"],
                        "handle": p.get("username", ""),
                        "display_name": p.get("display_name", ""),
                    }
                    for p in yt_kols
                ]

                logger.info(f"▶️ [YOUTUBE] 抓取 {len(kol_list)} 个 YouTube KOL")
                scraper = YouTubeScraper(max_videos=5)
                stats = scraper.batch_scrape(kols=kol_list)
                logger.info(f"✅ [YOUTUBE] 完成: {stats}")

            except Exception as e:
                logger.error(f"❌ [YOUTUBE] 定时任务执行失败: {e}")

        scheduler.add_job(
            scheduled_scrape_kol_tweets,
            IntervalTrigger(hours=2),
            id="scrape_kol_tweets",
            name="抓取 KOL 推文/帖子",
            replace_existing=True,
        )

        # ============================================================
        # 任务 3b: 每日 2 次抓取 YouTube KOL 视频 (8:00 / 20:00 UTC)
        # ============================================================
        scheduler.add_job(
            scheduled_scrape_youtube,
            CronTrigger(hour="8,20", minute=0),
            id="scrape_youtube_kols",
            name="抓取 YouTube KOL 视频",
            replace_existing=True,
            misfire_grace_time=3600,
        )

        # ============================================================
        # 任务 4: 每天自动同步官方直连券商账户
        # ============================================================
        # Robinhood uses a cached OAuth session. Run it sequentially after
        # market close because robin_stocks keeps module-level auth state.
        async def scheduled_robinhood_sync():
            from app.services.scheduler_service import SchedulerService

            logger.info("⏰ [ROBINHOOD] 定时任务触发: 开始自动同步所有账户")
            service = SchedulerService()
            try:
                summary = await service.sync_all_robinhood_accounts()
                logger.info(
                    "✅ [ROBINHOOD] 自动同步完成 - 用户: %s, 成功: %s, 失败: %s",
                    summary.get("total_users", 0),
                    summary.get("success_count", 0),
                    summary.get("error_count", 0),
                )
            except Exception as error:
                logger.exception("❌ [ROBINHOOD] 自动同步任务失败: %s", error)
                raise

        scheduler.add_job(
            scheduled_robinhood_sync,
            CronTrigger(
                day_of_week="mon-fri",
                hour=14,
                minute=15,
                timezone="America/Los_Angeles",
            ),
            id="robinhood_daily_sync",
            name="Robinhood 每日自动同步 - 下午 2:15 PST",
            replace_existing=True,
            misfire_grace_time=7200,
            max_instances=1,
            coalesce=True,
        )

        # ============================================================
        # 任务 5: 盘中每 30 分钟扫描期权异动
        # 美东时间 9:30-16:00 → 美西时间 6:30-13:00
        # ============================================================
        def scheduled_options_flow_scan():
            """定时任务：扫描期权异动"""
            from app.services.options_flow.service import get_options_flow_service

            logger.info("⏰ [OPTIONS] 定时任务触发: 开始扫描期权异动")
            try:
                service = get_options_flow_service()
                results = service.scan_multiple(max_expirations=3)
                if results:
                    saved = service.save_results(results)
                    logger.info(
                        f"✅ [OPTIONS] 扫描完成 - 发现 {len(results)} 条异动, "
                        f"已保存 {saved} 条"
                    )
                else:
                    logger.info("📭 [OPTIONS] 本轮扫描未发现异动")
            except Exception as e:
                logger.error(f"❌ [OPTIONS] 定时任务执行失败: {e}")

        scheduler.add_job(
            scheduled_options_flow_scan,
            CronTrigger(
                day_of_week="mon-fri",
                hour="6-13",
                minute="0,30",
                timezone="America/Los_Angeles",
            ),
            id="options_flow_scan",
            name="期权异动扫描 - 盘中每30分钟",
            replace_existing=True,
            misfire_grace_time=1800,
        )

        # ============================================================
        # 任务: 每日预热 Stock Screener 缓存 (美东 6:00)
        # ============================================================
        from app.services.stock_screener.screener_service import StockScreenerService
        from app.services.stock_screener.symbols import SP500_SYMBOLS

        async def scheduled_screener_cache_warm():
            """Pre-warm S&P 500 financial data into Redis for the stock screener."""
            logger.info("⏰ [SCREENER] 开始预热 S&P 500 数据缓存")
            try:
                count = await StockScreenerService.warm_cache(SP500_SYMBOLS)
                logger.info(f"✅ [SCREENER] 缓存预热完成: {count} stocks")
            except Exception as e:
                logger.error(f"❌ [SCREENER] 缓存预热失败: {e}")

        scheduler.add_job(
            scheduled_screener_cache_warm,
            CronTrigger(hour=6, minute=0, timezone="America/New_York"),
            id="screener_cache_warm",
            name="Stock Screener 缓存预热",
            replace_existing=True,
        )

        scheduler.start()
        logger.info("✅ 定时任务调度器已启动")

        # Do not wait until the next 6:00 AM run after a deploy or Redis reset.
        # The service guards against duplicate warm tasks in this process.
        StockScreenerService.start_background_warm()

        # 更新 KOL 任务状态
        kol_job = scheduler.get_job("fetch_kol_news")
        if kol_job:
            from app.api.routes.news import scheduler_status

            scheduler_status.next_run_at = kol_job.next_run_time
            logger.info(f"📅 [KOL] 下次执行时间: {kol_job.next_run_time}")

        # 更新批量新闻任务状态
        bulk_job = scheduler.get_job("fetch_bulk_news")
        if bulk_job:
            from app.api.routes.news import bulk_news_scheduler_status

            bulk_news_scheduler_status.is_enabled = True
            bulk_news_scheduler_status.next_run_at = bulk_job.next_run_time
            logger.info(f"📅 [BULK] 下次执行时间: {bulk_job.next_run_time}")

        # 更新抓取任务状态
        scrape_job = scheduler.get_job("scrape_kol_tweets")
        if scrape_job:
            logger.info(f"📅 [SCRAPE] 下次执行时间: {scrape_job.next_run_time}")
        
        # 更新持仓同步任务状态
        holdings_morning_job = scheduler.get_job("portfolio_snapshot_morning")
        if holdings_morning_job:
            logger.info(f"📅 [HOLDINGS] 早上同步下次执行时间: {holdings_morning_job.next_run_time}")
        
        holdings_noon_job = scheduler.get_job("portfolio_snapshot_noon")
        if holdings_noon_job:
            logger.info(f"📅 [HOLDINGS] 中午同步下次执行时间: {holdings_noon_job.next_run_time}")

        holdings_afternoon_job = scheduler.get_job("portfolio_snapshot_afternoon")
        if holdings_afternoon_job:
            logger.info(f"📅 [HOLDINGS] 下午同步下次执行时间: {holdings_afternoon_job.next_run_time}")

        robinhood_job = scheduler.get_job("robinhood_daily_sync")
        if robinhood_job:
            logger.info(
                "📅 [ROBINHOOD] 每日自动同步下次执行时间: %s",
                robinhood_job.next_run_time,
            )

        options_flow_job = scheduler.get_job("options_flow_scan")
        if options_flow_job:
            logger.info(f"📅 [OPTIONS] 期权异动扫描下次执行时间: {options_flow_job.next_run_time}")

        screener_job = scheduler.get_job("screener_cache_warm")
        if screener_job:
            logger.info(f"📅 [SCREENER] Stock Screener 缓存预热下次执行时间: {screener_job.next_run_time}")

        youtube_job = scheduler.get_job("scrape_youtube_kols")
        if youtube_job:
            logger.info(f"📅 [YOUTUBE] YouTube KOL 抓取下次执行时间: {youtube_job.next_run_time}")

    except ImportError:
        logger.warning("⚠️ APScheduler 未安装，定时任务功能不可用")
    except Exception as e:
        logger.error(f"❌ 定时任务调度器启动失败: {e}")


def shutdown_scheduler():
    """关闭定时任务调度器"""
    global scheduler
    if scheduler:
        scheduler.shutdown()
        logger.info("🛑 定时任务调度器已关闭")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    print("🚀 Starting Kolvex Backend API...")
    print(f"📝 API Version: {settings.APP_VERSION}")
    print(f"🌐 CORS Origins: {settings.ALLOWED_ORIGINS}")

    # 初始化 Redis
    await init_redis()

    # 清理上次残留的 running 状态分析
    from app.services.trading_analysis_service import get_trading_analysis_service
    get_trading_analysis_service().cleanup_stale_analyses()

    # 启动定时任务
    setup_scheduler()

    yield

    # 关闭时执行
    shutdown_scheduler()
    await close_redis()
    print("👋 Shutting down Kolvex Backend API...")


# 创建 FastAPI 应用
app = FastAPI(
    title=settings.APP_NAME,
    description="Kolvex 股票分析平台后端 API - 用户管理与 Supabase Auth 集成",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "Welcome to Kolvex API",
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc",
    }


@app.get("/health")
async def health_check():
    """健康检查端点 - 用于 Railway 部署"""
    redis = get_redis()
    redis_health = await redis.health_check()
    
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "redis": redis_health,
    }


# 注册 API 路由
app.include_router(api_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
