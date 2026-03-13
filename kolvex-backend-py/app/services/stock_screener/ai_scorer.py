"""
AI Stock Scorer — uses LLM to generate multi-dimensional scores and insights
for a list of screened stocks.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from app.services.ai import OllamaClient, extract_json_object

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior equity research analyst. Given a list of stocks with their
financial metrics, provide a concise AI analysis.

For EACH stock, output:
- ai_score (integer 0-100): overall investment attractiveness
- dimension_scores: { "fundamental": 0-100, "valuation": 0-100, "growth": 0-100, "risk": 0-100 }
- one_liner (string): a single-sentence investment thesis

Then provide:
- summary (string): a 2-3 sentence overall market insight about these stocks as a group.

Respond ONLY with valid JSON — no markdown, no explanation. Schema:
{
  "stocks": [
    {
      "symbol": "AAPL",
      "ai_score": 82,
      "dimension_scores": { "fundamental": 85, "valuation": 70, "growth": 80, "risk": 75 },
      "one_liner": "..."
    }
  ],
  "summary": "..."
}"""


class AIStockScorer:
    """Stateless scorer — call `score_stocks` with a list of stock dicts."""

    async def score_stocks(
        self,
        stocks: List[Dict[str, Any]],
        max_stocks: int = 10,
    ) -> Optional[Dict[str, Any]]:
        """Score a batch of stocks via LLM.
        `stocks` should be the flat snapshot dicts returned by the screener."""
        if not stocks:
            return None

        trimmed = stocks[:max_stocks]
        prompt = self._build_prompt(trimmed)

        try:
            async with OllamaClient() as client:
                raw = await client.generate(
                    prompt=prompt,
                    system=SYSTEM_PROMPT,
                    temperature=0.3,
                    max_tokens=2048,
                )
            parsed = extract_json_object(raw)
            if parsed:
                return parsed
            logger.warning("AI scorer: could not parse LLM response")
            return None
        except Exception as e:
            logger.error(f"AI scorer error: {e}")
            return None

    @staticmethod
    def _build_prompt(stocks: List[Dict[str, Any]]) -> str:
        rows: List[str] = []
        for s in stocks:
            row = {
                "symbol": s.get("symbol"),
                "name": s.get("name"),
                "sector": s.get("sector"),
                "price": s.get("current_price"),
                "market_cap": s.get("market_cap"),
                "pe": s.get("pe_ratio"),
                "pb": s.get("price_to_book"),
                "roe": s.get("return_on_equity"),
                "revenue_growth": s.get("revenue_growth"),
                "profit_margin": s.get("profit_margins"),
                "debt_to_equity": s.get("debt_to_equity"),
                "dividend_yield": s.get("dividend_yield"),
                "change_5d": s.get("change_percent_5d"),
            }
            rows.append(json.dumps(row, default=str))

        return (
            "Analyze the following stocks and produce the JSON scoring.\n\n"
            + "\n".join(rows)
        )
