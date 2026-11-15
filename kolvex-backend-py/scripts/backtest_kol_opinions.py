#!/usr/bin/env python3
"""Read-only event-study backtest of YouTube creator opinions.

Reads `youtube_stock_opinions` with the anon key (public SELECT policy), pulls adjusted daily
bars from yfinance, and writes report.md / events.csv / channels.csv. It never writes to the
database and never calls a model. Method: app/services/opinion_backtest.py.

    python scripts/backtest_kol_opinions.py --since 2026-01-01
"""

import argparse
import csv
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.services import opinion_backtest as bt  # noqa: E402
from app.services.opinion_outcomes import download_adjusted_bars  # noqa: E402

TABLE = "youtube_stock_opinions"
COLUMNS = (
    "id,video_id,video_published_at,channel_id,channel_title,ticker,sentiment,"
    "direction_score,confidence,time_horizon"
)
PAGE = 1000


def fetch_opinions(since: str | None) -> list[dict]:
    from app.core.supabase import get_supabase

    client = get_supabase()  # anon key: SELECT only under RLS
    rows: list[dict] = []
    while True:
        query = client.table(TABLE).select(COLUMNS).order("id")
        if since:
            query = query.gte("video_published_at", since)
        page = query.range(len(rows), len(rows) + PAGE - 1).execute().data or []
        rows.extend(page)
        if len(page) < PAGE:
            return rows


def cached_bars(cache: Path, symbol: str, start: str, today: date) -> list[dict]:
    """Bars from today's cache file, else a fresh download. Raises when the download fails."""
    path = cache / f"{symbol}.json"
    if path.exists():
        saved = json.loads(path.read_text())
        if saved.get("fetched_on") == today.isoformat() and saved.get("start", "9") <= start:
            return bt.completed_bars(saved["bars"], datetime.now(timezone.utc))
    bars = download_adjusted_bars(symbol, start, (today + timedelta(days=1)).isoformat())
    cache.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"fetched_on": today.isoformat(), "start": start, "bars": bars}))
    return bt.completed_bars(bars, datetime.now(timezone.utc))


def run(
    opinions: list[dict], horizons: tuple[int, ...], dedupe_days: int, cache: Path, today: date
):
    kept = bt.dedupe_opinions(opinions, dedupe_days)
    published = [p for p in (bt.published_ny(o.get("video_published_at")) for o in kept) if p]
    if not published:
        return kept, [], {}
    start = (min(published).date() - timedelta(days=7)).isoformat()
    benchmark = cached_bars(cache, bt.BENCHMARK, start, today)
    if not benchmark:
        raise SystemExit(f"No {bt.BENCHMARK} bars; cannot compute excess returns.")

    prices: dict[str, list[dict]] = {}
    failed: dict[str, str] = {}
    symbols = sorted({bt.price_symbol(o.get("ticker")) for o in kept} - {""})
    for index, symbol in enumerate(symbols, 1):
        print(f"\rprices {index}/{len(symbols)} {symbol:<8}", end="", file=sys.stderr)
        try:
            prices[symbol] = cached_bars(cache, symbol, start, today)
        except Exception as error:  # one bad ticker must not hide the rest
            failed[symbol] = f"{type(error).__name__}: {error}"
    print(file=sys.stderr)

    events = []
    for opinion in kept:
        symbol = bt.price_symbol(opinion.get("ticker"))
        event = bt.score_opinion(opinion, prices.get(symbol, []), benchmark, horizons)
        if symbol in failed:
            event["status"] = "price_fetch_failed"
        events.append(event)
    return kept, events, failed


def _cell(value) -> str:
    if value is None:
        return "—"
    if isinstance(value, tuple):
        return f"{value[0]}–{value[1]}"
    return f"{value:+.2f}" if isinstance(value, float) else str(value)


def _table(rows: list[dict], first: str) -> list[str]:
    lines = [
        f"| {first} | n | hit % | 95% CI | mean signed excess % | median % | t |",
        "| --- | ---: | ---: | --- | ---: | ---: | ---: |",
    ]
    for row in rows:
        hit = "—" if row["hit_rate_pct"] is None else f"{row['hit_rate_pct']:.1f}"
        lines.append(
            f"| {row['group']} | {row['n']} | {hit} | {_cell(row['hit_rate_ci'])} | "
            f"{_cell(row['mean_pct'])} | {_cell(row['median_pct'])} | {_cell(row['t_stat'])} |"
        )
    return lines


