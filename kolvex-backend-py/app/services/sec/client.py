"""Bounded, cached, rate-limited SEC reads. Does not call paid services."""
import asyncio
import json
import os
import re
import time
from collections import OrderedDict
from datetime import datetime, timezone
from urllib.parse import quote
from xml.etree.ElementTree import ParseError

import httpx

from .parsers import compare_holdings, financial_history, filings_from, is_earnings_filing, parse_holdings, parse_insider

# An explicit, curated coverage list, not a claim to cover all institutional investors.
MANAGERS = {
    "berkshire": {"cik": 1067983, "name": "Berkshire Hathaway"},
    "bridgewater": {"cik": 1350694, "name": "Bridgewater Associates"},
    "pershing": {"cik": 1336528, "name": "Pershing Square"},
    "duquesne": {"cik": 1536411, "name": "Duquesne Family Office"},
    "appaloosa": {"cik": 1656456, "name": "Appaloosa"},
    "baupost": {"cik": 1061768, "name": "Baupost Group"},
    "tiger": {"cik": 1167483, "name": "Tiger Global"},
    "third_point": {"cik": 1040273, "name": "Third Point"},
    "oaktree": {"cik": 949509, "name": "Oaktree Capital"},
    "renaissance": {"cik": 1037389, "name": "Renaissance Technologies"},
}
FINANCIALS_TTL = 21600


class SecUnavailable(Exception):
    pass


class SecNotFound(Exception):
    pass


