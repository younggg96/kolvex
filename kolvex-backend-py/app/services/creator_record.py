"""How stocks moved after one creator's opinions (the chat agent's creator record tool).

Facts only, by the same rules as the 回看 page (docs/opinion-backtest.md): bullish and bearish
opinions are kept apart and measured as the stock's return minus SPY's over the same sessions.
Nothing here says whether a call was right, and there is no accuracy, win rate or ranking.

A creator-level average is stated only when a group has at least MIN_GROUP opinions old enough
for the horizon and their entry dates span at least MIN_SPAN_DAYS; it then also gives the two
halves of that period so a single lucky stretch shows. Below that only the counts are stated.

Method: app/services/opinion_backtest.py; prices: app/services/opinion_outcomes.py (adjusted
daily bars, cached 30 minutes, failures never cached). Blocking: call it from a worker thread.
"""

import statistics
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from app.services import opinion_backtest as bt
from app.services import opinion_outcomes as oo

HORIZONS = oo.HORIZONS
SENTIMENTS = ("bullish", "bearish")
MIN_GROUP = 30
MIN_SPAN_DAYS = 90
MAX_RECENT = 12
MAX_WORKERS = 6


class CreatorNotFound(LookupError):
    """No tracked creator matches the query."""


class AmbiguousCreator(LookupError):
    def __init__(self, candidates: list[str]):
        super().__init__("several creators match")
        self.candidates = candidates


class PricesUnavailable(RuntimeError):
    """The price provider failed for every ticker; nothing can be stated right now."""


def _norm(value: Any) -> str:
    return " ".join(str(value or "").split()).casefold().lstrip("@")


def find_channel(rows: list[dict[str, Any]], query: str) -> str:
    """channel_id for a creator name, @handle or channel id. Exact matches beat partial ones."""
    wanted = _norm(query)
    if not wanted:
        raise CreatorNotFound(query)
    channels: dict[str, dict[str, Any]] = {}
    for row in rows:
        if row.get("channel_id"):
            channels.setdefault(row["channel_id"], row)
    exact = [
        cid for cid, row in channels.items()
        if wanted in (_norm(cid), _norm(row.get("channel_handle")), _norm(row.get("channel_title")))
    ]  # fmt: skip
    found = exact or [
        cid for cid, row in channels.items()
        if wanted in _norm(row.get("channel_title")) or wanted in _norm(row.get("channel_handle"))
    ]  # fmt: skip
    if not found:
        raise CreatorNotFound(query)
    if len(found) > 1:
        raise AmbiguousCreator(sorted(str(channels[c].get("channel_title") or c) for c in found))
    return found[0]


