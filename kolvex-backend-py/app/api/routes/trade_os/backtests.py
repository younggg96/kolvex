"""
Trade OS Backtests API Routes
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies.auth import get_current_user_id
from app.services.trade_os import backtest_jobs
from app.services.trade_os.backtester import run_strategy_backtest
from app.services.trade_os.decimal_utils import d
from app.services.trade_os.market_regime import regime_by_date
from app.services.trade_os.trading_calendar import completed_bars
from app.services.yfinance.client import get_yfinance_service

router = APIRouter(prefix="/backtests", tags=["Trade OS Backtests"])


class BacktestRunRequest(BaseModel):
    symbol: str = "NVDA"
    initial_capital: float = 100000.0
    period: str = "2y"
    use_market_filter: bool = True
    slippage_bps: float = 5.0
    # Only used when the market filter is off.
    risk_per_trade_pct: float = 0.0050


@router.post("/run")
async def trigger_backtest(body: BacktestRunRequest) -> Dict[str, Any]:
    """Replays Swing V3.0 (trend pullback) on one symbol's daily history."""
    try:
        yf_svc = get_yfinance_service()
        symbol = body.symbol.upper()
        bars = completed_bars(yf_svc.get_history(symbol, period=body.period))
        if not bars or len(bars) < 220:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient historical data for {symbol} ({len(bars or [])} bars). Minimum 220 required.",
            )

        regimes = None
        if body.use_market_filter:
            spy = completed_bars(yf_svc.get_history("SPY", period=body.period))
            qqq = completed_bars(yf_svc.get_history("QQQ", period=body.period))
            if not spy or not qqq:
                raise HTTPException(
                    status_code=503, detail="SPY/QQQ history unavailable for the market filter."
                )
            regimes = regime_by_date(spy, qqq)

        return run_strategy_backtest(
            symbol=symbol,
            bars=bars,
            initial_capital=d(body.initial_capital),
            regimes=regimes,
            slippage_bps=d(body.slippage_bps),
            risk_per_trade_pct=d(body.risk_per_trade_pct),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class PortfolioBacktestRequest(BaseModel):
    # Default: the scanner's admin universe. Today's list applied to the past
    # (survivorship bias is reported in the result's assumptions).
    symbols: Optional[List[str]] = None
    # 2017 gives SMA200 warm-up before the PRD development window (2018–2023).
    start_date: str = "2017-01-01"
    end_date: Optional[str] = None
    initial_capital: float = 100000.0
    use_market_filter: bool = True
    slippage_bps: float = 5.0


@router.post("/portfolio")
async def start_portfolio_backtest(
    body: PortfolioBacktestRequest, user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Queues a Swing V3.0 portfolio backtest; poll GET /backtests/{id}."""
    try:
        return backtest_jobs.start_portfolio_job(user_id=user_id, **body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("")
def list_backtests(user_id: str = Depends(get_current_user_id)) -> List[Dict[str, Any]]:
    """Your recent Swing V3.0 backtests (summaries only)."""
    return backtest_jobs.list_jobs(user_id)


@router.get("/{job_id}")
def get_backtest(job_id: str, user_id: str = Depends(get_current_user_id)) -> Dict[str, Any]:
    job = backtest_jobs.get_job(user_id, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Backtest not found")
    return job
