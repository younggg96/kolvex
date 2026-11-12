"""Check the numbers an answer states against this turn's tool evidence.

A claim is `matched` when it equals an evidence value within the rounding its own
precision implies ("$46.7 billion" covers 46.65B to 46.75B), `mismatch` when it
looks like a miscopied evidence value (a wrong digit, a 1000x unit slip, or a nearby
growth rate), and `unverified` otherwise: this turn holds nothing to check it against.
Unverified is not wrong, so only mismatches are flagged to the reader.
"""

import math
import re
from typing import Any, Iterable, Optional

CHECK_VERSION = 1
# Relative distance within which an unmatched claim reads as a copy error, not another figure.
NEAR = 0.2
CONTEXT_CHARS = 48

_SCALES = {
    "trillion": 1e12, "tn": 1e12, "t": 1e12, "万亿": 1e12,
    "billion": 1e9, "bn": 1e9, "b": 1e9,
    "million": 1e6, "mn": 1e6, "m": 1e6,
    "thousand": 1e3, "k": 1e3,
    "亿": 1e8, "万": 1e4,
}
_NUMBER = r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?"
_MONEY = re.compile(
    rf"(?P<cur>US\$|\$|USD\s?)?(?P<num>{_NUMBER})\s?"
    r"(?P<unit>trillion|billion|million|thousand|tn|bn|mn|万亿|亿|万|[TBMK](?![A-Za-z]))?",
    re.IGNORECASE,
)
_PERCENT = re.compile(rf"(?P<num>{_NUMBER})\s?[%％]")
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
        yield {"kind": "percent", "span": match.span(), "value": float(raw.replace(",", "")),
               "half_step": 0.5 * 10 ** -_decimals(raw)}
    for match in _MONEY.finditer(text):
        cur, raw, unit = match.group("cur"), match.group("num"), match.group("unit")
        if not cur and not unit:
            continue  # bare numbers are years, quarters, counts
        if any(start < match.end() and match.start() < end for start, end in taken):
            continue
        scale = _SCALES[unit.lower()] if unit else 1.0
        yield {"kind": "money", "span": match.span(), "value": float(raw.replace(",", "")) * scale,
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


def _judge(claim: dict, candidates: list[dict], context: str) -> tuple[str, Optional[dict]]:
    # Growth is often written without its sign ("fell 3%"), so percentages compare by size.
    value = abs(claim["value"]) if claim["kind"] == "percent" else claim["value"]
    for expected in candidates:
        target = abs(expected["value"]) if claim["kind"] == "percent" else expected["value"]
        if _close(value, target, claim["half_step"]):
            return "matched", expected
    for expected in candidates:
        target = abs(expected["value"]) if claim["kind"] == "percent" else expected["value"]
        if not target:
            continue
        if claim["kind"] == "percent":
            if _GROWTH_WORDS.search(context) and abs(value - target) / abs(target) <= NEAR:
                return "mismatch", expected
        elif expected["source"] == "revenue":
            unit_slip = any(_close(value * factor, target, claim["half_step"] * factor) for factor in (1e3, 1e-3))
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
        status, match = _judge(claim, expected[claim["kind"]], context)
        row: dict[str, Any] = {"text": text[start:end].strip(), "kind": claim["kind"], "status": status}
        if match:
            row["expected"] = {"value": match["value"], "label": match["label"]}
        claims.append(row)
    claims.sort(key=lambda c: c["status"] != "mismatch")
    counts = {status: sum(1 for c in claims if c["status"] == status) for status in ("matched", "mismatch", "unverified")}
    return {"version": CHECK_VERSION, **counts, "claims": claims[:40]}