def _group(events: list[dict[str, Any]], horizon: int) -> dict[str, Any]:
    scored = [
        (e["entry_date"], e["outcome"]["horizons"][str(horizon)])
        for e in events
        if e["outcome"]["horizons"].get(str(horizon), {}).get("excess_return_pct") is not None
    ]
    n = len(scored)
    if n == 0:
        return {"n": 0, "enough": False}
    days = sorted(day for day, _ in scored)
    span = (date.fromisoformat(days[-1]) - date.fromisoformat(days[0])).days
    if n < MIN_GROUP or span < MIN_SPAN_DAYS:
        return {"n": n, "span_days": span, "enough": False}
    excess = [r["excess_return_pct"] for _, r in scored]
    summary = bt.summarize(excess)  # hit rate here = share of opinions where the stock beat SPY
    middle = days[n // 2]
    early = [r["excess_return_pct"] for day, r in scored if day < middle]
    late = [r["excess_return_pct"] for day, r in scored if day >= middle]
    return {
        "n": n,
        "span_days": span,
        "enough": True,
        "mean_excess_pct": summary["mean_pct"],
        "median_excess_pct": summary["median_pct"],
        "beat_spy_share_pct": summary["hit_rate_pct"],
        "beat_spy_share_ci": list(summary["hit_rate_ci"]),
        "mean_return_pct": round(statistics.fmean(r["return_pct"] for _, r in scored), 2),
        "mean_spy_pct": round(statistics.fmean(r["benchmark_return_pct"] for _, r in scored), 2),
        "first_half": {"until": middle, "n": len(early), "mean_excess_pct": bt.summarize(early)["mean_pct"]},
        "second_half": {"from": middle, "n": len(late), "mean_excess_pct": bt.summarize(late)["mean_pct"]},
    }  # fmt: skip


def _move(result: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if not result or result.get("status") != "scored":
        return {"status": "pending"} if result else None
    return {
        "exit_date": result["exit_date"],
        "stock_pct": result["return_pct"],
        "spy_pct": result["benchmark_return_pct"],
        "stock_minus_spy_pct": result["excess_return_pct"],
    }


def _recent(event: dict[str, Any]) -> dict[str, Any]:
    row, outcome = event["row"], event["outcome"]
    item = {
        "date": str(row.get("video_published_at") or "")[:10] or None,
        "ticker": bt.price_symbol(row.get("ticker")),
        "sentiment": row.get("sentiment"),
        "confidence": row.get("confidence"),
        "video_url": row.get("video_url"),
        "price_status": outcome["status"],
    }
    if outcome["status"] == "scored":
        item["entry_date"] = outcome["entry_date"]
        item["after"] = {f"{h}_sessions": _move(outcome["horizons"].get(str(h))) for h in HORIZONS}
        latest = outcome.get("latest")
        if latest:
            item["after"]["so_far"] = {"sessions": latest.get("sessions"), **(_move(latest) or {})}
    return item


def creator_record(
    rows: list[dict[str, Any]],
    creator: str,
    ticker: Optional[str] = None,
    days: Optional[int] = 365,
    now: Optional[datetime] = None,
    download: oo.Downloader = oo.download_adjusted_bars,
) -> dict[str, Any]:
    """Post-opinion stock moves for one creator over the last `days` (None: all history)."""
    now = now or datetime.now(timezone.utc)
    channel_id = find_channel(rows, creator)
    mine = [
        r for r in rows if r.get("channel_id") == channel_id and bt.price_symbol(r.get("ticker"))
    ]
    title = next((r.get("channel_title") for r in mine if r.get("channel_title")), None)
    if ticker:
        mine = [r for r in mine if bt.price_symbol(r.get("ticker")) == bt.price_symbol(ticker)]
    if days is not None:
        since = now - timedelta(days=days)
        mine = [
            r for r in mine if (p := bt.published_ny(r.get("video_published_at"))) and p >= since
        ]
    kept = bt.dedupe_opinions(mine)

    by_ticker: dict[str, list[dict[str, Any]]] = {}
    for row in kept:
        by_ticker.setdefault(bt.price_symbol(row.get("ticker")), []).append(row)

    def outcomes(symbol: str):
        try:
            return symbol, oo.stock_outcomes(symbol, by_ticker[symbol], now, download)
        except oo.PricesUnavailable:
            return symbol, None

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        priced = dict(pool.map(outcomes, sorted(by_ticker)))
    if by_ticker and all(result is None for result in priced.values()):
        raise PricesUnavailable(channel_id)

    events, failed = [], 0
    for symbol, members in by_ticker.items():
        result = priced[symbol]
        for row in members:
            if result is None:
                failed += 1
                outcome = {"status": "price_unavailable", "horizons": {}}
            else:
                outcome = result["outcomes"][str(row["id"])]
            events.append({"row": row, "outcome": outcome, "entry_date": outcome.get("entry_date")})

    scored = [e for e in events if e["outcome"]["status"] == "scored"]
    statuses: dict[str, int] = {}
    for event in events:
        statuses[event["outcome"]["status"]] = statuses.get(event["outcome"]["status"], 0) + 1
    groups = {
        f"{h}_sessions": {
            s: _group([e for e in scored if e["row"].get("sentiment") == s], h) for s in SENTIMENTS
        }
        for h in HORIZONS
    }
    newest = sorted(
        events, key=lambda e: str(e["row"].get("video_published_at") or ""), reverse=True
    )
    as_of = max((r["as_of"] for r in priced.values() if r and r.get("as_of")), default=None)
    return {
        "creator": {"channel_id": channel_id, "name": title},
        "ticker": bt.price_symbol(ticker) if ticker else None,
        "window_days": days,
        "as_of": as_of,
        "benchmark": bt.BENCHMARK,
        "method": (
            "Entry at the first market open after the video was published; exit at the close of the "
            "Nth trading session; stock return minus SPY over the same sessions; the same creator "
            "repeating the same view on a ticker within 7 days counts once. Bullish and bearish "
            "opinions are kept apart. Facts about price moves, not a judgement of any call."
        ),
        "min_group": MIN_GROUP,
        "min_span_days": MIN_SPAN_DAYS,
        "counts": {
            "opinions": len(mine),
            "after_dedupe": len(kept),
            "tickers": len(by_ticker),
            "scored": len(scored),
            "bullish": sum(1 for e in scored if e["row"].get("sentiment") == "bullish"),
            "bearish": sum(1 for e in scored if e["row"].get("sentiment") == "bearish"),
            "neutral_or_mixed": sum(
                1 for e in scored if e["row"].get("sentiment") not in SENTIMENTS
            ),
            "not_started": statuses.get("pending", 0),
            "no_price_data": statuses.get("no_price_data", 0),
            "no_publish_time": statuses.get("no_publish_time", 0),
            "price_unavailable": failed,
        },
        "groups": groups,
        "recent": [_recent(e) for e in newest[:MAX_RECENT]],
    }
