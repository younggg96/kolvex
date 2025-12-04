"""
AI 服务模块
使用 Ollama API 进行推文分析、情感分析等

API 文档: https://github.com/ollama/ollama/blob/main/docs/api.md
"""

import os
import re
import json
import httpx
from typing import Optional, Dict, List, Any
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# 配置
# ============================================================

# Ollama API Base URL (可以通过环境变量覆盖)
OLLAMA_BASE_URL = os.getenv(
    "OLLAMA_BASE_URL", "https://zaksw0tikh2qca-11434.proxy.runpod.net"
)

# 默认模型
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1:70b")

# 请求超时 (秒) - DeepSeek R1 需要更长的思考时间
REQUEST_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "300.0"))


# ============================================================
# 工具函数
# ============================================================


def strip_think_tags(text: str) -> str:
    """
    移除 DeepSeek R1 模型输出的 <think>...</think> 思考过程标签

    Args:
        text: 模型原始输出

    Returns:
        str: 清理后的文本
    """
    if not text:
        return text
    # 移除 <think>...</think> 标签及其内容（支持多行）
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    return cleaned.strip()


def extract_json_object(text: str) -> Optional[Dict]:
    """
    从文本中提取第一个有效的 JSON 对象

    Args:
        text: 清理后的文本

    Returns:
        Dict 或 None
    """
    if not text:
        return None

    # 先清理 think 标签
    cleaned = strip_think_tags(text)

    # 查找 JSON 对象
    json_start = cleaned.find("{")
    if json_start < 0:
        return None

    # 从找到的位置开始，尝试找到匹配的结束括号
    brace_count = 0
    json_end = -1
    for i, char in enumerate(cleaned[json_start:], start=json_start):
        if char == "{":
            brace_count += 1
        elif char == "}":
            brace_count -= 1
            if brace_count == 0:
                json_end = i + 1
                break

    if json_end > json_start:
        try:
            json_str = cleaned[json_start:json_end]
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass

    return None


def extract_json_array(text: str) -> Optional[List]:
    """
    从文本中提取第一个有效的 JSON 数组

    Args:
        text: 清理后的文本

    Returns:
        List 或 None
    """
    if not text:
        return None

    # 先清理 think 标签
    cleaned = strip_think_tags(text)

    # 查找 JSON 数组
    json_start = cleaned.find("[")
    if json_start < 0:
        return None

    # 从找到的位置开始，尝试找到匹配的结束括号
    bracket_count = 0
    json_end = -1
    for i, char in enumerate(cleaned[json_start:], start=json_start):
        if char == "[":
            bracket_count += 1
        elif char == "]":
            bracket_count -= 1
            if bracket_count == 0:
                json_end = i + 1
                break

    if json_end > json_start:
        try:
            json_str = cleaned[json_start:json_end]
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass

    return None


# ============================================================
# Ollama API 客户端
# ============================================================


