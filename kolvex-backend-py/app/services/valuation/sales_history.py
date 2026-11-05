"""Point-in-time price-to-sales history from SEC filings and daily closes.

Works for loss-making companies, where PE has no meaning. Revenue is additive, so
TTM = last fiscal year + current YTD - prior-year YTD. Only filings published
before a session can affect it. Nothing here is estimated or AI-generated; shares
that cannot be reconciled with the vendor market cap leave the series unavailable.
"""
import asyncio
from bisect import bisect_left
from collections import OrderedDict
from datetime import date, datetime, timedelta
import time
from zoneinfo import ZoneInfo

from app.services.sec.client import SecNotFound
from app.services.yfinance.client import get_yfinance_service
from .eps import finite, split_factor
from .service import download_prices
from .source_cache import ValuationSecClient

REVENUE_CONCEPTS = ("RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet",
                    "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueGoodsNet", "SalesRevenueServicesNet")
SHARE_CONCEPTS = ("WeightedAverageNumberOfSharesOutstandingBasic", "WeightedAverageNumberOfShareOutstandingBasicAndDiluted")
MAX_REVENUE_AGE_DAYS = 200
MIN_REFERENCE_SESSIONS = 252
SHARE_TOLERANCE = .25
HISTORY_YEARS = 5


def _facts(payload, concepts, unit):
    """First-filed value per period, so later restatements cannot leak backward."""
    gaap = payload.get("facts", {}).get("us-gaap", {})
    best = {}
    for concept in concepts:
        first = {}
        for row in gaap.get(concept, {}).get("units", {}).get(unit, []):
            if not row.get("start") or not finite(row.get("val")) or row["val"] <= 0 or not row.get("filed"):
                continue
            key = (row["start"], row["end"])
            if key not in first or (row["filed"], row.get("accn", "")) < (first[key]["filed"], first[key].get("accn", "")):
                first[key] = row
        # Concepts overlap: a subset (contract revenue) and a total (Revenues) can
        # both be tagged for one period. The consolidated total is the larger one.
        for key, row in first.items():
            if key not in best or row["val"] > best[key]["val"]:
                best[key] = {**row, "concept": concept}
    return list(best.values())


def _days(row):
    return (date.fromisoformat(row["end"]) - date.fromisoformat(row["start"])).days


def ttm_revenue(facts, known_before):
    known = [r for r in facts if r["filed"] < known_before]
    years = [r for r in known if 350 <= _days(r) <= 380]
    if not years:
        return None
    fiscal = max(years, key=lambda r: r["end"])
    fiscal_end = date.fromisoformat(fiscal["end"])
    # Year-to-date periods that begin right after the last fiscal year.
    current = [r for r in known if r["end"] > fiscal["end"] and _days(r) < 350
               and abs((date.fromisoformat(r["start"]) - fiscal_end).days - 1) <= 7]
    if not current:
        return {"value": fiscal["val"], "period_end": fiscal["end"], "inputs": [fiscal], "kind": "fiscal_year"}
    latest = max(current, key=lambda r: r["end"])
    target_end, length = date.fromisoformat(latest["end"]) - timedelta(days=365), _days(latest)
    prior = [r for r in known if abs((date.fromisoformat(r["end"]) - target_end).days) <= 10 and abs(_days(r) - length) <= 10]
    if not prior:
        # Without the comparable prior period, the last full year stays the honest value.
        return {"value": fiscal["val"], "period_end": fiscal["end"], "inputs": [fiscal], "kind": "fiscal_year"}
    earlier = min(prior, key=lambda r: abs((date.fromisoformat(r["end"]) - target_end).days))
    value = fiscal["val"] + latest["val"] - earlier["val"]
    if value <= 0:
        return None
    return {"value": value, "period_end": latest["end"], "inputs": [fiscal, latest, earlier], "kind": "ttm"}


