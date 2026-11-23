"""
Portfolio backtests as background jobs (PRD §13, §22.2).

A run fetches daily history for the universe, SPY and QQQ, replays Swing V3.0
on one shared account, and stores the result. The request returns immediately
with the job id; the page polls it. A job left "running" by a restarted server
is reported as failed instead of hanging forever.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional

from app.services.trade_os.backtester import run_portfolio_backtest
from app.services.trade_os.market_regime import regime_by_date
from app.services.trade_os.scanner import DEFAULT_SCANNER_UNIVERSE
from app.services.trade_os.setup_detection import STRATEGY_CODE
from app.services.trade_os.trading_calendar import completed_bars

logger = logging.getLogger(__name__)

TABLE = "trade_os_backtest_runs"
STALE_AFTER = timedelta(minutes=30)
MAX_SYMBOLS = 50
SUMMARY_COLUMNS = (
    "id,status,error,symbol,start_date,end_date,initial_capital,parameters,"
    "summary_metrics,gates,segments,benchmark,config_hash,created_at,completed_at"
)

_RUNNING: "set[asyncio.Task]" = set()

Fetcher = Callable[[str, str, Optional[str]], List[Dict[str, Any]]]


def _db():
    from app.core.supabase import get_supabase_service

    return get_supabase_service()


def _default_fetcher() -> Fetcher:
    from app.services.yfinance.client import get_yfinance_service

    yf_svc = get_yfinance_service()

    def fetch(sym: str, start: str, end: Optional[str]) -> List[Dict[str, Any]]:
        # get_history applies its default 1-month period even when start is given,
        # so take the full daily history and cut the window here.
        bars = completed_bars(yf_svc.get_history(sym, period="max"))
        return [
            b
            for b in bars
            if str(b["date"])[:10] >= start and (end is None or str(b["date"])[:10] <= end)
        ]

    return fetch


def default_earnings_history(symbol: str) -> Optional[List[str]]:
    """Past and scheduled report timestamps (New York time); None when unavailable."""
    try:
        import yfinance as yf

        df = yf.Ticker(symbol).get_earnings_dates(limit=60)
        if df is None or df.empty:
            return None
        return sorted(ts.isoformat() for ts in df.index)
    except Exception as err:  # noqa: BLE001 — unknown, never "no earnings"
        logger.warning("Earnings history unavailable for %s: %s", symbol, err)
        return None


def execute_portfolio_backtest(
    params: Dict[str, Any],
    fetch: Fetcher,
    earnings_fetch: Optional[Callable[[str], Optional[List[str]]]] = None,
) -> Dict[str, Any]:
    """Fetch, replay, return the result. No database access (unit-testable)."""
    start, end = params["start_date"], params.get("end_date")
    symbols = [s.upper() for s in params["symbols"]]
    bars = {}
    failed = []
    for sym in symbols:
        try:
            bars[sym] = fetch(sym, start, end) or []
        except Exception as err:  # noqa: BLE001
            logger.warning("Backtest fetch failed for %s: %s", sym, err)
            failed.append(sym)
    spy = fetch("SPY", start, end) or []
    regimes = None
    if params.get("use_market_filter", True):
        qqq = fetch("QQQ", start, end) or []
        if not spy or not qqq:
            raise RuntimeError("SPY/QQQ history unavailable for the market filter.")
        regimes = regime_by_date(spy, qqq)

    earnings = None
    if params.get("use_earnings_rules", True) and earnings_fetch is not None:
        earnings = {sym: earnings_fetch(sym) for sym in bars}

    result = run_portfolio_backtest(
        bars,
        earnings=earnings,
        initial_capital=Decimal(str(params.get("initial_capital", 100000))),
        regimes=regimes,
        slippage_bps=Decimal(str(params.get("slippage_bps", 5))),
        benchmark_bars=spy,
    )
    result["excluded_symbols"] = sorted(set(result.get("excluded_symbols", [])) | set(failed))
    return result


def _run_and_store(job_id: str, params: Dict[str, Any], fetch: Optional[Fetcher]) -> None:
    db = _db()
    db.table(TABLE).update({"status": "running"}).eq("id", job_id).execute()
    try:
        if fetch is None:
            result = execute_portfolio_backtest(
                params, _default_fetcher(), default_earnings_history
            )
        else:
            result = execute_portfolio_backtest(params, fetch)
        if result.get("error"):
            raise RuntimeError(result["error"])
        db.table(TABLE).update(
            {
                "status": "completed",
                "summary_metrics": result["summary"],
                "gates": result["gates"],
                "segments": result["segments"],
                "benchmark": result["benchmark"],
                "equity_curve": result["equity_curve"],
                "trades": result["trades"],
                "skipped_signals": result["skipped_signals"],
                "excluded_symbols": result["excluded_symbols"],
                "assumptions": result["assumptions"],
                "config_hash": result["config_hash"],
                "parameters": {**params, "config": result["config"]},
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", job_id).execute()
    except Exception as err:  # noqa: BLE001 — a failed run is stored as failed, never as partial success
        logger.exception("Portfolio backtest %s failed", job_id)
        db.table(TABLE).update(
            {
                "status": "failed",
                "error": str(err)[:500],
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", job_id).execute()


def start_portfolio_job(
    user_id: str,
    symbols: Optional[List[str]] = None,
    start_date: str = "2017-01-01",
    end_date: Optional[str] = None,
    initial_capital: float = 100000.0,
    use_market_filter: bool = True,
    slippage_bps: float = 5.0,
    fetch: Optional[Fetcher] = None,
) -> Dict[str, Any]:
    universe = [s.strip().upper() for s in (symbols or DEFAULT_SCANNER_UNIVERSE) if s.strip()]
    if not universe or len(universe) > MAX_SYMBOLS:
        raise ValueError(f"Choose 1–{MAX_SYMBOLS} symbols.")
    params = {
        "symbols": universe,
        "start_date": start_date,
        "end_date": end_date,
        "initial_capital": initial_capital,
        "use_market_filter": use_market_filter,
        "slippage_bps": slippage_bps,
    }
    row = (
        _db()
        .table(TABLE)
        .insert(
            {
                "user_id": user_id,
                "strategy_code": STRATEGY_CODE,
                "symbol": "PORTFOLIO" if len(universe) > 1 else universe[0],
                "start_date": start_date,
                "end_date": end_date or date.today().isoformat(),
                "initial_capital": initial_capital,
                "parameters": params,
                "status": "queued",
            }
        )
        .execute()
        .data[0]
    )

    async def runner() -> None:
        await asyncio.to_thread(_run_and_store, row["id"], params, fetch)

    # Keep a reference so the task isn't garbage-collected mid-run.
    task = asyncio.get_running_loop().create_task(runner())
    _RUNNING.add(task)
    task.add_done_callback(_RUNNING.discard)
    return {"id": row["id"], "status": "queued"}


def _mark_stale(row: Dict[str, Any]) -> Dict[str, Any]:
    if row.get("status") in ("queued", "running") and row.get("created_at"):
        created = datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - created > STALE_AFTER:
            return {
                **row,
                "status": "failed",
                "error": "Interrupted (server restarted). Run it again.",
            }
    return row


def get_job(user_id: str, job_id: str) -> Optional[Dict[str, Any]]:
    res = _db().table(TABLE).select("*").eq("id", job_id).eq("user_id", user_id).limit(1).execute()
    return _mark_stale(res.data[0]) if res.data else None


def list_jobs(user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    res = (
        _db()
        .table(TABLE)
        .select(SUMMARY_COLUMNS)
        .eq("user_id", user_id)
        .eq("strategy_code", STRATEGY_CODE)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [_mark_stale(r) for r in res.data or []]