class SecClient:
    def __init__(self):
        self._cache = OrderedDict()
        self._bytes = 0
        self._gate = asyncio.Lock()
        self._locks = {}
        self._next_request = 0.0
        self._financials = OrderedDict()

    async def read(self, url, ttl=21600):
        # URLs are entirely constructed by this module, never supplied by a caller.
        if not (url.startswith("https://data.sec.gov/") or url.startswith("https://www.sec.gov/")):
            raise ValueError("Unsupported SEC source")
        async with self._gate:
            lock = self._locks.setdefault(url, [asyncio.Lock(), 0])
            lock[1] += 1
        try:
            async with lock[0]:
                cached = self._cache.get(url)
                if cached and cached[0] > time.monotonic():
                    self._cache.move_to_end(url)
                    return cached[1]
                async with self._gate:
                    delay = max(0, self._next_request - time.monotonic())
                    self._next_request = max(self._next_request, time.monotonic()) + .25
                if delay:
                    await asyncio.sleep(delay)
                try:
                    async with httpx.AsyncClient(timeout=12, follow_redirects=False) as client:
                        async with client.stream("GET", url, headers={"User-Agent": os.getenv("SEC_USER_AGENT", "Kolvex/1.0 (https://kolvex.app)"), "Accept-Encoding": "gzip, deflate"}) as response:
                            response.raise_for_status()
                            parts, size = [], 0
                            async for part in response.aiter_bytes():
                                size += len(part)
                                if size > 12_000_000:
                                    raise SecUnavailable("SEC document too large")
                                parts.append(part)
                            body = b"".join(parts)
                except (httpx.HTTPError, ValueError) as exc:
                    raise SecUnavailable("SEC source unavailable") from exc
                old = self._cache.pop(url, None)
                if old:
                    self._bytes -= len(old[1])
                self._cache[url] = (time.monotonic() + ttl, body)
                self._bytes += len(body)
                while len(self._cache) > 64 or self._bytes > 32_000_000:
                    _, item = self._cache.popitem(last=False)
                    self._bytes -= len(item[1])
                return body
        finally:
            async with self._gate:
                lock[1] -= 1
                if lock[1] == 0:
                    self._locks.pop(url, None)

    async def json(self, url, ttl=21600):
        try:
            return json.loads(await self.read(url, ttl))
        except (json.JSONDecodeError, UnicodeError) as exc:
            raise SecUnavailable("Invalid SEC response") from exc

    async def company(self, symbol):
        tickers = await self.json("https://www.sec.gov/files/company_tickers.json", 86400)
        normalized = symbol.upper().replace(".", "-")
        row = next((r for r in tickers.values() if r["ticker"].upper().replace(".", "-") == normalized), None)
        if not row:
            raise SecNotFound("No SEC ticker mapping")
        return {"symbol": symbol.upper(), "cik": row["cik_str"], "name": row["title"]}

    async def submissions(self, cik):
        return await self.json(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json", 3600)

    @staticmethod
    def archive(cik, filing, filename):
        # Only basename documents observed in SEC filings/index. No traversal or external URL.
        name = filename.split("/")[-1]
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", name) or name in {".", ".."}:
            raise SecUnavailable("Invalid SEC filename")
        accession = filing["accession"].replace("-", "")
        if not re.fullmatch(r"\d{18}", accession):
            raise SecUnavailable("Invalid SEC accession")
        return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession}/{quote(name)}"

    @staticmethod
    def meta():
        return {"source": "SEC EDGAR", "fetched_at": datetime.now(timezone.utc).isoformat()}

    async def financials(self, symbol):
        company = await self.company(symbol)
        cached = self._financials.get(company["cik"])
        if cached and cached[0] > time.monotonic():
            self._financials.move_to_end(company["cik"])
            return {**company, **cached[1]}
        raw = await self.read(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{int(company['cik']):010d}.json", FINANCIALS_TTL)
        # Company facts run to several megabytes. Parse off the event loop, keep only the result.
        try:
            history = await asyncio.to_thread(lambda: financial_history(json.loads(raw)))
        except (json.JSONDecodeError, UnicodeError) as exc:
            raise SecUnavailable("Invalid SEC response") from exc
        result = {**self.meta(), **history}
        self._financials[company["cik"]] = (time.monotonic() + FINANCIALS_TTL, result)
        while len(self._financials) > 64:
            self._financials.popitem(last=False)
        return {**company, **result}

    async def filings(self, symbol):
        company = await self.company(symbol)
        submissions = await self.submissions(company["cik"])
        rows = [{**r, "earnings": is_earnings_filing(r)} for r in filings_from(submissions) if r["form"] in {"10-K", "10-Q", "8-K", "10-K/A", "10-Q/A", "8-K/A", "20-F", "20-F/A", "6-K"}][:40]
        return {**company, **self.meta(), "filings": rows,
            "coverage": "Recent SEC filings only. 8-K filings may include earnings releases and exhibits; transcripts and slides are not guaranteed."}

    async def insiders(self, symbol):
        company = await self.company(symbol)
        submissions = await self.submissions(company["cik"])
        filings = [r for r in filings_from(submissions) if r["form"] in {"4", "4/A"}][:12]
        rows, failed = [], 0
        for filing in filings:
            try:
                raw = await self.read(self.archive(company["cik"], filing, filing["document"]))
                rows.extend(parse_insider(raw, filing, company["cik"]))
            except (SecUnavailable, ValueError, ParseError):
                failed += 1
        return {**company, **self.meta(), "transactions": sorted(rows, key=lambda r: r["date"] or "", reverse=True),
            "filings": filings, "failed_filings": failed, "filing_limit": 12,
            "coverage": "Non-derivative transactions from the latest 12 Form 4/4-A filings. Amendments are shown separately; this is not a complete trading history."}

    async def _holdings_filing(self, cik, filing):
        index = await self.json(self.archive(cik, filing, "index.json"))
        files = index.get("directory", {}).get("item", [])
        # Prefer information-table names, then inspect a bounded number of XML documents.
        names = [r["name"] for r in files if str(r.get("name", "")).lower().endswith(".xml")]
        names.sort(key=lambda n: ("info" not in n.lower(), n))
        for name in names[:8]:
            rows = parse_holdings(await self.read(self.archive(cik, filing, name)))
            if rows is not None:
                return rows
        raise SecUnavailable("SEC information table unavailable")

    async def institution(self, manager):
        identity = MANAGERS[manager]
        filings = filings_from(await self.submissions(identity["cik"]))
        originals = [r for r in filings if r["form"] == "13F-HR"]
        if not originals:
            return {**identity, **self.meta(), "holdings": [], "filing": None, "previous_filing": None, "partial": False, "amendments": []}
        current = originals[0]
        previous = next((r for r in originals[1:] if r["period"] < current["period"]), None)
        amendments = [r for r in filings if r["form"] == "13F-HR/A" and r["period"] in {current["period"], previous["period"] if previous else None}]
        now = await self._holdings_filing(identity["cik"], current)
        prior, failed = None, False
        # No share-change calculation across gaps or amended snapshots.
        from .parsers import days
        if previous and 70 <= days(previous["period"], current["period"]) <= 110 and not amendments:
            try:
                prior = await self._holdings_filing(identity["cik"], previous)
            except (SecUnavailable, ValueError):
                failed = True
        # SEC switched 13F values from thousands to dollars for reporting periods >= 2023-01-03.
        def dollars(rows, period):
            return [{**r, "value": r["value"] * (1000 if period < "2023-01-03" else 1) if r["value"] is not None else None} for r in rows]
        now = dollars(now, current["period"])
        if prior is not None:
            prior = dollars(prior, previous["period"])
        return {**identity, **self.meta(), "filing": current, "previous_filing": previous,
            "holdings": compare_holdings(now, prior), "partial": failed or bool(amendments), "amendments": amendments,
            "coverage": "Original 13F snapshots from the selected manager, not live positions. Amendments are linked separately and disable change calculations. Share changes are unadjusted for corporate actions."}


sec_client = SecClient()