def _shares_on_current_basis(facts, known_before, splits, as_of):
    known = []
    for row in facts:
        if row["filed"] >= known_before:
            continue
        # Around a split, a filing's share basis needs manual review; skip it.
        filed = date.fromisoformat(row["filed"])
        if any(abs((filed - date.fromisoformat(s["date"])).days) <= 3 for s in splits):
            continue
        known.append(row)
    if not known:
        return None
    end = max(r["end"] for r in known)
    row = min((r for r in known if r["end"] == end), key=_days)
    return {"value": row["val"] * split_factor(splits, row["filed"], as_of), "period_end": end, "filed": row["filed"]}


def percentile(ordered, share):
    position = (len(ordered) - 1) * share
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def source_url(cik, row):
    accession = row.get("accn")
    return f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={int(cik):010d}&type={row.get('form', '')}" if not accession else \
        f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace('-', '')}/"


def build_sales_history(symbol, payload, market, *, as_of, vendor_market_cap=None):
    base = {"symbol": symbol, "as_of": as_of, "currency": "USD", "metric": "ps", "source": "SEC + Yahoo Finance",
            "result_kind": "sec_filing_history_reconstruction"}
    revenue = _facts(payload, REVENUE_CONCEPTS, "USD")
    shares = []
    for concept in SHARE_CONCEPTS:
        shares = _facts(payload, (concept,), "shares")
        if shares:
            break
    if not revenue or not shares:
        return {**base, "status": "unavailable", "reason": "sec_facts_missing"}
    rows = sorted((r for r in market["rows"] if r["date"] < as_of and finite(r.get("close")) and r["close"] > 0), key=lambda r: r["date"])
    if not rows or market.get("currency") != "USD":
        return {**base, "status": "unavailable", "reason": "price_history_unavailable"}
    splits = market.get("splits", [])
    filing_days = sorted({r["filed"] for r in revenue + shares})
    states, events = {}, {}

    def state(day):
        index = bisect_left(filing_days, day)
        if index not in states:
            states[index] = (ttm_revenue(revenue, day), _shares_on_current_basis(shares, day, splits, as_of))
        return states[index]

    points = []
    for row in rows:
        sales, count = state(row["date"])
        fresh = sales and (date.fromisoformat(row["date"]) - date.fromisoformat(sales["period_end"])).days <= MAX_REVENUE_AGE_DAYS
        point = {"date": row["date"], "price": row["close"], "ps": None, "market_cap": None, "ttm_revenue": None, "shares": None, "event_id": None}
        if fresh and count:
            cap = row["close"] * count["value"]
            event_id = f"{sales['period_end']}:{count['period_end']}"
            events.setdefault(event_id, {"period_end": sales["period_end"], "kind": sales["kind"], "shares_period_end": count["period_end"],
                                         "inputs": [{"start": r["start"], "end": r["end"], "value": r["val"], "form": r.get("form"),
                                                     "filed": r["filed"], "concept": r["concept"], "source_url": source_url(payload.get("cik", 0), r)}
                                                    for r in sales["inputs"]]})
            point.update(ps=cap / sales["value"], market_cap=cap, ttm_revenue=sales["value"], shares=count["value"], event_id=event_id)
        points.append(point)
    valid = [p for p in points if p["ps"] is not None]
    if not valid:
        return {**base, "status": "unavailable", "reason": "insufficient_sec_history"}
    # A jump with no split means the share series changed meaning (IPO, class
    # conversion). Publish only the unbroken stretch ending at the latest filing.
    for newer, older in zip(reversed(valid), reversed(valid[:-1])):
        ratio = newer["shares"] / older["shares"]
        if not .5 <= ratio <= 2:
            for point in points:
                if point["date"] <= older["date"]:
                    point.update(ps=None, market_cap=None, ttm_revenue=None, shares=None, event_id=None)
            break
    valid = [p for p in points if p["ps"] is not None]
    latest = valid[-1]
    if latest["date"] != rows[-1]["date"]:
        # A stale series must not present an old multiple as the current one.
        return {**base, "status": "unavailable", "reason": "insufficient_sec_history"}
    if finite(vendor_market_cap) and vendor_market_cap > 0:
        vendor_shares = vendor_market_cap / rows[-1]["close"]
        if abs(latest["shares"] / vendor_shares - 1) > SHARE_TOLERANCE:
            # For example, class-A-equivalent counts against a class B quote.
            return {**base, "status": "unavailable", "reason": "share_basis_unverified"}
    start = f"{int(as_of[:4])-HISTORY_YEARS}{as_of[4:]}".replace("02-29", "02-28")
    points = [p for p in points if p["date"] >= start]
    samples = sorted(p["ps"] for p in points if p["ps"] is not None)
    reference = None
    if len(samples) >= MIN_REFERENCE_SESSIONS:
        reference = {"p25": percentile(samples, .25), "p50": percentile(samples, .5), "p75": percentile(samples, .75),
                     "sample_count": len(samples), "current_percentile": bisect_left(samples, latest["ps"]) / len(samples)}
    used = {p["event_id"] for p in points if p["event_id"]}
    return {**base, "status": "available", "points": points, "events": {k: v for k, v in events.items() if k in used},
            "current": latest, "reference": reference,
            "coverage": {"price_sessions": len(points), "valuation_sessions": len(samples)}}


