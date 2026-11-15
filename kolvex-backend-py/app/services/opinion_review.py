"""How stocks moved after creator opinions, across every opinion (the 回看 page).

Facts only: for bullish and bearish opinions separately, the stock's return minus SPY's over the
same sessions. No verdict on any call, no per-creator figures, no ranking. A group with fewer than
MIN_GROUP opinions shows its count but no statistics.

Method: app/services/opinion_backtest.py (entry at the first open after the video, completed
sessions only, 7-day dedupe). Prices for hundreds of tickers take minutes to download, so the
snapshot is built in a background thread, kept in memory and in a JSON file, and rebuilt once
per settled session. Requests never wait for a build.
"""

import json
import logging
import os
import statistics
import tempfile
import threading
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from app.services import opinion_backtest as bt

logger = logging.getLogger(__name__)

HORIZONS = (5, 20)
SENTIMENTS = ("bullish", "bearish")
MIN_GROUP = 30
HISTOGRAM_EDGES = (-20, -15, -10, -5, 0, 5, 10, 15, 20)
CONFIDENCE_EDGES = (0.5, 0.7, 0.85)
STRENGTH_EDGES = (30, 60, 80)
LOOKBACK_PAD_DAYS = 7
RETRY_AFTER_FAILURE_SECONDS = 600.0
SNAPSHOT_PATH = Path(
    os.getenv(
        "OPINION_REVIEW_SNAPSHOT",
        str(Path(__file__).resolve().parents[2] / "data" / "review" / "snapshot.json"),
    )
)

Bars = bt.Bars
# (symbols, start, end) -> {symbol: bars}; a symbol the provider does not know maps to [].
BatchDownloader = Callable[[list[str], str, str], dict[str, Bars]]


class ReviewUnavailable(RuntimeError):
    """No snapshot yet (first build running or failed)."""


# --------------------------------------------------------------------------- prices


def download_many(symbols: list[str], start: str, end: str) -> dict[str, Bars]:
    """Adjusted daily bars for many symbols in one yfinance call."""
    import yfinance as yf

    frame = yf.download(
        symbols, start=start, end=end, interval="1d", auto_adjust=True,
        group_by="ticker", threads=True, progress=False,
    )  # fmt: skip
    result: dict[str, Bars] = {}
    for symbol in symbols:
        try:
            sub = frame[symbol] if len(symbols) > 1 else frame
        except KeyError:
            result[symbol] = []
            continue
        bars = []
        for timestamp, row in sub.iterrows():
            open_, close = float(row["Open"]), float(row["Close"])
            if open_ > 0 and close > 0:  # NaN fails both comparisons
                bars.append({"date": timestamp.date().isoformat(), "open": open_, "close": close})
        result[symbol] = bars
    return result


# --------------------------------------------------------------------------- statistics


def _stats(events: list[dict], horizon: int) -> dict[str, Any]:
    """Return minus SPY for one group. Below MIN_GROUP only the count is stated."""
    scored = [
        e["horizons"][horizon]
        for e in events
        if e["horizons"].get(horizon, {}).get("excess_return_pct") is not None
    ]
    n = len(scored)
    if n < MIN_GROUP:
        return {"n": n, "enough": False}
    excess = [r["excess_return_pct"] for r in scored]
    summary = bt.summarize(excess)  # hit rate here = share where the stock beat SPY
    return {
        "n": n,
        "enough": True,
        "mean_excess_pct": summary["mean_pct"],
        "median_excess_pct": summary["median_pct"],
        "beat_share_pct": summary["hit_rate_pct"],
        "beat_share_ci": list(summary["hit_rate_ci"]),
        "mean_return_pct": round(statistics.fmean(r["return_pct"] for r in scored), 2),
        "mean_benchmark_pct": round(statistics.fmean(r["benchmark_return_pct"] for r in scored), 2),
        "histogram": _histogram(excess),
    }


