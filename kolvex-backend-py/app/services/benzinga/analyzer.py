"""
新闻分析器模块
使用 Ollama + Llama-3-8B-Finance 进行新闻分析

功能：
- 情感分析 (bullish/bearish/neutral)
- 交易信号生成 (buy/sell/hold)
- 关键信息提取 (股票代码、标签、要点)
- 市场影响评估 (high/medium/low)
- 智能摘要生成
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field

from app.services.ai import OllamaClient, OllamaClientSync, extract_json_object

logger = logging.getLogger(__name__)


# ============================================================
# 数据模型
# ============================================================


class NewsAIAnalysis(BaseModel):
    """新闻 AI 分析结果模型"""

    # 摘要
    ai_summary: str = Field(default="", description="AI 生成的新闻摘要")

    # 情感分析
    sentiment: str = Field(default="neutral", description="情感: bullish/bearish/neutral")
    sentiment_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    sentiment_reasoning: str = Field(default="", description="情感分析原因")

    # 交易信号
    trading_action: Optional[str] = Field(default=None, description="交易信号: buy/sell/hold/null")
    trading_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)

    # 信息提取
    ai_tags: List[str] = Field(default_factory=list, description="AI 提取的标签")
    ai_tickers: List[str] = Field(default_factory=list, description="AI 识别的股票代码")
    key_points: List[str] = Field(default_factory=list, description="关键要点")

    # 市场影响
    market_impact: Optional[str] = Field(default=None, description="市场影响: high/medium/low/none")
    impact_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)

    # 元数据
    analyzed_at: str = Field(default="", description="分析时间 ISO 格式")
    ai_model: str = Field(default="", description="使用的 AI 模型")
    analysis_version: int = Field(default=1, description="分析算法版本")

    class Config:
        extra = "ignore"


# ============================================================
# 新闻分析器
# ============================================================


class NewsAnalyzer:
    """
    新闻分析器 - 异步版本
    使用本地 Llama-3-8B-Finance 模型分析金融新闻
    """

    ANALYSIS_VERSION = 1

    def __init__(self, client: OllamaClient = None):
        self.client = client or OllamaClient()

    async def analyze_news(
        self,
        title: str,
        content: str,
        existing_tickers: List[str] = None,
    ) -> NewsAIAnalysis:
        """
        综合分析新闻文章

        Args:
            title: 新闻标题
            content: 新闻内容 (摘要或正文)
            existing_tickers: 已知的相关股票代码

        Returns:
            NewsAIAnalysis: 完整的 AI 分析结果
        """
        # 构建提示词
        tickers_hint = ""
        if existing_tickers:
            tickers_hint = f"\nKnown related tickers: {', '.join(existing_tickers)}"

        prompt = f"""Analyze this financial news article comprehensively.

Title: "{title}"

Content: "{content[:2000]}"{tickers_hint}

Respond with ONLY this JSON object, no other text:
{{
  "ai_summary": "Concise summary in 150 characters focusing on key financial impact",
  "sentiment": "bullish/bearish/neutral",
  "sentiment_confidence": 0.0-1.0,
  "sentiment_reasoning": "Brief reason for sentiment",
  "trading_action": "buy/sell/hold/null",
  "trading_confidence": 0.0-1.0,
  "ai_tickers": ["SYMBOL1", "SYMBOL2"],
  "ai_tags": ["earnings", "merger", "tech"],
  "key_points": ["point1", "point2", "point3"],
  "market_impact": "high/medium/low/none",
  "impact_confidence": 0.0-1.0
}}"""

        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=600,
            )

            result = extract_json_object(response)

            if result:
                return NewsAIAnalysis(
                    ai_summary=result.get("ai_summary", "")[:200],
                    sentiment=result.get("sentiment", "neutral"),
                    sentiment_confidence=result.get("sentiment_confidence", 0.5),
                    sentiment_reasoning=result.get("sentiment_reasoning", ""),
                    trading_action=result.get("trading_action"),
                    trading_confidence=result.get("trading_confidence"),
                    ai_tickers=result.get("ai_tickers", []),
                    ai_tags=result.get("ai_tags", []),
                    key_points=result.get("key_points", [])[:5],
                    market_impact=result.get("market_impact"),
                    impact_confidence=result.get("impact_confidence"),
                    analyzed_at=datetime.now(timezone.utc).isoformat(),
                    ai_model=self.client.model,
                    analysis_version=self.ANALYSIS_VERSION,
                )

            logger.warning("AI 分析响应解析失败，返回默认结果")
            return self._default_analysis()

        except Exception as e:
            logger.error(f"新闻 AI 分析失败: {e}")
            return self._default_analysis()

    async def quick_sentiment(self, title: str, content: str = "") -> Dict[str, Any]:
        """
        快速情感分析 (轻量级)

        Returns:
            {"sentiment": "bullish", "confidence": 0.85, "reasoning": "..."}
        """
        text = f"{title}. {content[:500]}" if content else title

        prompt = f"""Analyze the sentiment of this financial news.

