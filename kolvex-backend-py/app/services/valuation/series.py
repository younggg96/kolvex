"""Rebuild daily PE references without using later filings or today's multiples."""
from hashlib import sha256
import json

from .basis import normalize_pilot_facts
from .eps import finite, ttm_candidate
from .pe import comparison, historical_pe_reference, pe_reference


def build_series(symbol, facts, market, *, as_of):
    normalized, basis = normalize_pilot_facts(symbol, facts, market, as_of=as_of)
    points, observations, events = [], [], {}
    previous_identity, multiples = None, None
    frozen_observations, calibration_date = [], None
    rows = sorted([r for r in market["rows"] if r["date"] < as_of
                   and finite(r.get("close")) and r["close"] > 0], key=lambda r: r["date"])
    if len({r["date"] for r in rows}) != len(rows):
        raise ValueError("Duplicate price sessions")
    for row in rows:
        candidate = ttm_candidate(normalized, row["date"])
        identity = sha256(json.dumps({"status": candidate["status"], "end": candidate["period_end"],
                                     "inputs": [r["id"] for r in candidate["inputs"]]}, sort_keys=True).encode()).hexdigest()[:24]
        valid = candidate["status"] == "complete" and candidate["share_basis_status"] == "verified"
        if identity != previous_identity:
            events[identity] = {**candidate, "effective_session": row["date"]}
            calibration = historical_pe_reference(observations, as_of=row["date"]) if valid else None
            multiples = calibration["multiples"] if calibration else None
            frozen_observations, calibration_date = list(observations), row["date"]
            previous_identity = identity
        pe = row["close"] / candidate["eps"] if valid else None
        reference = pe_reference(eps=candidate["eps"], multiples=multiples, price=row["close"]) if valid and multiples else None
        point = {"date": row["date"], "price": row["close"], "eps": candidate["eps"] if valid else None,
                 "pe": pe, "event_id": identity, "status": candidate["status"] if valid else
                 ("share_basis_unverified" if candidate["status"] == "complete" else candidate["status"]),
                 "conservative": None, "base": None, "optimistic": None, "premium_discount": None}
        if reference:
            point.update({key: value["reference_value"] for key, value in reference["scenarios"].items()})
            point["premium_discount"] = comparison(price=row["close"], reference=point["base"])["premium_discount"]
        points.append(point)
        if pe is not None:
            observations.append({"date": row["date"], "pe": pe, "financial_input_id": identity})
    current = ttm_candidate(normalized, as_of)
    latest = rows[-1] if rows else None
    valid = latest is not None and current["status"] == "complete" and current["share_basis_status"] == "verified"
    current_identity = sha256(json.dumps({"status": current["status"], "end": current["period_end"],
                                         "inputs": [r["id"] for r in current["inputs"]]}, sort_keys=True).encode()).hexdigest()[:24]
    # Keep the current reference consistent with the latest event's frozen PE
    # assumptions; quote movement alone must not recalibrate the model.
    if current_identity != previous_identity:
        frozen_observations, calibration_date = observations, as_of
    calibration = historical_pe_reference(frozen_observations, as_of=calibration_date or as_of,
                                          current_pe=latest["close"] / current["eps"] if valid else None)
    result = pe_reference(eps=current["eps"], multiples=calibration["multiples"], price=latest["close"]) if valid and calibration["multiples"] else None
    current.update({"price": latest["close"] if latest else None, "price_date": latest["date"] if latest else None,
                    "pe": latest["close"] / current["eps"] if valid else None,
                    "calibration": calibration, "reference": result})
    snapshot = sha256(json.dumps({"symbol": symbol, "as_of": as_of, "current": current,
                                 "basis": basis}, sort_keys=True).encode()).hexdigest()
    return {"symbol": symbol, "as_of": as_of, "currency": "USD", "snapshot_id": snapshot,
            "result_kind": "sec_filing_history_reconstruction", "price_kind": "regular_session_close",
            "basis": basis, "current": current, "points": points, "events": events,
            "coverage": {"price_sessions": len(points), "eps_sessions": sum(p["pe"] is not None for p in points),
                         "reference_sessions": sum(p["base"] is not None for p in points)}}
