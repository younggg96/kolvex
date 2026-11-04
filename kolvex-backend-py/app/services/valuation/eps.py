"""Preserve SEC EPS versions and identify complete, point-in-time TTM inputs.

This module deliberately does not infer the share basis of an EPS from its period
or filing date. Issuers can retrospectively recast comparative EPS for splits.
An input-complete candidate is not an approved, price-aligned valuation input.
"""
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from hashlib import sha256
import math
import re


MODEL_VERSION = "sec-eps-inputs-v1"
TAG = "EarningsPerShareDiluted"
FORMS = {"10-K", "10-K/A", "10-Q", "10-Q/A"}


def iso_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Expected an ISO calendar date")
    return date.fromisoformat(value)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


@dataclass(frozen=True)
class EpsFact:
    start: str
    end: str
    value: float
    filed: str
    accession: str
    form: str
    unit: str
    cik: int
    source_url_override: str | None = None
    source_sha256: str | None = None
    raw_value: float | None = None
    share_basis_date: str | None = None
    share_basis_status: str = "unverified"
    basis_evidence: tuple[str, ...] = ()

    @property
    def duration(self):
        return (iso_date(self.end) - iso_date(self.start)).days + 1

    def public(self):
        row = asdict(self)
        identity = f"{self.cik}|{self.accession}|{self.start}|{self.end}|{self.unit}|{self.value}"
        return {**row, "id": sha256(identity.encode()).hexdigest(), "tag": TAG,
                "source_url": self.source_url_override or f"https://www.sec.gov/Archives/edgar/data/{self.cik}/"
                              f"{self.accession.replace('-', '')}/{self.accession}-index.html"}


def parse_eps_facts(payload, currency="USD"):
    """Keep every filing version; reject invalid observations with reason counts."""
    cik = payload.get("cik")
    if isinstance(cik, bool) or not isinstance(cik, int) or not 0 < cik < 10**10:
        raise ValueError("Invalid SEC company identifier")
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise ValueError("Invalid financial currency")
    units = payload.get("facts", {}).get("us-gaap", {}).get(TAG, {}).get("units", {})
    expected_unit = f"{currency}/shares"
    rejected = Counter()
    seen, facts = set(), []
    for row in units.get(expected_unit, []):
        if row.get("form") not in FORMS:
            rejected["unsupported_form"] += 1
            continue
        if not finite(row.get("val")):
            rejected["invalid_value"] += 1
            continue
        try:
            start, end, filed = [iso_date(row.get(key)) for key in ("start", "end", "filed")]
        except ValueError:
            rejected["invalid_date"] += 1
            continue
        if end < start or filed < end:
            rejected["invalid_chronology"] += 1
            continue
        accession = row.get("accn", "")
        if not isinstance(accession, str) or not re.fullmatch(r"\d{10}-\d{2}-\d{6}", accession):
            rejected["invalid_accession"] += 1
            continue
        fact = EpsFact(str(start), str(end), float(row["val"]), str(filed), accession,
                       row["form"], expected_unit, cik)
        # Identical duplicate rows can occur; conflicting values remain in the ledger.
        if fact not in seen:
            facts.append(fact)
            seen.add(fact)
    return {
        "facts": sorted(facts, key=lambda f: (f.filed, f.end, f.start, f.accession, f.value)),
        "rejected": dict(rejected),
        "other_units": sorted(unit for unit in units if unit != expected_unit),
        "currency": currency,
    }