News: "{text}"

Respond with ONLY a JSON object:
{{"sentiment": "bullish/bearish/neutral", "confidence": 0.0-1.0, "reasoning": "brief reason"}}"""

        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=200,
            )

            result = extract_json_object(response)
            if result:
                return {
                    "sentiment": result.get("sentiment", "neutral"),
                    "confidence": result.get("confidence", 0.5),
                    "reasoning": result.get("reasoning", ""),
                }

            return {"sentiment": "neutral", "confidence": 0.5, "reasoning": "Parse failed"}

        except Exception as e:
            return {"sentiment": "neutral", "confidence": 0.0, "reasoning": f"Error: {e}"}

    async def extract_tickers(self, title: str, content: str = "") -> List[str]:
        """
        从新闻中提取股票代码

        Returns:
            ["AAPL", "NVDA", ...]
        """
        text = f"{title}. {content[:1000]}" if content else title

        prompt = f"""Extract all stock ticker symbols mentioned or implied in this financial news.

News: "{text}"

Respond with ONLY a JSON array of ticker symbols (uppercase):
["AAPL", "NVDA"]

If no tickers found, respond: []"""

        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=150,
            )

            # 尝试提取 JSON 数组
            import json
            import re

            # 查找 JSON 数组
            match = re.search(r"\[.*?\]", response, re.DOTALL)
            if match:
                return json.loads(match.group())

            return []

        except Exception:
            return []

    async def generate_summary(self, title: str, content: str, max_length: int = 150) -> str:
        """
        生成新闻摘要

        Args:
            title: 新闻标题
            content: 新闻内容
            max_length: 最大摘要长度

        Returns:
            str: 摘要
        """
        prompt = f"""Summarize this financial news in {max_length} characters or less.
Focus on key financial impact and market relevance.

Title: "{title}"
Content: "{content[:1500]}"

Respond with ONLY the summary text, no quotes or formatting."""

        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.3,
                max_tokens=200,
            )
            return response.strip()[:max_length]

        except Exception:
            return title[:max_length]

    def _default_analysis(self) -> NewsAIAnalysis:
        """返回默认的分析结果"""
        return NewsAIAnalysis(
            ai_summary="",
            sentiment="neutral",
            sentiment_confidence=0.0,
            sentiment_reasoning="Analysis failed",
            analyzed_at=datetime.now(timezone.utc).isoformat(),
            ai_model=self.client.model if self.client else "unknown",
            analysis_version=self.ANALYSIS_VERSION,
        )


class NewsAnalyzerSync:
    """
    新闻分析器 - 同步版本
    用于非异步环境或简单脚本
    """

    ANALYSIS_VERSION = 1

    def __init__(self, client: OllamaClientSync = None):
        self.client = client or OllamaClientSync()

    def analyze_news(
        self,
        title: str,
        content: str,
        existing_tickers: List[str] = None,
    ) -> NewsAIAnalysis:
        """
        综合分析新闻文章 (同步版本)
        """
        tickers_hint = ""
        if existing_tickers:
            tickers_hint = f"\nKnown related tickers: {', '.join(existing_tickers)}"

        prompt = f"""Analyze this financial news article comprehensively.

Title: "{title}"

