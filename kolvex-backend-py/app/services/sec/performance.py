"""13F simulated returns: what holding each quarter's disclosed portfolio would have returned.

Each quarter's long equity positions (shares only, no options) are held at their
reported value weights from that quarter end to the next one; the latest quarter
runs to the latest close. Quarterly returns are chained into one curve and set
against SPY over the same dates. Prices are Yahoo adjusted closes, so dividends
are reinvested.

This is not the manager's actual return. 13F leaves out shorts, cash, bonds,
non-US listings and trades within the quarter, and is filed up to 45 days after
the quarter end. Positions without a ticker or price (often delisted or acquired
companies) are dropped and the rest re-weighted; every quarter records the share
of its value that was priced, and the curve starts after the last quarter that
priced less than MIN_COVERAGE.

Past quarters are backfilled from SEC EDGAR into `institution_13f_quarters`
(largest positions only); the curve is cached in `institution_13f_performance`
and recomputed about once a day by a background worker.
"""

import asyncio
import bisect
import logging
import os
from datetime import date, datetime, timedelta, timezone

from app.core.supabase import get_supabase_service

from .client import MANAGERS, sec_client
from .holdings_store import HoldingsRepository
from .parsers import filings_from, value_multiplier
from .tickers import cusip_tickers

logger = logging.getLogger(__name__)
QUARTERS_TABLE = "institution_13f_quarters"
PERFORMANCE_TABLE = "institution_13f_performance"
QUARTERS = 20  # about five years
TOP_POSITIONS = 100
MIN_COVERAGE = 0.5
MAX_QUARTER_DAYS = 92
MAX_LATEST_DAYS = MAX_QUARTER_DAYS + 46  # allow for disclosure lag after the next quarter ends
STALE_PRICE_DAYS = 7
METHOD_VERSION = 2
BENCHMARK = "SPY"
PRICE_CHUNK = 50
REFRESH_AFTER = timedelta(hours=20)
CHECK_INTERVAL = int(os.getenv("SEC_13F_PERFORMANCE_INTERVAL_SECONDS", "3600"))


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def is_quarter_end(value):
    try:
        day = date.fromisoformat(value)
    except (TypeError, ValueError):
        return False
    return day.month in (3, 6, 9, 12) and (day + timedelta(days=1)).day == 1


def quarter_ends(start, end):
    """Calendar quarter ends from `start` to `end` inclusive, as ISO dates."""
    result, year = [], start.year
    while True:
        for month, last in ((3, 31), (6, 30), (9, 30), (12, 31)):
            day = date(year, month, last)
            if day > end:
                return result
            if day >= start:
                result.append(day.isoformat())
        year += 1


def window_start(today):
    return today - timedelta(days=(QUARTERS + 1) * 92)


def yahoo_symbol(ticker):
    return ticker.replace(".", "-")


def quarter_snapshot(rows, period, top=TOP_POSITIONS):
    """Long equity rows aggregated by CUSIP, in dollars; the largest `top` are kept for pricing."""
    scale = value_multiplier(rows, period)
    grouped = {}
    for row in rows:
        cusip, value = (row.get("cusip") or "").upper(), row.get("value")
        if (
            row.get("share_type") != "SH"
            or row.get("put_call")
            or not cusip
            or not value
            or value <= 0
        ):
            continue
        item = grouped.setdefault(
            cusip, {"cusip": cusip, "issuer": row.get("issuer"), "value": 0.0}
        )
        item["value"] += float(value) * scale
    ranked = sorted(grouped.values(), key=lambda p: p["value"], reverse=True)
    return {
        "equity_value": sum(p["value"] for p in ranked),
        "positions_count": len(ranked),
        "positions": ranked[:top],
    }


def annualized(total, start, end):
    span = (date.fromisoformat(end) - date.fromisoformat(start)).days
    if span < 365 or total is None or total <= -1:
        return None
    return (1 + total) ** (365 / span) - 1


