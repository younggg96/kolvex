"""
仪表盘服务
提供综合数据概览
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import Counter
from .base_service import BaseAnalyticsService


class DashboardService(BaseAnalyticsService):
    """仪表盘服务"""

    async def get_dashboard_summary(
        self,
        days: int = 7,
    ) -> Dict[str, Any]:
        """
        获取综合数据仪表盘

        Args:
            days: 分析天数

        Returns:
            仪表盘概要数据
        """
        start_date = datetime.utcnow() - timedelta(days=days)

        # 查询基础数据
        result = (
            self.supabase.table("kol_tweets")
            .select(
                "username, created_at, views_count, like_count, retweet_count, "
                "reply_count, bookmark_count, ai_sentiment, ai_tickers, ai_is_stock_related"
            )
            .gte("created_at", start_date.isoformat())
            .execute()
        )

        tweets = result.data or []

        # 1. 基础统计
        total_tweets = len(tweets)
        total_views = sum(self.safe_get(t, "views_count", 0) for t in tweets)
        total_engagement = sum(
            self.safe_get(t, "like_count", 0)
            + self.safe_get(t, "retweet_count", 0)
            + self.safe_get(t, "reply_count", 0)
            + self.safe_get(t, "bookmark_count", 0)
            for t in tweets
        )

        unique_authors = len(set(t.get("username", "") for t in tweets))
        stock_related = sum(1 for t in tweets if t.get("ai_is_stock_related"))

        # 2. 情感分布
        sentiment_counts = {"bullish": 0, "bearish": 0, "neutral": 0}
        for t in tweets:
            s = t.get("ai_sentiment", "neutral")
            if s in sentiment_counts:
                sentiment_counts[s] += 1

        # 3. Top 5 Tickers
        ticker_counts: Counter = Counter()
        for t in tweets:
            for ticker in t.get("ai_tickers") or []:
                ticker_counts[ticker.upper()] += 1

        top_tickers = [
            {"ticker": ticker, "count": count}
            for ticker, count in ticker_counts.most_common(5)
        ]

        # 4. Top 3 KOLs (by views)
        author_views: Dict[str, int] = {}
        for t in tweets:
            username = t.get("username", "")
            author_views[username] = author_views.get(username, 0) + (
                self.safe_get(t, "views_count", 0)
            )

        top_kols = sorted(
            [{"username": k, "total_views": v} for k, v in author_views.items()],
            key=lambda x: x["total_views"],
            reverse=True,
        )[:3]

        # 5. 每日趋势
        daily_counts: Dict[str, int] = {}
        for t in tweets:
            if t.get("created_at"):
                date_str = t["created_at"][:10]
                daily_counts[date_str] = daily_counts.get(date_str, 0) + 1

        daily_trend = sorted(
            [{"date": k, "count": v} for k, v in daily_counts.items()],
            key=lambda x: x["date"],
        )

        return {
            "period": {
                "days": days,
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": datetime.utcnow().strftime("%Y-%m-%d"),
            },
            "overview": {
                "total_tweets": total_tweets,
                "total_views": total_views,
                "total_engagement": total_engagement,
                "unique_authors": unique_authors,
                "stock_related_tweets": stock_related,
                "avg_views_per_tweet": (
                    round(total_views / total_tweets, 2) if total_tweets else 0
                ),
                "avg_engagement_per_tweet": (
                    round(total_engagement / total_tweets, 2) if total_tweets else 0
                ),
            },
            "sentiment": {
                "distribution": sentiment_counts,
                "sentiment_score": (
                    round(
                        (sentiment_counts["bullish"] - sentiment_counts["bearish"])
                        / total_tweets,
                        4,
                    )
                    if total_tweets
                    else 0
                ),
            },
            "top_tickers": top_tickers,
            "top_kols": top_kols,
            "daily_trend": daily_trend,
        }

