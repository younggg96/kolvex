"""
股票代码分析服务
分析 Ticker 提及频率
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from .base_service import BaseAnalyticsService


class TickersService(BaseAnalyticsService):
    """股票代码分析服务"""

    async def get_ticker_analysis(
        self,
        limit: int = 20,
        days: Optional[int] = None,
        include_sentiment: bool = True,
    ) -> Dict[str, Any]:
        """
        获取股票代码热度分析

        Args:
            limit: 返回数量
            days: 分析天数
            include_sentiment: 是否包含情感分布

        Returns:
            股票分析数据
        """
        # 构建查询
        query = (
            self.supabase.table("kol_tweets")
            .select(
                "ai_tickers, ai_sentiment, views_count, like_count, "
                "retweet_count, created_at, username"
            )
            .eq("ai_is_stock_related", True)
        )

        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.gte("created_at", start_date.isoformat())

        result = query.execute()
        tweets = result.data or []

        # 统计 ticker 数据
        ticker_data: Dict[str, Dict] = {}

        for tweet in tweets:
            tickers = tweet.get("ai_tickers", [])
            if not tickers:
                continue

            sentiment = tweet.get("ai_sentiment", "neutral")
            views = self.safe_get(tweet, "views_count", 0)
            likes = self.safe_get(tweet, "like_count", 0)
            retweets = self.safe_get(tweet, "retweet_count", 0)
            username = tweet.get("username", "")

            for ticker in tickers:
                ticker = ticker.upper()
                if ticker not in ticker_data:
                    ticker_data[ticker] = {
                        "ticker": ticker,
                        "mention_count": 0,
                        "total_views": 0,
                        "total_likes": 0,
                        "total_retweets": 0,
                        "sentiment_counts": {"bullish": 0, "bearish": 0, "neutral": 0},
                        "unique_authors": set(),
                    }

                data = ticker_data[ticker]
                data["mention_count"] += 1
                data["total_views"] += views
                data["total_likes"] += likes
                data["total_retweets"] += retweets
                if sentiment in data["sentiment_counts"]:
                    data["sentiment_counts"][sentiment] += 1
                data["unique_authors"].add(username)

        # 转换 set 为 count，计算情感得分
        for ticker, data in ticker_data.items():
            data["unique_author_count"] = len(data["unique_authors"])
            del data["unique_authors"]

            # 计算情感得分
            total = sum(data["sentiment_counts"].values())
            if total > 0:
                data["sentiment_score"] = round(
                    (
                        data["sentiment_counts"]["bullish"]
                        - data["sentiment_counts"]["bearish"]
                    )
                    / total,
                    4,
                )
            else:
                data["sentiment_score"] = 0

        # 排序
        sorted_tickers = sorted(
            ticker_data.values(), key=lambda x: x["mention_count"], reverse=True
        )[:limit]

        # 如果不需要情感分布，移除该字段
        if not include_sentiment:
            for data in sorted_tickers:
                del data["sentiment_counts"]

        # 添加排名
        for i, data in enumerate(sorted_tickers, 1):
            data["rank"] = i

        return {
            "tickers": sorted_tickers,
            "total_unique_tickers": len(ticker_data),
            "summary": {
                "most_mentioned": (
                    sorted_tickers[0]["ticker"] if sorted_tickers else None
                ),
                "most_bullish": (
                    max(
                        ticker_data.values(),
                        key=lambda x: x["sentiment_score"],
                        default={"ticker": None},
                    )["ticker"]
                    if ticker_data
                    else None
                ),
                "most_bearish": (
                    min(
                        ticker_data.values(),
                        key=lambda x: x["sentiment_score"],
                        default={"ticker": None},
                    )["ticker"]
                    if ticker_data
                    else None
                ),
            },
        }

