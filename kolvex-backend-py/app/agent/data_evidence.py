"""Checkable figures from the macro, valuation, 13F and options-flow tools.

Same evidence shape as financial_evidence.py (value, kind, label, the words that name the metric), so
answer_check calls a nearby number a miscopy only when the answer is talking about that metric.
Earlier readings (previous values, recent history) are evidence too: "前值 2.9%" is not a miscopied 2.7%.
"""

import re
from typing import Any, Callable, Optional

_PCT_WORDS = {
    "cpi": r"CPI|通胀|inflation",
    "pce": r"PCE",
    "unemployment": r"失业率|unemployment",
    "gdp": r"GDP",
    "2y": r"2\s*年|2-year|two-year|2Y",
    "10y": r"10\s*年|10-year|ten-year|10Y",
    "30y": r"30\s*年|30-year|thirty-year|30Y",
    "spread": r"利差|spread",
}


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    return value if value == value and abs(value) != float("inf") else None


def _item(value: Any, kind: str, label: str, words: str, signed: bool = False) -> Optional[dict]:
    number = _number(value)
    if number is None:
        return None
    return {
        "value": number,
        "kind": kind,
        "source": "financials",
        "label": label,
        "words": words,
        "signed": signed,
    }


def _macro_words(indicator: dict) -> str:
    text = " ".join(str(indicator.get(k) or "") for k in ("id", "name_en", "name_zh")).lower()
    words = [w for key, w in _PCT_WORDS.items() if key in text]
    names = [str(indicator.get(k)) for k in ("name_zh", "name_en") if indicator.get(k)]
    return "|".join(words + [re.escape(n) for n in names]) or r"(?!)"


def macro(data: dict) -> list[dict]:
    items = []
    for ind in data.get("indicators") or []:
        if not isinstance(ind, dict) or ind.get("unit") != "%":
            continue  # Payrolls in thousands, index levels: no unit the answer check reads.
        name, words = ind.get("name_en") or ind.get("id"), _macro_words(ind)
        items.append(
            _item(ind.get("value"), "percent", f"{name} {ind.get('period')} (macro)", words)
        )
        items.append(
            _item(
                ind.get("previous_value"),
                "percent",
                f"{name} {ind.get('previous_period')} (macro)",
                words,
            )
        )
        for point in ind.get("recent") or []:
            value = point.get("value") if isinstance(point, dict) else point
            when = point.get("period") or point.get("date") if isinstance(point, dict) else ""
            items.append(_item(value, "percent", f"{name} {when} (macro history)", words))
    return items


def valuation(data: dict) -> list[dict]:
    symbol = str(data.get("symbol") or "").upper()
    reference = r"参考|reference|保守|中性|乐观|基准|conservative|base|optimistic"
    items = [
        _item(
            data.get("current_pe"), "multiple", f"{symbol} current P/E (valuation)", r"P/?E|市盈率"
        ),
        _item(
            data.get("ttm_diluted_eps"),
            "money",
            f"{symbol} TTM diluted EPS (valuation)",
            r"EPS|每股收益",
        ),
        _item(
            data.get("price"),
            "money",
            f"{symbol} price on {data.get('price_date')} (valuation)",
            r"价|price|close|收盘",
        ),
        _item(
            (data.get("pe_reference") or {}).get("current_pe_percentile_pct"),
            "percent",
            f"{symbol} P/E percentile (valuation)",
            r"分位|percentile",
        ),
    ]
    for edge in ("low", "high"):
        items.append(
            _item(
                (data.get("past_year_pe_range") or {}).get(edge),
                "multiple",
                f"{symbol} past-year P/E {edge} (valuation)",
                r"P/?E|市盈率|区间|range",
            )
        )
    for s in data.get("scenarios") or []:
        name = s.get("name")
        items += [
            _item(
                s.get("target_pe"),
                "multiple",
                f"{symbol} {name} P/E (valuation)",
                r"P/?E|市盈率|" + reference,
            ),
            _item(
                s.get("reference_value"),
                "money",
                f"{symbol} {name} reference value (valuation)",
                reference,
            ),
            _item(
                s.get("premium_discount_pct"),
                "percent",
                f"{symbol} distance to {name} value (valuation)",
                r"溢价|折价|高出|低于|premium|discount|above|below|距离",
            ),
        ]
    return items


_WEIGHT = r"权重|占比|仓位|weight|portfolio"
_CHANGE = r"减持|增持|加仓|减仓|变化|变动|reduc|increas|chang|cut|add"
_VALUE = r"市值|价值|持仓|value|worth|stake"


def _holding_items(owner: str, h: dict) -> list[dict]:
    ticker = h.get("ticker") or ""
    who = f"{owner} {ticker}".strip()
    return [
        _item(h.get("portfolio_weight_pct"), "percent", f"{who} portfolio weight (13F)", _WEIGHT),
        _item(
            h.get("change_percent"),
            "percent",
            f"{who} change in shares (13F)",
            _CHANGE,
            signed=True,
        ),
        _item(h.get("value_usd"), "money", f"{who} position value (13F)", _VALUE),
    ]


def superinvestor(data: dict) -> list[dict]:
    owner = str(data.get("manager") or "")
    items = []
    for key in ("top_holdings", "new", "increased", "reduced", "exited"):
        for h in data.get(key) or []:
            if isinstance(h, dict):
                items += _holding_items(owner, h)
    return items


def holders(data: dict) -> list[dict]:
    ticker = str(data.get("ticker") or "")
    return [
        i
        for h in data.get("holders") or []
        if isinstance(h, dict)
        for i in _holding_items(str(h.get("manager") or ""), {**h, "ticker": ticker})
    ]


def options_activity(data: dict) -> list[dict]:
    """Every premium figure in the run (market totals, most active tickers, one ticker's activity)."""
    items: list = []

    def walk(node: Any, where: str) -> None:
        if isinstance(node, dict):
            name = node.get("symbol") or node.get("ticker") or node.get("underlying") or where
            for key, value in node.items():
                if "premium" in key and _number(value) is not None:
                    items.append(
                        _item(
                            abs(value),
                            "money",
                            f"{name} {key} (options activity {data.get('data_date')})",
                            r"权利金|premium|期权|options|call|put|看涨|看跌",
                        )
                    )
                elif isinstance(value, (dict, list)):
                    walk(value, name)
        elif isinstance(node, list):
            for child in node:
                walk(child, where)

    walk(data, "market")
    return items


EXTRACTORS: dict[str, Callable[[dict], list]] = {
    "get_macro_indicators": macro,
    "get_valuation": valuation,
    "get_superinvestor_portfolio": superinvestor,
    "get_institutional_holders": holders,
    "get_options_activity": options_activity,
}


def extract(name: str, data: dict) -> list[dict[str, Any]]:
    extractor = EXTRACTORS.get(name)
    return [i for i in extractor(data) if i] if extractor else []
