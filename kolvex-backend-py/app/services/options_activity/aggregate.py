"""Pure aggregation for the options-activity report.

"Net premium" here is call premium traded minus put premium traded. Snapshots
carry no trade-level aggressor side, so this measures where the money traded,
not whether it was bought or sold; the UI states this.
"""

from datetime import date
from statistics import median
from typing import Iterable, Optional

from app.services.options_chain import metrics

TOP_CONTRIBUTORS = 5
TOP_CONTRACTS = 20
MIN_RANGE_DAYS = 5


def contract_price(row: dict) -> Optional[float]:
    """Session VWAP best reflects what traded; fall back to mid, last, then close."""
    for value in (row.get("vwap"), metrics.mid_price(row), row.get("last"), row.get("close")):
        if value is not None and value > 0:
            return value
    return None


def premium(row: dict) -> float:
    price = contract_price(row)
    volume = row.get("volume") or 0
    if not price or volume <= 0:
        return 0.0
    return volume * price * (row.get("multiplier") or metrics.CONTRACT_MULTIPLIER)


def _days(expiration: str, today: date) -> int:
    return (date.fromisoformat(expiration) - today).days


def _ratio(puts: float, calls: float) -> Optional[float]:
    return round(puts / calls, 4) if calls > 0 else None


def gamma_exposure(rows: Iterable[dict], spot: Optional[float]) -> Optional[dict]:
    """Dealer-style GEX per strike: gamma * OI * 100 * S^2 * 1%, calls positive, puts negative."""
    if not spot:
        return None
    by_strike: dict[float, float] = {}
    for row in rows:
        gamma, oi = row.get("gamma"), row.get("open_interest") or 0
        if gamma is None or oi <= 0:
            continue
        value = gamma * oi * (row.get("multiplier") or metrics.CONTRACT_MULTIPLIER) * spot * spot * 0.01
        by_strike[row["strike"]] = by_strike.get(row["strike"], 0.0) + (value if row["type"] == "call" else -value)
    if not by_strike:
        return None
    key = max(by_strike, key=lambda k: (abs(by_strike[k]), -k))
    return {"strike": key, "gex": round(by_strike[key], 2), "total_gex": round(sum(by_strike.values()), 2)}


def implied_range(rows: list[dict], spot: Optional[float], today: date) -> Optional[dict]:
    """Expected move to the first expiration at least MIN_RANGE_DAYS out (else the nearest)."""
    if not spot:
        return None
    expirations = sorted({r["expiration"] for r in rows if _days(r["expiration"], today) >= 0})
    if not expirations:
        return None
    target = next((e for e in expirations if _days(e, today) >= MIN_RANGE_DAYS), expirations[-1])
    move = metrics.expected_move([r for r in rows if r["expiration"] == target], spot, target, today)
    if not move:
        return None
    return {
        "expiration": target,
        "low": round(spot - move["value"], 2),
        "high": round(spot + move["value"], 2),
        "pct": move["pct"],
        "method": move["method"],
    }


def main_expiration_max_pain(rows: list[dict]) -> Optional[dict]:
    """Max pain for the expiration holding the most open interest."""
    oi_by_exp: dict[str, int] = {}
    for row in rows:
        oi_by_exp[row["expiration"]] = oi_by_exp.get(row["expiration"], 0) + (row.get("open_interest") or 0)
    if not oi_by_exp or max(oi_by_exp.values()) <= 0:
        return None
    target = max(oi_by_exp, key=lambda e: (oi_by_exp[e], e))
    pain = metrics.max_pain([r for r in rows if r["expiration"] == target])
    return {"expiration": target, "strike": pain["strike"]} if pain else None


def contract_entry(row: dict, symbol: str, is_etf: bool, spot: Optional[float], today: date, earnings: Optional[str]) -> dict:
    oi = row.get("open_interest") or 0
    volume = row.get("volume") or 0
    vol_oi = round(volume / oi, 2) if oi > 0 else None
    otm = None
    if spot:
        otm = (row["strike"] / spot - 1) if row["type"] == "call" else (1 - row["strike"] / spot)
    return {
        "symbol": row["symbol"],
        "underlying": symbol,
        "is_etf": is_etf,
        "type": row["type"],
        "strike": row["strike"],
        "expiration": row["expiration"],
        "dte": _days(row["expiration"], today),
        "premium": round(premium(row), 2),
        "volume": volume,
        "open_interest": oi,
        "vol_oi": vol_oi,
        "price": contract_price(row),
        "last": row.get("last"),
        "iv": row.get("iv"),
        "delta": row.get("delta"),
        "otm_pct": round(otm * 100, 2) if otm is not None else None,
        "flags": {
            "new_positions": volume > 0 and (oi == 0 or volume > oi),
            "crosses_earnings": bool(earnings and today.isoformat() <= earnings <= row["expiration"]),
        },
    }


