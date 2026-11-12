"""Real-model eval: does the chat agent pick the right tool, copy numbers faithfully,
and refuse to invent figures when the data is missing?

    venv/bin/python -m evals.chat_numbers --runs 5 [--model claude-sonnet-...] [--case nvda_q_yoy]
    venv/bin/python -m evals.chat_numbers --runs 5 --baseline evals/results/<earlier>.json

Each case runs through the same router, tool selection and prompts as the web chat
(supervisor._classify_intent + _create_agent_for_request). Scenario cases replace the
SEC client with a fixture so the expected outcome never depends on the day it runs.
Results land in evals/results/<UTC timestamp>.json; the process exits 1 when a
threshold is missed, so it can gate a prompt or model change.
"""

import argparse
import asyncio
import json
import sys
import time
from contextlib import nullcontext
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional
from unittest.mock import AsyncMock, patch

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

import re

from app.agent.answer_check import _NUMBER, _SCALES, check_answer, revenue_claims, stated_numbers
from app.agent.quote_evidence import extract_quote_evidence
from app.agent.revenue_evidence import extract_revenue_evidence

DEFAULT_SKILLS = ["market", "fundamentals", "options", "news", "creators"]
RESULTS_DIR = Path(__file__).parent / "results"
THRESHOLDS = {
    "tool_accuracy": 0.9,         # share of runs that called the expected tool with the right arguments
    "mismatch_rate": 0.05,        # share of answers with at least one number that contradicts the evidence
    "fabrication_rate": 0.0,      # share of no-data runs that still state a revenue figure or growth rate
    "ungrounded_rate": 0.1,       # share of answers stating an amount or percentage no tool returned
    "error_rate": 0.1,            # share of runs that crashed or produced no answer
}
_SOURCE = "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000001/0001045810-26-000001-index.html"


def _quarter(start, end, filed, value):
    return {"start": start, "period": end, "revenue": value,
            "sources": {"revenue": {"derived": False, "filed": filed, "source_url": _SOURCE}}}


def _no_prior_year():
    """Two recent quarters and nothing a year earlier: growth must be reported as unavailable."""
    return patch("app.agent.tools.stock_tools.sec_client.financials", AsyncMock(return_value={
        "symbol": "NVDA", "currency": "USD", "quarterly": [
            _quarter("2026-04-27", "2026-07-26", "2026-08-27", 46_743_000_000),
            _quarter("2026-01-26", "2026-04-26", "2026-05-28", 44_062_000_000),
        ], "annual": [],
    }))


def _sec_down():
    from app.services.sec.client import SecUnavailable
    return patch("app.agent.tools.stock_tools.sec_client.financials",
                 AsyncMock(side_effect=SecUnavailable("fixture: SEC down")))


@dataclass
class Case:
    id: str
    question: str
    # Expected revenue tool call: None means the tool must not be called (it is unavailable).
    expect_period: Optional[str] = "quarterly"
    expect_yoy: bool = False
    # True when the turn cannot hold a real figure: any revenue amount or growth rate is invented.
    no_data: bool = False
    # When only growth is missing, amounts are real; only growth percentages count as invented.
    no_growth: bool = False
    skills: list[str] = field(default_factory=lambda: list(DEFAULT_SKILLS))
    scenario: Optional[Callable[[], Any]] = None


CASES = [
    Case("nvda_q_yoy", "NVDA 最新季度营收同比增长多少？", expect_yoy=True),
    Case("msft_q_yoy_en", "How much did Microsoft's revenue grow year over year last quarter?", expect_yoy=True),
    Case("aapl_annual", "What was Apple's total revenue for its most recent fiscal year?", expect_period="annual"),
    Case("amzn_q_amount", "亚马逊最近一个季度的营收是多少？"),
    # News off: the fixture's numbers are made up, so live web results would contradict them.
    Case("no_prior_year", "NVDA 最新季度营收同比增长多少？", expect_yoy=True, no_growth=True,
         skills=["market", "fundamentals"], scenario=_no_prior_year),
    # SEC down but other skills on: falling back to news or Yahoo is fine; figures must come from them.
    Case("sec_unavailable", "What was NVIDIA's revenue last quarter?", scenario=_sec_down),
    # Fundamentals and news both off: no tool in the turn can know revenue. With news on,
    # web_search is a real (if unchecked) source, so that is not a no-data turn.
    Case("skill_off", "NVDA 最新季度营收是多少？", expect_period=None, no_data=True, skills=["market"]),
    # Files 20-F/6-K, which the SEC parser does not read: the SEC tool has no quarter to return.
    Case("foreign_filer", "台积电 TSM 最新季度营收同比增长多少？", expect_yoy=True),
]


