# scripts/generate_dify_openapi.py
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

import json
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

# 导入所有路由模块
from app.api.routes import health, users, ai, news, market_data, notifications
from app.api.routes.auth import router as auth_router
from app.api.routes.upload import router as upload_router
from app.api.routes.scraper import router as scraper_router
from app.api.routes.stocks import router as stocks_router
from app.api.routes.kol_tweets import router as kol_tweets_router
from app.api.routes.kol_subscriptions import router as kol_subscriptions_router
from app.api.routes.snaptrade import router as snaptrade_router
from app.api.routes.xiaohongshu import router as xiaohongshu_router
from app.api.routes.dataroma import router as dataroma_router
from app.api.routes.scheduler_routes import router as scheduler_router
from app.api.routes.chat import router as chat_router

# 创建一个临时的 app 只挂载我们需要给 AI 用的路由
dify_app = FastAPI()

# 挂载所有可用的 API 路由
# 注意：这些路由模块已经定义了自己的 prefix 和 tags，所以只需添加 /api 前缀

# 健康检查
dify_app.include_router(health.router, prefix="/api", tags=["Health"])

# 认证 & 用户
dify_app.include_router(auth_router, prefix="/api", tags=["Authentication"])
dify_app.include_router(users.router, prefix="/api", tags=["Users"])

# 股票相关
dify_app.include_router(stocks_router, prefix="/api", tags=["Stocks"])
dify_app.include_router(market_data.router, prefix="/api", tags=["Market Data"])
dify_app.include_router(news.router, prefix="/api", tags=["News"])

# KOL 相关
dify_app.include_router(kol_tweets_router, prefix="/api", tags=["KOL Posts"])
dify_app.include_router(
    kol_subscriptions_router, prefix="/api", tags=["KOL Subscriptions"]
)
dify_app.include_router(scraper_router, prefix="/api", tags=["KOL Scraper"])

# 超级投资者 (Dataroma)
dify_app.include_router(dataroma_router, prefix="/api", tags=["超级投资者"])

# 社交平台
dify_app.include_router(xiaohongshu_router, prefix="/api", tags=["小红书"])

# 券商连接 (SnapTrade)
dify_app.include_router(snaptrade_router, prefix="/api", tags=["SnapTrade"])

# AI 分析
dify_app.include_router(ai.router, prefix="/api", tags=["AI"])

# 聊天
dify_app.include_router(chat_router, prefix="/api", tags=["Chat"])

# 通知
dify_app.include_router(notifications.router, prefix="/api", tags=["Notifications"])

# 文件上传
dify_app.include_router(upload_router, prefix="/api", tags=["Upload"])

# 定时任务管理
dify_app.include_router(scheduler_router, prefix="/api", tags=["Scheduler"])


def generate_schema():
    openapi_schema = get_openapi(
        title="Kolvex AI Tools",
        version="1.0.0",
        description="API for Dify Agent to access financial data",
        routes=dify_app.routes,
    )

    # 清理不需要的字段，减小体积
    for path in list(openapi_schema["paths"].keys()):
        # 比如排除一些 POST/PUT/DELETE 操作，只保留 GET
        for method in list(openapi_schema["paths"][path].keys()):
            if method != "get":
                del openapi_schema["paths"][path][method]

    # 添加 Server URL (根据你的部署环境修改)
    # 如果你是本地开发 + Dify Cloud，这里必须是 ngrok 地址
    # 如果是生产环境，这里是 https://api.kolvex.com
    openapi_schema["servers"] = [{"url": "https://kolvex-production.up.railway.app"}]

    with open("dify_tools.json", "w") as f:
        json.dump(openapi_schema, f, indent=2)

    print("✅ Dify Tool Schema generated: dify_tools.json")


if __name__ == "__main__":
    generate_schema()
