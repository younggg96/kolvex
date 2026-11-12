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
               "half_step": 0.5 * 10 ** -_decimals(raw), "bound": bound}
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


def _expected(quotes: list[dict], revenues: list[dict]) -> dict[str, list[dict]]:
    money, percent = [], []
    for quote in quotes:
        if isinstance(quote.get("price"), (int, float)):
            money.append({"value": float(quote["price"]), "source": "quote",
                          "label": f"{quote.get('symbol')} price"})
    for revenue in revenues:
        if isinstance(revenue.get("value"), (int, float)):
            money.append({"value": float(revenue["value"]), "source": "revenue",
                          "label": f"{revenue.get('symbol')} revenue, period ending {revenue.get('period_end')}"})
        pct = revenue.get("year_over_year_pct")
        if isinstance(pct, (int, float)) and math.isfinite(pct):
            percent.append({"value": float(pct), "source": "revenue_growth",
                            "label": f"{revenue.get('symbol')} revenue year over year, period ending {revenue.get('period_end')}"})
    return {"money": money, "percent": percent}


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
            else:
                results = (abs(a["value"] - b["value"]),)
            if any(_close(value, result, claim["half_step"]) for result in results):
                return {"value": results[0] if claim["kind"] != "percent" else value,
                        "label": f"derived from {a['label']} and {b['label']}"}
    return None


def _judge(claim: dict, candidates: list[dict], context: str,
           amounts: Optional[list[dict]] = None) -> tuple[str, Optional[dict]]:
    # Growth is often written without its sign ("fell 3%"), so percentages compare by size.
    value = abs(claim["value"]) if claim["kind"] == "percent" else claim["value"]
    for expected in candidates:
        target = abs(expected["value"]) if claim["kind"] == "percent" else expected["value"]
        if _close(value, target, claim["half_step"]):
            return "matched", expected
    # Only revenue figures share a unit and meaning; a price minus a revenue is not a derivation.
    if derived := _derived(claim, [a for a in amounts or [] if a["source"] == "revenue"]):
        return "matched", derived
    for expected in candidates:
        target = abs(expected["value"]) if claim["kind"] == "percent" else expected["value"]
        if not target:
            continue
        if claim["kind"] == "percent":
            if _GROWTH_WORDS.search(context) and not claim.get("bound") \
                    and abs(value - target) / abs(target) <= NEAR:
                return "mismatch", expected
        elif expected["source"] == "revenue":
            unit_slip = any(_close(value * factor, target, claim["half_step"] * factor) for factor in _UNIT_SLIPS)
            near = abs(value - target) / abs(target) <= NEAR and _REVENUE_WORDS.search(context)
            if unit_slip or near:
                return "mismatch", expected
    return "unverified", None


def check_answer(text: str, quotes: list[dict], revenues: list[dict]) -> Optional[dict[str, Any]]:
    """Per-claim verdicts for one assistant answer, or None when the turn has no evidence."""
    expected = _expected(quotes or [], revenues or [])
    if not text or not (expected["money"] or expected["percent"]):
        return None
    claims = []
    for claim in _claims(text):
        start, end = claim["span"]
        context = text[max(0, start - CONTEXT_CHARS):end + CONTEXT_CHARS // 2]
        status, match = _judge(claim, expected[claim["kind"]], context, expected["money"])
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
        words = _GROWTH_WORDS if claim["kind"] == "percent" else _REVENUE_WORDS
        if words.search(context):
            found.append({"text": text[start:end].strip(), "kind": claim["kind"], "value": claim["value"]})
    return found


def stated_numbers(text: str) -> list[dict[str, Any]]:
    """Every amount (with a currency or unit) and percentage the text states."""
    return [{"text": text[c["span"][0]:c["span"][1]].strip(), "kind": c["kind"], "value": c["value"]}
            for c in _claims(text or "")]
