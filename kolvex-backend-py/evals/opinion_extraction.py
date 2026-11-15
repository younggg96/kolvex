"""Opinion-extraction eval: given a transcript, does the extractor find each stock the creator
took a view on, read the direction correctly, keep price targets faithful, and avoid inventing
stocks or views?

The extractor is outside this repo (the AI client that writes the YouTube import JSON and sends
it through MCP validate_youtube_import). This eval does not call any model; it scores files the
extractor produced, so it works for any model or prompt and costs nothing to run.

    venv/bin/python -m evals.opinion_extraction inputs --out /tmp/opinion_inputs.json
    # Give the inputs to the extractor; save its output as {case_id: import payload} per run.
    venv/bin/python -m evals.opinion_extraction score run1.json run2.json run3.json
    venv/bin/python -m evals.opinion_extraction score run*.json --baseline evals/results/<earlier>.json

Each predictions file is one run. A value may be the full import payload (with "opinions"),
or just the list of opinions. Opinions are read the same way the import reads them, so an
answer the import would silently change (for example an unrecognised sentiment becoming
neutral) is scored as the import would store it and counted as a schema error.
Results land in evals/results/opinion_<UTC timestamp>.json; exit code 1 when a threshold is missed.
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.youtube_stock_opinions import (
    SENTIMENT_ALIASES,
    _ensure_list,
    _extract_opinions,
    _first_text,
    _normalize_sentiment,
    _normalize_ticker,
)

CASES_PATH = Path(__file__).parent / "opinion_cases.json"
RESULTS_DIR = Path(__file__).parent / "results"
DIRECTIONAL = {"bullish", "bearish", "mixed"}
TARGET_TOLERANCE = 0.005  # 850 vs 850.0 or 849.99 is the same target
_TICKER = re.compile(r"[A-Z0-9][A-Z0-9.\-]{0,19}")
_NUMBER = re.compile(r"\d+(?:,\d{3})*(?:\.\d+)?")

# (metric, "min" | "max", limit)
THRESHOLDS = {
    "ticker_recall": ("min", 0.9),  # expected stocks the extractor found
    "sentiment_accuracy": ("min", 0.85),  # found stocks whose direction is exactly right
    "flip_rate": ("max", 0.0),  # found stocks read as the opposite direction (bull <-> bear)
    "invented_rate": (
        "max",
        0.0,
    ),  # case runs that contain a stock the transcript gives no basis for
    "misread_rate": ("max", 0.0),  # mention-only stocks given a direction the creator never stated
    "target_recall": ("min", 0.8),  # expected price targets found
    "target_precision": ("min", 0.9),  # predicted targets that are the creator's real targets
    "ungrounded_target_rate": (
        "max",
        0.0,
    ),  # predicted targets whose number is not in the transcript
    "schema_error_rate": ("max", 0.0),  # opinions the import would reject or silently change
    "missing_rate": ("max", 0.0),  # case runs with no prediction at all
}


def load_cases(path: Path = CASES_PATH) -> List[Dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))["cases"]


def _numbers(text: str) -> List[float]:
    return [float(m.replace(",", "")) for m in _NUMBER.findall(text or "")]


def _same(a: float, b: float) -> bool:
    return abs(a - b) <= TARGET_TOLERANCE * max(abs(a), abs(b), 1)


def _target_values(raw: Any) -> List[Any]:
    """Price targets as the import stores them: dicts with value, bare numbers, or strings."""
    values = []
    for item in _ensure_list(raw):
        if isinstance(item, dict):
            item = next((item[k] for k in ("value", "price", "target") if k in item), None)
        if isinstance(item, str):
            found = _numbers(item)
            item = found[0] if found else None
        values.append(item)
    return values


def read_opinions(prediction: Any) -> List[Dict[str, Any]]:
    """Mirror YouTubeStockOpinionService's import parsing for the fields this eval scores."""
    payload = prediction if isinstance(prediction, dict) else {}
    raw = _extract_opinions(payload) if isinstance(prediction, dict) else prediction
    opinions = []
    for opinion in raw if isinstance(raw, list) else []:
        if not isinstance(opinion, dict):
            continue
        raw_sentiment = _first_text(opinion, payload, "sentiment", "stance", "rating", "action")
        opinions.append(
            {
                "ticker": _normalize_ticker(_first_text(opinion, payload, "ticker", "symbol")),
                "raw_sentiment": raw_sentiment,
                "sentiment": _normalize_sentiment(raw_sentiment),
                "summary": _first_text(opinion, payload, "summary", "view", "opinion"),
                "targets": _target_values(
                    opinion.get("price_targets") or opinion.get("price_target")
                ),
            }
        )
    return opinions


