"""Pure options-chain metrics: put/call ratios, max pain, expected move, ATM IV.

Every function takes normalized contract dicts (see `normalize_contract`) so it
is data-source agnostic and unit-testable without network access.
"""

import math
import re
from datetime import date
from typing import Iterable, Optional

CONTRACT_MULTIPLIER = 100
OCC_RE = re.compile(r"^(?P<root>[A-Z.]{1,6}\d?)(?P<yymmdd>\d{6})(?P<cp>[CP])(?P<strike>\d{8})$")


def _num(value) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def parse_occ_symbol(symbol: str) -> Optional[dict]:
    match = OCC_RE.match(symbol or "")
    if not match:
        return None
    yymmdd = match["yymmdd"]
    return {
        "root": match["root"],
        "expiration": f"20{yymmdd[:2]}-{yymmdd[2:4]}-{yymmdd[4:]}",
        "type": "call" if match["cp"] == "C" else "put",
        "strike": int(match["strike"]) / 1000,
    }


def normalize_contract(symbol: str, snapshot: Optional[dict], contract: Optional[dict]) -> Optional[dict]:
    """Merge an Alpaca snapshot and contract record into one flat row."""
    parsed = parse_occ_symbol(symbol)
    if parsed is None and not contract:
        return None
    snapshot = snapshot or {}
    contract = contract or {}
    quote = snapshot.get("latestQuote") or {}
    trade = snapshot.get("latestTrade") or {}
    bar = snapshot.get("dailyBar") or {}
    greeks = snapshot.get("greeks") or {}
    oi = _num(contract.get("open_interest"))
    volume = _num(bar.get("v"))
    return {
        "symbol": symbol,
        "type": contract.get("type") or parsed["type"],
        "strike": _num(contract.get("strike_price")) or parsed["strike"],
        "expiration": contract.get("expiration_date") or parsed["expiration"],
        "bid": _num(quote.get("bp")),
        "ask": _num(quote.get("ap")),
        "last": _num(trade.get("p")),
        "volume": int(volume) if volume is not None else 0,
        "open_interest": int(oi) if oi is not None else 0,
        "open_interest_date": contract.get("open_interest_date"),
        "iv": _num(snapshot.get("impliedVolatility")),
        "delta": _num(greeks.get("delta")),
        "gamma": _num(greeks.get("gamma")),
        "theta": _num(greeks.get("theta")),
        "vega": _num(greeks.get("vega")),
    }


def mid_price(row: dict) -> Optional[float]:
    bid, ask = row.get("bid"), row.get("ask")
    if bid is not None and ask is not None and ask > 0 and ask >= bid:
        return round((bid + ask) / 2, 4)
    return row.get("last")


def _ratio(puts: float, calls: float) -> Optional[float]:
    return round(puts / calls, 4) if calls > 0 else None


def put_call_ratios(rows: Iterable[dict]) -> dict:
    totals = {"call_volume": 0, "put_volume": 0, "call_oi": 0, "put_oi": 0}
    for row in rows:
        side = row["type"]
        totals[f"{side}_volume"] += row.get("volume") or 0
        totals[f"{side}_oi"] += row.get("open_interest") or 0
    return {
        **totals,
        "total_volume": totals["call_volume"] + totals["put_volume"],
        "total_oi": totals["call_oi"] + totals["put_oi"],
        "volume_put_call_ratio": _ratio(totals["put_volume"], totals["call_volume"]),
        "oi_put_call_ratio": _ratio(totals["put_oi"], totals["call_oi"]),
    }


def max_pain(rows: Iterable[dict]) -> Optional[dict]:
    """Strike at which option holders' total intrinsic value at expiry is lowest."""
    calls, puts, strikes = [], [], set()
    for row in rows:
        oi = row.get("open_interest") or 0
        strike = row.get("strike")
        if strike is None:
            continue
        strikes.add(strike)
        if oi > 0:
            (calls if row["type"] == "call" else puts).append((strike, oi))
    if not strikes or not (calls or puts):
        return None
    best_strike, best_value = None, None
    for settle in sorted(strikes):
        value = sum(oi * max(0.0, settle - k) for k, oi in calls) + sum(oi * max(0.0, k - settle) for k, oi in puts)
        if best_value is None or value < best_value:
            best_strike, best_value = settle, value
    return {"strike": best_strike, "holder_value": round(best_value * CONTRACT_MULTIPLIER, 2)}


def _atm_pair(rows: list[dict], spot: float) -> tuple[Optional[dict], Optional[dict]]:
    by_strike: dict[float, dict] = {}
    for row in rows:
        by_strike.setdefault(row["strike"], {})[row["type"]] = row
    paired = [k for k, sides in by_strike.items() if "call" in sides and "put" in sides]
    if not paired:
        return None, None
    strike = min(paired, key=lambda k: (abs(k - spot), k))
    return by_strike[strike]["call"], by_strike[strike]["put"]


def atm_iv(rows: list[dict], spot: Optional[float]) -> Optional[float]:
    if not spot:
        return None
    call, put = _atm_pair(rows, spot)
    ivs = [r["iv"] for r in (call, put) if r and r.get("iv")]
    return round(sum(ivs) / len(ivs), 4) if ivs else None


def expected_move(rows: list[dict], spot: Optional[float], expiration: str, today: date) -> Optional[dict]:
    """ATM straddle mid price; falls back to spot * IV * sqrt(T) when quotes are missing."""
    if not spot:
        return None
    call, put = _atm_pair(rows, spot)
    if call and put:
        call_mid, put_mid = mid_price(call), mid_price(put)
        if call_mid is not None and put_mid is not None:
            move = call_mid + put_mid
            return {"value": round(move, 2), "pct": round(move / spot * 100, 2), "method": "atm_straddle", "strike": call["strike"]}
    iv = atm_iv(rows, spot)
    days = max((date.fromisoformat(expiration) - today).days, 1)
    if iv:
        move = spot * iv * math.sqrt(days / 365)
        return {"value": round(move, 2), "pct": round(move / spot * 100, 2), "method": "iv", "strike": None}
    return None


def chain_metrics(rows: list[dict], spot: Optional[float], expiration: str, today: date) -> dict:
    pain = max_pain(rows)
    return {
        **put_call_ratios(rows),
        "max_pain": pain,
        "max_pain_vs_spot_pct": round((pain["strike"] / spot - 1) * 100, 2) if pain and spot else None,
        "atm_iv": atm_iv(rows, spot),
        "expected_move": expected_move(rows, spot, expiration, today),
        "days_to_expiration": (date.fromisoformat(expiration) - today).days,
    }
