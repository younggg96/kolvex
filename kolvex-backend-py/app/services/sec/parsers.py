"""SEC source normalization. Missing facts remain missing; no estimated financials."""
import math
import re
from datetime import date, timedelta
from xml.etree import ElementTree as ET

TAGS = {
    "revenue": ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax"],
    "gross_profit": ["GrossProfit"],
    "operating_income": ["OperatingIncomeLoss"],
    "net_income": ["NetIncomeLoss", "ProfitLoss"],
    "eps_diluted": ["EarningsPerShareDiluted"],
    "operating_cash_flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
    "assets": ["Assets"], "liabilities": ["Liabilities"],
    "equity": ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
}
INSTANT = {"assets", "liabilities", "equity"}
ADDITIVE = set(TAGS) - INSTANT - {"eps_diluted"}
# 70-120 days: includes 16-week fiscal fourth quarters (for example Costco).
QUARTER_DAYS = (70, 120)
EARNINGS_FORMS = {"10-K", "10-K/A", "10-Q", "10-Q/A", "20-F", "20-F/A"}


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def days(start, end):
    try:
        return (date.fromisoformat(end) - date.fromisoformat(start)).days + 1
    except (ValueError, TypeError):
        return -1


def filing_url(cik, accession):
    if not re.fullmatch(r"\d{10}-\d{2}-\d{6}", accession or ""):
        return None
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace('-', '')}/{accession}-index.html"


def filings_from(submissions):
    recent = submissions.get("filings", {}).get("recent", {})
    result = []
    for i, form in enumerate(recent.get("form", [])):
        def field(key):
            values = recent.get(key, [])
            return values[i] if i < len(values) else ""
        accession = field("accessionNumber")
        if not filing_url(submissions["cik"], accession):
            continue
        result.append({"form": form, "accession": accession, "filed": field("filingDate"),
                       "period": field("reportDate"), "document": field("primaryDocument"),
                       "description": field("primaryDocDescription"),
                       "items": [i for i in str(field("items")).split(",") if i],
                       "source_url": filing_url(submissions["cik"], accession)})
    return sorted(result, key=lambda r: (r["filed"], r["accession"]), reverse=True)


def is_earnings_filing(filing):
    # 8-K Item 2.02 is "Results of Operations and Financial Condition".
    return filing["form"] in EARNINGS_FORMS or (filing["form"] in {"8-K", "8-K/A", "6-K"} and "2.02" in filing.get("items", []))


