"""
AI technical analysis for the price chart.

Indicators, swing points and candidate levels are computed here; the LLM only chooses and
explains levels and trend lines from that evidence. Every price and date it returns is
validated against the actual bars before it reaches the chart.
"""

import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field

from app.agent.config import LLM_PROVIDER
from app.agent.llm import OPENAI_COMPATIBLE_PROVIDERS, get_llm

logger = logging.getLogger(__name__)

PROVIDER_ORDER = ["openai", "anthropic", "deepseek", "gemini", "qwen", "kimi", "grok"]
PROVIDER_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-haiku-4-5",
    **{name: config["default_model"] for name, config in OPENAI_COMPATIBLE_PROVIDERS.items()},
}


class AiNotConfigured(RuntimeError):
    """No usable LLM key; the user can add one under Settings → API Keys."""


def _choose_model(user_api_keys: Optional[Dict[str, str]]) -> Tuple[Optional[str], Optional[str]]:
    """Prefer the server default provider, else the first provider the user has a key for."""
    if not user_api_keys or LLM_PROVIDER in user_api_keys:
        return None, None
    for provider in PROVIDER_ORDER:
        if provider in user_api_keys:
            return provider, PROVIDER_MODELS[provider]
    return None, None


def _is_auth_error(error: Exception) -> bool:
    text = f"{type(error).__name__} {error}".lower()
    return any(token in text for token in ("authentication", "api key", "api_key", "401", "unauthorized"))


# Not every OpenAI-compatible provider supports `response_format: json_schema` or tool calls.
STRUCTURED_METHODS = ("json_schema", "function_calling", "json_mode")


def _is_unsupported(error: Exception) -> bool:
    text = f"{type(error).__name__} {error}".lower()
    return any(
        token in text
        for token in ("response_format", "json_schema", "tool", "function", "not support", "unsupported", "unavailable", "notimplemented")
    )


async def _structured_call(llm, messages) -> "AiAnalysis":
    last: Optional[Exception] = None
    for method in STRUCTURED_METHODS:
        prompt = list(messages)
        if method == "json_mode":
            prompt.append((
                "system",
                "Reply with one JSON object only, matching this JSON schema:\n"
                + json.dumps(AiAnalysis.model_json_schema(), ensure_ascii=False),
            ))
        try:
            result = await llm.with_structured_output(AiAnalysis, method=method).ainvoke(prompt)
        except Exception as e:
            if _is_auth_error(e) or not _is_unsupported(e):
                raise
            logger.info("Structured output method %s unsupported, trying the next: %s", method, e)
            last = e
            continue
        if isinstance(result, AiAnalysis):
            return result
        if isinstance(result, dict):
            return AiAnalysis.model_validate(result)
        last = ValueError(f"Model returned no structured analysis via {method}")
    raise last or ValueError("Model returned no structured analysis")

MAX_PROMPT_BARS = 160
CACHE_TTL_SECONDS = 600
_cache: Dict[Tuple, Tuple[float, Dict[str, Any]]] = {}


class AiLevel(BaseModel):
    kind: Literal["support", "resistance"]
    price: float
    strength: Literal["weak", "medium", "strong"] = "medium"
    reason: str = Field(default="", max_length=240)


class AiTrendline(BaseModel):
    kind: Literal["support", "resistance"]
    start_date: str = Field(description="Exact date value of a bar from the data table")
    start_price: float
    end_date: str = Field(description="Exact date value of a later bar from the data table")
    end_price: float
    reason: str = Field(default="", max_length=240)


class AiFib(BaseModel):
    from_date: str
    from_price: float
    to_date: str
    to_price: float


class AiAnalysis(BaseModel):
    trend: Literal["uptrend", "downtrend", "sideways"]
    bias: Literal["bullish", "bearish", "neutral"]
    summary: str = Field(max_length=900)
    levels: List[AiLevel] = Field(default_factory=list, max_length=8)
    trendlines: List[AiTrendline] = Field(default_factory=list, max_length=4)
    fib: Optional[AiFib] = None
    signals: List[str] = Field(default_factory=list, max_length=6)
    invalidation: Optional[str] = Field(default=None, max_length=240)