def _schema_errors(opinion: Dict[str, Any]) -> List[str]:
    errors = []
    if not opinion["ticker"] or not _TICKER.fullmatch(opinion["ticker"]):
        errors.append("ticker format")
    raw = (opinion["raw_sentiment"] or "").strip().lower()
    if raw not in SENTIMENT_ALIASES:
        errors.append(f"sentiment {opinion['raw_sentiment']!r} is stored as neutral")
    if not opinion["summary"]:
        errors.append("empty summary")
    for value in opinion["targets"]:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
            errors.append(f"price target {value!r} is not a positive number")
    return errors


def score_case(case: Dict[str, Any], prediction: Any) -> Dict[str, Any]:
    """Score one run of one case. prediction is None when the run has no entry for the case."""
    result = {
        "case": case["id"],
        "missing": prediction is None,
        "expected": len(case["expected"]),
        "found": [],
        "not_found": [],
        "wrong_sentiment": [],
        "flips": [],
        "invented": [],
        "misread": [],
        "mention_only": len(case.get("mentioned_only", [])),
        "targets_expected": sum(len(e.get("price_targets", [])) for e in case["expected"]),
        "targets_found": 0,
        "targets_predicted": 0,
        "targets_correct": 0,
        "wrong_targets": [],
        "ungrounded_targets": [],
        "opinions": 0,
        "schema_errors": [],
        "sentiments": {},
    }
    if prediction is None:
        result["not_found"] = [e["ticker"] for e in case["expected"]]
        return result

    expected = {e["ticker"]: e for e in case["expected"]}
    alias = {a: e["ticker"] for e in case["expected"] for a in e.get("accept", [])}
    mention_only = set(case.get("mentioned_only", []))
    transcript_numbers = _numbers(case["transcript"])
    seen = {}

    for opinion in read_opinions(prediction):
        result["opinions"] += 1
        for error in _schema_errors(opinion):
            result["schema_errors"].append(f"{opinion['ticker']}: {error}")
        ticker = alias.get(opinion["ticker"], opinion["ticker"])
        targets = [v for v in opinion["targets"] if isinstance(v, (int, float))]
        if ticker in expected:
            if ticker in seen:
                result["schema_errors"].append(f"{ticker}: duplicate opinion")
                continue
            seen[ticker] = opinion
            gold_targets = expected[ticker].get("price_targets", [])
            result["targets_predicted"] += len(targets)
            for value in targets:
                if any(_same(value, g) for g in gold_targets):
                    result["targets_correct"] += 1
                else:
                    result["wrong_targets"].append(f"{ticker} {value:g}")
                if not any(_same(value, n) for n in transcript_numbers):
                    result["ungrounded_targets"].append(f"{ticker} {value:g}")
        elif ticker in mention_only:
            if opinion["sentiment"] in DIRECTIONAL:
                result["misread"].append(f"{ticker} as {opinion['sentiment']}")
        else:
            result["invented"].append(f"{opinion['ticker']} ({opinion['sentiment']})")
            result["targets_predicted"] += len(targets)
            result["wrong_targets"] += [f"{opinion['ticker']} {v:g}" for v in targets]

    for ticker, gold in expected.items():
        opinion = seen.get(ticker)
        if not opinion:
            result["not_found"].append(ticker)
            continue
        result["found"].append(ticker)
        result["sentiments"][ticker] = opinion["sentiment"]
        if opinion["sentiment"] != gold["sentiment"]:
            result["wrong_sentiment"].append(
                f"{ticker}: {opinion['sentiment']} ≠ {gold['sentiment']}"
            )
            if {opinion["sentiment"], gold["sentiment"]} == {"bullish", "bearish"}:
                result["flips"].append(ticker)
        targets = [v for v in opinion["targets"] if isinstance(v, (int, float))]
        result["targets_found"] += sum(
            any(_same(v, g) for v in targets) for g in gold.get("price_targets", [])
        )
    return result