_TOOL_NUMBER = re.compile(
    rf"(?P<num>{_NUMBER})\s?(?P<unit>trillion|billion|million|thousand|万亿|萬億|亿|億|万|萬|兆)?", re.IGNORECASE)
# Taiwan filings write "1兆460億9千萬元" and "5,057億4千萬元".
_ZH_COMPOUND = re.compile(r"(?:(?P<zhao>\d+)兆)?(?P<yi>[\d,]+)億(?:(?P<qian>\d)千萬)?")


def tool_numbers(tool_outputs: list[str]) -> list[float]:
    """Every number a tool returned, as written and with its stated unit applied."""
    values = []
    for text in tool_outputs:
        for match in _TOOL_NUMBER.finditer(text or ""):
            raw = float(match.group("num").replace(",", ""))
            values.append(raw)
            if match.group("unit"):
                values.append(raw * _SCALES[match.group("unit").lower()])
        for match in _ZH_COMPOUND.finditer(text or ""):
            values.append(int(match.group("zhao") or 0) * 1e12 + int(match.group("yi").replace(",", "")) * 1e8
                          + int(match.group("qian") or 0) * 1e7)
    return values


def _half_step(claim: dict) -> float:
    digits = re.search(_NUMBER, claim["text"]).group(0)
    base = float(digits.replace(",", ""))
    decimals = len(digits.split(".")[1]) if "." in digits else 0
    return 0.5 * 10 ** -decimals * (claim["value"] / base if base else 1.0)


def grounded(claim: dict, numbers: list[float]) -> bool:
    """True when the claim restates some tool number, at the claim's own precision, in
    either direction of scale ("$92.28B" vs 92283000000, or a bare "478.83" vs 478830000000).
    Lenient on purpose (a stray "18" in a tool grounds "18%"), so ungrounded claims are certain."""
    value, half = abs(claim["value"]), _half_step(claim)
    if claim["kind"] == "percent":
        return any(abs(value - abs(n) * f) <= half + 1e-9 for n in numbers for f in (1, 100))
    # A tool number is never scaled by 1e8: that is exactly how "40.2 billion" becomes "40.2 亿".
    # A bare figure in an answer table may be in 亿, so scaling the claim up by 1e8 is allowed.
    return any(abs(value - abs(n) * f) <= half + 1e-9 for n in numbers for f in (1, 1e3, 1e6, 1e9, 1e12)) or \
        any(abs(value * f - abs(n)) <= half * f + 1e-9 for n in numbers for f in (1e3, 1e6, 1e8, 1e9, 1e12))


def derived(claim: dict, operands: list[float]) -> bool:
    """True when the claim is correct arithmetic on two figures the answer itself states:
    a growth rate (a/b - 1), a share (a/b) or a difference (a - b)."""
    half, target = _half_step(claim), abs(claim["value"])
    for a in operands:
        for b in operands:
            if a == b or not b:
                continue
            if claim["kind"] == "percent":
                candidates = (abs(a / b - 1) * 100, a / b * 100)
            else:
                candidates = tuple(abs(a - b) * f for f in (1, 1e3, 1e6, 1e8, 1e9))
            if any(abs(target - c) <= half + 1e-9 for c in candidates):
                return True
    return False