class OllamaClient:
    """Ollama API 客户端"""

    def __init__(
        self, base_url: str = None, model: str = None, timeout: float = REQUEST_TIMEOUT
    ):
        self.base_url = (base_url or OLLAMA_BASE_URL).rstrip("/")
        self.model = model or DEFAULT_MODEL
        self.timeout = timeout
        self._client = httpx.AsyncClient(timeout=timeout)

    async def close(self):
        """关闭客户端"""
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    # ========== 基础 API ==========

    async def generate(
        self,
        prompt: str,
        model: str = None,
        system: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        stream: bool = False,
    ) -> str:
        """
        生成文本

        Args:
            prompt: 用户提示
            model: 模型名称 (可选，默认使用实例配置)
            system: 系统提示 (可选)
            temperature: 温度 (0-1)
            max_tokens: 最大 token 数
            stream: 是否流式输出

        Returns:
            str: 生成的文本
        """
        url = f"{self.base_url}/api/generate"

        payload = {
            "model": model or self.model,
            "prompt": prompt,
            "stream": stream,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        if system:
            payload["system"] = system

        response = await self._client.post(url, json=payload)
        response.raise_for_status()

        data = response.json()
        return data.get("response", "")

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        stream: bool = False,
    ) -> str:
        """
        聊天补全

        Args:
            messages: 消息列表 [{"role": "user/assistant/system", "content": "..."}]
            model: 模型名称
            temperature: 温度
            max_tokens: 最大 token 数
            stream: 是否流式

        Returns:
            str: AI 回复内容
        """
        url = f"{self.base_url}/api/chat"

        payload = {
            "model": model or self.model,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        response = await self._client.post(url, json=payload)
        response.raise_for_status()

        data = response.json()
        return data.get("message", {}).get("content", "")

    async def embeddings(self, text: str, model: str = None) -> List[float]:
        """
        生成文本嵌入向量

        Args:
            text: 输入文本
            model: 模型名称

        Returns:
            List[float]: 嵌入向量
        """
        url = f"{self.base_url}/api/embeddings"

        payload = {"model": model or self.model, "prompt": text}

        response = await self._client.post(url, json=payload)
        response.raise_for_status()

        data = response.json()
        return data.get("embedding", [])

    async def list_models(self) -> List[Dict]:
        """获取可用模型列表"""
        url = f"{self.base_url}/api/tags"
        response = await self._client.get(url)
        response.raise_for_status()
        data = response.json()
        return data.get("models", [])

    async def health_check(self) -> bool:
        """健康检查"""
        try:
            url = f"{self.base_url}/api/tags"
            response = await self._client.get(url, timeout=10.0)
            return response.status_code == 200
        except Exception:
            return False


# ============================================================
# 推文分析服务
# ============================================================


class TweetAnalyzer:
    """推文分析器 - 使用 AI 分析推文内容"""

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
        system_prompt = """You are a financial sentiment analyzer. Analyze the given tweet and determine:
1. Sentiment: bullish (positive about markets/stocks), bearish (negative), or neutral
2. Confidence: 0.0 to 1.0
3. Brief reasoning (1-2 sentences)

Respond in JSON format only:
{"sentiment": "bullish|bearish|neutral", "confidence": 0.85, "reasoning": "..."}"""

        try:
            response = await self.client.chat(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Analyze this tweet:\n\n{tweet_text}"},
                ],
                temperature=0.3,
                max_tokens=2500,
            )

            # 使用新的 JSON 提取函数（自动处理 <think> 标签）
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
        从推文中提取股票代码

        Returns:
            ["AAPL", "TSLA", ...]
        """
        system_prompt = """Extract stock tickers (symbols) mentioned in the tweet.
Look for:
- $SYMBOL format
- Company names that map to tickers
- Common stock abbreviations

Respond with JSON array only: ["AAPL", "TSLA"]
If no tickers found, respond: []"""

        try:
            response = await self.client.chat(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": f"Extract tickers from:\n\n{tweet_text}",
                    },
                ],
                temperature=0.1,
                max_tokens=2500,
            )

            # 使用新的 JSON 提取函数（自动处理 <think> 标签）
            result = extract_json_array(response)
            if result is not None:
                return result

            return []

        except Exception:
            return []

    async def summarize(self, tweet_text: str, max_length: int = 100) -> str:
        """
        生成推文摘要

        Args:
            tweet_text: 推文原文
            max_length: 摘要最大长度

        Returns:
            str: 摘要
        """
        system_prompt = f"""Summarize the following tweet in {max_length} characters or less.
Focus on the key financial/market information.
Respond with the summary text only, no quotes or formatting."""

        try:
            response = await self.client.chat(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": tweet_text},
                ],
                temperature=0.3,
                max_tokens=2500,
            )
            # 清理 <think> 标签后再提取摘要
            cleaned = strip_think_tags(response)
            return cleaned.strip()[:max_length]
        except Exception:
            return tweet_text[:max_length]

    async def generate_tags(self, tweet_text: str, max_tags: int = 5) -> List[str]:
        """
        为推文生成标签

        Returns:
            ["earnings", "tech", "bullish", ...]
        """
        system_prompt = f"""Generate up to {max_tags} relevant tags for this financial tweet.
