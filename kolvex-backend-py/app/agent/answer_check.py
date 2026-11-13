"""Check the numbers an answer states against this turn's tool evidence.

A claim is `matched` when it equals an evidence value within the rounding its own
precision implies ("$46.7 billion" covers 46.65B to 46.75B), `mismatch` when it
looks like a miscopied evidence value (a wrong digit, a 1000x unit slip, or a nearby
growth rate), and `unverified` otherwise: this turn holds nothing to check it against.
Correct arithmetic on two evidence values (the increase between two periods, a ratio)
counts as matched: "an increase of 494.8 亿" is not a miscopied 467.43 亿.
Unverified is not wrong, so only mismatches are flagged to the reader.
"""

import math
import re

from app.agent.financial_evidence import words_match
from typing import Any, Iterable, Optional

CHECK_VERSION = 1
# Relative distance within which an unmatched claim reads as a copy error, not another figure.
NEAR = 0.2
CONTEXT_CHARS = 48
# Scale errors seen in real answers: billion as 亿 (10x), million as 亿 (100x), 1000x unit swaps.
_UNIT_SLIPS = tuple(f for k in (10, 100, 1e3, 1e4, 1e5, 1e6) for f in (k, 1 / k))

_SCALES = {
    "trillion": 1e12, "tn": 1e12, "t": 1e12, "万亿": 1e12,
    "billion": 1e9, "bn": 1e9, "b": 1e9,
    "million": 1e6, "mn": 1e6, "m": 1e6,
    "thousand": 1e3, "k": 1e3,
    "亿": 1e8, "万": 1e4, "億": 1e8, "萬": 1e4, "兆": 1e12, "萬億": 1e12,
}
_NUMBER = r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?"
_MONEY = re.compile(
    # "1 兆 460.9 亿" (Taiwan) states trillions and hundred-millions together.
    rf"(?P<cur>US\$|NT\$|\$|USD\s?)?(?:(?P<zhao>\d+)\s?兆\s?)?(?P<num>{_NUMBER})\s?"
    r"(?P<unit>trillion|billion|million|thousand|tn|bn|mn|万亿|萬億|亿|億|万|萬|兆|[TBMK](?![A-Za-z]))?"
    # "3.06 亿股" and "2 million shares" count shares, not money.
    r"(?!\s?(?:股|shares|share\b))",
    re.IGNORECASE,
)
_PERCENT = re.compile(rf"(?P<num>{_NUMBER})\s?[%％]")
_BOUND_BEFORE = re.compile(r"(超过|高于|低于|逾|近|above|over|below|under|more than|less than|nearly)\s*$", re.IGNORECASE)
_BOUND_AFTER = re.compile(r"\s*(以上|以下|左右|上下|\+)")
_DOWN = re.compile(r"(下降|下滑|减少|下跌|萎缩|负增长|declin\w*|fell|fall\w*|drop\w*|down|decrease\w*|shrank|[-−–])\s*(?:了|约|by|about|roughly)?\s*$", re.IGNORECASE)
_UP = re.compile(r"(增长|上升|增加|上涨|提升|grew|grow\w*|rose|ris\w*|up|increase\w*|gain\w*|\+)\s*(?:了|约|by|about|roughly)?\s*$", re.IGNORECASE)
# "45.2 倍" / "45.2x", or a named ratio followed by its value: "P/E 45.2", "市盈率约 45.2".
_MULTIPLE = re.compile(
    rf"(?P<num>{_NUMBER})\s?(?:倍|x|×)(?![A-Za-z])"
    rf"|(?:P/?E|P/?B|P/?S|PEG|EV/EBITDA|EV/(?:revenue|sales)|市盈率|市净率|市销率|put/call(?: volume)?(?: ratio)?"
    rf"|current ratio|quick ratio|流动比率|速动比率)\s*(?:ratio|为|是|of|约|at|is|:|：|~|～|\s)*(?P<num2>{_NUMBER})(?!\s?[%％])",
    re.IGNORECASE,
)
_REVENUE_WORDS = re.compile(r"revenue|sales|营收|收入|营业额", re.IGNORECASE)
_GROWTH_WORDS = re.compile(r"year[- ]over[- ]year|yoy|y/y|growth|grew|increase|同比|增长|增幅|上升|下降", re.IGNORECASE)


def _decimals(raw: str) -> int:
    return len(raw.split(".")[1]) if "." in raw else 0


def _close(claim: float, expected: float, half_step: float) -> bool:
    return abs(claim - expected) <= half_step + abs(expected) * 1e-9