Content: "{content[:2000]}"{tickers_hint}

Respond with ONLY this JSON object, no other text:
{{
  "ai_summary": "Concise summary in 150 characters focusing on key financial impact",
  "sentiment": "bullish/bearish/neutral",
  "sentiment_confidence": 0.0-1.0,
  "sentiment_reasoning": "Brief reason for sentiment",
  "trading_action": "buy/sell/hold/null",
  "trading_confidence": 0.0-1.0,
  "ai_tickers": ["SYMBOL1", "SYMBOL2"],
  "ai_tags": ["earnings", "merger", "tech"],
  "key_points": ["point1", "point2", "point3"],
  "market_impact": "high/medium/low/none",
  "impact_confidence": 0.0-1.0
}}"""

        try:
            response = self.client.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=600,
            )

            result = extract_json_object(response)

            if result:
                return NewsAIAnalysis(
                    ai_summary=result.get("ai_summary", "")[:200],
                    sentiment=result.get("sentiment", "neutral"),
                    sentiment_confidence=result.get("sentiment_confidence", 0.5),
                    sentiment_reasoning=result.get("sentiment_reasoning", ""),
                    trading_action=result.get("trading_action"),
                    trading_confidence=result.get("trading_confidence"),
                    ai_tickers=result.get("ai_tickers", []),
                    ai_tags=result.get("ai_tags", []),
                    key_points=result.get("key_points", [])[:5],
                    market_impact=result.get("market_impact"),
                    impact_confidence=result.get("impact_confidence"),
                    analyzed_at=datetime.now(timezone.utc).isoformat(),
                    ai_model=self.client.model,
                    analysis_version=self.ANALYSIS_VERSION,
                )

            return self._default_analysis()

        except Exception as e:
            logger.error(f"新闻 AI 分析失败: {e}")
            return self._default_analysis()

    def quick_sentiment(self, title: str, content: str = "") -> Dict[str, Any]:
        """快速情感分析 (同步版本)"""
        text = f"{title}. {content[:500]}" if content else title

        prompt = f"""Analyze the sentiment of this financial news.

News: "{text}"

Respond with ONLY a JSON object:
{{"sentiment": "bullish/bearish/neutral", "confidence": 0.0-1.0, "reasoning": "brief reason"}}"""

        try:
            response = self.client.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=200,
            )

            result = extract_json_object(response)
            if result:
                return {
                    "sentiment": result.get("sentiment", "neutral"),
                    "confidence": result.get("confidence", 0.5),
                    "reasoning": result.get("reasoning", ""),
                }

            return {"sentiment": "neutral", "confidence": 0.5, "reasoning": "Parse failed"}

        except Exception as e:
            return {"sentiment": "neutral", "confidence": 0.0, "reasoning": f"Error: {e}"}

    def _default_analysis(self) -> NewsAIAnalysis:
        """返回默认的分析结果"""
        return NewsAIAnalysis(
            ai_summary="",
            sentiment="neutral",
            sentiment_confidence=0.0,
            sentiment_reasoning="Analysis failed",
            analyzed_at=datetime.now(timezone.utc).isoformat(),
            ai_model=self.client.model if self.client else "unknown",
            analysis_version=self.ANALYSIS_VERSION,
        )


# ============================================================
# 便捷函数
# ============================================================


async def analyze_news_article(
    title: str,
    content: str,
    tickers: List[str] = None,
) -> NewsAIAnalysis:
    """
    便捷函数: 分析单篇新闻

    Usage:
        result = await analyze_news_article(
            title="NVDA Beats Earnings Expectations",
            content="Nvidia reported...",
            tickers=["NVDA"]
        )
    """
    async with OllamaClient() as client:
        analyzer = NewsAnalyzer(client)
        return await analyzer.analyze_news(title, content, tickers)


def analyze_news_article_sync(
    title: str,
    content: str,
    tickers: List[str] = None,
) -> NewsAIAnalysis:
    """
    便捷函数: 分析单篇新闻 (同步版本)
    """
    analyzer = NewsAnalyzerSync()
    return analyzer.analyze_news(title, content, tickers)