def _histogram(values: list[float]) -> list[dict[str, Any]]:
    edges = [None, *HISTOGRAM_EDGES, None]
    bins = []
    for low, high in zip(edges, edges[1:]):
        count = sum(1 for v in values if (low is None or v >= low) and (high is None or v < high))
        bins.append({"low": low, "high": high, "count": count})
    return bins


def _segments(events: list[dict], horizon: int, field: str, edges: tuple, absolute=False):
    groups: dict[str, list[dict]] = {}
    for event in events:
        groups.setdefault(bt.bucket(event.get(field), edges, absolute), []).append(event)
    bounds = [None, *edges, None]
    rows = []
    for low, high in zip(bounds, bounds[1:]):
        # Same labels as bt.bucket, built from the interval so the order follows the edges.
        key = f"<{high:g}" if low is None else f">={low:g}" if high is None else f"{low:g}-{high:g}"
        rows.append({"low": low, "high": high, **_stats(groups.get(key, []), horizon)})
    rows.append(
        {"low": None, "high": None, "unknown": True, **_stats(groups.get("unknown", []), horizon)}
    )
    # A group with no opinion old enough for this horizon says nothing; leave it out.
    return [row for row in rows if row["n"]]


def _week(day: str) -> str:
    parsed = date.fromisoformat(day)
    return (parsed - timedelta(days=parsed.weekday())).isoformat()