def _claims(text: str) -> Iterable[dict[str, Any]]:
    taken: list[tuple[int, int]] = []
    for match in _PERCENT.finditer(text):
        raw = match.group("num")
        taken.append(match.span())
        # "超过 100%" / "50% 以上" / "over 50%" state a bound, not the figure itself.
        bound = bool(_BOUND_BEFORE.search(text[max(0, match.start() - 6):match.start()])
                     or _BOUND_AFTER.match(text[match.end():match.end() + 4]))
        yield {"kind": "percent", "span": match.span(), "value": float(raw.replace(",", "")),
               "half_step": 0.5 * 10 ** -_decimals(raw), "bound": bound,
               "sign": _direction(text[max(0, match.start() - 12):match.start()])}
    for match in _MULTIPLE.finditer(text):
        raw = match.group("num") or match.group("num2")
        span = match.span("num") if match.group("num") else match.span("num2")
        if any(start < span[1] and span[0] < end for start, end in taken):
            continue
        taken.append(span)
        yield {"kind": "multiple", "span": (span[0], match.end()) if match.group("num") else span,
               "value": float(raw.replace(",", "")), "half_step": 0.5 * 10 ** -_decimals(raw)}
    for match in _MONEY.finditer(text):
        cur, raw, unit = match.group("cur"), match.group("num"), match.group("unit")
        if not cur and not unit:
            continue  # bare numbers are years, quarters, counts
        if not cur and unit in ("万亿", "萬億", "亿", "億", "万", "萬", "兆") and not re.match(
                r"\s?(?:美元|元|新台币|新台幣|港元|人民币|日元|欧元|英镑)", text[match.end():]):
            continue  # "4.63 亿" alone is a count (shares, users), not money
        if any(start < match.end() and match.start() < end for start, end in taken):
            continue
        scale = _SCALES[unit.lower()] if unit else 1.0
        value = float(raw.replace(",", "")) * scale
        if match.group("zhao") and scale == 1e8:
            value += int(match.group("zhao")) * 1e12
        yield {"kind": "money", "span": match.span(), "value": value,
               "half_step": 0.5 * 10 ** -_decimals(raw) * scale}


def _expected(quotes: list[dict], revenues: list[dict],
              financials: Optional[list[dict]] = None) -> dict[str, list[dict]]:
    money, percent, multiple = [], [], []
    for quote in quotes:
        if isinstance(quote.get("price"), (int, float)):
            money.append({"value": float(quote["price"]), "source": "quote",
                          "label": f"{quote.get('symbol')} price"})
    for revenue in revenues:
        if isinstance(revenue.get("value"), (int, float)):
            money.append({"value": float(revenue["value"]), "source": "revenue",
                          "label": f"{revenue.get('symbol')} revenue, period ending {revenue.get('period_end')}"})
        usd = revenue.get("usd_value")
        if isinstance(usd, (int, float)) and math.isfinite(usd):
            money.append({"value": float(usd), "source": "revenue",
                          "label": f"{revenue.get('symbol')} revenue in USD at the {revenue.get('fx_date')} "
                                   f"rate, period ending {revenue.get('period_end')}"})
        pct = revenue.get("year_over_year_pct")
        if isinstance(pct, (int, float)) and math.isfinite(pct):
            percent.append({"value": float(pct), "source": "revenue_growth", "signed": True,
                            "label": f"{revenue.get('symbol')} revenue year over year, period ending {revenue.get('period_end')}"})
    for item in financials or []:
        signed = "growth" in item["label"]
        {"money": money, "percent": percent, "multiple": multiple}[item["kind"]].append({**item, "signed": signed})
    return {"money": money, "percent": percent, "multiple": multiple}


def _derived(claim: dict, amounts: list[dict]) -> Optional[dict]:
    """The evidence pair the claim is correct arithmetic on, if any: a difference for an
    amount, a growth rate (a/b - 1) or a share (a/b) for a percentage."""
    value = abs(claim["value"])
    for a in amounts:
        for b in amounts:
            if a is b or not b["value"]:
                continue
            if claim["kind"] == "percent":
                results = (abs(a["value"] / b["value"] - 1) * 100, a["value"] / b["value"] * 100)
            elif claim["kind"] == "multiple":
                results = (a["value"] / b["value"],)  # "NVDA 营收是 AMD 的 7.2 倍"
            else:
                results = (abs(a["value"] - b["value"]),)
            if any(_close(value, result, claim["half_step"]) for result in results):
                return {"value": results[0] if claim["kind"] != "percent" else value,
                        "label": f"derived from {a['label']} and {b['label']}"}
    return None


def _direction(before: str) -> Optional[int]:
    """-1 / +1 when the words right before a percentage say which way it went, else None."""
    if _DOWN.search(before):
        return -1
    if _UP.search(before):
        return 1
    return None


