"""Public pilot valuation reads, bounded background builds and cached simulations."""
import asyncio
from collections import OrderedDict
from datetime import datetime
import time
from uuid import uuid4
from zoneinfo import ZoneInfo

from .eps import parse_eps_facts
from .pe import pe_reference, project_pe
from .releases import PARSER_VERSION, PILOTS, supplement_q4
from .series import build_series
from .source_cache import ValuationSecClient


def download_prices(symbol, start, end):
    import yfinance as yf
    ticker = yf.Ticker(symbol)
    frame = ticker.history(start=start, end=end, auto_adjust=False, back_adjust=False,
                           actions=True, prepost=False, repair=False, interval="1d")
    if frame.empty:
        raise ValueError("Price history unavailable")
    metadata = ticker.get_history_metadata()
    if metadata.get("symbol", "").upper() != symbol or metadata.get("instrumentType") != "EQUITY":
        raise ValueError("Unexpected price instrument")
    rows, splits = [], []
    for stamp, row in frame.iterrows():
        day = stamp.date().isoformat()
        rows.append({"date": day, "close": float(row["Close"])})
        if row.get("Stock Splits", 0):
            splits.append({"date": day, "ratio": float(row["Stock Splits"])})
    return {"rows": rows, "splits": splits, "currency": metadata.get("currency"),
            "timezone": metadata.get("exchangeTimezoneName")}


class ValuationService:
    def __init__(self):
        self.client = ValuationSecClient()
        self.cache = {}
        self.jobs = OrderedDict()
        self.active = {}
        self.gate = asyncio.Semaphore(2)

    @staticmethod
    def today():
        return str(datetime.now(ZoneInfo("America/New_York")).date())

    async def build(self, symbol, as_of):
        async with self.gate:
            payload = await self.client.json(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{PILOTS[symbol]:010d}.json")
            if payload.get("cik") != PILOTS[symbol]:
                raise ValueError("Unexpected SEC company identifier")
            facts = parse_eps_facts(payload)["facts"]
            start = f"{int(as_of[:4])-8}{as_of[4:]}"
            if start.endswith("02-29"):
                start = start[:-2] + "28"
            releases = await supplement_q4(self.client, symbol, facts, after=f"{int(as_of[:4])-9}-01-01", as_of=as_of)
            prices = await asyncio.to_thread(download_prices, symbol, start, as_of)
            result = await asyncio.to_thread(build_series, symbol, facts + [r["fact"] for r in releases["records"]], prices, as_of=as_of)
            result["supplements"] = {"accepted": len(releases["records"]), "failures": releases["failures"],
                                     "parser_version": PARSER_VERSION,
                                     "records": [{"period_end": r["fact"].end, "value": r["fact"].value,
                                                   "filed": r["fact"].filed, "source_url": r["fact"].source_url_override,
                                                   "source_sha256": r["fact"].source_sha256, "evidence": r["evidence"]}
                                                  for r in releases["records"]]}
            self.cache[symbol] = (time.monotonic() + 21600, result)
            return result

    async def _build_job(self, job_id, symbol, as_of):
        job = self.jobs[job_id]
        job["status"] = "running"
        try:
            await self.build(symbol, as_of)
            job["status"] = "complete"
        except Exception:
            # The client sees a stable error code, never provider/debug internals.
            job["status"] = "failed"
            job["error"] = "valuation_source_unavailable"

    def request(self, symbol, *, retry=False):
        if symbol not in PILOTS:
            return 200, {"symbol": symbol, "status": "unsupported", "supported_symbols": list(PILOTS)}
        as_of = self.today()
        cached = self.cache.get(symbol)
        if cached and cached[0] > time.monotonic() and cached[1]["as_of"] == as_of:
            return 200, cached[1]
        job_id = self.active.get(symbol)
        if job_id and self.jobs[job_id]["status"] == "failed" and not retry:
            return 503, {"symbol": symbol, "status": "failed", "error": "valuation_source_unavailable"}
        if not job_id or self.jobs[job_id]["status"] in {"complete", "failed"}:
            job_id = uuid4().hex
            self.jobs[job_id] = {"id": job_id, "symbol": symbol, "status": "queued"}
            self.active[symbol] = job_id
            self.jobs[job_id]["task"] = asyncio.create_task(self._build_job(job_id, symbol, as_of))
            # Public jobs only. Keep active jobs and a small completed history.
            for key in list(self.jobs):
                if len(self.jobs) <= 24:
                    break
                if key not in self.active.values() and self.jobs[key]["status"] in {"complete", "failed"}:
                    self.jobs.pop(key)
        return 202, {"symbol": symbol, "status": "building", "job_id": job_id, "retry_after": 3}

    def job(self, job_id):
        job = self.jobs.get(job_id)
        return {k: v for k, v in job.items() if k != "task"} if job else None

    def simulate(self, symbol, snapshot_id, multiples, growth, target_dates):
        cached = self.cache.get(symbol)
        if not cached or cached[1]["snapshot_id"] != snapshot_id:
            raise LookupError("snapshot_unavailable")
        data = cached[1]
        current = data["current"]
        if current["status"] != "complete" or current["share_basis_status"] != "verified":
            raise ValueError("verified_eps_unavailable")
        assumptions = {key: {"target_pe": value, "eps_growth": growth[key]} for key, value in multiples.items()}
        result = pe_reference(eps=current["eps"], multiples=multiples, price=current["price"])
        projections = [project_pe(eps=current["eps"], assumptions=assumptions, as_of=data["as_of"],
                                  target_date=target, price=current["price"]) for target in target_dates]
        return {"symbol": symbol, "snapshot_id": snapshot_id, "result_kind": "personal_simulation",
                "reference": result, "projections": projections}


valuation_service = ValuationService()
