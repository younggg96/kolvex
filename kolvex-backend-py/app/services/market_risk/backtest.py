"""Historical analysis of the Market Risk model (M4, PRD §11.4). Research only.

The model has no fitted parameters and each day's score already uses only earlier data,
so every scored day is out of sample. Results are split into a development period and
a later validation period to show whether behaviour holds up over time.

Forward outcomes use S&P 500 index closes from the session's close: returns over
``HORIZONS`` sessions and the worst close within the window. Nothing here is a
forecast or shown to users as a hit rate.
"""

from contextlib import contextmanager
from datetime import date
from statistics import mean, median

from app.services.market_risk import engine

HORIZONS = (5, 20, 60)
DRAWDOWN_ALERT = -0.05  # a "stress follow-through" within 20 sessions
EPISODE_DRAWDOWN = -0.10  # a market drawdown episode, peak to trough
LEAD_SESSIONS = 20
PERIODS = (
    ("2012–2019", date(2012, 1, 1), date(2019, 12, 31)),
    ("2020–", date(2020, 1, 1), date(2100, 1, 1)),
    ("all", date(1900, 1, 1), date(2100, 1, 1)),
)
STRESS_STAGES = (engine.BUILD_UP, engine.ACCELERATION)


@contextmanager
def override(**constants):
    """Temporarily change engine constants for a sensitivity run (never in production)."""
    saved = {name: getattr(engine, name) for name in constants}
    try:
        for name, value in constants.items():
            setattr(engine, name, value)
        yield
    finally:
        for name, value in saved.items():
            setattr(engine, name, value)


def forward_outcomes(closes: dict[date, float]) -> dict[date, dict]:
    """Per session: forward returns and the worst forward close vs today's close."""
    days = sorted(closes)
    out = {}
    for i, day in enumerate(days):
        base = closes[day]
        row = {}
        for h in HORIZONS:
            if i + h < len(days):
                row[f"ret_{h}"] = closes[days[i + h]] / base - 1
                row[f"dd_{h}"] = min(
                    0.0, min(closes[d] for d in days[i + 1 : i + h + 1]) / base - 1
                )
        out[day] = row
    return out


def drawdown_episodes(closes: dict[date, float], threshold: float = EPISODE_DRAWDOWN):
    """Peak-to-trough declines of at least ``threshold`` on closing prices."""
    episodes, peak_day, peak, crossed, trough = [], None, None, None, None
    for day in sorted(closes):
        close = closes[day]
        if peak is None or close >= peak:
            if crossed:
                episodes.append(
                    {"peak": peak_day, "crossed": crossed, "trough": trough[0], "depth": trough[1]}
                )
            peak_day, peak, crossed, trough = day, close, None, None
            continue
        depth = close / peak - 1
        if trough is None or depth < trough[1]:
            trough = (day, depth)
        if crossed is None and depth <= threshold:
            crossed = day
    if crossed:
        episodes.append(
            {
                "peak": peak_day,
                "crossed": crossed,
                "trough": trough[0],
                "depth": trough[1],
                "open": True,
            }
        )
    return episodes


def _summary(rows: list[dict]) -> dict:
    out = {"n": len(rows)}
    r20 = [r["ret_20"] for r in rows if "ret_20" in r]
    d20 = [r["dd_20"] for r in rows if "dd_20" in r]
    r60 = [r["ret_60"] for r in rows if "ret_60" in r]
    if r20:
        out.update(
            ret20_mean=mean(r20),
            ret20_median=median(r20),
            ret20_negative=sum(x < 0 for x in r20) / len(r20),
            dd20_mean=mean(d20),
            dd20_alert=sum(x <= DRAWDOWN_ALERT for x in d20) / len(d20),
        )
    if r60:
        out["ret60_mean"] = mean(r60)
    return out


def _runs(days: list[engine.Day]) -> list[tuple[str, int]]:
    runs: list[tuple[str, int]] = []
    for d in days:
        if runs and runs[-1][0] == d.stage:
            runs[-1] = (d.stage, runs[-1][1] + 1)
        else:
            runs.append((d.stage, 1))
    return runs


def analyse(evaluation: engine.Evaluation, closes: dict[date, float]) -> dict:
    outcomes = forward_outcomes(closes)
    scored = [d for d in evaluation.days if d.score is not None and d.trading_date in closes]
    if not scored:
        return {"periods": {}, "episodes": []}
    episodes = drawdown_episodes(closes)
    index = {d.trading_date: i for i, d in enumerate(scored)}
    report = {"periods": {}, "episodes": []}

    for name, start, end in PERIODS:
        days = [d for d in scored if start <= d.trading_date <= end]
        if not days:
            continue
        rows = lambda pick: [outcomes[d.trading_date] for d in days if pick(d)]  # noqa: E731
        years = (days[-1].trading_date - days[0].trading_date).days / 365.25 or 1
        events = [e for e in evaluation.events[1:] if start <= e.effective_date <= end]
        entries = [e for e in events if e.new == engine.ACCELERATION]
        followed = [
            e
            for e in entries
            if outcomes.get(e.effective_date, {}).get("dd_20", 0) <= DRAWDOWN_ALERT
        ]
        runs = _runs(days)
        period_eps = [
            ep for ep in episodes if start <= ep["crossed"] <= end and ep["crossed"] in index
        ]
        warned = []
        for ep in period_eps:
            i = index[ep["crossed"]]
            window = scored[max(0, i - LEAD_SESSIONS) : i + 1]
            first = next((d for d in window if d.stage in STRESS_STAGES), None)
            warned.append(first is not None)
        # Base rate: how often any 21-session window holds a stress stage at all.
        positions = [index[d.trading_date] for d in days]
        stressed = [
            any(x.stage in STRESS_STAGES for x in scored[max(0, i - LEAD_SESSIONS) : i + 1])
            for i in positions
        ]
        report["periods"][name] = {
            "first": days[0].trading_date,
            "last": days[-1].trading_date,
            "baseline": _summary(rows(lambda d: True)),
            "by_level": {
                level: _summary(rows(lambda d, level=level: d.level == level))
                for level in ("low", "moderate", "elevated", "high", "extreme")
            },
            "by_stage": {
                stage: _summary(rows(lambda d, stage=stage: d.stage == stage))
                for stage in engine.STAGES
            },
            "stage_changes_per_year": len(events) / years,
            "median_run": median(n for _, n in runs),
            "short_runs": sum(n <= 5 for _, n in runs) / len(runs),
            "acceleration_entries": len(entries),
            "acceleration_followed": len(followed),
            "episodes": len(period_eps),
            "episodes_warned": sum(warned),
            "windows_with_stress": sum(stressed) / len(stressed),
        }
    for ep in episodes:
        if ep["crossed"] not in index:
            continue
        i = index[ep["crossed"]]
        window = scored[max(0, i - LEAD_SESSIONS) : i + 1]
        first = next((d for d in window if d.stage in STRESS_STAGES), None)
        report["episodes"].append(
            {
                **ep,
                "stage_at_cross": scored[i].stage,
                "score_at_cross": scored[i].score,
                "first_stress_stage": first.trading_date if first else None,
                "lead_sessions": i - index[first.trading_date] if first else None,
            }
        )
    return report
