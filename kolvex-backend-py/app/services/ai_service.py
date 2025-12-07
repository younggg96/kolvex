"""
AI 服务模块 - 兼容层

使用本地 Ollama + Llama-3-8B-Finance 进行推文分析、情感分析等

模型: QuantFactory/Llama-3-8B-Instruct-Finance-RAG-GGUF:Q4_K_M
API 文档: https://github.com/ollama/ollama/blob/main/docs/api.md

模块结构:
- app/services/ai/config.py: 配置参数
- app/services/ai/utils.py: JSON 解析工具
- app/services/ai/client.py: Ollama API 客户端
- app/services/ai/analyzer.py: 推文分析器
- app/services/ai/db.py: 数据库操作
"""

# 从新模块导入所有内容以保持兼容性
from app.services.ai import (
    # 配置
    OLLAMA_BASE_URL,
    DEFAULT_MODEL,
    REQUEST_TIMEOUT,
    # 工具
    extract_json_object,
    extract_json_array,
    # 客户端
    OllamaClient,
    OllamaClientSync,
    # 分析器
    TweetAnalyzer,
    # 数据库
    save_analysis_to_db,
    analyze_and_save_tweet,
    batch_analyze_tweets,
    # 便捷函数
    get_ai_client,
    analyze_tweet,
    quick_sentiment,
)

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
    # 数据库
    "save_analysis_to_db",
    "analyze_and_save_tweet",
    "batch_analyze_tweets",
    # 便捷函数
    "get_ai_client",
    "analyze_tweet",
    "quick_sentiment",
]
