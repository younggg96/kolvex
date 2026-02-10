"""
Web Search Tools
网络搜索工具，使用 Tavily API 进行实时网络搜索
"""

import json
import logging
from langchain_core.tools import tool

from app.agent.config import TAVILY_API_KEY

logger = logging.getLogger(__name__)


@tool
def web_search(query: str, max_results: int = 5) -> str:
    """Search the web for real-time information on any topic. Use this when other specialized tools cannot provide the needed information, or when you need the very latest news, events, or general knowledge.

    Args:
        query: Search query text (e.g. 'latest Fed interest rate decision', 'NVDA earnings 2025 Q4')
        max_results: Maximum number of search results to return (default 5, max 10)

    Returns:
        JSON string with web search results including titles, snippets, and URLs
    """
    if not TAVILY_API_KEY:
        return json.dumps({
            "error": "Web search is not configured. Please set TAVILY_API_KEY in .env"
        })

    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=TAVILY_API_KEY)

        # 使用 Tavily 搜索
        response = client.search(
            query=query,
            max_results=min(max_results, 10),
            search_depth="basic",
            include_answer=True,
        )

        results = []
        for item in response.get("results", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "content": item.get("content", "")[:500],
                "score": item.get("score", 0),
            })

        return json.dumps(
            {
                "query": query,
                "answer": response.get("answer", ""),
                "count": len(results),
                "results": results,
            },
            indent=2,
            ensure_ascii=False,
        )

    except ImportError:
        logger.error("tavily-python package not installed. Run: pip install tavily-python")
        return json.dumps({"error": "tavily-python package not installed"})
    except Exception as e:
        logger.error(f"Web search error: {e}")
        return json.dumps({"error": f"Web search failed: {str(e)}"})