def ticker_summary(symbol: str, is_etf: bool, rows: list[dict], stock: dict, today: date, earnings: Optional[str] = None) -> dict:
    spot = stock.get("price")
    call_premium = sum(premium(r) for r in rows if r["type"] == "call")
    put_premium = sum(premium(r) for r in rows if r["type"] == "put")
    return {
        "symbol": symbol,
        "is_etf": is_etf,
        "spot": spot,
        "change_pct": stock.get("change_pct"),
        "call_premium": round(call_premium, 2),
        "put_premium": round(put_premium, 2),
        "net_premium": round(call_premium - put_premium, 2),
        "pc_premium_ratio": _ratio(put_premium, call_premium),
        "call_volume": sum(r.get("volume") or 0 for r in rows if r["type"] == "call"),
        "put_volume": sum(r.get("volume") or 0 for r in rows if r["type"] == "put"),
        "contracts_scanned": len(rows),
        "implied_range": implied_range(rows, spot, today),
        "max_pain": main_expiration_max_pain(rows),
        "gamma_level": gamma_exposure(rows, spot),
        "earnings_date": earnings,
    }


def _median(values: Iterable[Optional[float]]) -> Optional[float]:
    clean = [v for v in values if v is not None]
    return round(median(clean), 4) if clean else None


def build_report(scans: list[dict], history: list[dict], today: date) -> dict:
    """
    scans: [{symbol, is_etf, rows, stock, earnings}] for this run.
    history: payloads of earlier runs in the same session (newest first), for 7-run baselines.
    """
    tickers, contracts = [], []
    for scan in scans:
        summary = ticker_summary(scan["symbol"], scan["is_etf"], scan["rows"], scan["stock"], today, scan.get("earnings"))
        past = [_ticker(h, scan["symbol"]) for h in history]
        summary["pc_baseline"] = _median(t.get("pc_premium_ratio") for t in past if t)
        tickers.append(summary)
        contracts.extend(
            contract_entry(r, scan["symbol"], scan["is_etf"], summary["spot"], today, scan.get("earnings"))
            for r in scan["rows"]
            if premium(r) > 0
        )

    call_total = sum(t["call_premium"] for t in tickers)
    put_total = sum(t["put_premium"] for t in tickers)
    market = {
        "call_premium": round(call_total, 2),
        "put_premium": round(put_total, 2),
        "net_premium": round(call_total - put_total, 2),
        "pc_premium_ratio": _ratio(put_total, call_total),
        "pc_baseline": _median((h.get("market") or {}).get("pc_premium_ratio") for h in history),
        "baseline_runs": len(history),
        "etf_net_premium": round(sum(t["net_premium"] for t in tickers if t["is_etf"]), 2),
        "stock_net_premium": round(sum(t["net_premium"] for t in tickers if not t["is_etf"]), 2),
        "tickers_scanned": len(tickers),
    }
    ranked = sorted((t for t in tickers if t["net_premium"]), key=lambda t: t["net_premium"], reverse=True)
    positive = [_contributor(t) for t in ranked if t["net_premium"] > 0][:TOP_CONTRIBUTORS]
    negative = [_contributor(t) for t in reversed(ranked) if t["net_premium"] < 0][:TOP_CONTRIBUTORS]
    contracts.sort(key=lambda c: (-c["premium"], c["symbol"]))
    return {
        "market": market,
        "contributors": {
            "positive": positive,
            "negative": negative,
            "positive_total": round(sum(t["net_premium"] for t in tickers if t["net_premium"] > 0), 2),
            "negative_total": round(sum(t["net_premium"] for t in tickers if t["net_premium"] < 0), 2),
        },
        "contracts": contracts[:TOP_CONTRACTS],
        "tickers": sorted(tickers, key=lambda t: -(t["call_premium"] + t["put_premium"])),
    }


def _contributor(ticker: dict) -> dict:
    return {"symbol": ticker["symbol"], "is_etf": ticker["is_etf"], "net_premium": ticker["net_premium"]}


def _ticker(payload: dict, symbol: str) -> Optional[dict]:
    return next((t for t in payload.get("tickers") or [] if t.get("symbol") == symbol), None)