Tags should be lowercase, single words or short phrases.
Categories: sector (tech, finance, energy), sentiment (bullish, bearish), 
event type (earnings, merger, ipo), asset class (stocks, crypto, bonds).

Respond with JSON array only: ["tag1", "tag2"]"""

        try:
            response = await self.client.chat(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Generate tags for:\n\n{tweet_text}"},
                ],
                temperature=0.3,
                max_tokens=2500,
            )

            # 使用新的 JSON 提取函数（自动处理 <think> 标签）
            result = extract_json_array(response)
            if result is not None:
                return result[:max_tags]

            return []

        except Exception:
            return []

    async def analyze_trading_signal(
        self, tweet_text: str, tickers: List[str] = None
    ) -> Dict[str, Any]:
        """
        分析投资信号

        Returns:
            {
                "action": "buy" | "sell" | "hold" | null,
                "tickers": ["AAPL"],
                "confidence": 0.7
            }
        """
        system_prompt = """Analyze this financial tweet for trading signals.
Determine if there's an actionable trading recommendation.

Consider:
- Is the author suggesting to buy, sell, or hold?
- Which tickers are being recommended?
- How confident is the signal? (0.0-1.0)

If no clear trading signal, return null for action.

Respond in JSON format only:
{"action": "buy"|"sell"|"hold"|null, "tickers": ["AAPL"], "confidence": 0.7}"""

        try:
            context = tweet_text
            if tickers:
                context += f"\n\nDetected tickers: {', '.join(tickers)}"

            response = await self.client.chat(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": f"Analyze trading signal:\n\n{context}",
                    },
                ],
                temperature=0.3,
                max_tokens=2500,
            )

            # 使用新的 JSON 提取函数（自动处理 <think> 标签）
            result = extract_json_object(response)
            if result:
                return {
                    "action": result.get("action"),
                    "tickers": result.get("tickers", tickers or []),
                    "confidence": result.get("confidence"),
                }

            return {"action": None, "tickers": tickers or [], "confidence": None}

        except Exception as e:
            return {"action": None, "tickers": tickers or [], "confidence": None}

    async def generate_summary_cn(self, tweet_text: str, max_length: int = 100) -> str:
        """
        生成中文摘要
        """
        system_prompt = f"""将以下金融推文翻译并总结为中文，不超过{max_length}个字符。
