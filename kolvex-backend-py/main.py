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


    yield

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
