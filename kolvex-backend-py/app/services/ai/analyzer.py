"""
推文分析器模块
使用 Ollama + Llama-3-8B-Finance 进行推文分析
"""

import asyncio
import re
from typing import Dict, List, Any
from datetime import datetime, timezone

import yfinance as yf

from .client import OllamaClient, OllamaClientSync
from .utils import extract_json_object, extract_json_array


class TweetAnalyzerSync:
    """推文分析器 - 同步版本，用于爬虫实时分析"""

    def __init__(self, client: OllamaClientSync = None):
        self.client = client or OllamaClientSync()

    def basic_analysis(self, tweet_text: str) -> Dict[str, Any]:
        """
        基础分析推文 - 同步版本 (情感、股票代码、标签、股市相关性、摘要、投资信号)

        Returns:
            {
                "sentiment": {"sentiment": "bullish", "confidence": 0.85, "reasoning": "..."},
                "tickers": ["AAPL", "NVDA"],
                "tags": ["tech", "earnings"],
                "summary": "Brief summary of the tweet",
                "trading_signal": {"action": "buy", "tickers": ["AAPL"], "confidence": 0.7},
                "is_stock_related": {"is_stock_related": True, "confidence": 0.9, "reason": "..."},
                "analyzed_at": "2024-01-15T10:30:00Z",
                "model": "llama3-8b-finance"
            }
        """
        prompt = f"""Analyze this financial tweet comprehensively.

Tweet: "{tweet_text}"

Respond with ONLY this JSON object, no other text:
{{
  "is_stock_related": true/false,
  "sentiment": "bullish/bearish/neutral",
  "sentiment_confidence": 0.0-1.0,
  "sentiment_reasoning": "brief reason",
  "tickers": ["SYMBOL1", "SYMBOL2"],
  "tags": ["tag1", "tag2"],
  "summary": "Brief summary in 100 chars",
  "trading_action": "buy/sell/hold/null",
  "trading_confidence": 0.0-1.0,
  "stock_related_confidence": 0.0-1.0,
  "stock_related_reason": "brief reason"
}}"""

        try:
            response = self.client.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=400,
            )

            result = extract_json_object(response)

            if result:
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
                    "analyzed_at": datetime.now(timezone.utc).isoformat(),
                    "model": self.client.model,
                }

            return self._default_basic_analysis_result()

        except Exception as e:
            print(f"⚠️ Basic analysis failed: {e}")
            return self._default_basic_analysis_result()

    def _default_basic_analysis_result(self) -> Dict[str, Any]:
        """返回默认的基础分析结果结构"""
        return {
            "sentiment": {
                "sentiment": "neutral",
                "confidence": 0.0,
                "reasoning": "Analysis failed",
            },
            "tickers": [],
            "tags": [],
            "summary": "",
            "trading_signal": {"action": None, "tickers": [], "confidence": None},
            "is_stock_related": {
                "is_stock_related": False,
                "confidence": 0.0,
                "reason": "Analysis failed",
            },
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
            "model": self.client.model,
        }