def report(opinions, kept, events, failed, horizons, detail, min_n, today) -> str:
    statuses: dict[str, int] = {}
    for event in events:
        statuses[event["status"]] = statuses.get(event["status"], 0) + 1
    scored = [e for e in events if e["status"] == "scored"]
    directional = [e for e in scored if e["direction"]]
    lines = [
        f"# Creator opinion backtest ({today.isoformat()}, method v{bt.METHOD_VERSION})",
        "",
        f"- Opinions read: {len(opinions)}; after dedupe: {len(kept)}",
        f"- Status: {', '.join(f'{k} {v}' for k, v in sorted(statuses.items())) or 'none'}",
        f"- Scored with a direction (bullish/bearish): {len(directional)}; "
        f"neutral/mixed (not scored as calls): {len(scored) - len(directional)}",
        f"- Benchmark {bt.BENCHMARK}. Signed excess > 0 = the call beat the benchmark. "
        "No fees or slippage. Tickers without price data are excluded, which can flatter results.",
    ]
    if failed:
        lines.append(f"- Price download failed for: {', '.join(sorted(failed))}")
    missing = sorted({e["ticker"] for e in events if e["status"] == "no_price_data"})
    if missing:
        lines.append(f"- No price data for: {', '.join(missing)}")
    if not directional:
        return "\n".join(lines + ["", "Nothing to score."])

    lines += ["", "## By holding period (trading sessions)", ""]
    lines += _table([{"group": f"{h}d", **bt.summarize(bt.signed_values(directional, h))}
                     for h in horizons], "horizon")  # fmt: skip
    sections = [
        ("sentiment", lambda e: e["sentiment"]),
        ("confidence", lambda e: bt.bucket(e["confidence"], (0.5, 0.7, 0.85))),
        ("|direction_score|", lambda e: bt.bucket(e["direction_score"], (30, 60, 80), True)),
        ("stated time_horizon", lambda e: e["time_horizon"] or "unknown"),
    ]
    for title, key in sections:
        lines += ["", f"## {detail}d by {title}", ""]
        lines += _table(bt.group_summary(directional, detail, key), title)

    split = bt.split_date(directional, detail)
    channels = [c for c in bt.channel_table(directional, detail, split) if c["n"] >= min_n]
    lines += ["", f"## {detail}d by channel (n >= {min_n}; early/late split at {split})", ""]
    lines += ["| channel | n | hit % | 95% CI | mean % | t | early n | early mean % | late n | late mean % |",
              "| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |"]  # fmt: skip
    for c in sorted(channels, key=lambda c: -(c["mean_pct"] or 0)):
        lines.append(
            f"| {c['channel_title'] or c['channel_id']} | {c['n']} | {c['hit_rate_pct']:.1f} | "
            f"{_cell(c['hit_rate_ci'])} | {_cell(c['mean_pct'])} | {_cell(c['t_stat'])} | "
            f"{c.get('early_n', '—')} | {_cell(c.get('early_mean_pct'))} | "
            f"{c.get('late_n', '—')} | {_cell(c.get('late_mean_pct'))} |"
        )
    lines += ["", "A channel that only looks good in the early half and not the late half was "
              "probably luck. Ranking many channels and keeping the best one overstates skill."]  # fmt: skip
    return "\n".join(lines)


def write_csvs(out: Path, events: list[dict], horizons, detail: int) -> None:
    base = ["opinion_id", "status", "channel_id", "channel_title", "ticker", "sentiment",
            "direction_score", "confidence", "time_horizon", "video_id", "published_at",
            "entry_date", "entry_price"]  # fmt: skip
    fields = ["exit_date", "return_pct", "benchmark_return_pct", "excess_return_pct",
              "signed_excess_pct"]  # fmt: skip
    with (out / "events.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(base + [f"{f}_{h}d" for h in horizons for f in fields])
        for event in events:
            row = [event.get(name) for name in base]
            for horizon in horizons:
                result = event["horizons"].get(horizon, {})
                row += [result.get(f) for f in fields]
            writer.writerow(row)
    directional = [e for e in events if e["status"] == "scored" and e["direction"]]
    rows = bt.channel_table(directional, detail, bt.split_date(directional, detail))
    if rows:
        with (out / "channels.csv").open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--since", help="only opinions published on/after this date (YYYY-MM-DD)")
    parser.add_argument("--horizons", default=",".join(map(str, bt.DEFAULT_HORIZONS)))
    parser.add_argument("--detail-horizon", type=int, default=20, help="horizon for breakdowns")
    parser.add_argument("--dedupe-days", type=int, default=bt.DEFAULT_DEDUPE_DAYS)
    parser.add_argument("--min-n", type=int, default=10, help="min scored opinions per channel")
    parser.add_argument("--out", type=Path, default=BACKEND / "data" / "backtests")
    args = parser.parse_args()
    horizons = tuple(sorted({int(h) for h in args.horizons.split(",")}))
    if args.detail_horizon not in horizons:
        parser.error("--detail-horizon must be one of --horizons")

    today = date.today()
    opinions = fetch_opinions(args.since)
    kept, events, failed = run(opinions, horizons, args.dedupe_days, args.out / "prices", today)
    text = report(opinions, kept, events, failed, horizons, args.detail_horizon, args.min_n, today)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "report.md").write_text(text + "\n")
    write_csvs(args.out, events, horizons, args.detail_horizon)
    print(text)
    print(f"\nWrote {args.out}/report.md, events.csv, channels.csv", file=sys.stderr)


if __name__ == "__main__":
    main()