def score_run(case: Case, answer: str, tool_calls: list[dict], quotes: list[dict],
              revenues: list[dict], tool_outputs: Optional[list[str]] = None) -> dict[str, Any]:
    """Pure: everything a run is judged on, from its transcript."""
    revenue_calls = [c["args"] for c in tool_calls if c["name"] == "get_reported_revenue"]
    if case.expect_period is None:
        tool_ok = not revenue_calls
    else:
        # Asking for the comparison when only the amount was needed is harmless; the reverse is not.
        tool_ok = any(
            args.get("period", "quarterly") == case.expect_period
            and (bool(args.get("year_over_year")) or not case.expect_yoy)
            for args in revenue_calls
        )
    check = check_answer(answer, quotes, revenues) or {"matched": 0, "mismatch": 0, "unverified": 0, "claims": []}
    invented: list[dict] = []
    if case.no_data or case.no_growth:
        matched = {c["text"] for c in check["claims"] if c["status"] == "matched"}
        invented = [c for c in revenue_claims(answer)
                    if c["text"] not in matched and (case.no_data or c["kind"] == "percent")]
    numbers = tool_numbers(tool_outputs or [])
    # Operands for derived figures: amounts the answer states (units applied) that a tool returned.
    operands = {c["value"] for c in stated_numbers(answer)
                if c["kind"] == "money" and grounded(c, numbers)}
    # Bare table cells ("478.83" under a "$bn" header) count too, as written.
    operands |= {n for n in tool_numbers([answer])
                 if grounded({"text": f"{n:g}", "kind": "money", "value": n}, numbers)}
    operands = sorted(operands)
    ungrounded = [c for c in stated_numbers(answer)
                  if not grounded(c, numbers) and not derived(c, operands)]
    return {
        "tool_ok": tool_ok,
        "ungrounded": ungrounded,
        "revenue_calls": revenue_calls,
        "matched": check["matched"],
        "mismatch": check["mismatch"],
        "mismatches": [c for c in check["claims"] if c["status"] == "mismatch"],
        "invented": invented,
    }


async def run_case(case: Case, model_id: Optional[str]) -> dict[str, Any]:
    from app.agent.config import MAX_TOOL_ITERATIONS
    from app.agent.graphs.supervisor import _classify_intent, _create_agent_for_request
    from app.agent.llm import resolve_model_id

    started = time.monotonic()
    messages = [HumanMessage(content=case.question)]
    provider, model = resolve_model_id(model_id)
    try:
        with case.scenario() if case.scenario else nullcontext():
            route = await _classify_intent(messages)
            agent = _create_agent_for_request(route, provider, model, ["web"], skills=case.skills)
            result = await agent.ainvoke({"messages": messages},
                                         config={"recursion_limit": MAX_TOOL_ITERATIONS * 3})
    except Exception as error:  # noqa: BLE001
        return {"error": f"{type(error).__name__}: {error}", "seconds": round(time.monotonic() - started, 1)}

    produced = result.get("messages", [])[len(messages):]
    tool_calls = [{"name": c["name"], "args": c.get("args", {})}
                  for m in produced if isinstance(m, AIMessage) for c in (m.tool_calls or [])]
    quotes = [q.model_dump(mode="json") for m in produced if (q := extract_quote_evidence(m))]
    revenues = [r.model_dump(mode="json", exclude_none=True) for m in produced for r in extract_revenue_evidence(m)]
    answer = next((m.content for m in reversed(produced)
                   if isinstance(m, AIMessage) and m.content and not m.tool_calls), "")
    answer = answer if isinstance(answer, str) else json.dumps(answer, ensure_ascii=False)
    outputs = [str(m.content) for m in produced if isinstance(m, ToolMessage)]
    tool_errors = [text[:200] for text in outputs if '"error"' in text]
    if not answer.strip():
        return {"error": "no final answer", "route": route, "tool_calls": tool_calls}
    return {"route": route, "tool_calls": tool_calls, "tool_errors": tool_errors, "answer": answer,
            "tool_outputs": [text[:20_000] for text in outputs],
            "seconds": round(time.monotonic() - started, 1),
            **score_run(case, answer, tool_calls, quotes, revenues, outputs)}