def simulate(quarters, tickers, prices):
    """Chains quarterly returns. `quarters` ascending by period ({period, equity_value, positions_count,
    positions}); `tickers` maps CUSIP to a Yahoo symbol; `prices(symbol)` returns {"closes": {date: close},
    "latest": (date, close)} or None."""
    bench = prices(BENCHMARK)
    if not bench or not bench.get("latest"):
        raise ValueError("Benchmark prices unavailable")
    end_date = bench["latest"][0]

    def close(symbol, day, final):
        book = prices(symbol)
        if not book:
            return None
        if not final:
            return book["closes"].get(day)
        latest_day, value = book.get("latest") or (None, None)
        stale = (
            (date.fromisoformat(end_date) - date.fromisoformat(latest_day)).days
            if latest_day
            else None
        )
        return value if stale is not None and stale <= STALE_PRICE_DAYS else None

    segments = []
    for i, quarter in enumerate(quarters):
        final = i + 1 == len(quarters)
        start, end = quarter["period"], end_date if final else quarters[i + 1]["period"]
        span = (date.fromisoformat(end) - date.fromisoformat(start)).days
        if span <= 0:
            continue
        priced_value = weighted = 0.0
        priced = 0
        for position in quarter["positions"]:
            symbol = tickers.get(position["cusip"])
            first, last = (
                (close(symbol, start, False), close(symbol, end, final)) if symbol else (None, None)
            )
            if first and last and first > 0 and last > 0:
                priced_value += position["value"]
                weighted += position["value"] * (last / first - 1)
                priced += 1
        b0, b1 = close(BENCHMARK, start, False), close(BENCHMARK, end, final)
        coverage = priced_value / quarter["equity_value"] if quarter["equity_value"] else 0.0
        segments.append(
            {
                "start": start,
                "end": end,
                "return": weighted / priced_value if priced_value else None,
                "benchmark_return": b1 / b0 - 1 if b0 and b1 else None,
                "coverage": coverage,
                "priced": priced,
                "positions": quarter["positions_count"],
                "valid": span <= (MAX_LATEST_DAYS if final else MAX_QUARTER_DAYS)
                and priced_value > 0
                and bool(b0 and b1)
                and coverage >= MIN_COVERAGE,
            }
        )

    # The longest recent run of usable, back-to-back quarters.
    used = []
    for segment in reversed(segments):
        if not segment["valid"] or (used and used[0]["start"] != segment["end"]):
            break
        used.insert(0, segment)
    base = {
        "method_version": METHOD_VERSION,
        "benchmark": BENCHMARK,
        "quarters_stored": len(quarters),
        "min_coverage": MIN_COVERAGE,
    }
    if len(used) < 2:
        return {**base, "status": "insufficient", "points": [], "quarters": []}

    value = bench_value = 1.0
    points = [{"date": used[0]["start"], "value": 0.0, "benchmark": 0.0}]
    for segment in used:
        value *= 1 + segment["return"]
        bench_value *= 1 + segment["benchmark_return"]
        points.append({"date": segment["end"], "value": value - 1, "benchmark": bench_value - 1})
    start, end = points[0]["date"], points[-1]["date"]
    total, bench_total = value - 1, bench_value - 1
    return {
        **base,
        "status": "ready",
        "start": start,
        "end": end,
        "points": points,
        "quarters": [{k: v for k, v in s.items() if k != "valid"} for s in used],
        "total_return": total,
        "benchmark_return": bench_total,
        "annualized_return": annualized(total, start, end),
        "benchmark_annualized": annualized(bench_total, start, end),
        "coverage_min": min(s["coverage"] for s in used),
        "dropped_quarters": len(segments) - len(used),
    }


