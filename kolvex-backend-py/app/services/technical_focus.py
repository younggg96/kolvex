"""Validated, versionable user focus for chart technical analysis."""
from typing import List, Literal
from pydantic import BaseModel, Field, field_validator, model_validator

TechnicalCategory = Literal[
    "trend", "momentum", "levels", "structure", "volume", "volatility",
    "patterns", "timeframes", "score", "historical", "scenarios", "invalidation",
]
DEFAULT_CATEGORIES: List[TechnicalCategory] = ["trend", "momentum", "levels", "scenarios", "invalidation"]
CATEGORY_GUIDANCE = {
    "trend": "Explain price versus computed EMAs and current trend.",
    "momentum": "Explain the computed RSI; do not calculate additional indicators.",
    "levels": "Explain validated support and resistance candidates and nearby levels.",
    "structure": "Explain the sequence of supplied swing highs and lows; avoid tiny fluctuations.",
    "volume": "Explain computed relative volume and whether volume supports the move.",
    "volatility": "Explain computed ATR and ATR percentage of price.",
    "patterns": "No deterministic pattern detector is available. Do not invent a pattern or confidence.",
    "timeframes": "Only one timeframe was fetched. Do not invent multi-timeframe alignment.",
    "score": "No overall technical score engine is available. Do not invent an overall score.",
    "historical": "No historical similarity engine was run. Do not invent samples or future returns.",
    "scenarios": "Explain conditional bullish AND bearish scenarios using supplied levels, without trade instructions.",
    "invalidation": "Explain conditions that would invalidate the current technical interpretation.",
}

class TechnicalFocus(BaseModel):
    categories: List[TechnicalCategory] = Field(default_factory=lambda: list(DEFAULT_CATEGORIES), max_length=12)
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
