"""Validated, directly reported revenue observations from the chat tool."""

from datetime import date
from typing import Annotated, Literal

from langchain_core.messages import ToolMessage
from pydantic import BaseModel, Field, TypeAdapter, ValidationError, model_validator


class RevenueEvidence(BaseModel):
    symbol: Annotated[str, Field(pattern=r"^[A-Z0-9.-]{1,32}$")]
    value: Annotated[float, Field(allow_inf_nan=False)]
    currency: Annotated[str, Field(pattern=r"^[A-Z]{3}$")]
    period_kind: Literal["quarterly", "annual"]
    period_start: date
    period_end: date
    filed_on: date
    source_url: Annotated[str, Field(
        pattern=r"^https://www\.sec\.gov/Archives/edgar/data/\d+/\d{18}/\d{10}-\d{2}-\d{6}-index\.html$"
    )]
    # Set only on the latest period of a year-over-year comparison, by the server.
    year_over_year_pct: Annotated[float, Field(allow_inf_nan=False)] | None = None
    compared_period_end: date | None = None
    unavailable_reason: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if not self.period_start <= self.period_end <= self.filed_on:
            raise ValueError("Invalid reporting or filing dates")
        return self


class RevenueComparison(BaseModel):
    evidence: list[RevenueEvidence]
    year_over_year_pct: float | None
    unavailable_reason: str | None = None


_REVENUE_OUTPUT = TypeAdapter(list[RevenueEvidence] | RevenueComparison)


def extract_revenue_evidence(output: object) -> list[RevenueEvidence]:
    if not isinstance(output, ToolMessage) or output.name != "get_reported_revenue":
        return []
    if output.status != "success" or not isinstance(output.content, str):
        return []
    try:
        result = _REVENUE_OUTPUT.validate_json(output.content)
    except ValidationError:
        return []
    if not isinstance(result, RevenueComparison):
        return result
    evidence = [fact.model_copy() for fact in result.evidence]
    if evidence:
        # The card shows the server's percentage, so readers can check the one in the answer.
        evidence[0].year_over_year_pct = result.year_over_year_pct
        evidence[0].unavailable_reason = result.unavailable_reason
        evidence[0].compared_period_end = evidence[1].period_end if len(evidence) > 1 else None
    return evidence


def merge_revenue_evidence(found: dict[tuple, RevenueEvidence], revenue: RevenueEvidence) -> None:
    """Keep one card per period; a later plain lookup must not erase a comparison."""
    key = (revenue.symbol, revenue.period_kind, revenue.period_end)
    previous = found.get(key)
    if previous and revenue.year_over_year_pct is None and revenue.unavailable_reason is None:
        revenue = revenue.model_copy(update={
            "year_over_year_pct": previous.year_over_year_pct,
            "compared_period_end": previous.compared_period_end,
            "unavailable_reason": previous.unavailable_reason,
        })
    found[key] = revenue