def yahoo_closes(symbols, start, end):
    """Adjusted daily closes from one yfinance call: {symbol: [(date, close), ...]} ascending."""
    import pandas as pd
    import yfinance as yf

    # Yahoo degrades silently under concurrent batch downloads; share the process-wide lock.
    from app.services.market_performance import _download_lock

    with _download_lock:
        frame = yf.download(
            symbols, start=start, end=end, interval="1d", auto_adjust=True,
            group_by="ticker", threads=True, progress=False,
        )  # fmt: skip
    result = {}
    for symbol in symbols:
        try:
            sub = frame[symbol] if isinstance(frame.columns, pd.MultiIndex) else frame
            closes = sub["Close"].dropna()
        except (KeyError, TypeError):
            result[symbol] = []
            continue
        result[symbol] = [
            (ts.date().isoformat(), float(v)) for ts, v in closes.items() if float(v) > 0
        ]
    return result


class PriceBook:
    """Closes at each calendar quarter end (last close within a week before it) plus the latest close.
    One book serves a whole worker pass, so a ticker held by many managers downloads once."""

    def __init__(self, today=None, downloader=yahoo_closes):
        self.today = today or date.today()
        self.dates = quarter_ends(window_start(self.today), self.today)
        self.downloader = downloader
        self.failed = set()
        self._data = {}

    def _index(self, bars):
        if not bars:
            return None
        days = [d for d, _ in bars]
        closes = {}
        for target in self.dates:
            i = bisect.bisect_right(days, target) - 1
            if (
                i >= 0
                and (date.fromisoformat(target) - date.fromisoformat(days[i])).days
                <= STALE_PRICE_DAYS
            ):
                closes[target] = bars[i][1]
        return {"closes": closes, "latest": bars[-1]}

    async def load(self, symbols):
        missing = sorted(s for s in symbols if s not in self._data)
        start = (date.fromisoformat(self.dates[0]) - timedelta(days=10)).isoformat()
        end = (self.today + timedelta(days=1)).isoformat()
        for i in range(0, len(missing), PRICE_CHUNK):
            chunk = missing[i : i + PRICE_CHUNK]
            try:
                bars = await asyncio.to_thread(self.downloader, chunk, start, end)
            except Exception:
                logger.warning("13F performance price download failed", exc_info=True)
                self.failed.update(chunk)
                continue
            for symbol in chunk:
                self._data[symbol] = self._index(bars.get(symbol) or [])

    def get(self, symbol):
        return self._data.get(symbol)


