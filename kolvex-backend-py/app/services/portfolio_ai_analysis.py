"""AI portfolio analysis run with the model the user picked, using that user's own API key.

Holdings are summarised here; the model only writes the assessment. Each successful run is
saved (see ``PortfolioAnalysisRuns``) so the user can reopen earlier results.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from pydantic import BaseModel, Field

from app.agent.llm import get_user_llm
from app.services.portfolio_analyzer import PortfolioAnalyzer
from app.services.technical_analysis import (
    STRUCTURED_METHODS,
    _choose_user_model,
    _is_auth_error,
    _is_unsupported,
)
from supabase import Client

logger = logging.getLogger(__name__)

TABLE = "portfolio_ai_analyses"
TIMEOUT_SECONDS = 150
SUMMARY_LIMIT = 280


class NoPositions(LookupError):
    """The user has no visible positions to analyse."""


class AiKeyRejected(RuntimeError):
    """The provider rejected the user's API key."""


class AiRateLimited(RuntimeError):
    """The provider rate-limited the user's key."""


class PortfolioAnalysisInvalid(ValueError):
    """The model did not return a usable analysis."""


# ---------- Result schema (also the API response shape) ----------


class KeyMetrics(BaseModel):
    concentration_risk: Optional[str] = None
    sector_balance: Optional[str] = None
    growth_potential: Optional[str] = None


class OverallAnalysis(BaseModel):
    summary: str
    risk_level: str = Field(description="low, medium or high")
    diversification_score: int = Field(description="0-100")
    portfolio_style: Optional[str] = None
    strengths: List[str] = []
    weaknesses: List[str] = []
    key_metrics: Optional[KeyMetrics] = None


class StockAnalysis(BaseModel):
    symbol: str
    name: Optional[str] = None
    current_weight: Optional[float] = None
    sentiment: str = Field(description="bullish, bearish or neutral")
    analysis: Optional[str] = None
    recommendation: str = Field(description="hold, buy_more, reduce or sell")
    confidence: float = Field(description="0.0-1.0")
    key_points: List[str] = []


class PortfolioSuggestions(BaseModel):
    rebalancing: List[str] = []
    risk_management: List[str] = []
    opportunities: List[str] = []
    tax_considerations: List[str] = []


class PortfolioAiResult(BaseModel):
    overall_analysis: OverallAnalysis
    stock_analyses: List[StockAnalysis] = []
    portfolio_suggestions: PortfolioSuggestions = PortfolioSuggestions()


# ---------- Prompt ----------


def build_messages(holdings: Dict[str, Any], locale: str, user_context: Optional[str] = None):
    """Chat messages for the analysis, plus the number of positions they describe."""
    analyzer = PortfolioAnalyzer(client=None)
    positions = analyzer._extract_positions(holdings)
    if not positions:
        raise NoPositions("No positions to analyse")
    summary = analyzer._build_portfolio_summary(positions, holdings)
    language = (
        "Write every text field in Simplified Chinese. Keep ticker symbols and the enum values "
        "(risk_level, sentiment, recommendation, key_metrics values) in English."
        if (locale or "").lower().startswith("zh")
        else "Write every text field in English."
    )
    system = (
        "You are an expert portfolio analyst. Assess only the holdings given; do not invent "
        "prices, returns or positions. Analyse every equity position individually in "
        "stock_analyses, be specific and actionable, and weigh diversification and risk. "
        + language
    )
    user = summary
    if user_context:
        user += f"\nUser's investment context: {user_context}\n"
    return [("system", system), ("user", user)], len(positions)


async def _structured_call(llm, messages) -> PortfolioAiResult:
    last: Optional[Exception] = None
    for method in STRUCTURED_METHODS:
        prompt = list(messages)
        if method == "json_mode":
            prompt.append(
                (
                    "system",
                    "Reply with one JSON object only, matching this JSON schema:\n"
                    + json.dumps(PortfolioAiResult.model_json_schema(), ensure_ascii=False),
                )
            )
        try:
            result = await llm.with_structured_output(PortfolioAiResult, method=method).ainvoke(
                prompt
            )
        except Exception as e:
            if _is_auth_error(e) or not _is_unsupported(e):
                raise
            logger.info("Structured output method %s unsupported, trying the next: %s", method, e)
            last = e
            continue
        if isinstance(result, PortfolioAiResult):
            return result
        if isinstance(result, dict):
            return PortfolioAiResult.model_validate(result)
        last = PortfolioAnalysisInvalid(f"Model returned no structured analysis via {method}")
    raise last or PortfolioAnalysisInvalid("Model returned no structured analysis")


