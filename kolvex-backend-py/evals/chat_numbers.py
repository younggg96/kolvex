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
from app.agent.financial_evidence import extract_financial_evidence
from app.agent.quote_evidence import extract_quote_evidence
from app.agent.revenue_evidence import extract_revenue_evidence
from app.agent.unit_fix import figures_by_trust, fix_unit_slips

DEFAULT_SKILLS = ["market", "fundamentals", "options", "news", "creators"]
RESULTS_DIR = Path(__file__).parent / "results"
THRESHOLDS = {
    "tool_accuracy": 0.9,         # share of runs that called the expected tool with the right arguments
    "mismatch_rate": 0.05,        # share of answers with at least one number that contradicts the evidence
    "fabrication_rate": 0.0,      # share of no-data runs that still state a revenue figure or growth rate
    "ungrounded_rate": 0.1,
    "disclosure_rate": 1.0,
    "route_accuracy": 0.9,        # share of ROUTE_CASES sent to the expected agent       # share of runs that tell the user a newer period exists only as a derived figure       # share of answers stating an amount or percentage no tool returned
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


def _q4_only_derived():
    """After a 10-K: the newest quarter (Q4) exists only as annual minus nine months.
    The latest directly reported quarter is Q3; calling it "the latest quarter" silently is wrong."""
    def derived(start, end, value):
        return {"start": start, "period": end, "revenue": value,
                "sources": {"revenue": {"derived": True, "filed": "2027-02-25", "source_url": _SOURCE}}}
    return patch("app.agent.tools.stock_tools.sec_client.financials", AsyncMock(return_value={
        "symbol": "NVDA", "currency": "USD", "quarterly": [
            derived("2026-10-26", "2027-01-31", 108_400_000_000),
            _quarter("2026-07-27", "2026-10-25", "2026-11-19", 103_100_000_000),
            _quarter("2026-04-27", "2026-07-26", "2026-08-27", 96_221_000_000),
            _quarter("2025-07-28", "2025-10-26", "2025-11-19", 57_006_000_000),
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
    # Regex the answer must match: a fact the user has to be told, not just a number.
    must_mention: Optional[str] = None
    # A tool other than get_reported_revenue that the case is about.
    must_tool: Optional[str] = None
    # Earlier turns as (role, text): a follow-up must carry the subject or period over.
    history: list[tuple[str, str]] = field(default_factory=list)
    # The symbol the turn's tool calls must use ("那 AMD 呢？" after an NVDA question).
    expect_symbol: Optional[str] = None


CASES = [
    Case("nvda_q_yoy", "NVDA 最新季度营收同比增长多少？", expect_yoy=True),
    Case("msft_q_yoy_en", "How much did Microsoft's revenue grow year over year last quarter?", expect_yoy=True),
    Case("aapl_annual", "What was Apple's total revenue for its most recent fiscal year?", expect_period="annual"),
    Case("amzn_q_amount", "亚马逊最近一个季度的营收是多少？"),
    # News off: the fixture's numbers are made up, so live web results would contradict them.
    Case("no_prior_year", "NVDA 最新季度营收同比增长多少？", expect_yoy=True, no_growth=True,
         skills=["market", "fundamentals"], scenario=_no_prior_year),
    # SEC down but other skills on: falling back to news or Yahoo is fine; figures must come from them.
    Case("q4_derived_only", "NVDA 最新季度营收是多少？", no_growth=False, skills=["market", "fundamentals"],
         scenario=_q4_only_derived, must_mention=r"2027-01-31|2027\s*年\s*1\s*月\s*31|January 31, 2027|Jan(?:uary)?\.? 31"),
    Case("nvda_valuation", "NVDA 现在的市盈率、毛利率和净利润率分别是多少？", expect_period=None,
         skills=["market", "fundamentals"], must_tool="get_stock_financials"),
    Case("followup_symbol", "那 AMD 呢？", expect_yoy=True, expect_symbol="AMD",
         history=[("user", "NVDA 最新季度营收同比增长多少？"), ("assistant", 'NVDA 最新季度（FY2027 Q2，截至 2026-07-26）营收 962.21 亿美元，同比增长 105.85%。来源：SEC 10-Q，申报日 2026-08-26。')]),
    Case("followup_period", "换成年度呢？", expect_period="annual", expect_symbol="NVDA",
         history=[("user", "NVDA 最新季度营收同比增长多少？"), ("assistant", 'NVDA 最新季度（FY2027 Q2，截至 2026-07-26）营收 962.21 亿美元，同比增长 105.85%。来源：SEC 10-Q，申报日 2026-08-26。')]),
    Case("sec_unavailable", "What was NVIDIA's revenue last quarter?", scenario=_sec_down),
    # Fundamentals and news both off: no tool in the turn can know revenue. With news on,
    # web_search is a real (if unchecked) source, so that is not a no-data turn.
    Case("skill_off", "NVDA 最新季度营收是多少？", expect_period=None, no_data=True, skills=["market"]),
    # Files 20-F/6-K, which the SEC parser does not read: revenue comes from the Yahoo fallback.
    Case("foreign_filer", "台积电 TSM 最新季度营收同比增长多少？", expect_yoy=True),
]


_TOOL_NUMBER = re.compile(
    rf"(?P<num>{_NUMBER})\s?(?P<unit>trillion|billion|million|thousand|万亿|萬億|亿|億|万|萬|兆)?", re.IGNORECASE)
# Taiwan filings write "1兆460億9千萬元" and "5,057億4千萬元".
_ZH_COMPOUND = re.compile(r"(?:(?P<zhao>\d+)兆)?(?P<yi>[\d,]+)億(?:(?P<qian>\d)千萬)?")


# "需要我再查……吗？" / "Would you like me to…" in the last lines: filler on a quick answer.
_CLOSING_OFFER = re.compile(r"需要我|如需|如果你(?:想|需要)|要不要我|是否需要|Would you like|Let me know|If you(?:'d)? (?:want|like)", re.IGNORECASE)


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


_APPROX = re.compile(r"(约|大约|近|逾|about|around|roughly|approximately|~|～)\s*(US)?\$?\s*$", re.IGNORECASE)


def _with_approx(answer: str, claims: list[dict]) -> list[dict]:
    """Mark claims hedged with "约 / about": "约 $228" for a 228.52 close is a fair reading."""
    out, cursor = [], 0
    for claim in claims:
        at = answer.find(claim["text"], cursor)
        if at >= 0:
            cursor = at
        out.append({**claim, "approx": at >= 0 and bool(_APPROX.search(answer[max(0, at - 8):at]))})
    return out


def _half_step(claim: dict) -> float:
    digits = re.search(_NUMBER, claim["text"]).group(0)
    base = float(digits.replace(",", ""))
    decimals = len(digits.split(".")[1]) if "." in digits else 0
    step = 0.5 * 10 ** -decimals * (claim["value"] / base if base else 1.0)
    return step * 2 if claim.get("approx") else step


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
            elif claim["kind"] == "multiple":
                candidates = (a / b,)
            else:
                candidates = tuple(abs(a - b) * f for f in (1, 1e3, 1e6, 1e8, 1e9))
            if any(abs(target - c) <= half + 1e-9 for c in candidates):
                return True
    return False


def score_run(case: Case, answer: str, tool_calls: list[dict], quotes: list[dict],
              revenues: list[dict], tool_outputs: Optional[list[str]] = None,
              financials: Optional[list[dict]] = None) -> dict[str, Any]:
    """Pure: everything a run is judged on, from its transcript."""
    revenue_calls = [c["args"] for c in tool_calls if c["name"] == "get_reported_revenue"
                     and (not case.expect_symbol or str(c["args"].get("symbol", "")).upper() == case.expect_symbol)]
    if case.must_tool:
        tool_ok = any(c["name"] == case.must_tool for c in tool_calls)
    elif case.expect_period is None:
        tool_ok = not revenue_calls
    else:
        # Asking for the comparison when only the amount was needed is harmless; the reverse is not.
        tool_ok = any(
            args.get("period", "quarterly") == case.expect_period
            and (bool(args.get("year_over_year")) or not case.expect_yoy)
            for args in revenue_calls
        )
    check = check_answer(answer, quotes, revenues, financials) or {"matched": 0, "mismatch": 0, "unverified": 0, "claims": []}
    # Earlier answers in the conversation are sources too: "NVDA 同期增速约 105.85%" in a follow-up.
    numbers = tool_numbers((tool_outputs or []) + [text for role, text in case.history if role == "assistant"])
    invented: list[dict] = []
    if case.no_data or case.no_growth:
        matched = {c["text"] for c in check["claims"] if c["status"] == "matched"}
        # A figure some tool returned (a market cap near the word 营收) was read, not invented.
        invented = [c for c in revenue_claims(answer)
                    if c["text"] not in matched and not grounded(c, numbers)
                    and (case.no_data or c["kind"] == "percent")]
    # Operands for derived figures: amounts the answer states (units applied) that a tool returned.
    operands = {c["value"] for c in stated_numbers(answer)
                if c["kind"] == "money" and grounded(c, numbers)}
    # Bare table cells ("478.83" under a "$bn" header) count too, as written.
    operands |= {n for n in tool_numbers([answer])
                 if grounded({"text": f"{n:g}", "kind": "money", "value": n}, numbers)}
    operands = sorted(operands)
    ungrounded = [c for c in _with_approx(answer, stated_numbers(answer))
                  if not grounded(c, numbers) and not derived(c, operands)]
    return {
        "tool_ok": tool_ok,
        "chars": len(answer),
        "closing_offer": bool(_CLOSING_OFFER.search(answer[-160:])),
        "disclosed": bool(re.search(case.must_mention, answer, re.IGNORECASE)) if case.must_mention else None,
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
    messages = [HumanMessage(content=text) if role == "user" else AIMessage(content=text)
                for role, text in case.history] + [HumanMessage(content=case.question)]
    provider, model = resolve_model_id(model_id)
    try:
        with case.scenario() if case.scenario else nullcontext():
            route = await _classify_intent(messages)
            routed_at = time.monotonic()
            agent = _create_agent_for_request(route, provider, model, ["web"], skills=case.skills)
            result = await agent.ainvoke({"messages": messages},
                                         config={"recursion_limit": MAX_TOOL_ITERATIONS * 3})
    except Exception as error:  # noqa: BLE001
        return {"error": f"{type(error).__name__}: {error}", "seconds": round(time.monotonic() - started, 1)}

    produced = result.get("messages", [])[len(messages):]
    usage = [m.usage_metadata or {} for m in produced if isinstance(m, AIMessage)]
    tool_calls = [{"name": c["name"], "args": c.get("args", {})}
                  for m in produced if isinstance(m, AIMessage) for c in (m.tool_calls or [])]
    quotes = [q.model_dump(mode="json") for m in produced if (q := extract_quote_evidence(m))]
    revenues = [r.model_dump(mode="json", exclude_none=True) for m in produced for r in extract_revenue_evidence(m)]
    answer = next((m.content for m in reversed(produced)
                   if isinstance(m, AIMessage) and m.content and not m.tool_calls), "")
    answer = answer if isinstance(answer, str) else json.dumps(answer, ensure_ascii=False)
    outputs = [str(m.content) for m in produced if isinstance(m, ToolMessage)]
    # The same repair the chat applies before saving, so the eval judges what users see.
    named = [(m.name or "", str(m.content)) for m in produced if isinstance(m, ToolMessage)]
    answer, unit_fixes = fix_unit_slips(answer, figures_by_trust(named), [r["value"] for r in revenues])
    tool_errors = [text[:200] for text in outputs if '"error"' in text]
    if not answer.strip():
        return {"error": "no final answer", "route": route, "tool_calls": tool_calls}
    return {"route": route, "tool_calls": tool_calls, "tool_errors": tool_errors, "answer": answer,
            "tool_outputs": [text[:20_000] for text in outputs],
            "unit_fixes": unit_fixes,
            "seconds": round(time.monotonic() - started, 1),
            "route_seconds": round(routed_at - started, 1),
            "input_tokens": sum(u.get("input_tokens", 0) for u in usage),
            "output_tokens": sum(u.get("output_tokens", 0) for u in usage),
            "model_calls": len(usage),
            **score_run(case, answer, tool_calls, quotes, revenues, outputs,
                        [item for m in produced for item in extract_financial_evidence(m)])}


def _median(values: list) -> Optional[float]:
    values = sorted(v for v in values if isinstance(v, (int, float)))
    return values[len(values) // 2] if values else None


# The router picks the quick-answer agent ("financial") or the long research agent.
# A wrong "research" costs a multi-minute report; a wrong "financial" a shallow answer.
ROUTE_CASES = [
    ("NVDA 最新季度营收同比增长多少？", "financial"),
    ("What's AAPL trading at?", "financial"),
    ("TSLA 市盈率多少", "financial"),
    ("亚马逊上季度营收是多少？", "financial"),
    ("那 AMD 呢？", "financial"),
    ("Compare MSFT and GOOGL gross margins", "financial"),
    ("给我做一份 NVDA 的深度研究报告", "research"),
    ("Should I buy TSLA right now? Give me the bull and bear case.", "research"),
    ("Deep dive into AAPL: valuation, risks, catalysts", "research"),
    ("帮我分析一下 AMD 值不值得长期持有", "research"),
    ("Run a trading analysis on MSFT", "research"),
    ("今天美股大盘怎么样？", "financial"),
    # No keyword decides these; they exercise the model router itself.
    ("NVDA 最近怎么样", "financial"),
    ("分析一下特斯拉最近的走势", "research"),
]


async def run_routing(runs: int) -> dict[str, Any]:
    from app.agent.graphs.supervisor import _classify_intent, route_by_keywords
    rows = []
    for attempt in range(runs):
        for question, expected in ROUTE_CASES:
            started = time.monotonic()
            got = await _classify_intent([HumanMessage(content=question)])
            rows.append({"question": question, "expected": expected, "got": got, "attempt": attempt,
                         "by_keywords": route_by_keywords(question) is not None,
                         "seconds": round(time.monotonic() - started, 2)})
    wrong = [r for r in rows if r["got"] != r["expected"]]
    return {"accuracy": round(1 - len(wrong) / len(rows), 3), "median_seconds": _median([r["seconds"] for r in rows]),
            "wrong": wrong}


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
            # Reported, not gated: shorter is better only while the other rates hold.
            "median_seconds": _median([r.get("seconds") for r in ok]),
            "median_input_tokens": _median([r.get("input_tokens") for r in ok]),
            "median_output_tokens": _median([r.get("output_tokens") for r in ok]),
            "median_chars": sorted(r.get("chars", 0) for r in ok)[len(ok) // 2] if ok else None,
            "closing_offer_rate": round(sum(bool(r.get("closing_offer")) for r in ok) / len(ok), 3) if ok else None,
            "disclosure_rate": round(sum(r["disclosed"] for r in told) / len(told), 3) if (
                told := [r for r in ok if r.get("disclosed") is not None]) else None,
        }
    overall = rates(runs)
    by_case: dict[str, list] = {}
    for run in runs:
        by_case.setdefault(run["case"], []).append(run)
    floors = ("tool_accuracy", "disclosure_rate", "route_accuracy")
    failed = [name for name, limit in THRESHOLDS.items() if overall.get(name) is not None and (
        overall[name] < limit if name in floors else overall[name] > limit)]
    return {"overall": overall, "by_case": {k: rates(v) for k, v in by_case.items()},
            "thresholds": THRESHOLDS, "failed": failed}


def compare(current: dict, baseline: dict) -> dict[str, Any]:
    keys = ("tool_accuracy", "mismatch_rate", "fabrication_rate", "ungrounded_rate", "disclosure_rate",
            "route_accuracy", "error_rate", "median_seconds", "median_input_tokens", "median_output_tokens",
            "median_chars", "closing_offer_rate")
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
        clean = "error" not in row and row["tool_ok"] and row.get("disclosed") is not False \
            and not (row["mismatch"] or row["invented"] or row["ungrounded"])
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
    if not args.case:
        report["routing"] = await run_routing(1)
        report["overall"]["route_accuracy"] = report["routing"]["accuracy"]
        if report["routing"]["accuracy"] < THRESHOLDS["route_accuracy"]:
            report["failed"].append("route_accuracy")
    if args.baseline:
        report["compared_with"] = {"file": str(args.baseline),
                                   **compare(report, json.loads(args.baseline.read_text()))}
    RESULTS_DIR.mkdir(exist_ok=True)
    out = RESULTS_DIR / f"{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str))
    print(json.dumps({k: report[k] for k in ("overall", "by_case", "failed")}
                     | ({"routing_wrong": report["routing"]["wrong"]} if "routing" in report else {})
                     | ({"compared_with": report["compared_with"]} if args.baseline else {}),
                     ensure_ascii=False, indent=2))
    print(f"\nFull transcripts: {out}", file=sys.stderr)
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
