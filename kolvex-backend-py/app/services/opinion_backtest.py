"""Event-study backtest of creator stock opinions. Pure functions; no IO.

Method (METHOD_VERSION 1):
- Event time: `video_published_at`, read in New York time. `opinion_date` is never used
  (it defaults to the upload day, which can be later than the video).
- Entry: open of the publish day when the video went out before the 09:30 open on a trading
  day; otherwise open of the next trading day. Opinions without a publish time are skipped.
- Exit for horizon N: close of the Nth trading session held (N=1 is entry open -> same close).
- Prices must be split/dividend adjusted by the caller.
- Benchmark: SPY over the same entry/exit dates. No fallback: if a benchmark bar is missing
  the excess return is None.
- Direction: bullish +1, bearish -1. `signed_excess` > 0 means the call beat the benchmark.
  neutral/mixed have no direction and are only counted.
- Dedupe: the same channel repeating the same direction on the same ticker within
  `dedupe_days` keeps only the first opinion (overlapping windows inflate significance).
- A horizon that the price data does not cover yet is "pending", not zero. `latest` is the
  move from entry to the most recent completed close, for opinions younger than a horizon.
"""

import math
import statistics
from datetime import date, datetime, time, timedelta
from typing import Any, Callable, Iterable, Optional
from zoneinfo import ZoneInfo

METHOD_VERSION = 1
BENCHMARK = "SPY"
DEFAULT_HORIZONS = (1, 5, 20, 60)
DEFAULT_DEDUPE_DAYS = 7
NY = ZoneInfo("America/New_York")
MARKET_OPEN = time(9, 30)
SESSION_SETTLED = time(16, 30)
DIRECTIONS = {"bullish": 1, "bearish": -1}

Bars = list[dict[str, Any]]  # [{"date": "YYYY-MM-DD", "open": float, "close": float}], ascending


def completed_bars(bars: Bars, now: datetime) -> Bars:
    """Drop today's bar until the session has settled; its close is still moving."""
    local = now.astimezone(NY)
    cutoff = local.date().isoformat()
    if local.time() >= SESSION_SETTLED:
        return [b for b in bars if b["date"] <= cutoff]
    return [b for b in bars if b["date"] < cutoff]


def price_symbol(ticker: str) -> str:
    """Yahoo spelling of a ticker (BRK.B -> BRK-B)."""
    return str(ticker or "").strip().upper().replace(".", "-")