def financial_history(payload):
    facts = payload.get("facts", {}).get("us-gaap", {})
    # One financial currency per response. Never combine currencies in derived ratios.
    currency = None
    for tag in TAGS["revenue"]:
        units = facts.get(tag, {}).get("units", {})
        currencies = [u for u in units if re.fullmatch(r"[A-Z]{3}", u)]
        if currencies:
            currency = "USD" if "USD" in currencies else sorted(currencies)[0]
            break
    if not currency:
        return {"currency": None, "annual": [], "quarterly": [], "ttm": None}
    series, fiscal_years = {}, {}
    # (start, end) -> (filed, fy, fp) of the earliest filing reporting that revenue period. A
    # period's own 10-Q/10-K comes first; later filings repeat it as a comparative column but
    # carry their own fy, so only the earliest one names the period correctly.
    first_report: dict[tuple, tuple] = {}
    cik = payload["cik"]
    for metric, tags in TAGS.items():
        candidates, fiscal_years[metric] = {}, set()
        for priority, tag in enumerate(tags):
            unit = f"{currency}/shares" if metric == "eps_diluted" else currency
            for fact in facts.get(tag, {}).get("units", {}).get(unit, []):
                value = number(fact.get("val"))
                end, start = fact.get("end"), fact.get("start")
                if value is None or fact.get("form") not in {"10-K", "10-Q", "10-K/A", "10-Q/A"}:
                    continue
                if days(end, end) != 1 or (metric not in INSTANT and days(start, end) < 1):
                    continue
                source = filing_url(cik, fact.get("accn"))
                if not source:
                    continue
                key = (None if metric in INSTANT else start, end)
                # 10-Qs can report rolling twelve months (Amazon); only a 10-K establishes a fiscal year.
                if fact["form"].startswith("10-K"):
                    fiscal_years[metric].add(key)
                if metric == "revenue" and fact.get("fy") and fact.get("fp") in ("Q1", "Q2", "Q3", "Q4", "FY"):
                    seen = first_report.get(key)
                    if seen is None or fact.get("filed", "") < seen[0]:
                        first_report[key] = (fact.get("filed", ""), fact["fy"], fact["fp"])
                rank = (fact.get("filed", ""), -priority)
                if key not in candidates or rank > candidates[key][0]:
                    candidates[key] = (rank, {"start": key[0], "period": end, "value": value,
                        "filed": fact.get("filed"), "source_url": source, "tag": tag})
        series[metric] = {key: value[1] for key, value in candidates.items()}

    annual, quarter = {}, {}
    for metric, entries in series.items():
        if metric in INSTANT:
            continue
        for (start, end), fact in entries.items():
            duration = days(start, end)
            destination = annual if 330 <= duration <= 385 and (start, end) in fiscal_years[metric] else quarter if QUARTER_DAYS[0] <= duration <= QUARTER_DAYS[1] else None
            if destination is not None:
                row = destination.setdefault((start, end), {"start": start, "period": end, "sources": {}})
                row[metric] = fact["value"]
                row["sources"][metric] = {**fact, "derived": False}
        # Cash flows are commonly cumulative YTD. Only subtract additive facts with the same fiscal start.
        if metric in ADDITIVE:
            for (start, end), fact in entries.items():
                duration = days(start, end)
                if not 150 <= duration <= 385:
                    continue
                previous = [f for (s, e), f in entries.items() if s == start and QUARTER_DAYS[0] <= days(e, end) <= QUARTER_DAYS[1]]
                if not previous:
                    continue
                previous = max(previous, key=lambda f: f["period"])
                derived_start = (date.fromisoformat(previous["period"]) + timedelta(days=1)).isoformat()
                row = quarter.setdefault((derived_start, end), {"start": derived_start, "period": end, "sources": {}})
                if metric not in row:
                    row[metric] = fact["value"] - previous["value"]
                    row["sources"][metric] = {**fact, "derived": True,
                        "inputs": [fact["source_url"], previous["source_url"]]}

    annual_label = {end: fy for (start, end), (_, fy, fp) in first_report.items() if fp == "FY"}

    def fiscal_label(row):
        """'FY2027 Q2' as the company names it; Q4 only exists derived, so it borrows the FY."""
        reported = first_report.get((row["start"], row["period"]))
        if reported and reported[2] == "FY":
            return f"FY{reported[1]}"
        if reported and days(row["start"], row["period"]) < 120:
            return f"FY{reported[1]} {reported[2]}"
        if row["period"] in annual_label and days(row["start"], row["period"]) < 120:
            return f"FY{annual_label[row['period']]} Q4"
        return None

    def enrich(row):
        for metric in INSTANT:
            fact = series[metric].get((None, row["period"]))
            if fact:
                row[metric] = fact["value"]
                row["sources"][metric] = {**fact, "derived": False}
        if row.get("operating_cash_flow") is not None and row.get("capex") is not None:
            row["free_cash_flow"] = row["operating_cash_flow"] - row["capex"]
        row["fiscal_label"] = fiscal_label(row)
        for metric, numerator in [("gross_margin", "gross_profit"), ("operating_margin", "operating_income"), ("net_margin", "net_income")]:
            row[metric] = row.get(numerator) / row["revenue"] if row.get(numerator) is not None and (row.get("revenue") or 0) > 0 else None
        return row

    # Keep a single fiscal duration per end date, favor the longest valid period.
    def rows(values):
        by_end = {}
        for row in sorted(values.values(), key=lambda r: days(r["start"], r["period"])):
            by_end[row["period"]] = row
        return [enrich(r) for r in sorted(by_end.values(), key=lambda r: r["period"], reverse=True)]
    annual_rows, quarter_rows = rows(annual), rows(quarter)
    ttm = None
    latest = quarter_rows[:4]
    if len(latest) == 4 and all(days(latest[i+1]["period"], latest[i]["start"]) == 2 for i in range(3)) and 330 <= days(latest[-1]["start"], latest[0]["period"]) <= 385:
        ttm = {"start": latest[-1]["start"], "period": latest[0]["period"], "sources": {}}
        for metric in ADDITIVE:
            if all(row.get(metric) is not None for row in latest):
                ttm[metric] = sum(row[metric] for row in latest)
                ttm["sources"][metric] = {"derived": True, "inputs": [row["sources"][metric]["source_url"] for row in latest]}
        ttm = enrich(ttm)
    return {"currency": currency, "annual": annual_rows, "quarterly": quarter_rows, "ttm": ttm}


def xml_root(raw):
    # Public filings are untrusted. No DTD/entities or external resource resolution.
    if re.search(br"<!\s*(DOCTYPE|ENTITY)", raw, re.I):
        raise ValueError("Unsupported XML declaration")
    root = ET.fromstring(raw)
    for element in root.iter():
        element.tag = element.tag.split("}")[-1]
    return root


