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

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