class TweetAnalyzer:
    """推文分析器 - 使用本地 Llama-3-8B-Finance 模型"""

    def __init__(self, client: OllamaClient = None):
        self.client = client or OllamaClient()

    async def analyze_sentiment(self, tweet_text: str) -> Dict[str, Any]:
        """
        分析推文情感

        Returns:
            {
                "sentiment": "bullish" | "bearish" | "neutral",
                "confidence": 0.0-1.0,
                "reasoning": "..."
            }
        """
        prompt = f"""Analyze the sentiment of this financial tweet.

Tweet: "{tweet_text}"

Respond with ONLY a JSON object, no other text:
{{"sentiment": "bullish|bearish|neutral", "confidence": 0.0-1.0, "reasoning": "brief reason"}}"""

        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=200,
            )

            result = extract_json_object(response)
            if result:
                return result

            return {
                "sentiment": "neutral",
                "confidence": 0.5,
                "reasoning": "Unable to parse response",
            }

        except Exception as e:
            return {
                "sentiment": "neutral",
                "confidence": 0.0,
                "reasoning": f"Error: {str(e)}",
            }

    async def extract_tickers(self, tweet_text: str) -> List[str]:
        """
        从推文中提取股票代码，包含清洗和 yfinance 验证

        Returns:
            ["AAPL", "TSLA", ...] - 仅返回经过验证的有效股票代码
        """
        prompt = f"""Extract stock tickers from this tweet.

Tweet: "{tweet_text}"

Respond with ONLY a JSON array of ticker symbols, no other text:
["AAPL", "TSLA"]

If no tickers found, respond: []"""

        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=100,
            )

            result = extract_json_array(response)
            if result is None or not result:
                return []

            # Step 1: 清洗 ticker
            cleaned_tickers = self._clean_tickers(result)
            if not cleaned_tickers:
                return []

            # Step 2: 使用 yfinance 验证（在线程池中运行避免阻塞）
            validated_tickers = await asyncio.to_thread(
                self._validate_tickers_sync, cleaned_tickers
            )

            return validated_tickers

        except Exception as e:
            print(f"⚠️ Extract tickers failed: {e}")
            return []

    def _clean_tickers(self, raw_tickers: List[Any]) -> List[str]:
        """
        清洗 LLM 输出的 ticker 列表

        - 转大写
        - 移除 $ 符号
        - 去除空白
        - 过滤长度不合适的（<1 或 >6）
        - 去重
        - 过滤常见的误报词

        Returns:
            清洗后的 ticker 列表
        """
        # 常见的误报词（LLM 容易误认为是股票代码的词）
        false_positives = {
            "IT",
            "US",
            "UK",
            "EU",
            "CEO",
            "CFO",
            "IPO",
            "ETF",
            "USD",
            "EUR",
            "GBP",
            "JPY",
            "BTC",
            "ETH",
            "NFT",
            "API",
            "Q1",
            "Q2",
            "Q3",
            "Q4",
            "YOY",
            "QOQ",
            "MOM",
            "EPS",
            "PE",
            "DD",
            "TA",
            "FA",
            "ATH",
            "ATL",
            "HODL",
            "FOMO",
            "FUD",
            "IMO",
            "TBH",
            "FYI",
            "ASAP",
            "AM",
            "PM",
            "ETA",
            "USA",
            "GDP",
            "CPI",
            "PPI",
            "FED",
            "SEC",
            "NYSE",
            "NASDAQ",
            "DOW",
            "SPX",
            "VIX",
            "OTC",
            "YOLO",
            "LMAO",
            "LOL",
            "OMG",
        }

        cleaned = set()
        for ticker in raw_tickers:
            if not isinstance(ticker, str):
                continue

            # 清洗：大写、移除$、去空白
            t = ticker.upper().replace("$", "").strip()

            # 移除非字母数字字符（保留字母和数字，部分ETF有数字）
            t = re.sub(r"[^A-Z0-9]", "", t)

            # 长度检查：有效股票代码 1-6 字符
            if not t or len(t) < 1 or len(t) > 6:
                continue

            # 过滤纯数字
            if t.isdigit():
                continue

            # 过滤常见误报词
            if t in false_positives:
                continue

            cleaned.add(t)

        return list(cleaned)

    def _validate_tickers_sync(self, tickers: List[str]) -> List[str]:
        """
        使用 yfinance 批量验证 ticker 是否有效（同步方法）

        验证标准：yfinance 返回的数据中 'Close' 列不全为 NaN

        Args:
            tickers: 清洗后的 ticker 列表

        Returns:
            验证通过的有效 ticker 列表
        """
        if not tickers:
            return []

        valid_tickers = []

        try:
            # 批量下载一天的数据进行验证
            # progress=False 避免打印进度条
            data = yf.download(
                tickers,
                period="1d",
                group_by="ticker",
                progress=False,
                threads=True,
            )

            if data.empty:
                return []

            # 单个 ticker 时，yfinance 返回的 DataFrame 结构不同
            if len(tickers) == 1:
                ticker = tickers[0]
                # 单 ticker 时，列是 ('Open', 'High', ...) 而不是 (ticker, 'Open')
                if "Close" in data.columns and not data["Close"].isna().all():
                    valid_tickers.append(ticker)
            else:
                # 多个 ticker 时，DataFrame 是多级列索引 (ticker, field)
                for ticker in tickers:
                    try:
                        # 检查该 ticker 的 Close 列是否有有效数据
                        if ticker in data.columns.get_level_values(0):
                            ticker_data = data[ticker]
                            if "Close" in ticker_data.columns:
                                close_series = ticker_data["Close"]
                                if not close_series.isna().all():
                                    valid_tickers.append(ticker)
                    except (KeyError, TypeError):
                        # 该 ticker 数据不存在或格式异常，跳过
                        continue

        except Exception as e:
            print(f"⚠️ yfinance validation failed: {e}")
            # 验证失败时，返回空列表（保守策略）
            # 如需宽松策略，可以返回原始 tickers
            return []

        return valid_tickers

    async def summarize(self, tweet_text: str, max_length: int = 100) -> str:
        """
        生成推文摘要

        Args:
            tweet_text: 推文原文
            max_length: 摘要最大长度

        Returns:
            str: 摘要
        """
        prompt = f"""Summarize this financial tweet in {max_length} characters or less.
Focus on key financial information.

Tweet: "{tweet_text}"

Respond with ONLY the summary text, no quotes or formatting."""

        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.3,
                max_tokens=150,
            )
            return response.strip()[:max_length]
        except Exception:
            return tweet_text[:max_length]

    async def generate_tags(self, tweet_text: str, max_tags: int = 5) -> List[str]:
        """
        为推文生成标签

        Returns:
            ["earnings", "tech", "bullish", ...]
        """
        prompt = f"""Generate up to {max_tags} relevant tags for this financial tweet.

Tweet: "{tweet_text}"

Respond with ONLY a JSON array of lowercase tags, no other text:
["earnings", "tech", "bullish"]"""

        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.2,
                max_tokens=100,
            )

            result = extract_json_array(response)
            if result is not None:
                return result[:max_tags]

            return []

        except Exception:
            return []

    async def check_stock_related(self, tweet_text: str) -> Dict[str, Any]:
        """
        检测推文是否与股市/金融市场相关

        Returns:
            {
                "is_stock_related": True/False,
                "confidence": 0.0-1.0,
                "reason": "..."
            }
        """
        prompt = f"""Is this tweet related to stocks, financial markets, or investing?

Tweet: "{tweet_text}"

Respond with ONLY a JSON object, no other text:
{{"is_stock_related": true/false, "confidence": 0.0-1.0, "reason": "brief reason"}}"""

        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=150,
            )

            result = extract_json_object(response)
            if result:
                return {
                    "is_stock_related": result.get("is_stock_related", False),
                    "confidence": result.get("confidence", 0.5),
                    "reason": result.get("reason", ""),
                }

            return {
                "is_stock_related": False,
                "confidence": 0.5,
                "reason": "Unable to parse response",
            }

        except Exception as e:
            return {
                "is_stock_related": False,
                "confidence": 0.0,
                "reason": f"Error: {str(e)}",
            }

    async def basic_analysis(self, tweet_text: str) -> Dict[str, Any]:
        """
        基础分析推文 - 用于插入时自动分析 (情感、股票代码、标签、股市相关性、摘要、投资信号)

        Returns:
            {
                "sentiment": {"sentiment": "bullish", "confidence": 0.85, "reasoning": "..."},
                "tickers": ["AAPL", "NVDA"],
                "tags": ["tech", "earnings"],
                "summary": "Brief summary of the tweet",
                "trading_signal": {"action": "buy", "tickers": ["AAPL"], "confidence": 0.7},
                "is_stock_related": {"is_stock_related": True, "confidence": 0.9, "reason": "..."},
                "analyzed_at": "2024-01-15T10:30:00Z",
                "model": "llama3-8b-finance"
            }
        """
        prompt = f"""Analyze this financial tweet comprehensively.

Tweet: "{tweet_text}"

Respond with ONLY this JSON object, no other text:
{{
  "is_stock_related": true/false,
  "sentiment": "bullish/bearish/neutral",
  "sentiment_confidence": 0.0-1.0,
  "sentiment_reasoning": "brief reason",
  "tickers": ["SYMBOL1", "SYMBOL2"],
  "tags": ["tag1", "tag2"],
  "summary": "Brief summary in 100 chars",
  "trading_action": "buy/sell/hold/null",
  "trading_confidence": 0.0-1.0,
  "stock_related_confidence": 0.0-1.0,
  "stock_related_reason": "brief reason"
}}"""

        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=400,
            )

            result = extract_json_object(response)

            if result:
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
                    "analyzed_at": datetime.now(timezone.utc).isoformat(),
                    "model": self.client.model,
                }

            return self._default_basic_analysis_result()

        except Exception as e:
            print(f"⚠️ Basic analysis failed: {e}")
            return self._default_basic_analysis_result()

    async def full_analysis(self, tweet_text: str) -> Dict[str, Any]:
        """
        完整分析推文 (一次 API 调用完成所有分析)

        Returns:
            {
                "sentiment": {"sentiment": "bullish", "confidence": 0.85, "reasoning": "..."},
                "tickers": ["AAPL", "NVDA"],
                "tags": ["tech", "earnings"],
                "trading_signal": {"action": "buy", "tickers": ["AAPL"], "confidence": 0.7},
                "summary": "Summary",
                "is_stock_related": {"is_stock_related": True, "confidence": 0.9, "reason": "..."},
                "analyzed_at": "2024-01-15T10:30:00Z",
                "model": "llama3-8b-finance"
            }
        """
        # 使用单次调用完成所有分析
        prompt = f"""Analyze this financial tweet comprehensively.

Tweet: "{tweet_text}"

Respond with ONLY this JSON object, no other text before or after:
{{
  "is_stock_related": true/false,
  "sentiment": "bullish/bearish/neutral",
  "sentiment_confidence": 0.0-1.0,
  "sentiment_reasoning": "brief reason",
  "tickers": ["SYMBOL1", "SYMBOL2"],
  "sectors": ["Technology", "Finance"],
  "tags": ["tag1", "tag2"],
  "trading_action": "buy/sell/hold/null",
  "trading_confidence": 0.0-1.0,
  "summary": "Summary in 100 chars",
  "stock_related_confidence": 0.0-1.0,
  "stock_related_reason": "brief reason"
}}"""

        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=500,
            )

            result = extract_json_object(response)

            if result:
                return {
                    "sentiment": {
                        "sentiment": result.get("sentiment", "neutral"),
                        "confidence": result.get("sentiment_confidence", 0.5),
                        "reasoning": result.get("sentiment_reasoning", ""),
                    },
                    "tickers": result.get("tickers", []),
                    "tags": result.get("tags", []),
                    "trading_signal": {
                        "action": result.get("trading_action"),
                        "tickers": result.get("tickers", []),
                        "confidence": result.get("trading_confidence"),
                    },
                    "summary": result.get("summary", ""),
                    "is_stock_related": {
                        "is_stock_related": result.get("is_stock_related", False),
                        "confidence": result.get("stock_related_confidence", 0.5),
                        "reason": result.get("stock_related_reason", ""),
                    },
                    "sectors": result.get("sectors", []),
                    "analyzed_at": datetime.now(timezone.utc).isoformat(),
                    "model": self.client.model,
                }

            # 解析失败，返回默认结构
            return self._default_analysis_result()

        except Exception as e:
            print(f"⚠️ Full analysis failed: {e}")
            return self._default_analysis_result()

    def _default_basic_analysis_result(self) -> Dict[str, Any]:
        """返回默认的基础分析结果结构"""
        return {
            "sentiment": {
                "sentiment": "neutral",
                "confidence": 0.0,
                "reasoning": "Analysis failed",
            },
            "tickers": [],
            "tags": [],
            "summary": "",
            "trading_signal": {"action": None, "tickers": [], "confidence": None},
            "is_stock_related": {
                "is_stock_related": False,
                "confidence": 0.0,
                "reason": "Analysis failed",
            },
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
            "model": self.client.model,
        }

    def _default_analysis_result(self) -> Dict[str, Any]:
        """返回默认的完整分析结果结构"""
        return {
            "sentiment": {
                "sentiment": "neutral",
                "confidence": 0.0,
                "reasoning": "Analysis failed",
            },
            "tickers": [],
            "tags": [],
            "trading_signal": {"action": None, "tickers": [], "confidence": None},
            "summary": "",
            "is_stock_related": {
                "is_stock_related": False,
                "confidence": 0.0,
                "reason": "Analysis failed",
            },
            "sectors": [],
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
            "model": self.client.model,
        }
