#!/usr/bin/env python3
"""Fetch pilot data or replay its exact cached responses; emit a PE readiness audit."""
import argparse
import asyncio
from datetime import datetime
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
from zoneinfo import ZoneInfo

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.services.sec.client import SecClient, SecUnavailable
from app.services.valuation.audit import audit_company, markdown_report
from app.services.valuation.eps import finite, iso_date

# Explicit pilot mapping; not a claim of full-market coverage.
PILOTS = {"NVDA": 1045810, "AAPL": 320193, "MSFT": 789019}
PARAMETERS = {"auto_adjust": False, "back_adjust": False, "actions": True,
              "repair": False, "interval": "1d", "prepost": False}


def years_before(value, count):
    try:
        return value.replace(year=value.year - count)
    except ValueError:
        return value.replace(year=value.year - count, day=28)


def download_market(symbol, start, end):
    import yfinance as yf
    ticker = yf.Ticker(symbol)
    frame = ticker.history(start=start, end=end, **PARAMETERS)
    if frame.empty:
        raise ValueError("Empty market history")
    metadata = ticker.get_history_metadata()
    rows, splits = [], []
    for timestamp, row in frame.iterrows():
        day = timestamp.date().isoformat()
        def optional(key):
            return float(row[key]) if finite(row.get(key)) else None
        rows.append({"date": day, "close": optional("Close"), "adj_close": optional("Adj Close"),
                     "dividend": optional("Dividends")})
        ratio = optional("Stock Splits")
        if ratio is not None and ratio != 0:
            splits.append({"date": day, "ratio": ratio})
    return {"symbol": symbol, "currency": metadata.get("currency"),
            "timezone": metadata.get("exchangeTimezoneName"), "parameters": PARAMETERS,
            "requested_start": start, "requested_end_exclusive": end,
            "rows": rows, "splits": splits, "yfinance_version": yf.__version__}


def canonical_bytes(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False).encode()


def save_sources(directory, symbol, cik, facts_raw, market, *, fetched_at, start, as_of):
    directory.mkdir(parents=True, exist_ok=True)
    files = {}
    for kind, body in (("sec", facts_raw), ("market", canonical_bytes(market))):
        digest = sha256(body).hexdigest()
        filename = f"{kind}-{digest}.json"
        (directory / filename).write_bytes(body)
        files[kind] = {"filename": filename, "sha256": digest, "bytes": len(body)}
    receipt = {"version": 1, "symbol": symbol, "cik": cik, "fetched_at": fetched_at,
               "start": start, "as_of": as_of, "files": files,
               "sec_url": f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json",
               "market_source": "Yahoo Finance through yfinance; internal verification only"}
    manifest = directory / "manifest.json"
    temporary = directory / "manifest.json.tmp"
    temporary.write_bytes(canonical_bytes(receipt))
    temporary.replace(manifest)
    return receipt


def load_sources(directory, symbol, cik, *, start, as_of):
    receipt = json.loads((directory / "manifest.json").read_bytes())
    if any(receipt.get(key) != value for key, value in
           (("version", 1), ("symbol", symbol), ("cik", cik), ("start", start), ("as_of", as_of))):
        raise ValueError("Cached source identity or requested range differs")
    payloads = {}
    for kind in ("sec", "market"):
        source = receipt["files"][kind]
        if not re.fullmatch(rf"{kind}-[0-9a-f]{{64}}\.json", source["filename"]):
            raise ValueError("Invalid cached filename")
        body = (directory / source["filename"]).read_bytes()
        if sha256(body).hexdigest() != source["sha256"] or len(body) != source["bytes"]:
            raise ValueError("Cached source checksum differs")
        payloads[kind] = json.loads(body)
    if payloads["sec"].get("cik") != cik or payloads["market"].get("symbol") != symbol:
        raise ValueError("Source payload belongs to another company")
    return payloads["sec"], payloads["market"], receipt


async def run(args):
    cutoff = iso_date(args.as_of)
    start = str(years_before(cutoff, args.years))
    generated = datetime.now(ZoneInfo("UTC")).isoformat()
    report = {"as_of": args.as_of, "start": start, "started_at": generated,
              "mode": "offline_replay" if args.offline else "live_fetch", "companies": {}}
    client = SecClient()
    for symbol in args.symbols:
        cik = PILOTS[symbol]
        cache = args.cache_dir / args.as_of / symbol
        try:
            if args.offline:
                facts, market, receipt = load_sources(cache, symbol, cik, start=start, as_of=args.as_of)
            else:
                raw = await client.read(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json")
                facts = json.loads(raw)
                if facts.get("cik") != cik:
                    raise ValueError("Unexpected company identifier")
                market = await asyncio.to_thread(download_market, symbol, start, args.as_of)
                receipt = save_sources(cache, symbol, cik, raw, market,
                                       fetched_at=datetime.now(ZoneInfo("UTC")).isoformat(),
                                       start=start, as_of=args.as_of)
            result = audit_company(facts, market, start=start, as_of=args.as_of)
            report["companies"][symbol] = {**result, "source_receipt": receipt}
            print(f"{symbol}: {result['eps']['current']['status']}; "
                  f"candidate coverage={result['history']['candidate_coverage']}; ready_for_pe={result['ready_for_pe']}")
        except (SecUnavailable, ValueError, OSError, KeyError, TypeError) as exc:
            # Record a failure, never publish example data as a substitute.
            report["companies"][symbol] = {"error": type(exc).__name__, "ready_for_pe": False,
                                             "message": str(exc)[:240]}
            print(f"{symbol}: source/audit failure ({type(exc).__name__})", file=sys.stderr)
    report["generated_at"] = datetime.now(ZoneInfo("UTC")).isoformat()
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2,
                                                      allow_nan=False) + "\n")
    (args.output / "REPORT.md").write_text(markdown_report(report))
    print(f"Report: {args.output / 'REPORT.md'}")
    if any("error" in row for row in report["companies"].values()):
        return 1
    return 2 if args.require_ready and not all(row["ready_for_pe"] for row in report["companies"].values()) else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--symbols", nargs="+", type=str.upper, choices=sorted(PILOTS), default=list(PILOTS))
    parser.add_argument("--as-of", default=str(datetime.now(ZoneInfo("America/New_York")).date()))
    parser.add_argument("--years", type=int, choices=range(1, 11), default=5)
    parser.add_argument("--cache-dir", type=Path, default=BACKEND.parent / ".cache/valuation-audit")
    parser.add_argument("--output", type=Path, default=BACKEND.parent / "artifacts/valuation-data-audit")
    parser.add_argument("--offline", action="store_true", help="Verify and replay cached raw responses without network")
    parser.add_argument("--require-ready", action="store_true", help="Exit 2 when any PE readiness check fails")
    args = parser.parse_args()
    try:
        iso_date(args.as_of)
    except ValueError as exc:
        parser.error(str(exc))
    return asyncio.run(run(args))


if __name__ == "__main__":
    raise SystemExit(main())