def download_market_context(symbol, start, as_of):
    canonical = symbol.replace(".", "-")
    info = get_yfinance_service().get_ticker(canonical).info
    if not isinstance(info, dict):
        raise ValueError("company_source_unavailable")
    if info.get("quoteType") != "EQUITY" or info.get("currency") != "USD" or info.get("financialCurrency") not in {"USD", None}:
        return {"unsupported": True}
    return {"market": download_prices(canonical, start, as_of), "market_cap": info.get("marketCap")}


class SalesHistoryService:
    def __init__(self):
        self.client = ValuationSecClient()
        self.cache = OrderedDict()
        self.tasks = {}
        self.gate = asyncio.Semaphore(2)

    @staticmethod
    def today():
        return str(datetime.now(ZoneInfo("America/New_York")).date())

    async def _load(self, symbol, as_of):
        try:
            async with self.gate:
                try:
                    company = await self.client.company(symbol)
                except SecNotFound:
                    return {"symbol": symbol, "status": "unsupported", "reason": "no_sec_mapping"}
                payload = await self.client.json(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{int(company['cik']):010d}.json")
                start = f"{int(as_of[:4])-HISTORY_YEARS}-01-01"
                context = await asyncio.to_thread(download_market_context, symbol, start, as_of)
                if context.get("unsupported"):
                    data = {"symbol": symbol, "status": "unsupported", "reason": "usd_equity_required"}
                else:
                    data = await asyncio.to_thread(build_sales_history, symbol, {**payload, "cik": company["cik"]}, context["market"],
                                                   as_of=as_of, vendor_market_cap=context["market_cap"])
            self.cache[symbol] = (time.monotonic()+21600, data)
            self.cache.move_to_end(symbol)
            while len(self.cache) > 64:
                self.cache.popitem(last=False)
            return data
        finally:
            self.tasks.pop(symbol, None)

    async def load(self, symbol):
        as_of = self.today()
        cached = self.cache.get(symbol)
        if cached and cached[0] > time.monotonic() and cached[1].get("as_of", as_of) == as_of:
            return cached[1]
        if symbol not in self.tasks:
            if len(self.tasks) >= 16:
                raise RuntimeError("sales_history_busy")
            self.tasks[symbol] = asyncio.create_task(self._load(symbol, as_of))
            self.tasks[symbol].add_done_callback(lambda task: task.exception() if not task.cancelled() else None)
        return await asyncio.wait_for(asyncio.shield(self.tasks[symbol]), timeout=40)


sales_history_service = SalesHistoryService()
