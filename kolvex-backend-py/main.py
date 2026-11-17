"""
Kolvex Backend API
FastAPI 应用入口
"""

import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

import anyio.to_thread
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

# 导入路由和配置
from app.api.routes import api_router
from app.core.config import settings
from app.core.egress_metrics import RequestMetricsMiddleware, run_traffic_reporter
from app.core.public_read_cache import PublicReadCacheMiddleware
from app.core.redis import close_redis, get_redis, init_redis

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    print("🚀 Starting Kolvex Backend API...")
    print(f"📝 API Version: {settings.APP_VERSION}")
    print(f"🌐 CORS Origins: {settings.ALLOWED_ORIGINS}")

    # 同步 I/O（Supabase、yfinance）都放在线程中执行，避免阻塞事件循环。
    # 默认上限较小：asyncio.to_thread 约 12 个、sync 路由 40 个，并发时会排队。
    threads = int(os.getenv("IO_THREAD_POOL_SIZE", "64"))
    asyncio.get_running_loop().set_default_executor(
        ThreadPoolExecutor(max_workers=threads, thread_name_prefix="io")
    )
    anyio.to_thread.current_default_thread_limiter().total_tokens = threads

    # 初始化 Redis
    await init_redis()

    # 清理上次残留的 running 状态分析
    from app.services.trading_analysis_service import get_trading_analysis_service

    get_trading_analysis_service().cleanup_stale_analyses()
    try:
        from app.core.supabase import get_supabase_service
        from app.services.research_workspace import fail_stale_runs

        fail_stale_runs(get_supabase_service())
    except Exception as error:  # noqa: BLE001 — tables may not exist before the migration
        logger.warning("Research workspace cleanup skipped: %s", error)
    from app.services.stock_chart_jobs import run_worker

    worker = (
        asyncio.create_task(run_worker())
        if os.getenv("CHART_WORKER_ENABLED", "true").lower() == "true"
        else None
    )
    from app.services.economic_indicators import run_economic_indicators_worker

    indicators_worker = (
        asyncio.create_task(run_economic_indicators_worker())
        if settings.ECONOMIC_INDICATORS_WORKER_ENABLED
        else None
    )
    traffic_reporter = asyncio.create_task(run_traffic_reporter())
    from app.services.paper_trading.service import run_worker as run_paper_worker

    paper_worker = asyncio.create_task(run_paper_worker())
    from app.services.sec.holdings_store import institution_store
    from app.services.sec.managers import manager_registry

    # Reads the admin-edited coverage list now and every few minutes; the built-in list serves until then.
    managers_refresher = asyncio.create_task(manager_registry.run_refresher())

    holdings_worker = (
        asyncio.create_task(institution_store.run_worker())
        if os.getenv("SEC_13F_SYNC_ENABLED", "true").lower() == "true"
        else None
    )
    from app.services.sec.performance import performance_store

    # Backfills past 13F quarters and recomputes the simulated return curves about once a day.
    performance_worker = (
        asyncio.create_task(performance_store.run_worker())
        if os.getenv("SEC_13F_PERFORMANCE_ENABLED", "true").lower() == "true"
        else None
    )
    from app.services.options_activity.service import run_options_activity_worker

    options_activity_worker = (
        asyncio.create_task(run_options_activity_worker())
        if settings.OPTIONS_ACTIVITY_WORKER_ENABLED
        else None
    )
    from app.services.agent_signal_evaluation import run_signal_evaluation_worker

    signal_eval_worker = asyncio.create_task(run_signal_evaluation_worker())
    from app.services.congress_trades import run_congress_trades_worker

    congress_worker = (
        asyncio.create_task(run_congress_trades_worker())
        if os.getenv("CONGRESS_TRADES_SYNC_ENABLED", "").lower() == "true"
        else None
    )
    from app.services.email_service import run_email_worker

    email_worker = asyncio.create_task(run_email_worker())
    from app.services.plaid_snapshot_worker import run_plaid_snapshot_worker, worker_enabled

    plaid_history_worker = (
        asyncio.create_task(run_plaid_snapshot_worker()) if worker_enabled() else None
    )
    from app.services.content_translation import run_content_translation_worker

    translation_worker = (
        asyncio.create_task(run_content_translation_worker())
        if os.getenv("CONTENT_TRANSLATION_WORKER_ENABLED", "false").lower() == "true"
        else None
    )
    try:
        yield
    finally:
        managers_refresher.cancel()
        await asyncio.gather(managers_refresher, return_exceptions=True)
        if translation_worker:
            translation_worker.cancel()
            await asyncio.gather(translation_worker, return_exceptions=True)
        if plaid_history_worker:
            plaid_history_worker.cancel()
            await asyncio.gather(plaid_history_worker, return_exceptions=True)
        email_worker.cancel()
        await asyncio.gather(email_worker, return_exceptions=True)
        if congress_worker:
            congress_worker.cancel()
            await asyncio.gather(congress_worker, return_exceptions=True)
        signal_eval_worker.cancel()
        try:
            await signal_eval_worker
        except asyncio.CancelledError:
            pass
        if options_activity_worker:
            options_activity_worker.cancel()
            try:
                await options_activity_worker
            except asyncio.CancelledError:
                pass
        if performance_worker:
            performance_worker.cancel()
            await asyncio.gather(performance_worker, return_exceptions=True)
        if holdings_worker:
            holdings_worker.cancel()
            try:
                await holdings_worker
            except asyncio.CancelledError:
                pass
        paper_worker.cancel()
        try:
            await paper_worker
        except asyncio.CancelledError:
            pass
        if indicators_worker:
            indicators_worker.cancel()
            try:
                await indicators_worker
            except asyncio.CancelledError:
                pass
        if worker:
            worker.cancel()
            try:
                await worker
            except asyncio.CancelledError:
                pass

        traffic_reporter.cancel()
        try:
            await traffic_reporter
        except asyncio.CancelledError:
            pass

    # 关闭时执行
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

# Public cache sits inside CORS so cached headers never contain another origin.
app.add_middleware(PublicReadCacheMiddleware)
app.add_middleware(RequestMetricsMiddleware)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CompressResponses:
    """Gzip JSON responses (often several hundred KB), never SSE streams.

    Starlette's GZipMiddleware buffers its output, which would hold back
    streamed chat and analysis tokens, so every `/stream` endpoint bypasses it.
    """

    def __init__(self, app):
        self.app = app
        self.gzip = GZipMiddleware(app, minimum_size=1024, compresslevel=5)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and not scope["path"].endswith("/stream"):
            return await self.gzip(scope, receive, send)
        return await self.app(scope, receive, send)


# Outermost, so cached and CORS responses are compressed too.
app.add_middleware(CompressResponses)


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