def _is_rate_limited(error: Exception) -> bool:
    text = f"{type(error).__name__} {error}".lower()
    return "429" in text or "rate limit" in text or "ratelimit" in text


async def run_portfolio_analysis(
    holdings: Dict[str, Any],
    *,
    model_id: Optional[str],
    user_api_keys: Optional[Dict[str, str]],
    locale: str = "zh",
    user_context: Optional[str] = None,
    llm=None,
    timeout: float = TIMEOUT_SECONDS,
) -> Dict[str, Any]:
    """Run the analysis with the user's chosen model. Raises; never returns a placeholder."""
    provider, model = _choose_user_model(model_id, user_api_keys)  # AiNotConfigured
    messages, positions = build_messages(holdings, locale, user_context)
    llm = llm or get_user_llm(
        provider=provider, model=model, temperature=0.3, user_api_keys=user_api_keys
    )
    try:
        result = await asyncio.wait_for(_structured_call(llm, messages), timeout=timeout)
    except asyncio.TimeoutError:
        raise
    except Exception as e:
        if _is_auth_error(e):
            raise AiKeyRejected(str(type(e).__name__)) from e
        if _is_rate_limited(e):
            raise AiRateLimited(str(type(e).__name__)) from e
        if isinstance(e, (PortfolioAnalysisInvalid, ValueError)):
            raise PortfolioAnalysisInvalid(str(type(e).__name__)) from e
        raise
    if not result.overall_analysis.summary.strip():
        raise PortfolioAnalysisInvalid("Empty summary")
    return {
        **result.model_dump(),
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "model": model_id,
        "positions_analyzed": positions,
    }


# ---------- Saved runs ----------

LIST_FIELDS = "id,created_at,model_id,locale,summary,risk_level,positions_analyzed"


def _short(text: str) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= SUMMARY_LIMIT else text[: SUMMARY_LIMIT - 1].rstrip() + "…"


def to_list_item(row: Dict[str, Any]) -> Dict[str, Any]:
    return {key: row.get(key) for key in LIST_FIELDS.split(",")}


def to_detail(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        **row["result"],
        "id": row["id"],
        "saved": True,
        "created_at": row["created_at"],
        "locale": row.get("locale"),
    }


class PortfolioAnalysisRuns:
    """Saved analyses: private to their owner, written only by the server."""

    def __init__(self, db: Client):
        self.db = db

    def save(self, user_id: str, analysis: Dict[str, Any], locale: str) -> Dict[str, Any]:
        record = {
            "user_id": user_id,
            "model_id": analysis["model"],
            "locale": locale,
            "summary": _short(analysis["overall_analysis"]["summary"]),
            "risk_level": analysis["overall_analysis"].get("risk_level"),
            "positions_analyzed": analysis["positions_analyzed"],
            "result": analysis,
        }
        rows = self.db.table(TABLE).insert(record).execute().data
        return rows[0]

    def list(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        # The service client bypasses RLS, so ownership is filtered here explicitly.
        rows = (
            self.db.table(TABLE)
            .select(LIST_FIELDS)
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .order("id", desc=True)
            .limit(limit)
            .execute()
        ).data or []
        return [to_list_item(row) for row in rows]

    def get(self, user_id: str, run_id: str) -> Optional[Dict[str, Any]]:
        rows = (
            self.db.table(TABLE)
            .select(LIST_FIELDS + ",result")
            .eq("user_id", user_id)
            .eq("id", run_id)
            .limit(1)
            .execute()
        ).data or []
        return to_detail(rows[0]) if rows else None


def get_portfolio_analysis_runs() -> PortfolioAnalysisRuns:
    from app.core.supabase import get_supabase_service

    return PortfolioAnalysisRuns(get_supabase_service())


def save_quietly(save: Callable[[], Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Storage failure must not discard a result the user already paid for."""
    try:
        return save()
    except Exception as e:
        logger.warning("Saving portfolio analysis failed (%s)", type(e).__name__)
        return None
