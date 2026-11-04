"""Current vendor financial inputs for company calculators; no historical backfill.

This source stays distinct from the SEC historical reconstruction. All financial
fields retain their period, provider tag and origin; forecast defaults are never
presented as reported financial data.
"""
import asyncio
from collections import OrderedDict
from datetime import datetime, timezone
from hashlib import sha256
import json
import time
from urllib.parse import quote

from app.services.yfinance.client import get_yfinance_service
from .eps import finite, iso_date


def numeric(value):
    return float(value) if finite(value) else None


def field(row, names):
    for name in names:
        value = numeric(row.get(name))
        if value is not None:
            return value, name
    return None, None


def dated(rows, today):
    result = []
    for row in rows:
        try:
            end = iso_date(str(row.get("period", ""))[:10])
        except ValueError:
            continue
        if str(end) <= today:
            result.append({**row, "period": str(end)})
    result.sort(key=lambda row: row["period"], reverse=True)
    if len({r["period"] for r in result}) != len(result):
        raise ValueError("duplicate_financial_periods")
    return result


def normalize_company_inputs(symbol, info, quarterly, annual, balances, *, fetched_at):
    canonical = symbol.upper().replace(".", "-")
    base = {"symbol": symbol.upper(), "name": info.get("longName") or info.get("shortName") or symbol,
            "source": "Yahoo Finance", "fetched_at": fetched_at, "currency": info.get("currency"),
            "financial_currency": info.get("financialCurrency"), "sector": info.get("sector"),
            "industry": info.get("industry")}
    if info.get("symbol", "").upper().replace(".", "-") != canonical or info.get("quoteType") != "EQUITY":
        return {**base, "status": "unsupported", "reason": "ordinary_equity_required"}
    if info.get("currency") != "USD" or info.get("financialCurrency") != "USD":
        return {**base, "status": "unsupported", "reason": "usd_listing_and_financials_required"}
    if info.get("country") != "United States":
        return {**base, "status": "unsupported", "reason": "us_company_required"}
    today = fetched_at[:10]
    quarters = dated(quarterly, today)[:4]
    contiguous = len(quarters) == 4 and all(70 <= (iso_date(quarters[i]["period"])-iso_date(quarters[i+1]["period"])).days <= 120 for i in range(3))
    if contiguous and all(field(r, ["Total Revenue"])[0] is not None for r in quarters):
        operating = quarters
        income_basis = "ttm_four_quarters"
    else:
        operating = dated(annual, today)[:1]
        income_basis = "reported_fiscal_year" if operating else "unavailable"
    values, origins, fields = {}, {}, {}
    for key, tags in (("revenue", ["Total Revenue"]), ("operating_income", ["Operating Income"]),
                      ("pretax_income", ["Pretax Income"]), ("tax_provision", ["Tax Provision"])):
        parts = [field(r, tags)[0] for r in operating]
        values[key] = sum(parts) if parts and all(v is not None for v in parts) else None
        fields[key] = {"tags": tags, "periods": [r["period"] for r in operating]}
        origins[key] = "reported_vendor_data" if values[key] is not None else "unavailable"
    revenue, operating_income = values["revenue"], values["operating_income"]
    operating_margin = operating_income / revenue if revenue is not None and revenue > 0 and operating_income is not None else None
    tax = values["tax_provision"] / values["pretax_income"] if values["tax_provision"] is not None and (values["pretax_income"] or 0) > 0 else None
    values["tax_rate"] = tax if tax is not None and 0 <= tax <= 1 else .21
    origins["tax_rate"] = "derived_reported_data" if tax is not None and 0 <= tax <= 1 else "assumed_21_percent"
    balance = dated(balances, today)
    balance = balance[0] if balance else {}
    for key, tags in (("cash", ["Cash Cash Equivalents And Short Term Investments", "Cash And Cash Equivalents"]),
                      ("debt", ["Total Debt"])):
        value, tag = field(balance, tags)
        values[key] = value if value is not None and value >= 0 else None
        origins[key] = "reported_vendor_data" if values[key] is not None else "unavailable"
        fields[key] = {"tag": tag, "period": balance.get("period")}
    minority, minority_tag = field(balance, ["Minority Interest"])
    preferred, preferred_tag = field(balance, ["Preferred Stock Equity", "Preferred Stock"])
    values["other_claims"] = sum(v or 0 for v in (minority, preferred))
    origins["other_claims"] = "reported_vendor_data" if minority is not None and preferred is not None else "missing_components_assumed_zero"
    fields["other_claims"] = {"tags": [minority_tag, preferred_tag], "period": balance.get("period")}
    values["eps"] = numeric(info.get("trailingEps"))
    shares = numeric(info.get("sharesOutstanding"))
    values["shares"] = shares if shares is not None and shares > 0 else None
    for key, tag in (("eps", "trailingEps"), ("shares", "sharesOutstanding")):
        origins[key] = "reported_vendor_data" if values[key] is not None else "unavailable"
        fields[key] = {"tag": tag, "period": "vendor_current"}
    price = numeric(info.get("regularMarketPrice"))
    stamp = numeric(info.get("regularMarketTime"))
    now = datetime.fromisoformat(fetched_at).timestamp()
    quote_time = None
    if price is not None and price > 0 and stamp is not None and 0 < stamp <= now + 300:
        quote_time = datetime.fromtimestamp(stamp, timezone.utc).isoformat()
    else:
        price = None
    sector, industry = str(info.get("sector", "")).lower(), str(info.get("industry", "")).lower()
    exclusion = "specialized_financial_model_required" if "financial" in sector or "reit" in industry or "insurance" in industry else None
    sources = {"financials": f"https://finance.yahoo.com/quote/{quote(canonical)}/financials/",
               "balance_sheet": f"https://finance.yahoo.com/quote/{quote(canonical)}/balance-sheet/"}
    result = {**base, "status": "available", "inputs": values, "origins": origins, "fields": fields,
              "income_basis": income_basis, "income_periods": [r["period"] for r in operating],
              "balance_period": balance.get("period"), "operating_margin": operating_margin,
              "price": price, "quote_time": quote_time, "sources": sources, "dcf_exclusion": exclusion,
              "market_cap_reference": price * shares if price is not None and shares is not None and shares > 0 else None}
    result["snapshot_id"] = sha256(json.dumps(result, sort_keys=True, allow_nan=False).encode()).hexdigest()
    return result