# ------------------------------------------------------------------ indicators


def ema(values: List[float], period: int) -> List[Optional[float]]:
    out: List[Optional[float]] = [None] * len(values)
    if len(values) < period:
        return out
    k = 2 / (period + 1)
    current = sum(values[:period]) / period
    out[period - 1] = current
    for index in range(period, len(values)):
        current = values[index] * k + current * (1 - k)
        out[index] = current
    return out


def rsi(closes: List[float], period: int = 14) -> Optional[float]:
    if len(closes) <= period:
        return None
    gains = losses = 0.0
    for index in range(1, period + 1):
        change = closes[index] - closes[index - 1]
        gains += max(change, 0)
        losses += max(-change, 0)
    avg_gain, avg_loss = gains / period, losses / period
    for index in range(period + 1, len(closes)):
        change = closes[index] - closes[index - 1]
        avg_gain = (avg_gain * (period - 1) + max(change, 0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-change, 0)) / period
    if avg_loss == 0:
        return 100.0
    return 100 - 100 / (1 + avg_gain / avg_loss)


def atr(bars: List[Dict[str, Any]], period: int = 14) -> float:
    ranges = []
    for index, bar in enumerate(bars):
        previous = bars[index - 1]["close"] if index else bar["close"]
        ranges.append(max(bar["high"] - bar["low"], abs(bar["high"] - previous), abs(bar["low"] - previous)))
    window = ranges[-period:] or [0.0]
    return sum(window) / len(window)


def swing_points(bars: List[Dict[str, Any]], window: int) -> List[Dict[str, Any]]:
    """Fractal highs/lows: a bar whose high (low) is the extreme of `window` bars on each side."""
    points = []
    for index in range(window, len(bars) - window):
        neighbourhood = bars[index - window: index + window + 1]
        bar = bars[index]
        if bar["high"] == max(item["high"] for item in neighbourhood):
            points.append({"index": index, "date": bar["date"], "kind": "high", "price": bar["high"]})
        if bar["low"] == min(item["low"] for item in neighbourhood):
            points.append({"index": index, "date": bar["date"], "kind": "low", "price": bar["low"]})
    return points


def candidate_levels(points: List[Dict[str, Any]], tolerance: float, limit: int = 10) -> List[Dict[str, Any]]:
    """Cluster swing prices within `tolerance`; more touches and recency rank higher."""
    clusters: List[Dict[str, Any]] = []
    for point in sorted(points, key=lambda item: item["price"]):
        if clusters and point["price"] - clusters[-1]["prices"][-1] <= tolerance:
            clusters[-1]["prices"].append(point["price"])
            clusters[-1]["last_index"] = max(clusters[-1]["last_index"], point["index"])
            clusters[-1]["last_date"] = max(clusters[-1]["last_date"], point["date"])
        else:
            clusters.append({"prices": [point["price"]], "last_index": point["index"], "last_date": point["date"]})
    ranked = sorted(clusters, key=lambda item: (len(item["prices"]), item["last_index"]), reverse=True)[:limit]
    return [
        {
            "price": round(sum(item["prices"]) / len(item["prices"]), 2),
            "touches": len(item["prices"]),
            "last_touch": item["last_date"],
        }
        for item in sorted(ranked, key=lambda item: -sum(item["prices"]) / len(item["prices"]))
    ]


