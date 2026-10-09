"""Validated, versionable user focus for chart technical analysis."""
from typing import List, Literal
from pydantic import BaseModel, Field, field_validator, model_validator

TechnicalCategory = Literal[
    "trend", "momentum", "levels", "structure", "volume", "volatility",
    "waves", "moving_averages", "trendlines", "candlesticks", "fibonacci",
    "patterns", "timeframes", "score", "historical", "scenarios", "invalidation", "trade_plan", "breakouts", "retests", "false_breakouts",
]
DEFAULT_CATEGORIES: List[TechnicalCategory] = ["trend", "momentum", "levels", "scenarios", "invalidation"]
CATEGORY_GUIDANCE = {
    "trend": "Explain price versus computed EMAs and current trend.",
    "momentum": "Explain the computed RSI; do not calculate additional indicators.",
    "levels": "Explain validated support and resistance candidates and nearby levels.",
    "structure": "Explain the sequence of supplied swing highs and lows; avoid tiny fluctuations.",
    "volume": "Explain computed relative volume and whether volume supports the move.",
    "volatility": "Explain computed ATR and ATR percentage of price.",
    "patterns": "Explain supplied double-top/bottom and converging-triangle detections, separating candidates from neckline confirmations. Do not invent other patterns or confidence.",
    "waves": "Explain only supplied candidate Elliott impulse/correction counts. Treat them as one possible interpretation, not a confirmed count or forecast; never invent missing waves.",
    "moving_averages": "Explain the computed EMA20/50/200 series and price alignment. Do not calculate other averages.",
    "trendlines": "Explain supplied swing-based support and resistance trend lines.",
    "candlesticks": "Explain only supplied exact-OHLC candlestick detections. Geometric hammer/inverted hammer shapes require trend context; do not imply a reversal from shape alone.",
    "fibonacci": "Explain retracement between validated swing anchors, without projecting future prices.",
    "timeframes": "Only one timeframe was fetched. Do not invent multi-timeframe alignment.",
    "score": "No overall technical score engine is available. Do not invent an overall score.",
    "historical": "No historical similarity engine was run. Do not invent samples or future returns.",
    "scenarios": "Explain conditional bullish AND bearish scenarios using supplied levels, without trade instructions.",
    "breakouts": "Explain only supplied breakout/breakdown events. A pending close is not confirmed; two consecutive closes confirm by the declared rule. Failed events remain failed. Do not claim volume confirmation without volume evidence.",
    "retests": "Explain supplied held retests after confirmed breaks: former resistance becomes support, or former support rejects a rally. Only discuss detected events, not guaranteed future retests.",
    "false_breakouts": "Explain supplied wick rejections and failed breaks returning through a previously confirmed level within five bars. State the rule and dates, never call a pending breakout a false breakout without evidence.",
    "trade_plan": "Explain an optional conditional setup: entry range, stop-loss invalidation and 1–2 target prices, grounded in supplied swing points or candidate levels. Return setup=null when no coherent directional setup exists. The server computes risk/reward, never invent a ratio.",
    "invalidation": "Explain conditions that would invalidate the current technical interpretation.",
}

class TechnicalFocus(BaseModel):
    categories: List[TechnicalCategory] = Field(default_factory=lambda: list(DEFAULT_CATEGORIES), max_length=21)
    custom_scenarios: List[str] = Field(default_factory=list, max_length=5)

    @field_validator("categories")
    @classmethod
    def unique_categories(cls, values):
        return list(dict.fromkeys(values))

    @field_validator("custom_scenarios")
    @classmethod
    def clean_scenarios(cls, values):
        cleaned = list(dict.fromkeys(value.strip() for value in values if value.strip()))
        if any(len(value) > 200 for value in cleaned):
            raise ValueError("Each custom scenario must be at most 200 characters")
        return cleaned

    @model_validator(mode="after")
    def require_focus(self):
        if not self.categories and not self.custom_scenarios:
            raise ValueError("Select at least one category or add a scenario")
        return self
