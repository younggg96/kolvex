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

    @model_validator(mode="after")
    def validate_dates(self):
        if not self.period_start <= self.period_end <= self.filed_on:
            raise ValueError("Invalid reporting or filing dates")
        return self


_REVENUE_LIST = TypeAdapter(list[RevenueEvidence])


def extract_revenue_evidence(output: object) -> list[RevenueEvidence]:
    if not isinstance(output, ToolMessage) or output.name != "get_reported_revenue":
        return []
    if output.status != "success" or not isinstance(output.content, str):
        return []
    try:
        return _REVENUE_LIST.validate_json(output.content)
    except ValidationError:
        return []
