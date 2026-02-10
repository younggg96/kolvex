"""
KOL Tools
封装 KOL 推文查询和分析服务为 LangGraph 工具
"""

import json
import logging
from typing import Optional
from langchain_core.tools import tool

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)


@tool
def get_kol_latest_tweets(
    username: str = "",
    ticker: str = "",
    limit: int = 10,
) -> str:
    """Get latest KOL (Key Opinion Leader) tweets from the database. Can filter by KOL username or stock ticker.

    Args:
        username: KOL Twitter/X username to filter by (optional, e.g. 'elonmusk')
        ticker: Stock ticker symbol to search in tweets (optional, e.g. 'TSLA')
        limit: Maximum number of tweets to return (default 10)

    Returns:
        JSON string with KOL tweets including content, sentiment, and analysis
    """
    try:
        supabase = get_supabase_service()

        query = (
            supabase.table("kol_tweets")
            .select("id, username, full_text, created_at, sentiment, tickers, ai_analysis")
            .order("created_at", desc=True)
            .limit(limit)
        )

        if username:
            query = query.eq("username", username)

        if ticker:
            query = query.contains("tickers", [ticker.upper()])

        result = query.execute()

        tweets = []
        for tweet in (result.data or []):
            tweets.append({
                "id": tweet.get("id"),
                "username": tweet.get("username"),
                "content": tweet.get("full_text", "")[:500],  # 限制长度
                "created_at": tweet.get("created_at"),
                "sentiment": tweet.get("sentiment"),
                "tickers": tweet.get("tickers", []),
                "ai_analysis": tweet.get("ai_analysis"),
            })

        return json.dumps(
            {
                "filter": {"username": username, "ticker": ticker},
                "count": len(tweets),
                "tweets": tweets,
            },
            indent=2,
            default=str,
        )
    except Exception as e:
        logger.error(f"Error getting KOL tweets: {e}")
        return json.dumps({"error": f"Failed to get KOL tweets: {str(e)}"})


@tool
def analyze_kol_sentiment(ticker: str, limit: int = 20) -> str:
    """Analyze overall KOL sentiment for a specific stock by aggregating recent KOL tweets and their sentiment scores.

    Args:
        ticker: Stock ticker symbol (e.g. AAPL, TSLA, NVDA)
        limit: Number of recent tweets to analyze (default 20)

    Returns:
        JSON string with aggregated sentiment analysis (positive/negative/neutral counts, key opinions)
    """
    try:
        supabase = get_supabase_service()

        result = (
            supabase.table("kol_tweets")
            .select("username, full_text, sentiment, tickers, created_at")
            .contains("tickers", [ticker.upper()])
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        tweets = result.data or []

        if not tweets:
            return json.dumps({
                "ticker": ticker,
                "total_tweets": 0,
                "message": f"No KOL tweets found mentioning {ticker}"
            })

        # 聚合情感分析
        sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0, "unknown": 0}
        kol_opinions = []

        for tweet in tweets:
            sentiment = (tweet.get("sentiment") or "unknown").lower()
            if sentiment in sentiment_counts:
                sentiment_counts[sentiment] += 1
            else:
                sentiment_counts["unknown"] += 1

            kol_opinions.append({
                "username": tweet.get("username"),
                "sentiment": sentiment,
                "snippet": (tweet.get("full_text") or "")[:200],
                "date": tweet.get("created_at"),
            })

        total = len(tweets)
        return json.dumps(
            {
                "ticker": ticker,
                "total_tweets": total,
                "sentiment_breakdown": sentiment_counts,
                "positive_ratio": round(sentiment_counts["positive"] / max(total, 1) * 100, 1),
                "negative_ratio": round(sentiment_counts["negative"] / max(total, 1) * 100, 1),
                "recent_opinions": kol_opinions[:5],
            },
            indent=2,
            default=str,
        )
    except Exception as e:
        logger.error(f"Error analyzing KOL sentiment for {ticker}: {e}")
        return json.dumps({"error": f"Failed to analyze KOL sentiment for {ticker}: {str(e)}"})
