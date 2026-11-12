"""Repair one specific, mechanical model error: copying "1,270.38 billion" as "1,270.38 亿".

1 billion is 10 亿, so swapping the unit word alone shrinks the amount tenfold. The repair
is deterministic: when the answer states "<digits> 亿" (or 万 / 万亿) and some tool in the
same turn stated exactly those digits with an English scale word, the Chinese number is
rescaled so the amount equals what the tool said. Digits that differ are left alone: that
is a different figure, not a unit slip.

Two sources are trusted enough to rewrite against:
- structured tool data (SEC, Yahoo), and
- the answer itself: "1,046.09 亿（NT$1,046.09 billion）" or "3.81 万亿（3,809.05 亿元）"
  contradicts itself, whatever the source: a figure beside it equals the digits read as billions.
Web pages are not. They carry their own unit errors ("$346 billion" for a $34.6B quarter),
and a model that silently corrected one must not be "fixed" back to the error, nor flagged
for it: in a trial of 10 TSMC answers, web-only matches were mostly correct conversions.
"""

import math
import re
from typing import Any

_NUMBER = r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?"
_EN_SCALES = {"trillion": 1e12, "tn": 1e12, "billion": 1e9, "bn": 1e9, "million": 1e6, "mn": 1e6}
_ZH_SCALES = {"万亿": 1e12, "萬億": 1e12, "兆": 1e12, "亿": 1e8, "億": 1e8, "万": 1e4, "萬": 1e4}
_EN_FIGURE = re.compile(rf"(?P<num>{_NUMBER})\s?(?P<unit>trillion|billion|million|tn|bn|mn)\b", re.IGNORECASE)
_ZH_FIGURE = re.compile(rf"(?P<num>{_NUMBER})\s?(?P<unit>万亿|萬億|兆|亿|億|万|萬)")
# How far apart an amount and its restatement may sit: "3.81 万亿（3,809.05 亿元）".
NEARBY = 24
# A decimal-point shift is only assumed when this many significant digits line up.
_MIN_SHIFT_DIGITS = 4
# Three significant digits or more: "1.2 亿" matching some "1.2 billion" could be chance.
_MIN_DIGITS = 3


def _digits(raw: str) -> str:
    return raw.replace(",", "")


def scaled_figures(texts: list[str]) -> dict[str, float]:
    """{digits as written: scale} for every amount a tool stated with an English scale word."""
    found: dict[str, float] = {}
    for text in texts:
        for match in _EN_FIGURE.finditer(text or ""):
            digits = _digits(match.group("num"))
            if len(digits.replace(".", "").lstrip("0")) >= _MIN_DIGITS:
                found.setdefault(digits, _EN_SCALES[match.group("unit").lower()])
    return found


def _render(value: float, decimals: int) -> str:
    return f"{value:,.{max(decimals, 0)}f}"


# Tool outputs from these are pages written by others, not data: flag, never rewrite.
UNTRUSTED_TOOLS = {"web_search", "get_creator_opinions"}


def figures_by_trust(outputs: list[tuple[str, str]]) -> dict[str, dict[str, float]]:
    """{"trusted": ..., "web": ...} from (tool name, output text) pairs."""
    return {
        "trusted": scaled_figures([text for name, text in outputs if name not in UNTRUSTED_TOOLS]),
        "web": scaled_figures([text for name, text in outputs if name in UNTRUSTED_TOOLS]),
    }


