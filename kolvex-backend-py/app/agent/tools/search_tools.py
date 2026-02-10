"""
Search/Knowledge Tools
封装 Dify 知识库和 Dataroma 超级投资者数据为 LangGraph 工具
"""

import json
import logging
from langchain_core.tools import tool

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)


@tool
def search_knowledge_base(query: str, knowledge_base: str = "all", limit: int = 5) -> str:
    """Search the Kolvex knowledge base for relevant financial information from KOL posts, news, and Xiaohongshu.

    Args:
        query: Search query text (e.g. 'NVDA earnings outlook', 'AI chip competition')
        knowledge_base: Which knowledge base to search - one of: kol_posts, news, xiaohongshu, all (default: all)
        limit: Maximum number of results (default 5)

    Returns:
        JSON string with matching knowledge base entries
    """
    try:
        supabase = get_supabase_service()
        results = []

        if knowledge_base in ("kol_posts", "all"):
            # 搜索 KOL 推文
            try:
                kol_result = (
                    supabase.table("kol_tweets")
                    .select("username, full_text, created_at, sentiment, tickers")
                    .ilike("full_text", f"%{query}%")
                    .order("created_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                for item in (kol_result.data or []):
                    results.append({
                        "source": "kol_posts",
                        "author": item.get("username"),
                        "content": (item.get("full_text") or "")[:500],
                        "date": item.get("created_at"),
                        "sentiment": item.get("sentiment"),
                        "tickers": item.get("tickers", []),
                    })
            except Exception as e:
                logger.warning(f"Error searching KOL posts: {e}")

        if knowledge_base in ("news", "all"):
            # 搜索新闻文章
            try:
                news_result = (
                    supabase.table("news_articles")
                    .select("title, summary, url, published_at, tickers")
                    .ilike("title", f"%{query}%")
                    .order("published_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                for item in (news_result.data or []):
                    results.append({
                        "source": "news",
                        "title": item.get("title"),
                        "content": (item.get("summary") or "")[:500],
                        "url": item.get("url"),
                        "date": item.get("published_at"),
                        "tickers": item.get("tickers", []),
                    })
            except Exception as e:
                logger.warning(f"Error searching news: {e}")

        if knowledge_base in ("xiaohongshu", "all"):
            # 搜索小红书
            try:
                xhs_result = (
                    supabase.table("xiaohongshu_posts")
                    .select("author, title, content, created_at, tickers")
                    .ilike("content", f"%{query}%")
                    .order("created_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                for item in (xhs_result.data or []):
                    results.append({
                        "source": "xiaohongshu",
                        "author": item.get("author"),
                        "title": item.get("title"),
                        "content": (item.get("content") or "")[:500],
                        "date": item.get("created_at"),
                        "tickers": item.get("tickers", []),
                    })
            except Exception as e:
                logger.warning(f"Error searching Xiaohongshu: {e}")

        return json.dumps(
            {
                "query": query,
                "knowledge_base": knowledge_base,
                "count": len(results),
                "results": results,
            },
            indent=2,
            default=str,
        )
    except Exception as e:
        logger.error(f"Error searching knowledge base: {e}")
        return json.dumps({"error": f"Failed to search knowledge base: {str(e)}"})


@tool
def get_superinvestor_holdings(investor_name: str = "", ticker: str = "") -> str:
    """Get super investor (hedge fund) holdings from Dataroma. Can search by investor name or stock ticker.

    Args:
        investor_name: Super investor name to search (optional, e.g. 'Warren Buffett', 'Michael Burry')
        ticker: Stock ticker to find which super investors hold it (optional, e.g. 'AAPL')

    Returns:
        JSON string with super investor holdings data
    """
    try:
        supabase = get_supabase_service()

        if ticker:
            # 查找持有某只股票的超级投资者
            result = (
                supabase.table("dataroma_holdings")
                .select("manager_name, symbol, company, portfolio_percent, shares, reported_price, value")
                .ilike("symbol", ticker.upper())
                .order("portfolio_percent", desc=True)
                .limit(20)
                .execute()
            )

            holdings = result.data or []
            return json.dumps(
                {
                    "ticker": ticker.upper(),
                    "investors_holding": len(holdings),
                    "holdings": holdings,
                },
                indent=2,
                default=str,
            )

        elif investor_name:
            # 查找某个投资者的持仓
            result = (
                supabase.table("dataroma_holdings")
                .select("manager_name, symbol, company, portfolio_percent, shares, reported_price, value")
                .ilike("manager_name", f"%{investor_name}%")
                .order("portfolio_percent", desc=True)
                .limit(20)
                .execute()
            )

            holdings = result.data or []
            return json.dumps(
                {
                    "investor": investor_name,
                    "position_count": len(holdings),
                    "holdings": holdings,
                },
                indent=2,
                default=str,
            )

        else:
            # 列出所有超级投资者
            result = (
                supabase.table("dataroma_superinvestors")
                .select("name, portfolio_value, num_holdings, top_holding, turnover")
                .order("portfolio_value", desc=True)
                .limit(20)
                .execute()
            )

            investors = result.data or []
            return json.dumps(
                {
                    "total_investors": len(investors),
                    "investors": investors,
                },
                indent=2,
                default=str,
            )

    except Exception as e:
        logger.error(f"Error getting super investor data: {e}")
        return json.dumps({"error": f"Failed to get super investor data: {str(e)}"})
