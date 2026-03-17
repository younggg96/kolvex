"""
YouTube video content analyzer using OpenAI.

Designed for longer-form content (transcripts can be thousands of words),
unlike the Ollama-based tweet analyzer.
"""

import logging
import json
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from app.services.ai.utils import extract_json_object

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """You are a senior financial analyst. Analyze the following YouTube video content and extract structured financial insights.

Video Title: "{title}"

Video Description:
{description}

{transcript_section}

Respond with ONLY this JSON object, no other text:
{{
  "is_stock_related": true or false,
  "sentiment": "bullish" or "bearish" or "neutral",
  "sentiment_confidence": 0.0 to 1.0,
  "sentiment_reasoning": "2-3 sentence explanation of overall market sentiment expressed",
  "tickers": ["SYMBOL1", "SYMBOL2"],
  "ticker_analyses": [
    {{
      "ticker": "SYMBOL",
      "sentiment": "bullish" or "bearish" or "neutral",
      "reasoning": "brief analysis for this specific stock"
    }}
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "summary": "Comprehensive 200-300 word summary capturing key points, market thesis, and actionable insights",
  "trading_action": "buy" or "sell" or "hold" or null,
  "trading_confidence": 0.0 to 1.0,
  "stock_related_confidence": 0.0 to 1.0,
  "stock_related_reason": "brief reason"
}}"""


class YouTubeVideoAnalyzer:
    """Analyzes YouTube video content using OpenAI."""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model

    def analyze(
        self,
        title: str,
        description: str,
        transcript: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Synchronous analysis of video content via OpenAI.

        Returns the standardised analysis dict compatible with kol_tweets AI fields,
        or None on failure.
        """
        transcript_section = ""
        if transcript:
            transcript_section = f"Video Transcript (partial):\n{transcript[:8000]}"

        prompt = ANALYSIS_PROMPT.format(
            title=title,
            description=(description or "")[:2000],
            transcript_section=transcript_section,
        )

        try:
            from openai import OpenAI
            from app.core.config import settings

            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=1200,
            )

            raw = response.choices[0].message.content or ""
            result = extract_json_object(raw)

            if not result:
                logger.warning("Failed to parse OpenAI response as JSON")
                return None

            ticker_analyses = result.get("ticker_analyses", [])

            return {
                "sentiment": {
                    "sentiment": result.get("sentiment", "neutral"),
                    "confidence": result.get("sentiment_confidence", 0.5),
                    "reasoning": result.get("sentiment_reasoning", ""),
                },
                "tickers": result.get("tickers", []),
                "tags": result.get("tags", []),
                "summary": result.get("summary", ""),
                "trading_signal": {
                    "action": result.get("trading_action"),
                    "tickers": result.get("tickers", []),
                    "confidence": result.get("trading_confidence"),
                },
                "is_stock_related": {
                    "is_stock_related": result.get("is_stock_related", False),
                    "confidence": result.get("stock_related_confidence", 0.5),
                    "reason": result.get("stock_related_reason", ""),
                },
                "ticker_analyses": ticker_analyses,
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
                "model": self.model,
            }

        except Exception as e:
            logger.error(f"YouTube video analysis failed: {e}")
            return None
