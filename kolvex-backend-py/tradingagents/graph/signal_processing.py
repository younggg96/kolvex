# TradingAgents/graph/signal_processing.py

import logging
import re
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

SIGNAL_SCHEMA_VERSION = 1
RATINGS = ("BUY", "SELL", "HOLD")


class TradingSignal(BaseModel):
    """Structured decision the LLM extracts from the risk manager's final verdict.

    Everything here is a claim made by the model. Position sizing, risk limits and
    order execution are decided by code downstream, never by these fields alone.
    """

    rating: Literal["BUY", "SELL", "HOLD"]
    conviction: float = Field(ge=0, le=1, description="0 = no confidence, 1 = maximum confidence")
    horizon_days: int = Field(ge=1, le=365, description="Holding period the thesis is about, in calendar days")
    entry_plan: str = Field(default="", max_length=1000, description="How and when to enter, e.g. limit price or trigger")
    invalidation: str = Field(default="", max_length=1000, description="Observable condition that proves the thesis wrong")
    stop_loss_pct: Optional[float] = Field(default=None, gt=0, lt=100, description="Stop distance from entry, percent")
    take_profit_pct: Optional[float] = Field(default=None, gt=0, le=1000, description="Target distance from entry, percent")
    sell_size: Optional[Literal["reduce", "close"]] = Field(
        default=None, description="For SELL only: trim the existing long (reduce) or exit it fully (close)"
    )
    key_reasons: list[str] = Field(default_factory=list, max_length=5)
    key_risks: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("rating", mode="before")
    @classmethod
    def _upper_rating(cls, value: Any) -> Any:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("key_reasons", "key_risks", mode="before")
    @classmethod
    def _trim_list(cls, value: Any) -> Any:
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()][:5]
        return value


class SignalExtraction(BaseModel):
    """A signal plus how it was obtained, so evaluation can exclude degraded rows."""

    signal: TradingSignal
    status: Literal["structured", "rating_only", "fallback_hold"]
    error: Optional[str] = None


_EXTRACTION_PROMPT = """You convert a trading committee's final verdict into a structured signal.
Use only what the text states or clearly implies; do not invent price levels.
- rating: the committee's final BUY, SELL or HOLD.
- conviction: how firmly the text commits (hedged language = lower).
- horizon_days: the time frame discussed; if none, use 30.
- stop_loss_pct / take_profit_pct: percent distances only if the text gives levels or percentages; otherwise null.
- invalidation: the condition that would prove the thesis wrong.
- sell_size: only for SELL; "reduce" if the verdict trims the position, "close" if it exits fully; otherwise null.
- key_reasons / key_risks: at most 5 short items each."""

_FINAL_PROPOSAL = re.compile(r"FINAL\s+TRANSACTION\s+PROPOSAL\s*:?\s*\**\s*(BUY|SELL|HOLD)", re.IGNORECASE)
_BARE_RATING = re.compile(r"\b(BUY|SELL|HOLD)\b")


def parse_rating(text: str) -> Optional[str]:
    """Find the rating in free text: the explicit proposal line wins, else the last bare rating."""
    if not text:
        return None
    explicit = _FINAL_PROPOSAL.findall(text)
    if explicit:
        return explicit[-1].upper()
    bare = _BARE_RATING.findall(text.upper())
    return bare[-1] if bare else None


def _hold(reason: str) -> TradingSignal:
    return TradingSignal(rating="HOLD", conviction=0, horizon_days=30, invalidation="", key_risks=[reason])


class SignalProcessor:
    """Processes trading signals to extract actionable decisions."""

    def __init__(self, quick_thinking_llm: Any):
        """Initialize with an LLM for processing."""
        self.quick_thinking_llm = quick_thinking_llm

    def process_signal(self, full_signal: str) -> str:
        """
        Process a full trading signal to extract the core decision.

        Args:
            full_signal: Complete trading signal text

        Returns:
            Extracted decision (BUY, SELL, or HOLD)
        """
        messages = [
            (
                "system",
                "You are an efficient assistant designed to analyze paragraphs or financial reports provided by a group of analysts. Your task is to extract the investment decision: SELL, BUY, or HOLD. Provide only the extracted decision (SELL, BUY, or HOLD) as your output, without adding any additional text or information.",
            ),
            ("human", full_signal),
        ]

        return self.quick_thinking_llm.invoke(messages).content

    def extract_structured(self, final_decision: str, trader_plan: str = "") -> SignalExtraction:
        """Extract a TradingSignal, degrading safely instead of raising.

        Order of preference: LLM structured output, then the rating parsed from the
        text with zero conviction, then HOLD. A failure never produces BUY or SELL.
        """
        text = (final_decision or "").strip()
        if not text:
            return SignalExtraction(signal=_hold("empty final decision"), status="fallback_hold",
                                    error="empty final decision")

        human = f"Final verdict:\n{text}"
        if trader_plan:
            human += f"\n\nTrader plan (context only; the final verdict wins on conflict):\n{trader_plan}"

        error: Optional[str] = None
        try:
            structured_llm = self.quick_thinking_llm.with_structured_output(TradingSignal)
            raw = structured_llm.invoke([("system", _EXTRACTION_PROMPT), ("human", human)])
            signal = raw if isinstance(raw, TradingSignal) else TradingSignal.model_validate(raw)
            explicit = _FINAL_PROPOSAL.findall(text)
            if explicit and explicit[-1].upper() != signal.rating:
                # The verdict's own proposal line is the source of truth; a disagreeing extraction is not trusted.
                raise ValueError(f"extracted {signal.rating} but verdict says {explicit[-1].upper()}")
            return SignalExtraction(signal=signal, status="structured")
        except Exception as exc:  # validation, provider errors, unsupported structured output, timeouts
            error = f"{type(exc).__name__}: {exc}"
        logger.warning("Structured signal extraction failed, degrading: %s", error)

        rating = parse_rating(text)
        if rating:
            return SignalExtraction(
                signal=TradingSignal(rating=rating, conviction=0, horizon_days=30),
                status="rating_only",
                error=error,
            )
        return SignalExtraction(signal=_hold("could not read a rating"), status="fallback_hold", error=error)
