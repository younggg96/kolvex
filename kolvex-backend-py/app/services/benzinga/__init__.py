"""
Benzinga News API 客户端模块
提供金融新闻数据获取功能，用于 AI 投资分析管道

模块结构:
- client.py: Benzinga API 客户端 (异步/同步)
- models.py: 新闻数据模型
- analyzer.py: 新闻 AI 分析器
"""

from .client import (
    BenzingaClient,
    BenzingaClientSync,
    get_news_for_llm,
    get_recent_news_for_llm,
)
from .models import NewsArticle, BenzingaNewsResponse, BenzingaRawArticle
from .analyzer import (
    NewsAnalyzer,
    NewsAnalyzerSync,
    NewsAIAnalysis,
    analyze_news_article,
    analyze_news_article_sync,
)

__all__ = [
    # 客户端
    "BenzingaClient",
    "BenzingaClientSync",
    "get_news_for_llm",
    "get_recent_news_for_llm",
    # 数据模型
    "NewsArticle",
    "BenzingaNewsResponse",
    "BenzingaRawArticle",
    # AI 分析
    "NewsAnalyzer",
    "NewsAnalyzerSync",
    "NewsAIAnalysis",
    "analyze_news_article",
    "analyze_news_article_sync",
]