def download_company_inputs(symbol):
    service = get_yfinance_service()
    ticker = service.get_ticker(symbol.replace(".", "-"))
    info = ticker.info
    if not isinstance(info, dict) or not info.get("symbol"):
        raise ValueError("company_source_unavailable")
    from app.services.yfinance.client import _statement_rows
    frames = []
    for attr in ("quarterly_income_stmt", "income_stmt", "quarterly_balance_sheet"):
        try:
            frames.append(_statement_rows(getattr(ticker, attr)))
        except Exception:
            frames.append([])
    return normalize_company_inputs(symbol, info, *frames, fetched_at=datetime.now(timezone.utc).isoformat())


class CompanyInputsService:
    def __init__(self):
        self.cache = OrderedDict()
        self.tasks = {}
        self.gate = asyncio.Semaphore(2)

    async def _load(self, symbol):
        try:
            async with self.gate:
                data = await asyncio.to_thread(download_company_inputs, symbol)
            self.cache[symbol] = (time.monotonic()+300, data)
            self.cache.move_to_end(symbol)
            while len(self.cache) > 32:
                self.cache.popitem(last=False)
            return data
        finally:
            self.tasks.pop(symbol, None)

    async def load(self, symbol):
        cached = self.cache.get(symbol)
        if cached and cached[0] > time.monotonic():
            self.cache.move_to_end(symbol)
            return cached[1]
        if symbol not in self.tasks:
            if len(self.tasks) >= 16:
                raise RuntimeError("company_source_busy")
            self.tasks[symbol] = asyncio.create_task(self._load(symbol))
            # A shielded request can time out before its shared source task fails.
            self.tasks[symbol].add_done_callback(lambda task: task.exception() if not task.cancelled() else None)
        return await asyncio.wait_for(asyncio.shield(self.tasks[symbol]), timeout=40)

    def snapshot(self, symbol, snapshot_id):
        cached = self.cache.get(symbol)
        if not cached or cached[1].get("snapshot_id") != snapshot_id:
            raise LookupError("company_snapshot_changed")
        return cached[1]


company_inputs_service = CompanyInputsService()
