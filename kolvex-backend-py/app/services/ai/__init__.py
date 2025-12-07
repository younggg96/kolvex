"""
AI 服务模块
使用本地 Ollama + Llama-3-8B-Finance 进行推文分析、情感分析等

模型: QuantFactory/Llama-3-8B-Instruct-Finance-RAG-GGUF:Q4_K_M
API 文档: https://github.com/ollama/ollama/blob/main/docs/api.md

模块结构:
- config.py: 配置参数
- utils.py: JSON 解析工具
- client.py: Ollama API 客户端 (异步/同步)
- analyzer.py: 推文分析器
- db.py: 数据库操作
"""

# 配置
from .config import (
    OLLAMA_BASE_URL,
    DEFAULT_MODEL,
    REQUEST_TIMEOUT,
)

# 工具函数
from .utils import (
    extract_json_object,
    extract_json_array,
)

# 客户端
from .client import (
    OllamaClient,
    OllamaClientSync,
)

# 分析器
from .analyzer import TweetAnalyzer, TweetAnalyzerSync

# 数据库操作
from .db import (
    save_analysis_to_db,
    analyze_and_save_tweet,
    batch_analyze_tweets,
)

# 类型
from typing import Dict, Any


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


# 导出所有公共接口
__all__ = [
    # 配置
    "OLLAMA_BASE_URL",
    "DEFAULT_MODEL",
    "REQUEST_TIMEOUT",
    # 工具
    "extract_json_object",
    "extract_json_array",
    # 客户端
    "OllamaClient",
    "OllamaClientSync",
    # 分析器
    "TweetAnalyzer",
    "TweetAnalyzerSync",
    # 数据库
    "save_analysis_to_db",
    "analyze_and_save_tweet",
    "batch_analyze_tweets",
    # 便捷函数
    "get_ai_client",
    "analyze_tweet",
    "quick_sentiment",
]
