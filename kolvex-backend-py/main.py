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
from app.core.redis import init_redis, close_redis, get_redis

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
        # 任务 4: 每天自动同步所有用户的持仓数据并记录快照
        # ============================================================
        async def record_user_portfolio_snapshot(user_id: str, snaptrade_service):
            """为单个用户记录 portfolio 快照"""
            from app.services.portfolio_snapshot_service import get_portfolio_snapshot_service
            
            try:
                holdings = await snaptrade_service.get_user_holdings(user_id)
                
                if not holdings or not holdings.get("accounts"):
                    logger.warning(f"📭 [SNAPSHOT] 用户 {user_id[:8]}... 没有持仓数据")
                    return False
                
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
                        
                        # Options multiplier
                        multiplier = 100 if position_type == "option" else 1
                        
                        position_value = price * units * multiplier
                        cost_basis = avg_cost * units * (1 if position_type == "option" else 1)
                        
                        total_value += position_value
                        total_cost_basis += cost_basis
                        positions_count += 1
                        
                        # Calculate P&L
                        if position_type == "option":
                            pnl = position_value - cost_basis
                        else:
                            pnl = pos.get("open_pnl") or (position_value - cost_basis)
                        total_pnl += pnl
                
                # Record snapshot
                snapshot_service = get_portfolio_snapshot_service()
                await snapshot_service.record_snapshot(
                    user_id=user_id,
                    total_value=total_value,
                    total_cost_basis=total_cost_basis,
                    unrealized_pnl=total_pnl,
                    positions_count=positions_count,
                    accounts_count=accounts_count,
                )
                
                logger.info(
                    f"📸 [SNAPSHOT] 用户 {user_id[:8]}... 快照记录成功 - "
                    f"value=${total_value:,.2f}, pnl=${total_pnl:,.2f}"
                )
                return True
            except Exception as e:
                logger.error(f"❌ [SNAPSHOT] 用户 {user_id[:8]}... 快照记录失败: {e}")
                return False
        
        async def scheduled_sync_all_holdings():
            """定时任务：同步所有用户持仓数据并记录每日快照"""
            from app.services.snaptrade.service import SnapTradeService
            from app.core.supabase import get_supabase_service
            
            logger.info("⏰ [HOLDINGS] 定时任务触发: 开始同步所有用户持仓并记录快照")
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
                sync_success = 0
                sync_error = 0
                snapshot_success = 0
                snapshot_error = 0
                
                logger.info(f"📊 [HOLDINGS] 找到 {total_users} 个已连接的用户")
                
                # 逐个同步用户的持仓数据
                for connection in result.data:
                    user_id = connection["user_id"]
                    try:
                        # 1. 先同步账户
                        await snaptrade_service.sync_accounts(user_id)
                        # 2. 再同步持仓
                        positions = await snaptrade_service.sync_positions(user_id)
                        sync_success += 1
                        logger.info(f"✅ [HOLDINGS] 用户 {user_id[:8]}... 同步成功，共 {len(positions)} 个持仓")
                        
                        # 3. 记录 portfolio 快照（用于盈利曲线）
                        snapshot_recorded = await record_user_portfolio_snapshot(
                            user_id, snaptrade_service
                        )
                        if snapshot_recorded:
                            snapshot_success += 1
                        else:
                            snapshot_error += 1
                            
                    except Exception as e:
                        sync_error += 1
                        logger.error(f"❌ [HOLDINGS] 用户 {user_id[:8]}... 同步失败: {e}")
                
                logger.info(
                    f"✅ [HOLDINGS] 每日同步完成 - "
                    f"用户: {total_users}, 同步成功: {sync_success}, 同步失败: {sync_error}, "
                    f"快照成功: {snapshot_success}, 快照失败: {snapshot_error}"
                )
                
            except Exception as e:
                logger.error(f"❌ [HOLDINGS] 定时任务执行失败: {e}")

        # ============================================================
        # Portfolio Snapshot 定时任务 (美西时间 PST/PDT)
        # 使用 America/Los_Angeles 时区，自动处理夏令时
        # ============================================================
        
        # 美西时间早上 6:00 - 开盘前记录快照
        scheduler.add_job(
            scheduled_sync_all_holdings,
            CronTrigger(hour=6, minute=0, timezone="America/Los_Angeles"),
            id="portfolio_snapshot_morning",
            name="Portfolio 快照 - 早上 6:00 PST (开盘前)",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        
        # 美西时间中午 12:00 - 午间快照
        scheduler.add_job(
            scheduled_sync_all_holdings,
            CronTrigger(hour=12, minute=0, timezone="America/Los_Angeles"),
            id="portfolio_snapshot_noon",
            name="Portfolio 快照 - 中午 12:00 PST",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        
        # 美西时间下午 1:30 - 收盘后快照 (主要快照时间点)
        scheduler.add_job(
            scheduled_sync_all_holdings,
            CronTrigger(hour=13, minute=30, timezone="America/Los_Angeles"),
            id="portfolio_snapshot_afternoon",
            name="Portfolio 快照 - 下午 1:30 PST (收盘后)",
            replace_existing=True,
            misfire_grace_time=3600,
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

        options_flow_job = scheduler.get_job("options_flow_scan")
        if options_flow_job:
            logger.info(f"📅 [OPTIONS] 期权异动扫描下次执行时间: {options_flow_job.next_run_time}")

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