def published_ny(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None  # an unlabeled timestamp cannot be placed against the market open
    return parsed.astimezone(NY)


def _pct(a: float, b: float) -> float:
    return round((a / b - 1) * 100, 4)


def entry_index(bars: Bars, published: datetime) -> Optional[int]:
    """Index of the first bar whose open was still ahead when the video was published."""
    day = published.date().isoformat()
    before_open = published.time() < MARKET_OPEN
    for index, bar in enumerate(bars):
        if bar["date"] > day or (before_open and bar["date"] == day):
            return index
    return None


def dedupe_opinions(opinions: Iterable[dict], dedupe_days: int = DEFAULT_DEDUPE_DAYS) -> list[dict]:
    """Drop repeats of the same channel/ticker/sentiment within `dedupe_days` of the kept one."""
    kept: list[dict] = []
    last: dict[tuple, datetime] = {}
    dated = [(published_ny(o.get("video_published_at")), o) for o in opinions]
    undated = [o for when, o in dated if when is None]
    for when, opinion in sorted(((w, o) for w, o in dated if w), key=lambda pair: pair[0]):
        key = (
            opinion.get("channel_id"),
            price_symbol(opinion.get("ticker")),
            opinion.get("sentiment"),
        )
        previous = last.get(key)
        if previous is not None and when - previous < timedelta(days=dedupe_days):
            continue
        last[key] = when
        kept.append(opinion)
    return kept + undated


def score_opinion(
    opinion: dict,
    bars: Bars,
    benchmark_bars: Bars,
    horizons: Iterable[int] = DEFAULT_HORIZONS,
) -> dict[str, Any]:
    """One event row. `status` is scored / no_publish_time / no_price_data / pending."""
    sentiment = opinion.get("sentiment")
    event = {
        "opinion_id": opinion.get("id"),
        "channel_id": opinion.get("channel_id"),
        "channel_title": opinion.get("channel_title"),
        "ticker": price_symbol(opinion.get("ticker")),
        "sentiment": sentiment,
        "direction": DIRECTIONS.get(sentiment, 0),
        "direction_score": opinion.get("direction_score"),
        "confidence": opinion.get("confidence"),
        "time_horizon": opinion.get("time_horizon"),
        "video_id": opinion.get("video_id"),
        "published_at": opinion.get("video_published_at"),
        "entry_date": None,
        "entry_price": None,
        "horizons": {},
        "latest": None,
    }
    published = published_ny(opinion.get("video_published_at"))
    if published is None:
        return {**event, "status": "no_publish_time"}
    usable = [b for b in bars if b.get("open") and b.get("close")]
    if not usable:
        return {**event, "status": "no_price_data"}
    start = entry_index(usable, published)
    if start is None:
        return {**event, "status": "pending"}

    entry_bar = usable[start]
    entry = float(entry_bar["open"])
    bench = {b["date"]: b for b in benchmark_bars if b.get("open") and b.get("close")}
    bench_entry = bench.get(entry_bar["date"])

    def measure(exit_at: int) -> dict[str, Any]:
        exit_bar = usable[exit_at]
        ret = _pct(float(exit_bar["close"]), entry)
        bench_exit = bench.get(exit_bar["date"])
        bench_ret = excess = signed = None
        if bench_entry and bench_exit:
            bench_ret = _pct(float(bench_exit["close"]), float(bench_entry["open"]))
            excess = round(ret - bench_ret, 4)
            signed = round(excess * event["direction"], 4) if event["direction"] else None
        return {
            "status": "scored",
            "exit_date": exit_bar["date"],
            "return_pct": ret,
            "benchmark_return_pct": bench_ret,
            "excess_return_pct": excess,
            "signed_excess_pct": signed,
        }

    results: dict[int, dict[str, Any]] = {}
    for horizon in horizons:
        exit_at = start + horizon - 1
        results[horizon] = measure(exit_at) if exit_at < len(usable) else {"status": "pending"}
    return {
        **event,
        "status": "scored",
        "entry_date": entry_bar["date"],
        "entry_price": entry,
        "horizons": results,
        # Entry open -> the latest completed close, however many sessions that is.
        "latest": {"sessions": len(usable) - start, **measure(len(usable) - 1)},
    }


def wilson_interval(hits: int, n: int, z: float = 1.96) -> Optional[tuple[float, float]]:
    """95% confidence interval for a hit rate, in percent."""
    if n <= 0:
        return None
    p = hits / n
    centre = p + z * z / (2 * n)
    spread = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    scale = 1 + z * z / n
    low, high = (centre - spread) / scale, (centre + spread) / scale
    return round(max(low, 0.0) * 100, 1), round(min(high, 1.0) * 100, 1)


def summarize(values: list[float]) -> dict[str, Any]:
    """Stats over signed excess returns (percent). Empty input gives n=0 and None, not zeros."""
    n = len(values)
    if n == 0:
        return {"n": 0, "hit_rate_pct": None, "hit_rate_ci": None, "mean_pct": None,
                "median_pct": None, "t_stat": None}  # fmt: skip
    hits = sum(1 for v in values if v > 0)
    mean = statistics.fmean(values)
    t_stat = None
    if n >= 2:
        sd = statistics.stdev(values)
        t_stat = round(mean / (sd / math.sqrt(n)), 2) if sd > 0 else None
    return {
        "n": n,
        "hit_rate_pct": round(hits / n * 100, 1),
        "hit_rate_ci": wilson_interval(hits, n),
        "mean_pct": round(mean, 2),
        "median_pct": round(statistics.median(values), 2),
        "t_stat": t_stat,
    }


def signed_values(events: Iterable[dict], horizon: int) -> list[float]:
    values = []
    for event in events:
        signed = event.get("horizons", {}).get(horizon, {}).get("signed_excess_pct")
        if signed is not None:
            values.append(signed)
    return values


def group_summary(
    events: list[dict], horizon: int, key: Callable[[dict], Any]
) -> list[dict[str, Any]]:
    """Per-group stats for one horizon, largest group first."""
    groups: dict[Any, list[dict]] = {}
    for event in events:
        groups.setdefault(key(event), []).append(event)
    rows = [{"group": name, **summarize(signed_values(members, horizon))}
            for name, members in groups.items()]  # fmt: skip
    return sorted((r for r in rows if r["n"]), key=lambda r: (-r["n"], str(r["group"])))


def bucket(value: Any, edges: tuple[float, ...], absolute: bool = False) -> str:
    """Label like '0.5-0.75' for a numeric field; 'unknown' when it is missing."""
    try:
        number = abs(float(value)) if absolute else float(value)
    except (TypeError, ValueError):
        return "unknown"
    low = None
    for edge in edges:
        if number < edge:
            return f"<{edge:g}" if low is None else f"{low:g}-{edge:g}"
        low = edge
    return f">={edges[-1]:g}"


def split_date(events: list[dict], horizon: int) -> Optional[date]:
    """Median entry date of the events scored at `horizon`: pick channels before, check after."""
    days = sorted(
        e["entry_date"]
        for e in events
        if e.get("horizons", {}).get(horizon, {}).get("signed_excess_pct") is not None
    )
    return date.fromisoformat(days[len(days) // 2]) if days else None


def channel_table(events: list[dict], horizon: int, split: Optional[date]) -> list[dict[str, Any]]:
    """Per-channel stats plus the same stats on each side of `split` (in-sample vs later)."""
    rows = []
    groups: dict[Any, list[dict]] = {}
    for event in events:
        groups.setdefault(event["channel_id"], []).append(event)
    for channel_id, members in groups.items():
        overall = summarize(signed_values(members, horizon))
        if not overall["n"]:
            continue
        row = {
            "channel_id": channel_id,
            "channel_title": members[0].get("channel_title"),
            **overall,
        }
        if split is not None:
            cut = split.isoformat()
            early = summarize(
                signed_values([m for m in members if (m["entry_date"] or "") < cut], horizon)
            )
            late = summarize(
                signed_values([m for m in members if (m["entry_date"] or "") >= cut], horizon)
            )
            row.update({"early_n": early["n"], "early_mean_pct": early["mean_pct"],
                        "late_n": late["n"], "late_mean_pct": late["mean_pct"]})  # fmt: skip
        rows.append(row)
    return sorted(rows, key=lambda r: (-r["n"], str(r["channel_id"])))
