"""
Trade OS API Routes Aggregator
"""

from fastapi import APIRouter

from app.api.routes.trade_os.accounts import router as accounts_router
from app.api.routes.trade_os.analytics import router as analytics_router
from app.api.routes.trade_os.backtests import router as backtests_router
from app.api.routes.trade_os.equity import router as equity_router
from app.api.routes.trade_os.executions import router as executions_router
from app.api.routes.trade_os.import_ import router as import_router
from app.api.routes.trade_os.journal import router as journal_router
from app.api.routes.trade_os.market import router as market_router
from app.api.routes.trade_os.plans import router as plans_router
from app.api.routes.trade_os.portfolio import router as portfolio_router
from app.api.routes.trade_os.risk import router as risk_router
from app.api.routes.trade_os.scanner import router as scanner_router
from app.api.routes.trade_os.strategies import router as strategies_router

router = APIRouter(prefix="/trade-os", tags=["Trade OS"])

router.include_router(accounts_router)
router.include_router(import_router)
router.include_router(equity_router)
router.include_router(executions_router)
router.include_router(strategies_router)
router.include_router(plans_router)
router.include_router(portfolio_router)
router.include_router(risk_router)
router.include_router(market_router)
router.include_router(scanner_router)
router.include_router(backtests_router)
router.include_router(journal_router)
router.include_router(analytics_router)

__all__ = ["router"]
