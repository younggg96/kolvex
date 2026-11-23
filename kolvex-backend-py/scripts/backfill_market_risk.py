#!/usr/bin/env python3
"""Backfill Market Risk Monitor daily observations (VIX, VVIX, VIX9D, VIX3M + ratios).

Fetches Cboe daily history, validates it against the NYSE calendar and FRED, and
prints a quality report. Dry run by default: nothing is written unless ``--write`` is
passed, which uses the service-role key from the environment and records an ingestion run.
Re-running is safe: unchanged values are skipped, corrections become new revisions.

    python scripts/backfill_market_risk.py                     # dry run since 2011-01-03
    python scripts/backfill_market_risk.py --since 2007-01-03 --json report.json
    python scripts/backfill_market_risk.py --write             # needs the migration applied
"""

import argparse
import asyncio
import json
import sys
from datetime import date
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.services.market_risk import ingest  # noqa: E402

# VIX9D, the shortest series, starts in 2011; earlier VVIX history is sparse and noisy.
DEFAULT_SINCE = date(2011, 1, 3)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--since", type=date.fromisoformat, default=DEFAULT_SINCE)
    parser.add_argument("--write", action="store_true", help="insert into Supabase")
    parser.add_argument("--json", type=Path, help="also write the full summary to this file")
    args = parser.parse_args()

    report = asyncio.run(ingest.collect(start=args.since))
    if args.write:
        from app.core.supabase import get_supabase_service

        ingest.store(get_supabase_service(), report, "backfill", args.since)

    summary = report.summary()
    summary["rows_written"] = report.rows_written if args.write else None
    summary["observations"] = len(report.observations)
    if args.json:
        args.json.write_text(json.dumps(summary, indent=2, ensure_ascii=False))

    print(f"status={summary['status']} expected_through={summary['expected_through']}")
    for key, m in summary["metrics"].items():
        print(
            f"  {key:6} {m['first_date']}..{m['last_date']} accepted={m['accepted']} "
            f"suspect={m['suspect']} rejected={m['rejected']} "
            f"holiday_rows={m['skipped_non_trading_day']} missing={m['missing_days']}"
        )
    for key, error in summary["source_errors"].items():
        print(f"  ERROR {key}: {error}")
    for key, error in summary["cross_check_errors"].items():
        print(f"  cross-check unavailable {key}: {error}")
    print(f"  cross-check mismatches: {summary['cross_check_mismatch_count']}")
    print(f"  observations incl. ratios: {summary['observations']}")
    print(f"  written: {summary['rows_written'] if args.write else 'dry run'}")
    return 0 if summary["status"] != "failed" else 1


if __name__ == "__main__":
    sys.exit(main())
