"""
Kolvex Backend API
FastAPI 应用入口
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

# 导入路由和配置
from app.api.routes import api_router
from app.core.config import settings

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# 定时任务调度器
scheduler = None


def setup_scheduler():
    """设置定时任务调度器"""
    global scheduler

    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        from apscheduler.triggers.cron import CronTrigger

        scheduler = AsyncIOScheduler()

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
                        for kol in xhs_kols[:10]:  # 限制每次最多 10 个
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

        scheduler.add_job(
            scheduled_scrape_kol_tweets,
            IntervalTrigger(hours=2),
            id="scrape_kol_tweets",
            name="抓取 KOL 推文/帖子",
            replace_existing=True,
        )

        # ============================================================
        # 任务 4: 每天自动同步所有用户的持仓数据
        # ============================================================
        async def scheduled_sync_all_holdings():
            """定时任务：同步所有用户持仓数据"""
            from app.services.snaptrade.service import SnapTradeService
            from app.core.supabase import get_supabase_service
            
            logger.info("⏰ [HOLDINGS] 定时任务触发: 开始同步所有用户持仓")
            try:
                supabase = get_supabase_service()
                snaptrade_service = SnapTradeService(supabase=supabase)
                
                # 获取所有已连接 SnapTrade 的用户
                result = (
                    supabase.table("snaptrade_connections")
                    .select("user_id, snaptrade_user_id, is_connected")
                    .eq("is_connected", True)
                    .execute()
                )
                
                if not result.data:
                    logger.info("📭 [HOLDINGS] 没有已连接的用户需要同步")
                    return
                
                total_users = len(result.data)
                success_count = 0
                error_count = 0
                
                logger.info(f"📊 [HOLDINGS] 找到 {total_users} 个已连接的用户")
                
                # 逐个同步用户的持仓数据
                for connection in result.data:
                    user_id = connection["user_id"]
                    try:
                        # 先同步账户
                        await snaptrade_service.sync_accounts(user_id)
                        # 再同步持仓
                        positions = await snaptrade_service.sync_positions(user_id)
                        success_count += 1
                        logger.info(f"✅ [HOLDINGS] 用户 {user_id[:8]}... 同步成功，共 {len(positions)} 个持仓")
                    except Exception as e:
                        error_count += 1
                        logger.error(f"❌ [HOLDINGS] 用户 {user_id[:8]}... 同步失败: {e}")
                
                logger.info(
                    f"✅ [HOLDINGS] 持仓同步完成 - "
                    f"总计: {total_users}, 成功: {success_count}, 失败: {error_count}"
                )
                
            except Exception as e:
                logger.error(f"❌ [HOLDINGS] 定时任务执行失败: {e}")

        # 每天早上 8:00 UTC (美东时间凌晨 3:00/4:00) 同步
        scheduler.add_job(
            scheduled_sync_all_holdings,
            CronTrigger(hour=8, minute=0),
            id="sync_all_holdings_morning",
            name="每日早上同步所有用户持仓",
            replace_existing=True,
            misfire_grace_time=3600,  # 如果错过执行时间，在1小时内仍然执行
        )
        
        # 每天晚上 20:00 UTC (美东时间下午 3:00/4:00，市场收盘后) 再同步一次
        scheduler.add_job(
            scheduled_sync_all_holdings,
            CronTrigger(hour=20, minute=0),
            id="sync_all_holdings_evening",
            name="每日晚上同步所有用户持仓",
            replace_existing=True,
            misfire_grace_time=3600,
        )

        scheduler.start()
        logger.info("✅ 定时任务调度器已启动")

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
        holdings_morning_job = scheduler.get_job("sync_all_holdings_morning")
        if holdings_morning_job:
            logger.info(f"📅 [HOLDINGS] 早上同步下次执行时间: {holdings_morning_job.next_run_time}")
        
        holdings_evening_job = scheduler.get_job("sync_all_holdings_evening")
        if holdings_evening_job:
            logger.info(f"📅 [HOLDINGS] 晚上同步下次执行时间: {holdings_evening_job.next_run_time}")

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

    # 启动定时任务
    setup_scheduler()

    yield

    # 关闭时执行
    shutdown_scheduler()
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
    return {"status": "healthy", "version": settings.APP_VERSION}


# 注册 API 路由
app.include_router(api_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
