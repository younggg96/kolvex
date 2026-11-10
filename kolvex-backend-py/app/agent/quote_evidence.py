"""Extract the displayable quote snapshot from a successful stock tool result."""

import json
import math
import re
from datetime import datetime, timezone

from langchain_core.messages import ToolMessage
from pydantic import BaseModel


class QuoteEvidence(BaseModel):
    symbol: str
    price: float
    currency: str | None
    source: str
    quoted_at: datetime | None


def extract_quote_evidence(output: object) -> QuoteEvidence | None:
    if not isinstance(output, ToolMessage) or output.name != "get_stock_quote":
        return None
    if output.status != "success" or not isinstance(output.content, str):
        return None
    try:
        data = json.loads(output.content)
    except ValueError:
        return None
    if not isinstance(data, dict) or "error" in data:
        return None

    symbol, price = data.get("symbol"), data.get("current_price")
    if not isinstance(symbol, str) or not re.fullmatch(r"[A-Z0-9.^=/-]{1,32}", symbol):
        return None
    if type(price) not in (int, float) or not math.isfinite(price) or price <= 0:
        return None

    currency = data.get("currency")
    if not isinstance(currency, str) or not re.fullmatch(r"[A-Za-z]{3}", currency):
        currency = None
    source = data.get("quote_source")
    if source != "Yahoo Finance":
        return None

    quoted_at = None
    market_time = data.get("market_time")
    if type(market_time) in (int, float) and market_time > 0:
        try:
            quoted_at = datetime.fromtimestamp(market_time, tz=timezone.utc)
        except (ValueError, OverflowError, OSError):
            pass
    return QuoteEvidence(symbol=symbol, price=price, currency=currency, source=source, quoted_at=quoted_at)
