"""Reviewed issuer-specific share-basis rules, not a universal filing-date guess.

Coverage starts in 2015. A filing is assigned a basis only if it contains an
original current-period disclosure (not only old comparative facts). That basis
also applies to its comparative EPS under the issuer's retrospective split
accounting policy. Unknown corporate actions stop publication for the issuer.
"""
from collections import defaultdict
from dataclasses import replace

from .eps import iso_date, split_factor

POLICY_VERSION = "pilot-original-period-split-policy-v1"
POLICIES = {
    "NVDA": {"splits": [{"date": "2021-07-20", "ratio": 4}, {"date": "2024-06-10", "ratio": 10}],
             "evidence": (
                 "https://nvidianews.nvidia.com/news/nvidia-announces-four-for-one-stock-split-pending-stockholder-approval-at-annual-meeting-set-for-june-3",
                 "https://www.sec.gov/Archives/edgar/data/1045810/000104581024000144/nvda-20240607.htm",
                 "https://www.sec.gov/Archives/edgar/data/1045810/000104581024000264/nvda-20240728.htm")},
    "AAPL": {"splits": [{"date": "2020-08-31", "ratio": 4}],
             "evidence": ("https://investor.apple.com/dividend-history/default.aspx",)},
    "MSFT": {"splits": [],
             "evidence": ("https://www.microsoft.com/en-us/investor/dividends-and-stock-history",)},
}


def normalize_pilot_facts(symbol, facts, market, *, as_of):
    policy = POLICIES[symbol]
    rows = market.get("rows", [])
    if not rows or market.get("currency") != "USD":
        return facts, {"status": "unsupported_price_basis", "policy_version": POLICY_VERSION}
    first, last = min(r["date"] for r in rows), max(r["date"] for r in rows)
    observed = {(r["date"], r["ratio"]) for r in market.get("splits", []) if first <= r["date"] <= last}
    expected = {(r["date"], r["ratio"]) for r in policy["splits"] if first <= r["date"] <= last}
    if observed != expected:
        return facts, {"status": "corporate_action_review_required", "policy_version": POLICY_VERSION}
    known = [f for f in facts if "2015-01-01" <= f.filed < as_of]
    by_filing, by_period = defaultdict(list), defaultdict(list)
    for fact in known:
        by_filing[fact.accession].append(fact)
        by_period[(fact.start, fact.end)].append(fact)
    original_ids = {min(rows, key=lambda f: (f.filed, f.accession)).accession
                    for rows in by_period.values()}
    approved = {}
    for accession, entries in by_filing.items():
        latest_end = max(f.end for f in entries)
        current = [f for f in entries if f.end == latest_end
                   and min(v.filed for v in by_period[(f.start, f.end)]) == f.filed
                   and 0 <= (iso_date(f.filed) - iso_date(f.end)).days <= 100]
        if accession not in original_ids or not current:
            continue
        filed = current[0].filed
        # Near an effective split date the publication-time basis needs a
        # dedicated filing review; a date-only rule is insufficient.
        if any(abs((iso_date(filed)-iso_date(s["date"])).days) <= 3 for s in policy["splits"]):
            continue
        approved[accession] = max(["2015-01-01"] + [s["date"] for s in policy["splits"] if s["date"] <= filed])
    normalized = []
    for fact in known:
        basis = approved.get(fact.accession)
        if basis is None or basis > last:
            normalized.append(fact)
            continue
        factor = split_factor(policy["splits"], basis, last)
        normalized.append(replace(fact, raw_value=fact.value, value=fact.value / factor,
                                  share_basis_date=last, share_basis_status="verified",
                                  basis_evidence=policy["evidence"]))
    return normalized, {"status": "reviewed_pilot_policy", "policy_version": POLICY_VERSION,
                        "target_basis_date": last, "approved_filing_count": len(approved),
                        "evidence": policy["evidence"]}