def _ratio(numerator: int, denominator: int) -> Optional[float]:
    return round(numerator / denominator, 4) if denominator else None


def summarize(results: List[Dict[str, Any]]) -> Dict[str, Optional[float]]:
    total = lambda key: sum(len(r[key]) if isinstance(r[key], list) else r[key] for r in results)  # noqa: E731
    found = total("found")
    return {
        "ticker_recall": _ratio(found, total("expected")),
        "sentiment_accuracy": _ratio(found - total("wrong_sentiment"), found),
        "flip_rate": _ratio(total("flips"), found),
        "invented_rate": _ratio(sum(bool(r["invented"]) for r in results), len(results)),
        "misread_rate": _ratio(total("misread"), total("mention_only")),
        "target_recall": _ratio(total("targets_found"), total("targets_expected")),
        "target_precision": _ratio(total("targets_correct"), total("targets_predicted")),
        "ungrounded_target_rate": _ratio(total("ungrounded_targets"), total("targets_predicted")),
        "schema_error_rate": _ratio(total("schema_errors"), total("opinions")),
        "missing_rate": _ratio(sum(r["missing"] for r in results), len(results)),
    }


def gate(metrics: Dict[str, Optional[float]]) -> List[str]:
    """Missed thresholds. A metric with no data (None) is skipped, not passed silently: it is listed."""
    failures = []
    for name, (direction, limit) in THRESHOLDS.items():
        value = metrics.get(name)
        if value is None:
            continue
        if (direction == "min" and value < limit) or (direction == "max" and value > limit):
            failures.append(f"{name} = {value} ({'≥' if direction == 'min' else '≤'} {limit})")
    return failures