只返回摘要文本，不要引号或格式。"""

        try:
            response = await self.client.chat(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": tweet_text},
                ],
                temperature=0.3,
                max_tokens=2000,
            )
            # 清理 <think> 标签后再提取摘要
            cleaned = strip_think_tags(response)
            return cleaned.strip()[:max_length]
        except Exception:
            return ""

    async def full_analysis(self, tweet_text: str) -> Dict[str, Any]:
        """
        完整分析推文

        Returns:
            {
                "sentiment": {"value": "bullish", "confidence": 0.85, "reasoning": "..."},
                "tickers": ["AAPL", "NVDA"],
                "tags": ["tech", "earnings"],
                "trading_signal": {"action": "buy", "tickers": ["AAPL"], "confidence": 0.7},
                "summary": "中文摘要",
                "summary_en": "English summary",
                "analyzed_at": "2024-01-15T10:30:00Z",
                "model": "llama3.2"
            }
        """
        import asyncio

        # 第一阶段：并行执行基础分析
        sentiment_task = self.analyze_sentiment(tweet_text)
        tickers_task = self.extract_tickers(tweet_text)
        summary_en_task = self.summarize(tweet_text)
        summary_cn_task = self.generate_summary_cn(tweet_text)
        tags_task = self.generate_tags(tweet_text)

        sentiment, tickers, summary_en, summary_cn, tags = await asyncio.gather(
            sentiment_task, tickers_task, summary_en_task, summary_cn_task, tags_task
        )

        # 第二阶段：基于提取的 tickers 分析交易信号
        trading_signal = await self.analyze_trading_signal(tweet_text, tickers)

        return {
            "sentiment": sentiment,
            "tickers": tickers,
            "tags": tags,
            "trading_signal": trading_signal,
            "summary": summary_cn,
            "summary_en": summary_en,
            "analyzed_at": datetime.utcnow().isoformat(),
            "model": self.client.model,
        }


# ============================================================
# 便捷函数
# ============================================================


async def get_ai_client() -> OllamaClient:
    """获取 AI 客户端实例"""
    return OllamaClient()


async def analyze_tweet(tweet_text: str) -> Dict[str, Any]:
    """
    分析单条推文 (便捷函数)

    Usage:
        result = await analyze_tweet("$AAPL looking strong after earnings!")
    """
    async with OllamaClient() as client:
        analyzer = TweetAnalyzer(client)
        return await analyzer.full_analysis(tweet_text)


async def quick_sentiment(tweet_text: str) -> str:
    """
    快速获取情感 (便捷函数)

    Returns:
        "bullish" | "bearish" | "neutral"
    """
    async with OllamaClient() as client:
        analyzer = TweetAnalyzer(client)
        result = await analyzer.analyze_sentiment(tweet_text)
        return result.get("sentiment", "neutral")


# ============================================================
# 数据库操作 - 保存 AI 分析结果
# ============================================================


async def save_analysis_to_db(tweet_id: int, analysis: Dict[str, Any]) -> bool:
    """
    将 AI 分析结果保存到数据库

    Args:
        tweet_id: 推文 ID
        analysis: full_analysis 返回的分析结果

    Returns:
        bool: 保存成功返回 True
    """
    try:
        from app.core.supabase import get_supabase_service

        supabase = get_supabase_service()

        # 构建更新数据
        update_data = {
            # 情感分析
            "ai_sentiment": analysis.get("sentiment", {}).get("sentiment"),
            "ai_sentiment_confidence": analysis.get("sentiment", {}).get("confidence"),
            "ai_sentiment_reasoning": analysis.get("sentiment", {}).get("reasoning"),
            # 股票代码和标签 (JSONB)
            "ai_tickers": analysis.get("tickers", []),
            "ai_tags": analysis.get("tags", []),
            # 投资信号 (JSONB)
            "ai_trading_signal": analysis.get("trading_signal"),
            # 摘要
            "ai_summary": analysis.get("summary"),
            "ai_summary_en": analysis.get("summary_en"),
            # 元数据
            "ai_analyzed_at": analysis.get("analyzed_at"),
            "ai_model": analysis.get("model"),
        }

        # 更新数据库
        supabase.table("kol_tweets").update(update_data).eq("id", tweet_id).execute()

        return True

    except Exception as e:
        print(f"❌ 保存 AI 分析结果失败 (tweet_id={tweet_id}): {e}")
        return False


async def analyze_and_save_tweet(tweet_id: int, tweet_text: str) -> Dict[str, Any]:
    """
    分析推文并保存到数据库

    Args:
        tweet_id: 推文 ID
        tweet_text: 推文文本

    Returns:
        Dict: 分析结果
    """
    async with OllamaClient() as client:
        analyzer = TweetAnalyzer(client)
        analysis = await analyzer.full_analysis(tweet_text)

        # 保存到数据库
        await save_analysis_to_db(tweet_id, analysis)

        return analysis


async def batch_analyze_tweets(limit: int = 10) -> Dict[str, Any]:
    """
    批量分析未处理的推文

    Args:
        limit: 每批处理的推文数量

    Returns:
        Dict: 处理统计信息
    """
    try:
        from app.core.supabase import get_supabase_service

        supabase = get_supabase_service()

        # 查询未分析的推文
        result = (
            supabase.table("kol_tweets")
            .select("id, tweet_text")
            .is_("ai_analyzed_at", "null")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        tweets = result.data
        if not tweets:
            return {
                "processed": 0,
                "success": 0,
                "failed": 0,
                "message": "没有待分析的推文",
            }

        stats = {"processed": 0, "success": 0, "failed": 0, "results": []}

        async with OllamaClient() as client:
            analyzer = TweetAnalyzer(client)

            for tweet in tweets:
                tweet_id = tweet["id"]
                tweet_text = tweet["tweet_text"]

                try:
                    print(f"🔍 分析推文 #{tweet_id}: {tweet_text[:50]}...")

                    analysis = await analyzer.full_analysis(tweet_text)
                    saved = await save_analysis_to_db(tweet_id, analysis)

                    stats["processed"] += 1
                    if saved:
                        stats["success"] += 1
                        stats["results"].append(
                            {
                                "tweet_id": tweet_id,
                                "sentiment": analysis.get("sentiment", {}).get(
                                    "sentiment"
                                ),
                                "tickers": analysis.get("tickers", []),
                                "success": True,
                            }
                        )
                        print(
                            f"   ✅ 情感: {analysis.get('sentiment', {}).get('sentiment')} | "
                            f"股票: {analysis.get('tickers', [])}"
                        )
                    else:
                        stats["failed"] += 1
                        stats["results"].append(
                            {
                                "tweet_id": tweet_id,
                                "success": False,
                                "error": "保存失败",
                            }
                        )

                except Exception as e:
                    stats["processed"] += 1
                    stats["failed"] += 1
                    stats["results"].append(
                        {"tweet_id": tweet_id, "success": False, "error": str(e)}
                    )
                    print(f"   ❌ 分析失败: {e}")

        return stats

    except Exception as e:
        return {"processed": 0, "success": 0, "failed": 0, "error": str(e)}


# ============================================================
# 同步版本 (用于非异步环境)
# ============================================================


class OllamaClientSync:
    """同步版本的 Ollama 客户端"""

    def __init__(
        self, base_url: str = None, model: str = None, timeout: float = REQUEST_TIMEOUT
    ):
        self.base_url = (base_url or OLLAMA_BASE_URL).rstrip("/")
        self.model = model or DEFAULT_MODEL
        self.timeout = timeout

    def generate(
        self,
        prompt: str,
        model: str = None,
        system: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str:
        """同步生成文本"""
        url = f"{self.base_url}/api/generate"

        payload = {
            "model": model or self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        if system:
            payload["system"] = system

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")

    def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str:
        """同步聊天"""
        url = f"{self.base_url}/api/chat"

        payload = {
            "model": model or self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "")

    def health_check(self) -> bool:
        """健康检查"""
        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False


# ============================================================
# 测试
# ============================================================


if __name__ == "__main__":
    import asyncio

    async def test():
        print("🔍 测试 Ollama API...")
        print(f"📡 Base URL: {OLLAMA_BASE_URL}")
        print(f"🤖 Model: {DEFAULT_MODEL}")
        print()

        async with OllamaClient() as client:
            # 健康检查
            print("1️⃣ 健康检查...")
            is_healthy = await client.health_check()
            print(f"   ✅ API 状态: {'正常' if is_healthy else '异常'}")

            if not is_healthy:
                print("   ❌ API 不可用，请检查连接")
                return

            # 列出模型
            print("\n2️⃣ 可用模型...")
            models = await client.list_models()
            for m in models:
                print(f"   - {m.get('name', 'unknown')}")

            # 测试生成
            print("\n3️⃣ 测试文本生成...")
            response = await client.generate(
                prompt="Say hello in 5 words or less", temperature=0.5, max_tokens=20
            )
            print(f"   Response: {response}")

            # 测试推文分析
            print("\n4️⃣ 测试推文分析...")
            test_tweet = "$AAPL just smashed earnings! Revenue up 15% YoY. Tim Cook is a genius. 🚀📈"

            analyzer = TweetAnalyzer(client)

            print(f"   Tweet: {test_tweet}")
            print()

            # 情感分析
            sentiment = await analyzer.analyze_sentiment(test_tweet)
            print(f"   📊 Sentiment: {sentiment}")

            # 提取股票代码
            tickers = await analyzer.extract_tickers(test_tweet)
            print(f"   💹 Tickers: {tickers}")

            # 生成标签
            tags = await analyzer.generate_tags(test_tweet)
            print(f"   🏷️ Tags: {tags}")

        print("\n✅ 测试完成!")

    asyncio.run(test())
