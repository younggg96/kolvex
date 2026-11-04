"""Direct GAAP Q4 EPS from SEC-filed earnings releases for the pilot companies.

Only explicitly identified quarterly table rows are accepted. No annual/YTD
subtraction and no generic search-engine or AI extraction is used.
"""
from datetime import timedelta
from hashlib import sha256
import re

from bs4 import BeautifulSoup
from app.services.sec.client import SecUnavailable

from .eps import EpsFact, finite, iso_date

PILOTS = {"NVDA": 1045810, "AAPL": 320193, "MSFT": 789019}
PARSER_VERSION = "sec-gaap-release-v1"


def parse_quarter_eps(raw, *, symbol, period_end):
    if symbol not in PILOTS:
        raise ValueError("Company is outside reviewed release-parser coverage")
    soup = BeautifulSoup(raw, "html.parser")
    for node in soup(["script", "style"]):
        node.decompose()
    text = re.sub(r"\s+", " ", " ".join(soup.stripped_strings))
    end = iso_date(period_end)
    date_pattern = rf"{end.strftime('%B')}\s+0?{end.day},?\s+{end.year}"
    if not re.search(date_pattern, text, re.I):
        raise ValueError("Expected financial period is absent from release")
    candidates = []
    for table in soup.find_all("table"):
        flat = re.sub(r"\s+", " ", " ".join(table.stripped_strings))
        # SEC releases use either the GAAP quarterly summary or the full income
        # statement. Explicitly skip annual-only and non-GAAP-only tables.
        quarterly = re.search(r"three months ended|q4\s*(?:fy\s*)?\d{2}|quarter ended", flat, re.I)
        if not quarterly:
            continue
        expected_table = (str(end.year) in flat and re.search(rf"{end.strftime('%B')}\s+0?{end.day}\b", flat, re.I))
        if not expected_table and not re.search(rf"Q4\s*FY\s*{end.year % 100}\b", flat, re.I):
            continue
        first_gaap = re.search(r"\bGAAP\b", flat, re.I)
        if first_gaap and flat[max(0, first_gaap.start()-5):first_gaap.start()].lower().endswith("non-"):
            continue
        if not re.search(r"net income|net loss", flat, re.I):
            continue
        for row in table.find_all("tr"):
            line = re.sub(r"\s+", " ", " ".join(row.stripped_strings))
            if not re.match(r"^(?:Diluted earnings per share|Diluted earnings per common share|Diluted)\s", line, re.I):
                continue
            # Integer share-count rows cannot be mistaken for EPS.
            numbers = re.findall(r"(?<![\d,])\(?-?\d+\.\d{1,4}\)?", line)
            if not numbers:
                continue
            value = float(numbers[0].strip("()")) * (-1 if numbers[0].startswith("(") else 1)
            if not finite(value):
                continue
            candidates.append((value, line))
            break
    if not candidates or len({value for value, _ in candidates}) != 1:
        raise ValueError("Quarterly GAAP EPS is absent or table candidates disagree")
    value, evidence = candidates[0]
    return {"value": value, "evidence": evidence, "parser_version": PARSER_VERSION,
            "sha256": sha256(raw).hexdigest()}


def filing_rows(payload):
    data = payload.get("filings", {}).get("recent", payload)
    return [{key: data.get(key, [""] * len(data["form"]))[i]
             for key in ("form", "accessionNumber", "filingDate", "primaryDocument", "items")}
            for i in range(len(data.get("form", [])))]


async def supplement_q4(client, symbol, facts, *, after, as_of):
    """Find each missing Q4 through its original annual earnings 8-K exhibit."""
    cik = PILOTS[symbol]
    facts = [fact for fact in facts if fact.filed < as_of]
    submissions = await client.submissions(cik)
    filings = filing_rows(submissions)
    for previous in submissions.get("filings", {}).get("files", []):
        if previous["filingTo"] < after or previous["filingFrom"] >= as_of:
            continue
        name = previous["name"]
        if not re.fullmatch(r"CIK\d{10}-submissions-\d{3}\.json", name):
            continue
        filings.extend(filing_rows(await client.json(f"https://data.sec.gov/submissions/{name}")))
    earnings = sorted([r for r in filings if r["form"] == "8-K" and "2.02" in r["items"]
                       and after <= r["filingDate"] < as_of], key=lambda r: r["filingDate"])
    annual = sorted({(f.start, f.end) for f in facts if f.form.startswith("10-K")
                     and 330 <= f.duration <= 385 and after <= f.end < as_of})
    records, failures = [], []
    for start, end in annual:
        if any(f.end == end and 70 <= f.duration <= 120 for f in facts):
            continue
        # The nine-month period establishes the actual fiscal Q4 start, including
        # 52/53-week calendars. It supplies dates only, never an EPS subtraction.
        nine_months = [f for f in facts if f.start == start and 240 <= f.duration <= 300
                       and 70 <= (iso_date(end)-iso_date(f.end)).days <= 120]
        if not nine_months:
            failures.append({"period_end": end, "reason": "missing_fiscal_q4_start"})
            continue
        q4_start = str(iso_date(max(f.end for f in nine_months)) + timedelta(days=1))
        releases = [r for r in earnings if 0 < (iso_date(r["filingDate"])-iso_date(end)).days <= 100]
        accepted = False
        for filing in releases[:2]:
            accession = filing["accessionNumber"]
            base = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession.replace('-', '')}/"
            try:
                index = await client.json(base + "index.json")
                names = [r["name"] for r in index["directory"]["item"]
                         if re.search(r"(?:ex[-_]?99|ex991|exhibit99|dex991|q4.*pr\.htm)", r["name"], re.I)
                         and re.search(r"\.html?$", r["name"], re.I)]
                parsed = []
                for name in names[:3]:
                    if not re.fullmatch(r"[A-Za-z0-9_.-]+", name):
                        continue
                    raw = await client.read(base + name)
                    try:
                        parsed.append({**parse_quarter_eps(raw, symbol=symbol, period_end=end), "source_url": base + name})
                    except ValueError:
                        continue
                if not parsed or len({r["value"] for r in parsed}) != 1:
                    continue
                source = parsed[0]
                fact = EpsFact(q4_start, end, source["value"], filing["filingDate"], accession,
                               "8-K/earnings-release", "USD/shares", cik,
                               source_url_override=source["source_url"], source_sha256=source["sha256"])
                records.append({"fact": fact, "evidence": source["evidence"], "parser_version": PARSER_VERSION})
                accepted = True
                break
            except (ValueError, KeyError, RuntimeError, SecUnavailable):
                continue
        if not accepted:
            failures.append({"period_end": end, "reason": "no_verified_gaap_quarterly_release"})
    return {"records": records, "failures": failures}