def unstable(results: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    """Expected stocks whose direction changed between runs of the same case."""
    seen = defaultdict(set)
    for r in results:
        for ticker, sentiment in r["sentiments"].items():
            seen[(r["case"], ticker)].add(sentiment)
    return {f"{c}/{t}": sorted(s) for (c, t), s in seen.items() if len(s) > 1}


def score_runs(cases: List[Dict[str, Any]], runs: List[Dict[str, Any]]) -> Dict[str, Any]:
    results = [score_case(case, run.get(case["id"])) for run in runs for case in cases]
    metrics = summarize(results)
    return {
        "runs": len(runs),
        "cases": len(cases),
        "metrics": metrics,
        "failures": gate(metrics),
        "no_data": [name for name in THRESHOLDS if metrics.get(name) is None],
        "unstable": unstable(results),
        "results": results,
    }


_PROBLEM_KEYS = (
    "not_found",
    "wrong_sentiment",
    "invented",
    "misread",
    "wrong_targets",
    "ungrounded_targets",
    "schema_errors",
)


def report(scored: Dict[str, Any], baseline: Optional[Dict[str, Any]] = None) -> str:
    lines = [f"{scored['cases']} cases × {scored['runs']} runs"]
    old = (baseline or {}).get("metrics", {})
    for name, (direction, limit) in THRESHOLDS.items():
        value = scored["metrics"][name]
        mark = (
            "—"
            if value is None
            else ("✗" if any(f.startswith(name + " ") for f in scored["failures"]) else "✓")
        )
        delta = ""
        if value is not None and old.get(name) is not None:
            delta = f"  ({value - old[name]:+.4f} vs baseline)"
        shown = "no data" if value is None else value
        lines.append(f"  {mark} {name:<24} {shown}  [{direction} {limit}]{delta}")
    problems = defaultdict(list)
    for r in scored["results"]:
        if r["missing"]:
            problems[r["case"]].append("no prediction")
        for key in _PROBLEM_KEYS:
            problems[r["case"]] += [f"{key}: {item}" for item in r[key]]
    if problems:
        lines.append("Problems:")
        for case, items in problems.items():
            counts = defaultdict(int)
            for item in items:
                counts[item] += 1
            lines += [
                f"  {case}  {item}" + (f"  ×{n}" if n > 1 else "") for item, n in counts.items()
            ]
    if scored["unstable"]:
        lines.append("Direction changed between runs:")
        lines += [f"  {key}: {', '.join(values)}" for key, values in scored["unstable"].items()]
    lines.append("PASS" if not scored["failures"] else "FAIL: " + "; ".join(scored["failures"]))
    return "\n".join(lines)


def extractor_inputs(cases: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "instructions": [
            "For each case, extract the stock opinions the creator states in the transcript.",
            'Return one JSON object per run: {case_id: {"opinions": [...]}}, using the '
            "youtube_import opinion fields (ticker, sentiment, summary, price_targets, ...).",
            "Use the same prompt and model you use for real imports; that is what is being measured.",
            "The transcripts are synthetic evaluation text, not real creator statements. Never import them.",
        ],
        "cases": [{"id": c["id"], "transcript": c["transcript"]} for c in cases],
    }


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--cases", type=Path, default=CASES_PATH, help="Labelled cases file")
    commands = parser.add_subparsers(dest="command", required=True)
    inputs = commands.add_parser("inputs", help="Write the transcripts to give the extractor")
    inputs.add_argument("--out", type=Path, help="Output file (default: stdout)")
    score = commands.add_parser("score", help="Score one predictions file per run")
    score.add_argument("predictions", type=Path, nargs="+")
    score.add_argument("--baseline", type=Path, help="Earlier results file to compare with")
    score.add_argument("--no-save", action="store_true", help="Do not write a results file")
    args = parser.parse_args(argv)

    cases = load_cases(args.cases)
    if args.command == "inputs":
        text = json.dumps(extractor_inputs(cases), ensure_ascii=False, indent=2)
        if args.out:
            args.out.write_text(text + "\n", encoding="utf-8")
        else:
            print(text)
        return 0

    files = args.predictions + ([args.baseline] if args.baseline else [])
    missing = [str(p) for p in files if not p.is_file()]
    if missing:
        print(f"File not found: {', '.join(missing)}")
        print(
            "Predictions files come from your extractor; create them from the `inputs` output first."
        )
        return 2
    try:
        runs = [_load(path) for path in args.predictions]
    except json.JSONDecodeError as error:
        print(f"Not valid JSON: {error}")
        return 2
    bad = [str(p) for p, run in zip(args.predictions, runs) if not isinstance(run, dict)]
    if bad:
        print(f"Each predictions file must be a JSON object keyed by case id: {', '.join(bad)}")
        return 2
    unknown = sorted({key for run in runs for key in run} - {c["id"] for c in cases})
    scored = score_runs(cases, runs)
    print(report(scored, _load(args.baseline) if args.baseline else None))
    if unknown:
        print(f"Ignored unknown case ids: {', '.join(unknown)}")
    if not args.no_save:
        RESULTS_DIR.mkdir(exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        out = RESULTS_DIR / f"opinion_{stamp}.json"
        scored["predictions"] = [str(p) for p in args.predictions]
        out.write_text(json.dumps(scored, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Saved {out}")
    return 1 if scored["failures"] else 0


if __name__ == "__main__":
    sys.exit(main())