def _judge(claim: dict, candidates: list[dict], context: str,
           amounts: Optional[list[dict]] = None) -> tuple[str, Optional[dict]]:
    # Growth is often written without its sign ("fell 3%"), so percentages compare by size.
    value = abs(claim["value"]) if claim["kind"] == "percent" else claim["value"]
    for expected in candidates:
        target = abs(expected["value"]) if claim["kind"] == "percent" else expected["value"]
        if _close(value, target, claim["half_step"]):
            # Sizes are compared unsigned, so "fell 3%" can match -3; "rose 3%" must not.
            if claim["kind"] == "percent" and expected.get("signed") and claim.get("sign") and expected["value"] \
                    and claim["sign"] != (1 if expected["value"] > 0 else -1):
                return "mismatch", expected
            return "matched", expected
    # Only revenue figures share a unit and meaning; a price minus a revenue is not a derivation.
    if derived := _derived(claim, [a for a in amounts or [] if a["source"] == "revenue"]):
        return "matched", derived
    for expected in candidates:
        target = abs(expected["value"]) if claim["kind"] == "percent" else expected["value"]
        if not target:
            continue
        near = abs(value - target) / abs(target) <= NEAR and not claim.get("bound")
        if expected["source"] == "financials":
            # Only when the answer names this metric: "毛利率 72%" against a 73.3% gross margin.
            if not words_match(expected, context):
                continue
            if claim["kind"] == "money" and any(
                    _close(value * factor, target, claim["half_step"] * factor) for factor in _UNIT_SLIPS):
                return "mismatch", expected
            if near:
                return "near", expected
        elif claim["kind"] == "percent":
            if _GROWTH_WORDS.search(context) and near:
                return "near", expected
        elif expected["source"] == "revenue":
            if any(_close(value * factor, target, claim["half_step"] * factor) for factor in _UNIT_SLIPS):
                return "mismatch", expected
            if abs(value - target) / abs(target) <= NEAR and _REVENUE_WORDS.search(context):
                return "near", expected
    return "unverified", None


def check_answer(text: str, quotes: list[dict], revenues: list[dict],
                 financials: Optional[list[dict]] = None) -> Optional[dict[str, Any]]:
    """Per-claim verdicts for one assistant answer, or None when the turn has no evidence."""
    expected = _expected(quotes or [], revenues or [], financials)
    if not text or not any(expected.values()):
        return None
    judged = []
    for claim in _claims(text):
        start, end = claim["span"]
        context = text[max(0, start - CONTEXT_CHARS):end + CONTEXT_CHARS // 2]
        judged.append((claim, *_judge(claim, expected[claim["kind"]], context, expected["money"])))
    # A figure merely close to an evidence value is a miscopy only if the answer never states
    # that value correctly. Once "962.21 亿" is right, "1080 亿" nearby is the guidance, not a typo.
    stated = {match["label"] for _, status, match in judged if status == "matched" and match}
    claims = []
    for claim, status, match in judged:
        if status == "near":
            status, match = ("unverified", None) if match["label"] in stated else ("mismatch", match)
        start, end = claim["span"]
        row: dict[str, Any] = {"text": text[start:end].strip(), "kind": claim["kind"], "status": status}
        if match:
            row["expected"] = {"value": match["value"], "label": match["label"]}
        claims.append(row)
    claims.sort(key=lambda c: c["status"] != "mismatch")
    counts = {status: sum(1 for c in claims if c["status"] == status) for status in ("matched", "mismatch", "unverified")}
    return {"version": CHECK_VERSION, **counts, "claims": claims[:40]}


def revenue_claims(text: str) -> list[dict[str, Any]]:
    """Amounts stated as revenue and percentages stated as growth, whatever the evidence.

    Used where a turn should hold no such figure at all (the tool was off, failed, or the
    source has no comparable period): any claim found here was not read from a tool.
    """
    found = []
    for claim in _claims(text or ""):
        start, end = claim["span"]
        context = text[max(0, start - CONTEXT_CHARS):end + CONTEXT_CHARS // 2]
        if claim["kind"] == "multiple":
            continue  # a P/E is not a revenue figure
        words = _GROWTH_WORDS if claim["kind"] == "percent" else _REVENUE_WORDS
        if words.search(context):
            found.append({"text": text[start:end].strip(), "kind": claim["kind"], "value": claim["value"]})
    return found


def stated_numbers(text: str) -> list[dict[str, Any]]:
    """Every amount (with a currency or unit) and percentage the text states."""
    return [{"text": text[c["span"][0]:c["span"][1]].strip(), "kind": c["kind"], "value": c["value"]}
            for c in _claims(text or "")]