def build_snapshot(
    rows: list[dict[str, Any]],
    download: BatchDownloader,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Aggregate snapshot over every stored opinion. Blocking; raises when SPY is unavailable."""
    now = now or datetime.now(timezone.utc)
    opinions = [r for r in rows if bt.price_symbol(r.get("ticker"))]
    kept = bt.dedupe_opinions(opinions)
    published = [p for p in (bt.published_ny(o.get("video_published_at")) for o in kept) if p]
    if not published:
        raise ReviewUnavailable("no opinions with a publish time")
    start = (min(published).date() - timedelta(days=LOOKBACK_PAD_DAYS)).isoformat()
    end = (now.astimezone(bt.NY).date() + timedelta(days=1)).isoformat()
    symbols = sorted({bt.price_symbol(o.get("ticker")) for o in kept} | {bt.BENCHMARK})
    prices = {s: bt.completed_bars(b, now) for s, b in download(symbols, start, end).items()}
    benchmark = prices.get(bt.BENCHMARK) or []
    if not benchmark:
        raise ReviewUnavailable(f"{bt.BENCHMARK}: no bars")

    events = [
        bt.score_opinion(o, prices.get(bt.price_symbol(o.get("ticker")), []), benchmark, HORIZONS)
        for o in kept
    ]
    statuses: dict[str, int] = {}
    for event in events:
        statuses[event["status"]] = statuses.get(event["status"], 0) + 1
    scored = [e for e in events if e["status"] == "scored"]
    by_sentiment = {s: [e for e in scored if e["sentiment"] == s] for s in SENTIMENTS}

    groups = {}
    for horizon in HORIZONS:
        groups[str(horizon)] = {
            sentiment: {
                "overall": _stats(members, horizon),
                "confidence": _segments(members, horizon, "confidence", CONFIDENCE_EDGES),
                "strength": _segments(members, horizon, "direction_score", STRENGTH_EDGES, True),
            }
            for sentiment, members in by_sentiment.items()
        }

    first_entry = min((e["entry_date"] for e in scored), default=None)
    weekly: dict[str, dict[str, int]] = {}
    for event in scored:
        if event["sentiment"] in SENTIMENTS:
            week = weekly.setdefault(_week(event["entry_date"]), {"bullish": 0, "bearish": 0})
            week[event["sentiment"]] += 1
    return {
        "method_version": bt.METHOD_VERSION,
        "benchmark": bt.BENCHMARK,
        "horizons": list(HORIZONS),
        "min_group": MIN_GROUP,
        "as_of": benchmark[-1]["date"],
        "built_at": now.astimezone(timezone.utc).isoformat(),
        "counts": {
            "opinions": len(opinions),
            "after_dedupe": len(kept),
            "scored": len(scored),
            "bullish": len(by_sentiment["bullish"]),
            "bearish": len(by_sentiment["bearish"]),
            "neutral_or_mixed": len(scored) - sum(len(v) for v in by_sentiment.values()),
            "no_price_data": statuses.get("no_price_data", 0),
            "no_publish_time": statuses.get("no_publish_time", 0),
            "not_started": statuses.get("pending", 0),
        },
        "groups": groups,
        "market": {
            "benchmark": [
                {"date": b["date"], "close": round(float(b["close"]), 2)}
                for b in benchmark
                if first_entry and b["date"] >= first_entry
            ],
            "weekly_opinions": [{"week": k, **v} for k, v in sorted(weekly.items())],
        },
    }


# --------------------------------------------------------------------------- snapshot lifecycle


def last_settle(now: datetime) -> datetime:
    """The most recent 16:30 New York; a snapshot built after it is current."""
    local = now.astimezone(bt.NY)
    cutoff = local.replace(hour=bt.SESSION_SETTLED.hour, minute=bt.SESSION_SETTLED.minute,
                           second=0, microsecond=0)  # fmt: skip
    if local < cutoff:
        cutoff -= timedelta(days=1)
    return cutoff


class _State:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.snapshot: Optional[dict[str, Any]] = None
        self.loaded_file = False
        self.building = False
        self.failed_at: Optional[float] = None


_state = _State()


def reset() -> None:
    global _state
    _state = _State()


def _read_file(path: Path) -> Optional[dict[str, Any]]:
    try:
        data = json.loads(path.read_text())
    except (OSError, ValueError):
        return None
    return data if data.get("method_version") == bt.METHOD_VERSION else None


def _write_file(path: Path, snapshot: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False, suffix=".tmp") as handle:
        json.dump(snapshot, handle)
    os.replace(handle.name, path)


def _is_current(snapshot: dict[str, Any], now: datetime) -> bool:
    try:
        built = datetime.fromisoformat(snapshot["built_at"])
    except (KeyError, ValueError):
        return False
    return built >= last_settle(now)


def _build(load_rows, download, path: Path, now: datetime) -> None:
    state = _state
    try:
        snapshot = build_snapshot(load_rows(), download, now)
        try:
            _write_file(path, snapshot)
        except OSError as error:  # memory copy still serves
            logger.warning("Opinion review snapshot not saved: %s", error)
        with state.lock:
            state.snapshot = snapshot
            state.failed_at = None
    except Exception:
        logger.exception("Opinion review snapshot build failed")
        with state.lock:
            state.failed_at = time.monotonic()
    finally:
        with state.lock:
            state.building = False


def get_review(
    load_rows: Callable[[], list[dict[str, Any]]],
    download: BatchDownloader = download_many,
    now: Optional[datetime] = None,
    spawn: Callable[[Callable[[], None]], Any] = lambda fn: threading.Thread(
        target=fn, name="opinion-review", daemon=True
    ).start(),
    path: Optional[Path] = None,
) -> dict[str, Any]:
    """The latest snapshot, starting a rebuild when it is out of date. Never blocks on a build.

    `refreshing` is true while a newer snapshot is being built. Raises ReviewUnavailable when
    there is no snapshot at all yet.
    """
    now = now or datetime.now(timezone.utc)
    path = path or SNAPSHOT_PATH
    state = _state
    with state.lock:
        if not state.loaded_file:
            state.loaded_file = True
            state.snapshot = state.snapshot or _read_file(path)
        snapshot = state.snapshot
        stale = snapshot is None or not _is_current(snapshot, now)
        cooling = state.failed_at is not None and (
            time.monotonic() - state.failed_at < RETRY_AFTER_FAILURE_SECONDS
        )
        start = stale and not state.building and not cooling
        if start:
            state.building = True
        building = state.building
    if start:
        spawn(lambda: _build(load_rows, download, path, now))
        with state.lock:
            snapshot, building = state.snapshot, state.building
    if snapshot is None:
        raise ReviewUnavailable("building" if building else "unavailable")
    return {**snapshot, "refreshing": building}
