"""Repair one specific, mechanical model error: copying "1,270.38 billion" as "1,270.38 亿".

1 billion is 10 亿, so swapping the unit word alone shrinks the amount tenfold. The repair
is deterministic: when the answer states "<digits> 亿" (or 万 / 万亿) and some tool in the
same turn stated exactly those digits with an English scale word, the Chinese number is
rescaled so the amount equals what the tool said. Digits that differ are left alone: that
is a different figure, not a unit slip.
"""

import math
import re
from typing import Any

_NUMBER = r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?"
_EN_SCALES = {"trillion": 1e12, "tn": 1e12, "billion": 1e9, "bn": 1e9, "million": 1e6, "mn": 1e6}
_ZH_SCALES = {"万亿": 1e12, "萬億": 1e12, "亿": 1e8, "億": 1e8, "万": 1e4, "萬": 1e4}
_EN_FIGURE = re.compile(rf"(?P<num>{_NUMBER})\s?(?P<unit>trillion|billion|million|tn|bn|mn)\b", re.IGNORECASE)
_ZH_FIGURE = re.compile(rf"(?P<num>{_NUMBER})\s?(?P<unit>万亿|萬億|亿|億|万|萬)")
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


def fix_unit_slips(text: str, figures: dict[str, float]) -> tuple[str, list[dict[str, Any]]]:
    """The answer with unit slips rescaled, and one record per repair."""
    if not text or not figures:
        return text, []
    fixes: list[dict[str, Any]] = []

    def repair(match: re.Match) -> str:
        raw, unit = match.group("num"), match.group("unit")
        source_scale = figures.get(_digits(raw))
        target_scale = _ZH_SCALES[unit]
        if source_scale is None or source_scale == target_scale:
            return match.group(0)
        value = float(_digits(raw)) * source_scale
        decimals = len(raw.split(".")[1]) if "." in raw else 0
        # Keep the source's precision: 1,270.38 billion -> 12,703.8 亿 (one decimal fewer).
        shift = round(math.log10(source_scale / target_scale))
        fixed = f"{_render(value / target_scale, decimals - shift)} {unit}" if " " in match.group(0) \
            else f"{_render(value / target_scale, decimals - shift)}{unit}"
        fixes.append({"from": match.group(0), "to": fixed, "value": value})
        return fixed

    return _ZH_FIGURE.sub(repair, text), fixes