def ttm_candidate(facts, as_of):
    """Use only facts filed *before* this trading session (date-level precision).

    Consumers evaluate this on observed exchange sessions, never on an invented
    weekday calendar. A new incomplete quarter invalidates a carried old annual
    EPS rather than pretending that the old figure is an updated TTM.
    """
    cutoff = iso_date(as_of) if isinstance(as_of, str) else as_of
    known = [fact for fact in facts if iso_date(fact.filed) < cutoff]
    result = {"as_of": str(cutoff), "status": "not_yet_reported", "eps": None,
              "period_start": None, "period_end": None, "method": None, "inputs": [],
              "model_version": MODEL_VERSION, "share_basis_status": "unverified",
              "available_after": None, "missing_quarter_ends": []}
    if not known:
        return result
    by_period = defaultdict(list)
    for fact in known:
        by_period[(fact.start, fact.end)].append(fact)
    selected, conflicts = {}, set()
    for key, versions in by_period.items():
        latest_filed = max(f.filed for f in versions)
        latest = [f for f in versions if f.filed == latest_filed]
        if len({f.value for f in latest}) != 1:
            conflicts.add(key)
        selected[key] = max(latest, key=lambda f: (f.accession, f.form, f.value))
    latest_end = max(f.end for f in selected.values())
    result["period_end"] = latest_end
    annual = [f for f in selected.values() if f.end == latest_end and 330 <= f.duration <= 385]
    used = []
    if annual:
        # Multiple distinct twelve-month periods ending together are ambiguous.
        if len(annual) != 1:
            return {**result, "status": "ambiguous_periods"}
        used = annual
        result["method"] = "reported_full_year" if annual[0].form.startswith("10-K") else "reported_twelve_months"
    else:
        quarters = defaultdict(list)
        for fact in selected.values():
            if 70 <= fact.duration <= 120:
                quarters[fact.end].append(fact)
        end = latest_end
        for _ in range(4):
            choices = quarters.get(end, [])
            if not choices:
                return {**result, "status": "missing_quarter_eps", "missing_quarter_ends": [end]}
            if len(choices) != 1:
                return {**result, "status": "ambiguous_periods"}
            used.append(choices[0])
            end = str(iso_date(choices[0].start) - timedelta(days=1))
        total_days = (iso_date(used[0].end) - iso_date(used[-1].start)).days + 1
        if not 330 <= total_days <= 385:
            return {**result, "status": "invalid_twelve_month_span"}
        result["method"] = "sum_reported_quarters"
    if any((fact.start, fact.end) in conflicts for fact in used):
        return {**result, "status": "conflicting_facts"}
    value = math.fsum(f.value for f in used)
    last_filed = max(f.filed for f in used)
    age = (cutoff - iso_date(last_filed)).days
    period_age = (cutoff - iso_date(latest_end)).days
    status = "complete" if value > 0 else "nonpositive_eps"
    if age > 150 or period_age > 200:
        status = "stale_financials"
    return {**result, "status": status, "eps": value,
            "period_start": min(f.start for f in used), "available_after": last_filed,
            "inputs": [f.public() for f in sorted(used, key=lambda f: f.start)],
            "input_filing_count": len({f.accession for f in used}),
            "input_age_days": age, "period_age_days": period_age,
            "share_basis_status": "verified" if all(f.share_basis_status == "verified" for f in used)
            and len({f.share_basis_date for f in used}) == 1 else "unverified"}


def split_factor(events, basis_date, target_date):
    """Ratio from an explicitly verified share basis to a later share basis."""
    start, end = iso_date(basis_date), iso_date(target_date)
    if end < start:
        raise ValueError("Target share basis precedes input share basis")
    result, seen = 1.0, set()
    for event in events:
        event_date = iso_date(event["date"])
        ratio = event["ratio"]
        if event_date in seen:
            raise ValueError("Duplicate split date; resolve source conflicts first")
        seen.add(event_date)
        if not finite(ratio) or ratio <= 0:
            raise ValueError("Invalid split ratio")
        if start < event_date <= end:
            result *= ratio
    if not math.isfinite(result) or result <= 0:
        raise ValueError("Invalid cumulative split ratio")
    return result


def align_eps_to_share_basis(eps, *, verified_basis_date, target_date, splits):
    """Never infer EPS basis from filing date, period end or split proximity."""
    if not finite(eps):
        raise ValueError("EPS must be finite")
    if verified_basis_date is None:
        return {"status": "share_basis_unverified", "eps": None}
    factor = split_factor(splits, verified_basis_date, target_date)
    value = eps / factor
    if not math.isfinite(value):
        raise ValueError("Adjusted EPS is not finite")
    return {"status": "aligned", "eps": value, "split_factor": factor,
            "basis_date": verified_basis_date, "target_basis_date": target_date}
