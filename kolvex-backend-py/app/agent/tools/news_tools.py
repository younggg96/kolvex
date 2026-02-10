"""
News Tools
封装新闻聚合和搜索服务为 LangGraph 工具
"""

import json
import asyncio
import logging
from typing import Optional
from langchain_core.tools import tool

from app.services.news_aggregator import get_news_aggregator

logger = logging.getLogger(__name__)


@tool
def search_stock_news(ticker: str, limit: int = 10) -> str:
    """Search for latest news articles about a specific stock from multiple sources.

    Args:
        ticker: Stock ticker symbol (e.g. AAPL, TSLA, NVDA)
        limit: Maximum number of articles to return (default 10)

    Returns:
        JSON string with news articles including title, summary, url, and date
    """
    try:
        aggregator = get_news_aggregator()

        # 运行异步函数
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    asyncio.run,
                    aggregator.aggregate_news(ticker=ticker, limit=limit)
                )
                response = future.result(timeout=30)
        else:
            response = asyncio.run(
                aggregator.aggregate_news(ticker=ticker, limit=limit)
            )

        articles = []
        for article in response.articles[:limit]:
            articles.append({
                "title": article.title,
                "summary": article.summary,
                "url": article.url,
                "published_at": article.published_at,
                "tickers": article.tickers,
            })

        return json.dumps(
            {"ticker": ticker, "count": len(articles), "articles": articles},
            indent=2,
            default=str,
        )
    except Exception as e:
        logger.error(f"Error searching news for {ticker}: {e}")
        return json.dumps({"error": f"Failed to search news for {ticker}: {str(e)}"})


@tool
def get_trending_news(limit: int = 10) -> str:
    """Get trending financial news from major stocks and indices (SPY, QQQ, AAPL, NVDA, etc.).

    Args:
        limit: Maximum number of articles to return (default 10)

    Returns:
        JSON string with trending news articles
    """
    try:
        aggregator = get_news_aggregator()

        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    asyncio.run,
                    aggregator.get_trending_news(limit=limit)
                )
                articles_raw = future.result(timeout=30)
        else:
            articles_raw = asyncio.run(aggregator.get_trending_news(limit=limit))

        articles = []
        for article in articles_raw[:limit]:
            articles.append({
                "title": article.title,
                "summary": article.summary,
                "url": article.url,
                "published_at": article.published_at,
                "tickers": article.tickers,
            })

        return json.dumps(
            {"count": len(articles), "articles": articles},
            indent=2,
            default=str,
        )
    except Exception as e:
        logger.error(f"Error getting trending news: {e}")
        return json.dumps({"error": f"Failed to get trending news: {str(e)}"})