class PerformanceRepository:
    def __init__(self, db=None):
        self._db = db

    @property
    def db(self):
        return self._db or get_supabase_service()

    def accessions(self, manager_id):
        rows = (
            self.db.table(QUARTERS_TABLE)
            .select("accession")
            .eq("manager_id", manager_id)
            .execute()
            .data
        )
        return {r["accession"] for r in rows}

    def save_quarter(self, row):
        self.db.table(QUARTERS_TABLE).upsert(row, on_conflict="accession").execute()

    def quarters(self, accessions):
        if not accessions:
            return []
        rows = (
            self.db.table(QUARTERS_TABLE)
            .select("*")
            .in_("accession", list(accessions))
            .execute()
            .data
        )
        return sorted(rows, key=lambda r: r["period"])

    def performance(self, manager_id):
        rows = (
            self.db.table(PERFORMANCE_TABLE)
            .select("*")
            .eq("manager_id", manager_id)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def performance_index(self):
        return (
            self.db.table(PERFORMANCE_TABLE)
            .select("manager_id,method_version,computed_at")
            .execute()
            .data
        )

    def save_performance(self, row):
        self.db.table(PERFORMANCE_TABLE).upsert(row, on_conflict="manager_id").execute()


class PerformanceStore:
    def __init__(self, repo=None, sec=None, tickers=None, holdings=None, book=PriceBook):
        self.repo = repo or PerformanceRepository()
        self.sec = sec or sec_client
        self.tickers = tickers or cusip_tickers
        self.holdings = holdings or HoldingsRepository()
        self.book = book

    async def read(self, manager):
        row = await asyncio.to_thread(self.repo.performance, manager)
        if row is None or row["method_version"] != METHOD_VERSION:
            return {"id": manager, "status": "pending", "points": []}
        return {
            **row["result"],
            "id": manager,
            "status": row["status"],
            "computed_at": row["computed_at"],
        }

    async def backfill(self, manager, today):
        """Stores every original quarter-end 13F-HR in the window that is not stored yet; returns their accessions."""
        cik = MANAGERS[manager]["cik"]
        since = window_start(today).isoformat()
        chosen, periods = [], set()
        for filing in filings_from(await self.sec.submissions(cik)):  # newest filed first
            period = filing["period"]
            if (
                filing["form"] != "13F-HR"
                or not is_quarter_end(period)
                or period < since
                or period in periods
            ):
                continue
            periods.add(period)
            chosen.append(filing)
            if len(chosen) == QUARTERS:
                break
        stored = await asyncio.to_thread(self.repo.accessions, manager)
        kept = []
        for filing in chosen:
            if filing["accession"] not in stored:
                try:
                    rows = await self.sec.holdings_filing(cik, filing)
                except Exception:
                    logger.warning(
                        "13F quarter %s for %s unavailable",
                        filing["accession"],
                        manager,
                        exc_info=True,
                    )
                    continue
                snapshot = quarter_snapshot(rows, filing["period"])
                await asyncio.to_thread(
                    self.repo.save_quarter,
                    {
                        "accession": filing["accession"],
                        "manager_id": manager,
                        "period": filing["period"],
                        "filed": filing["filed"],
                        **snapshot,
                        "synced_at": now_iso(),
                    },
                )
            kept.append(filing["accession"])
        return kept

    async def _map(self, cusips):
        try:
            await self.tickers.load()
            self.tickers.remember(await asyncio.to_thread(self.holdings.known_tickers, cusips))
        except Exception:
            logger.warning("Stored CUSIP tickers unavailable", exc_info=True)
        mapped = await self.tickers.resolve(cusips, wait=True)
        return {c: yahoo_symbol(t) for c, t in mapped.items() if t}

    async def refresh(self, manager, book=None):
        """Backfills, prices and recomputes one manager. Returns the saved status, or None when prices failed."""
        book = book or self.book()
        accessions = await self.backfill(manager, book.today)
        quarters = await asyncio.to_thread(self.repo.quarters, accessions)
        cusips = sorted({p["cusip"] for q in quarters for p in q["positions"]})
        tickers = await self._map(cusips)
        symbols = set(tickers.values()) | {BENCHMARK}
        await book.load(symbols)
        if symbols & book.failed:
            logger.warning("13F performance for %s kept: price download incomplete", manager)
            return None
        for quarter in quarters:
            quarter["equity_value"] = float(quarter["equity_value"])
        result = simulate(quarters, tickers, book.get)
        await asyncio.to_thread(
            self.repo.save_performance,
            {
                "manager_id": manager,
                "method_version": METHOD_VERSION,
                "status": result["status"],
                "result": result,
                "latest_period": quarters[-1]["period"] if quarters else None,
                "computed_at": now_iso(),
            },
        )
        logger.info("13F performance %s: %s", manager, result["status"])
        return result["status"]

    async def refresh_due(self, now=None):
        now = now or datetime.now(timezone.utc)
        rows = {r["manager_id"]: r for r in await asyncio.to_thread(self.repo.performance_index)}
        book = self.book()
        for manager in list(MANAGERS):
            row = rows.get(manager)
            if row and row["method_version"] == METHOD_VERSION:
                computed = datetime.fromisoformat(str(row["computed_at"]).replace("Z", "+00:00"))
                if now - computed < REFRESH_AFTER:
                    continue
            try:
                await self.refresh(manager, book)
            except Exception:
                logger.warning("13F performance failed for %s", manager, exc_info=True)

    async def run_worker(self, interval=CHECK_INTERVAL, delay=600):
        """Starts after the holdings sync has had a head start; each pass only touches managers that are due."""
        await asyncio.sleep(delay)
        while True:
            try:
                await self.refresh_due()
            except Exception:
                logger.warning("13F performance pass failed", exc_info=True)
            await asyncio.sleep(interval)


performance_store = PerformanceStore()