def parse_insider(raw, filing, expected_cik):
    root = xml_root(raw)
    issuer_cik = root.findtext("issuer/issuerCik", "")
    if not issuer_cik.isdigit() or int(issuer_cik) != int(expected_cik):
        raise ValueError("Issuer does not match")
    owners = root.findall("reportingOwner")
    names = [r.findtext("reportingOwnerId/rptOwnerName", "") for r in owners]
    titles = [r.findtext("reportingOwnerRelationship/officerTitle", "") or ("Director" if r.findtext("reportingOwnerRelationship/isDirector") in {"1", "true"} else "Reporting owner") for r in owners]
    result = []
    for transaction in root.findall("nonDerivativeTable/nonDerivativeTransaction"):
        shares = number(transaction.findtext("transactionAmounts/transactionShares/value"))
        price = number(transaction.findtext("transactionAmounts/transactionPricePerShare/value"))
        result.append({"owner": " / ".join(names), "position": " / ".join(titles),
            "security": transaction.findtext("securityTitle/value"),
            "date": transaction.findtext("transactionDate/value"), "filed": filing["filed"],
            "code": transaction.findtext("transactionCoding/transactionCode"),
            "direction": transaction.findtext("transactionAmounts/transactionAcquiredDisposedCode/value"),
            "shares": shares, "price": price, "value": shares * price if shares is not None and price is not None else None,
            "shares_after": number(transaction.findtext("postTransactionAmounts/sharesOwnedFollowingTransaction/value")),
            "ownership": transaction.findtext("ownershipNature/directOrIndirectOwnership/value"),
            "amended": filing["form"].endswith("/A"), "source_url": filing["source_url"]})
    return result


def parse_holdings(raw):
    root = xml_root(raw)
    if root.tag != "informationTable":
        return None
    result = []
    for row in root.findall("infoTable"):
        result.append({"issuer": row.findtext("nameOfIssuer"), "class": row.findtext("titleOfClass"),
            "cusip": row.findtext("cusip"), "value": number(row.findtext("value")),
            "shares": number(row.findtext("shrsOrPrnAmt/sshPrnamt")),
            "share_type": row.findtext("shrsOrPrnAmt/sshPrnamtType"),
            "put_call": row.findtext("putCall")})
    return result


def value_multiplier(rows, period):
    """13F values are in thousands before 2023-01-03 and in dollars after, but some filers kept reporting
    thousands. A median implied price under $1 per share across plain share rows marks a thousands table."""
    if period < "2023-01-03":
        return 1000
    prices = sorted(r["value"] / r["shares"] for r in rows
                    if r.get("share_type") == "SH" and not r.get("put_call") and r.get("value") and r.get("shares"))
    return 1000 if prices and prices[len(prices) // 2] < 1 else 1


def compare_holdings(current, previous):
    def grouped(rows):
        result = {}
        for r in rows:
            key = (r["cusip"], r["class"], r["share_type"], r["put_call"])
            if key not in result:
                result[key] = {**r}
            else:
                for field in ("shares", "value"):
                    a, b = result[key][field], r[field]
                    result[key][field] = a + b if a is not None and b is not None else None
        return result
    now, before = grouped(current), grouped(previous or [])
    total = sum(r["value"] or 0 for r in now.values())
    result = []
    for key, row in now.items():
        old = before.get(key)
        shares, prior = row["shares"], old["shares"] if old else None
        delta = shares - prior if shares is not None and prior is not None else None
        result.append({**row, "weight": row["value"] / total if total > 0 and row["value"] is not None else None,
            "previous_shares": prior, "change": delta,
            "change_percent": delta / prior if delta is not None and prior > 0 else None,
            "activity": "unknown" if previous is None else "new" if old is None else "increased" if delta is not None and delta > 0 else "reduced" if delta is not None and delta < 0 else "unchanged" if delta == 0 else "unknown"})
    if previous is not None:
        result.extend({**r, "previous_shares": r["shares"], "shares": 0, "value": 0, "weight": 0,
            "activity": "exited", "change": -r["shares"] if r["shares"] is not None else None,
            "change_percent": -1 if (r["shares"] or 0) > 0 else None} for k, r in before.items() if k not in now)
    return sorted(result, key=lambda r: r["value"] or 0, reverse=True)


def summarize_institution(data, top=5):
    """A compact card view of one manager's latest 13F: totals, change counts and largest positions."""
    holdings = data.get("holdings") or []
    held = [r for r in holdings if r.get("activity") != "exited"]
    counts = {kind: sum(1 for r in holdings if r.get("activity") == kind) for kind in ("new", "increased", "reduced", "exited")}
    compared = any(r.get("activity") != "unknown" for r in holdings)
    return {key: data.get(key) for key in ("id", "name", "cik", "filing", "previous_filing", "partial", "fetched_at", "source")} | {
        "positions": len(held),
        "value": sum(r.get("value") or 0 for r in held),
        "changes": counts if compared else None,
        "top": [{field: r.get(field) for field in ("issuer", "ticker", "class", "cusip", "put_call", "value", "weight", "activity")} for r in held[:top]],
    }