def fix_unit_slips(text: str, figures: dict[str, Any],
                   values: tuple[float, ...] | list[float] = ()) -> tuple[str, list[dict[str, Any]]]:
    """The answer with unit slips rescaled, and one record per repair.

    `figures` is figures_by_trust() output; a flat {digits: scale} dict counts as trusted.
    Web figures are accepted and ignored, so callers need not split them out.
    `values` are trusted evidence amounts (SEC/Yahoo revenue): a Chinese amount whose digits
    equal one of them shifted by a power of ten ("4,674.3 亿" for 46,743,000,000) is that
    amount with its decimal point in the wrong place."""
    if not text:
        return text, []
    figures = figures or {}
    if "trusted" not in figures and "web" not in figures:
        figures = {"trusted": figures, "web": {}}
    # The answer's own English figures outrank everything: they are what it meant to say.
    trusted = {**(figures.get("trusted") or {}), **scaled_figures([text])}
    fixes: list[dict[str, Any]] = []

    # Every scaled amount in the answer, currency or not: "新台币 3.81 万亿（" names its currency first.
    amounts = []
    for pattern, scales in ((_ZH_FIGURE, _ZH_SCALES), (_EN_FIGURE, _EN_SCALES)):
        for m in pattern.finditer(text):
            raw, scale = m.group("num"), scales[m.group("unit").lower() if pattern is _EN_FIGURE else m.group("unit")]
            decimals = len(raw.split(".")[1]) if "." in raw else 0
            amounts.append({"span": m.span(), "value": float(_digits(raw)) * scale,
                            "half_step": 0.5 * 10 ** -decimals * scale})

    def restated_nearby(match: re.Match, scale: float) -> bool:
        """Another amount within a few characters equals these digits at `scale`."""
        value = float(_digits(match.group("num"))) * scale
        start, end = match.span()
        return any(
            c["span"][1] >= start - NEARBY and c["span"][0] <= end + NEARBY and c["span"] != match.span()
            and abs(c["value"] - value) <= c["half_step"] + abs(value) * 1e-9
            for c in amounts
        )

    def shifted_truth(match: re.Match) -> float | None:
        """A trusted or nearby amount equal to this one with the decimal point moved."""
        digits = _digits(match.group("num"))
        if len(digits.replace(".", "").strip("0")) < _MIN_SHIFT_DIGITS:
            return None
        decimals = len(digits.split(".")[1]) if "." in digits else 0
        stated = float(digits) * _ZH_SCALES[match.group("unit")]
        half = 0.5 * 10 ** -decimals * _ZH_SCALES[match.group("unit")]
        start, end = match.span()
        nearby = [c["value"] for c in amounts if c["span"] != match.span()
                  and c["span"][1] >= start - NEARBY and c["span"][0] <= end + NEARBY]
        candidates = [v for v in [*values, *nearby] if v and stated]
        if any(abs(v - stated) <= half + abs(stated) * 1e-9 for v in candidates):
            return None  # it already equals a trusted figure
        for v in candidates:
            k = round(math.log10(abs(v / stated)))
            if k and abs(k) <= 6 and abs(stated * 10 ** k - v) <= half * 10 ** k + abs(v) * 1e-9:
                return v
        return None

    def repair(match: re.Match) -> str:
        raw, unit = match.group("num"), match.group("unit")
        digits = _digits(raw)
        target_scale = _ZH_SCALES[unit]
        source_scale = trusted.get(digits)
        if source_scale is None and target_scale == 1e8 and restated_nearby(match, 1e9) \
                and not restated_nearby(match, 1e8):
            source_scale = 1e9
        if source_scale is None or source_scale == target_scale:
            truth = shifted_truth(match)
            if truth is None:
                return match.group(0)
            source_scale = truth / float(digits)
        value = float(_digits(raw)) * source_scale
        decimals = len(raw.split(".")[1]) if "." in raw else 0
        # Keep the source's precision: 1,270.38 billion -> 12,703.8 亿 (one decimal fewer).
        shift = round(math.log10(source_scale / target_scale))
        fixed = f"{_render(value / target_scale, decimals - shift)} {unit}" if " " in match.group(0) \
            else f"{_render(value / target_scale, decimals - shift)}{unit}"
        fixes.append({"from": match.group(0), "to": fixed, "value": value})
        return fixed

    return _ZH_FIGURE.sub(repair, text), fixes



def with_unit_fixes(check: dict[str, Any] | None, fixes: list[dict[str, Any]]) -> dict[str, Any]:
    """Record the repairs made to an answer next to its number check."""
    check = dict(check or {"version": 1, "matched": 0, "mismatch": 0, "unverified": 0, "claims": []})
    check["unit_fixes"] = fixes
    return check

