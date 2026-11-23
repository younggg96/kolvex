"""
Trade OS Backtests API Routes
"""

from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.trade_os.backtester import run_strategy_backtest
from app.services.trade_os.decimal_utils import d
from app.services.yfinance.client import get_yfinance_service

router = APIRouter(prefix="/backtests", tags=["Trade OS Backtests"])


class BacktestRunRequest(BaseModel):
    symbol: str = "NVDA"
    initial_capital: float = 100000.0
    risk_per_trade_pct: float = 0.0050
    breakout_period: int = 20
    atr_period: int = 14
    stop_atr_mult: float = 2.0
    target_r_mult: float = 2.5
    period: str = "2y"


@router.post("/run")
async def trigger_backtest(body: BacktestRunRequest) -> Dict[str, Any]:
    """Runs a historical simulation of the Trend Breakout 20D strategy."""
    try:
        yf_svc = get_yfinance_service()
        bars = yf_svc.get_history(body.symbol.upper(), period=body.period)
        if not bars or len(bars) < 220:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient historical data for {body.symbol} ({len(bars)} bars). Minimum 220 required.",
            )

        res = run_strategy_backtest(
            symbol=body.symbol.upper(),
            bars=bars,
            initial_capital=d(body.initial_capital),
            risk_per_trade_pct=d(body.risk_per_trade_pct),
            breakout_period=body.breakout_period,
            atr_period=body.atr_period,
            stop_atr_mult=d(body.stop_atr_mult),
            target_r_mult=d(body.target_r_mult),
        )
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