def summarize(runs: list[dict]) -> dict[str, Any]:
    """Rates over all runs, plus per case. Pure, so the gate is testable without a model."""
    def rates(rows):
        ok = [r for r in rows if "error" not in r]
        no_data = [r for r in ok if r["no_data_case"]]
        return {
            "runs": len(rows),
            "error_rate": round(1 - len(ok) / len(rows), 3) if rows else None,
            "tool_accuracy": round(sum(r["tool_ok"] for r in ok) / len(ok), 3) if ok else None,
            "mismatch_rate": round(sum(r["mismatch"] > 0 for r in ok) / len(ok), 3) if ok else None,
            "fabrication_rate": round(sum(bool(r["invented"]) for r in no_data) / len(no_data), 3) if no_data else None,
            "ungrounded_rate": round(sum(bool(r.get("ungrounded")) for r in ok) / len(ok), 3) if ok else None,
        }
    overall = rates(runs)
    by_case: dict[str, list] = {}
    for run in runs:
        by_case.setdefault(run["case"], []).append(run)
    failed = [name for name, limit in THRESHOLDS.items() if overall[name] is not None and (
        overall[name] < limit if name == "tool_accuracy" else overall[name] > limit)]
    return {"overall": overall, "by_case": {k: rates(v) for k, v in by_case.items()},
            "thresholds": THRESHOLDS, "failed": failed}


def compare(current: dict, baseline: dict) -> dict[str, Any]:
    keys = ("tool_accuracy", "mismatch_rate", "fabrication_rate", "ungrounded_rate", "error_rate")
    return {k: {"baseline": baseline["overall"].get(k), "current": current["overall"].get(k)} for k in keys}


async def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--model", help="Chat model id as the web client sends it; default is the server default")
    parser.add_argument("--case", action="append", help="Run only these case ids")
    parser.add_argument("--baseline", type=Path, help="Earlier results file to compare with")
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--rescore", type=Path, help="Re-judge a saved results file without calling the model")
    args = parser.parse_args(argv)

    if args.rescore:
        saved = json.loads(args.rescore.read_text())
        by_id = {c.id: c for c in CASES}
        runs = []
        for run in saved["runs"]:
            if "error" not in run and run["case"] in by_id:
                outputs = run.get("tool_outputs", [])
                # Rebuild the evidence the same way the chat does, from the saved tool outputs.
                revenues = [r.model_dump(mode="json", exclude_none=True) for text in outputs
                            for r in extract_revenue_evidence(ToolMessage(
                                content=text, name="get_reported_revenue", tool_call_id="rescore"))]
                run.update(score_run(by_id[run["case"]], run["answer"], run["tool_calls"], [],
                                     revenues, outputs))
            runs.append(run)
        print(json.dumps(summarize(runs), ensure_ascii=False, indent=2))
        return 0

    cases = [c for c in CASES if not args.case or c.id in args.case]
    if not cases:
        parser.error(f"unknown case; choose from {[c.id for c in CASES]}")
    gate = asyncio.Semaphore(args.concurrency)

    async def one(case: Case, attempt: int) -> dict:
        async with gate:
            row = await run_case(case, args.model)
        row.update(case=case.id, attempt=attempt, no_data_case=case.no_data or case.no_growth)
        clean = "error" not in row and row["tool_ok"] and not (row["mismatch"] or row["invented"] or row["ungrounded"])
        mark = "ERR" if "error" in row else ("ok " if clean else "BAD")
        print(f"{mark} {case.id} #{attempt}", file=sys.stderr)
        return row

    # Scenario cases patch a shared client, so they run one at a time after the live cases.
    live = [one(c, i) for c in cases if not c.scenario for i in range(args.runs)]
    runs = list(await asyncio.gather(*live))
    for case in (c for c in cases if c.scenario):
        for i in range(args.runs):
            runs.append(await one(case, i))

    report = {"created_at": datetime.now(timezone.utc).isoformat(), "model": args.model or "server default",
              **summarize(runs), "runs": runs}
    if args.baseline:
        report["compared_with"] = {"file": str(args.baseline),
                                   **compare(report, json.loads(args.baseline.read_text()))}
    RESULTS_DIR.mkdir(exist_ok=True)
    out = RESULTS_DIR / f"{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str))
    print(json.dumps({k: report[k] for k in ("overall", "by_case", "failed")}
                     | ({"compared_with": report["compared_with"]} if args.baseline else {}),
                     ensure_ascii=False, indent=2))
    print(f"\nFull transcripts: {out}", file=sys.stderr)
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
