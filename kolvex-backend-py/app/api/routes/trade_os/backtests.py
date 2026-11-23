"""
Trade OS Backtests API Routes
"""

from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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