def compress(bars: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    """Merge neighbouring bars so the prompt stays small while keeping every extreme."""
    if len(bars) <= limit:
        return bars
    size = -(-len(bars) // limit)
    merged = []
    for start in range(0, len(bars), size):
        chunk = bars[start: start + size]
        merged.append({
            "date": chunk[0]["date"],
            "open": chunk[0]["open"],
            "high": max(item["high"] for item in chunk),
            "low": min(item["low"] for item in chunk),
            "close": chunk[-1]["close"],
            "volume": sum(item.get("volume") or 0 for item in chunk),
        })
    return merged


# ------------------------------------------------------------------ validation


def _bar_lookup(bars: List[Dict[str, Any]]):
    exact = {bar["date"]: index for index, bar in enumerate(bars)}
    by_prefix: Dict[str, int] = {}
    for index, bar in enumerate(bars):
        by_prefix.setdefault(bar["date"][:16], index)
        by_prefix.setdefault(bar["date"][:10], index)

    def find(value: str) -> Optional[int]:
        if value in exact:
            return exact[value]
        for length in (16, 10):
            if value[:length] in by_prefix:
                return by_prefix[value[:length]]
        return None

    return find


def sanitize(
    result: AiAnalysis,
    bars: List[Dict[str, Any]],
    swings: List[Dict[str, Any]],
    tolerance: float,
) -> Dict[str, Any]:
    low = min(bar["low"] for bar in bars)
    high = max(bar["high"] for bar in bars)
    margin = max(tolerance * 6, (high - low) * 0.15)
    in_range = lambda price: low - margin <= price <= high + margin  # noqa: E731
    find = _bar_lookup(bars)
    swing_at = {(point["index"], point["kind"]): point["price"] for point in swings}

    levels = []
    for level in result.levels:
        if not in_range(level.price) or any(abs(level.price - item["price"]) < tolerance * 0.5 for item in levels):
            continue
        levels.append({**level.model_dump(), "price": round(level.price, 2)})

    def anchor(date: str, price: float, kind: str) -> Optional[Dict[str, Any]]:
        index = find(date)
        if index is None or not in_range(price):
            return None
        bar = bars[index]
        snapped = swing_at.get((index, "low" if kind == "support" else "high"))
        if snapped is not None and abs(snapped - price) <= tolerance * 2:
            price = snapped
        price = min(max(price, bar["low"] - tolerance), bar["high"] + tolerance)
        return {"index": index, "date": bar["date"], "price": round(price, 2)}

    trendlines = []
    for line in result.trendlines:
        start = anchor(line.start_date, line.start_price, line.kind)
        end = anchor(line.end_date, line.end_price, line.kind)
        if not start or not end or end["index"] - start["index"] < 3:
            continue
        trendlines.append({
            "kind": line.kind,
            "start": {"date": start["date"], "price": start["price"]},
            "end": {"date": end["date"], "price": end["price"]},
            "reason": line.reason,
        })

    fib = None
    if result.fib:
        start, end = find(result.fib.from_date), find(result.fib.to_date)
        if start is not None and end is not None and start != end and in_range(result.fib.from_price) and in_range(result.fib.to_price):
            fib = {
                "from": {"date": bars[start]["date"], "price": round(result.fib.from_price, 2)},
                "to": {"date": bars[end]["date"], "price": round(result.fib.to_price, 2)},
            }

    return {
        "trend": result.trend,
        "bias": result.bias,
        "summary": result.summary.strip(),
        "levels": levels[:6],
        "trendlines": trendlines[:3],
        "fib": fib,
        "signals": [item.strip() for item in result.signals if item.strip()][:5],
        "invalidation": (result.invalidation or "").strip() or None,
    }


# ------------------------------------------------------------------ service


def _evidence(symbol: str, interval: str, bars: List[Dict[str, Any]], history: List[Dict[str, Any]]):
    closes = [bar["close"] for bar in history]
    tolerance = max(atr(bars) * 0.6, bars[-1]["close"] * 0.002)
    window = 2 if len(bars) < 60 else 3 if len(bars) < 200 else 5
    swings = swing_points(bars, window)
    indicators = {
        f"ema{period}": (round(value, 2) if (value := ema(closes, period)[-1]) is not None else None)
        for period in (20, 50, 200)
    }
    indicators["rsi14"] = round(value, 1) if (value := rsi(closes)) is not None else None
    indicators["atr14"] = round(atr(bars), 2)
    evidence = {
        "symbol": symbol,
        "interval": interval,
        "bars_in_view": len(bars),
        "first_bar": bars[0]["date"],
        "last_bar": bars[-1]["date"],
        "last_close": bars[-1]["close"],
        "view_high": max(bar["high"] for bar in bars),
        "view_low": min(bar["low"] for bar in bars),
        "indicators": indicators,
        "swing_points": [
            {key: point[key] for key in ("date", "kind", "price")} for point in swings[-40:]
        ],
        "candidate_levels": candidate_levels(swings, tolerance),
    }
    return evidence, swings, tolerance


SYSTEM_PROMPT = """You are a disciplined technical analyst drawing on a stock chart.
Use only the data provided. Do not invent prices, dates, news or fundamentals.
- Levels: choose 2–6 support/resistance prices, preferring candidate_levels with more touches and recent tests; the nearest levels above and below last_close matter most.
- Trend lines: 0–3 lines, each connecting two swing_points of the same kind (lows for support, highs for resistance). start_date and end_date must be copied exactly from the data, start before end.
- Fib: optional retracement between the most significant swing low and high in view.
- summary: 3–5 sentences covering trend, momentum (EMA/RSI), the key levels and what would change the view.
- signals: short bullet observations. invalidation: the price action that would invalidate the bias.
This is educational analysis, not investment advice; never tell the user to buy or sell.
Write all text in {language}."""


async def analyze_chart(
    symbol: str,
    interval: str,
    history: List[Dict[str, Any]],
    view_start: Optional[str],
    view_end: Optional[str],
    locale: str = "zh",
    user_api_keys: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """`history` may extend before the view so long EMAs are warmed up."""
    bars = [
        bar for bar in history
        if (not view_start or bar["date"] >= view_start) and (not view_end or bar["date"] <= view_end)
    ]
    if len(bars) < 20:
        raise ValueError("Need at least 20 bars in view for technical analysis")

    cache_key = (symbol, interval, bars[0]["date"], bars[-1]["date"], bars[-1]["close"], locale)
    cached = _cache.get(cache_key)
    if cached and time.time() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    end_index = history.index(bars[-1]) + 1
    evidence, swings, tolerance = _evidence(symbol, interval, bars, history[:end_index])
    table = "\n".join(
        f"{bar['date']},{bar['open']},{bar['high']},{bar['low']},{bar['close']},{bar.get('volume') or 0}"
        for bar in compress(bars, MAX_PROMPT_BARS)
    )
    language = "Simplified Chinese" if locale.startswith("zh") else "English"
    provider, model = _choose_model(user_api_keys)
    try:
        llm = get_llm(provider=provider, model=model, temperature=0.2, user_api_keys=user_api_keys)
        result = await _structured_call(llm, [
            ("system", SYSTEM_PROMPT.format(language=language)),
            (
                "human",
                "Evidence (computed from the bars):\n"
                f"{json.dumps(evidence, ensure_ascii=False)}\n\n"
                "Bars (date,open,high,low,close,volume; may be merged to keep it short):\n"
                f"{table}",
            ),
        ])
    except Exception as e:
        if _is_auth_error(e):
            raise AiNotConfigured(str(e)) from e
        raise

    payload = {
        "symbol": symbol,
        "interval": interval,
        "view": {"start": bars[0]["date"], "end": bars[-1]["date"]},
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "indicators": evidence["indicators"],
        **sanitize(result, bars, swings, tolerance),
    }
    _cache[cache_key] = (time.time(), payload)
    if len(_cache) > 200:
        for key, _ in sorted(_cache.items(), key=lambda item: item[1][0])[:50]:
            _cache.pop(key, None)
    return payload
