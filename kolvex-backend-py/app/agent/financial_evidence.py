"""Checkable figures from get_stock_financials and the options summary.

Each figure becomes an evidence item for answer_check: a value, its kind (percent, multiple,
money), a readable label, and the words that name it, so a nearby but different number is
only called a miscopy when the answer is talking about that metric.
Yahoo reports margins and growth as fractions (0.733); answers state them as 73.3%.
"""

import json
import math
import re
from typing import Any

from langchain_core.messages import ToolMessage

# field: (label, kind, words naming it). Percent fields are fractions in Yahoo's data.
_FINANCIAL_FIELDS: dict[str, tuple[str, str, str]] = {
    "gross_margins": ("gross margin", "percent", r"gross margin|毛利率"),
    "operating_margins": ("operating margin", "percent", r"operating margin|营业利润率|营业利益率|经营利润率"),
    "profit_margins": ("net margin", "percent", r"net margin|profit margin|净利率|净利润率"),
    "ebitda_margins": ("EBITDA margin", "percent", r"EBITDA margin|EBITDA 利润率|EBITDA利润率"),
    "return_on_equity": ("return on equity", "percent", r"return on equity|ROE|净资产收益率"),
    "return_on_assets": ("return on assets", "percent", r"return on assets|ROA|资产收益率"),
    "revenue_growth": ("revenue growth", "percent", r"revenue growth|营收增长|收入增长|营收同比"),
    "earnings_growth": ("earnings growth", "percent", r"earnings growth|盈利增长|利润增长|EPS 增长"),
    "pe_ratio": ("trailing P/E", "multiple", r"P/?E|市盈率"),
    "forward_pe": ("forward P/E", "multiple", r"forward P/?E|远期市盈率|预期市盈率"),
    "peg_ratio": ("PEG", "multiple", r"PEG"),
    "price_to_book": ("price to book", "multiple", r"P/?B|price[- ]to[- ]book|市净率"),
    "price_to_sales": ("price to sales", "multiple", r"P/?S|price[- ]to[- ]sales|市销率"),
    "ev_to_revenue": ("EV/revenue", "multiple", r"EV/(?:revenue|sales)"),
    "ev_to_ebitda": ("EV/EBITDA", "multiple", r"EV/EBITDA"),
    "current_ratio": ("current ratio", "multiple", r"current ratio|流动比率"),
    "quick_ratio": ("quick ratio", "multiple", r"quick ratio|速动比率"),
    "total_revenue": ("TTM revenue", "money", r"revenue|营收|收入"),
    "gross_profits": ("gross profit", "money", r"gross profit|毛利"),
    "ebitda": ("EBITDA", "money", r"EBITDA"),
    "net_income": ("net income", "money", r"net income|净利润|净利"),
    "total_cash": ("cash", "money", r"cash|现金"),
    "total_debt": ("debt", "money", r"debt|债务|负债"),
    "free_cash_flow": ("free cash flow", "money", r"free cash flow|自由现金流|FCF"),
    "operating_cash_flow": ("operating cash flow", "money", r"operating cash flow|经营现金流"),
    "eps_trailing": ("trailing EPS", "money", r"EPS|每股收益"),
    "eps_forward": ("forward EPS", "money", r"EPS|每股收益"),
    "book_value": ("book value per share", "money", r"book value|每股净资产"),
}
_OPTIONS_FIELDS: dict[str, tuple[str, str, str]] = {
    "put_call_volume_ratio": ("put/call volume ratio", "multiple", r"put/call|put-call|看跌/看涨|认沽/认购|PCR"),
}


def _number(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) \
        and math.isfinite(value) else None


def extract_financial_evidence(output: object) -> list[dict[str, Any]]:
    """Evidence items from a successful get_stock_financials or options summary result."""
    if not isinstance(output, ToolMessage) or output.status != "success" or not isinstance(output.content, str):
        return []
    fields = {"get_stock_financials": _FINANCIAL_FIELDS, "get_options_chain_summary": _OPTIONS_FIELDS}.get(output.name or "")
    if not fields:
        return []
    try:
        data = json.loads(output.content)
    except ValueError:
        return []
    if not isinstance(data, dict) or "error" in data:
        return []
    symbol = str(data.get("symbol") or "").upper()
    source = "Yahoo Finance"
    items = []
    for field, (label, kind, words) in fields.items():
        value = _number(data.get(field))
        if value is None:
            continue
        if kind == "percent":
            value *= 100
        items.append({"value": value, "kind": kind, "source": "financials",
                      "label": f"{symbol} {label} ({source})", "words": words})
    return items


def words_match(item: dict[str, Any], context: str) -> bool:
    words = item.get("words")
    return bool(words and re.search(words, context, re.IGNORECASE))
