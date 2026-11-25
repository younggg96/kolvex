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


def process_role() -> str:
    """PROCESS_ROLE splits HTTP serving from background jobs across Railway services.

    - ``all`` (default, unchanged behaviour): one process serves the API and runs every job.
    - ``web``: serves the API only; the jobs run in a separate ``worker`` service, so a
      heavy 13F sync or chart job no longer competes with requests for the event loop
      and the I/O thread pool.
    - ``worker``: runs the jobs only. It skips the startup cleanups, which mark the web
      process's in-flight analyses as failed and must only run when that process restarts.
    """
    role = os.getenv("PROCESS_ROLE", "all").strip().lower()
    if role not in ("all", "web", "worker"):
        logger.warning("Unknown PROCESS_ROLE=%r; running as 'all'", role)
        return "all"
    return role


def _env_on(name: str, default: str) -> bool:
    return os.getenv(name, default).lower() == "true"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    role = process_role()
    serves_http = role in ("all", "web")
    runs_jobs = role in ("all", "worker")
    # 启动时执行
    print("🚀 Starting Kolvex Backend API...")
    print(f"📝 API Version: {settings.APP_VERSION} · role={role}")
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

    if serves_http:
        # 清理上次残留的 running 状态分析（这些分析跑在提供 HTTP 的进程里）
        from app.services.trading_analysis_service import get_trading_analysis_service

        get_trading_analysis_service().cleanup_stale_analyses()
        try:
            from app.core.supabase import get_supabase_service
            from app.services.research_workspace import fail_stale_runs

            fail_stale_runs(get_supabase_service())
        except Exception as error:  # noqa: BLE001 — tables may not exist before the migration
            logger.warning("Research workspace cleanup skipped: %s", error)

    tasks: list[asyncio.Task] = []

    def start(factory, enabled: bool = True) -> None:
        if enabled:
            tasks.append(asyncio.create_task(factory()))

    start(run_traffic_reporter)
    from app.services.sec.managers import manager_registry

    # Reads the admin-edited coverage list now and every few minutes; the built-in list
    # serves until then. Both roles need it: the API lists managers, the 13F jobs sync them.
    start(manager_registry.run_refresher)

    if runs_jobs:
        from app.services.agent_signal_evaluation import run_signal_evaluation_worker
        from app.services.congress_trades import run_congress_trades_worker
        from app.services.content_translation import run_content_translation_worker
        from app.services.economic_indicators import run_economic_indicators_worker
        from app.services.email_service import run_email_worker
        from app.services.market_risk.worker import run_market_risk_worker
        from app.services.market_risk.worker import worker_enabled as market_risk_enabled
        from app.services.options_activity.service import run_options_activity_worker
        from app.services.paper_trading.service import run_worker as run_paper_worker
        from app.services.plaid_snapshot_worker import run_plaid_snapshot_worker, worker_enabled
        from app.services.sec.holdings_store import institution_store
        from app.services.sec.performance import performance_store
        from app.services.stock_chart_jobs import run_worker
        from app.services.trade_os.daily_job import run_trade_os_daily_worker
        from app.services.trade_os.daily_job import worker_enabled as trade_os_job_enabled

        start(run_worker, _env_on("CHART_WORKER_ENABLED", "true"))
        start(run_economic_indicators_worker, settings.ECONOMIC_INDICATORS_WORKER_ENABLED)
        start(run_paper_worker)
        start(institution_store.run_worker, _env_on("SEC_13F_SYNC_ENABLED", "true"))
        # Backfills past 13F quarters and recomputes the simulated return curves about once a day.
        start(performance_store.run_worker, _env_on("SEC_13F_PERFORMANCE_ENABLED", "true"))
        start(run_options_activity_worker, settings.OPTIONS_ACTIVITY_WORKER_ENABLED)
        start(run_signal_evaluation_worker)
        start(run_congress_trades_worker, _env_on("CONGRESS_TRADES_SYNC_ENABLED", ""))
        start(run_email_worker)
        start(run_plaid_snapshot_worker, worker_enabled())
        # Stores each NYSE session's market state and Swing V3.0 scan after the close.
        start(run_trade_os_daily_worker, trade_os_job_enabled())
        start(
            run_content_translation_worker,
            _env_on("CONTENT_TRANSLATION_WORKER_ENABLED", "false"),
        )
        # Ingests Cboe volatility closes each evening; off unless MARKET_RISK_WORKER_ENABLED=true.
        start(run_market_risk_worker, market_risk_enabled())
    try:
        yield
    finally:
        for task in reversed(tasks):
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

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
