"""
Dataroma 超级投资者 API 模块
提供超级投资者和机构持仓数据的 REST API

主要端点：

👤 投资者端点：
- GET  /api/dataroma/investors              - 获取投资者列表
- GET  /api/dataroma/investors/{code}       - 获取投资者详情
- GET  /api/dataroma/investors/{code}/summary - 获取投资者投资组合摘要
- PATCH /api/dataroma/investors/{code}      - 更新投资者信息

📊 持仓端点：
- GET  /api/dataroma/holdings               - 获取持仓列表（支持多种筛选）
- GET  /api/dataroma/holdings/by-investor/{code} - 获取某投资者的持仓
- GET  /api/dataroma/holdings/by-stock/{ticker}  - 获取某股票的持有者
- GET  /api/dataroma/holdings/popular       - 获取热门股票（被多人持有）
- GET  /api/dataroma/holdings/changes       - 获取最近持仓变动
- GET  /api/dataroma/holdings/quarters      - 获取可用季度列表

🔄 同步端点：
- POST /api/dataroma/sync/investors         - 同步投资者名单（后台）
- POST /api/dataroma/sync/investors/now     - 同步投资者名单（同步）
- POST /api/dataroma/sync/holdings          - 同步持仓数据（后台）
- POST /api/dataroma/sync/holdings/now      - 同步持仓数据（同步）
- GET  /api/dataroma/sync/status            - 获取同步状态
- GET  /api/dataroma/sync/quarters          - 获取季度信息

数据来源：
- Dataroma (https://www.dataroma.com)
- 13F 季度报告数据

注意：
- 13F 报告是季度更新（2月、5月、8月、11月中旬）
- 建议在这些月份的 15 号后同步数据
"""

from fastapi import APIRouter

from .investors_routes import router as investors_router
from .holdings_routes import router as holdings_router
from .sync_routes import router as sync_router

# 创建主路由器
router = APIRouter(prefix="/dataroma", tags=["超级投资者"])

# 注册子路由
router.include_router(investors_router)
router.include_router(holdings_router)
router.include_router(sync_router)

__all__ = ["router"]

