"""
情感分析服务
分析市场情绪分布
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from .base_service import BaseAnalyticsService


class SentimentService(BaseAnalyticsService):
    """情感分析服务"""

    def _get_sentiment_label(self, score: float) -> str:
        """根据情绪得分返回标签"""
        if score > 0.5:
            return "Extremely Bullish"
        elif score > 0.2:
            return "Bullish"
        elif score > 0:
            return "Slightly Bullish"
        elif score == 0:
            return "Neutral"
        elif score > -0.2:
            return "Slightly Bearish"
        elif score > -0.5:
            return "Bearish"
        else:
            return "Extremely Bearish"

    async def get_sentiment_analysis(
        self,
        days: Optional[int] = None,
        ticker: Optional[str] = None,
        include_daily: bool = False,
    ) -> Dict[str, Any]:
        """
        获取市场情感分析

        Args:
            days: 分析天数
            ticker: 按股票代码筛选
            include_daily: 是否包含每日趋势

        Returns:
            情感分析数据
        """
        # 构建查询
        query = self.supabase.table("kol_tweets").select(
            "ai_sentiment, ai_sentiment_confidence, ai_sentiment_reasoning, "
            "ai_tickers, ai_is_stock_related, created_at, views_count"
        )

        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.gte("created_at", start_date.isoformat())

        result = query.execute()
        tweets = result.data or []

        # 按 ticker 筛选
        if ticker:
            ticker_upper = ticker.upper()
            tweets = [
                t
                for t in tweets
                if t.get("ai_tickers") and ticker_upper in t.get("ai_tickers", [])
            ]

        # 情感分布统计
        sentiment_counts = {"bullish": 0, "bearish": 0, "neutral": 0}
        confidence_sum = {"bullish": 0, "bearish": 0, "neutral": 0}
        views_by_sentiment = {"bullish": 0, "bearish": 0, "neutral": 0}
        daily_sentiment: Dict[str, Dict] = {}

        for tweet in tweets:
            sentiment = tweet.get("ai_sentiment", "neutral")
            confidence = self.safe_get(tweet, "ai_sentiment_confidence", 0)
            views = self.safe_get(tweet, "views_count", 0)

            if sentiment in sentiment_counts:
                sentiment_counts[sentiment] += 1
                confidence_sum[sentiment] += confidence
                views_by_sentiment[sentiment] += views

            # 每日统计
            if include_daily and tweet.get("created_at"):
                date_str = tweet["created_at"][:10]
                if date_str not in daily_sentiment:
                    daily_sentiment[date_str] = {
                        "date": date_str,
                        "bullish": 0,
                        "bearish": 0,
                        "neutral": 0,
                    }
                if sentiment in daily_sentiment[date_str]:
                    daily_sentiment[date_str][sentiment] += 1

        # 计算平均置信度
        avg_confidence = {}
        for s in sentiment_counts:
            count = sentiment_counts[s]
            avg_confidence[s] = round(confidence_sum[s] / count, 4) if count > 0 else 0

        # 计算总体情绪指标
        total = sum(sentiment_counts.values())
        bullish_ratio = sentiment_counts["bullish"] / total if total > 0 else 0
        bearish_ratio = sentiment_counts["bearish"] / total if total > 0 else 0
        sentiment_score = round(bullish_ratio - bearish_ratio, 4)

        response_data = {
            "distribution": {
                "counts": sentiment_counts,
                "percentages": {
                    s: round(c / total * 100, 2) if total > 0 else 0
                    for s, c in sentiment_counts.items()
                },
            },
            "confidence": avg_confidence,
            "views_weighted": views_by_sentiment,
            "metrics": {
                "total_analyzed": total,
                "sentiment_score": sentiment_score,
                "sentiment_label": self._get_sentiment_label(sentiment_score),
                "bull_bear_ratio": (
                    round(sentiment_counts["bullish"] / sentiment_counts["bearish"], 2)
                    if sentiment_counts["bearish"] > 0
                    else float("inf")
                ),
            },
        }

        if include_daily:
            response_data["daily_trends"] = sorted(
                daily_sentiment.values(), key=lambda x: x["date"]
            )

        return response_data

    async def get_sentiment_engagement_analysis(
        self,
        days: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取情感与互动交叉分析

        Args:
            days: 分析天数

        Returns:
            交叉分析数据
        """
        # 构建查询
        query = self.supabase.table("kol_tweets").select(
            "ai_sentiment, views_count, like_count, retweet_count, "
            "reply_count, bookmark_count"
        )

        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.gte("created_at", start_date.isoformat())

        result = query.execute()
        tweets = result.data or []

        # 按情感分组统计
        sentiment_metrics: Dict[str, Dict] = {
            "bullish": {
                "tweets": [],
                "views": [],
                "likes": [],
                "retweets": [],
                "engagement": [],
            },
            "bearish": {
                "tweets": [],
                "views": [],
                "likes": [],
                "retweets": [],
                "engagement": [],
            },
            "neutral": {
                "tweets": [],
                "views": [],
                "likes": [],
                "retweets": [],
                "engagement": [],
            },
        }

        for t in tweets:
            sentiment = t.get("ai_sentiment", "neutral")
            if sentiment not in sentiment_metrics:
                continue

            views = self.safe_get(t, "views_count", 0)
            likes = self.safe_get(t, "like_count", 0)
            retweets = self.safe_get(t, "retweet_count", 0)
            replies = self.safe_get(t, "reply_count", 0)
            bookmarks = self.safe_get(t, "bookmark_count", 0)

            total_engagement = likes + retweets + replies + bookmarks
            engagement_rate = (total_engagement / views * 100) if views > 0 else 0

            metrics = sentiment_metrics[sentiment]
            metrics["tweets"].append(1)
            metrics["views"].append(views)
            metrics["likes"].append(likes)
            metrics["retweets"].append(retweets)
            metrics["engagement"].append(engagement_rate)

        # 计算各情感的平均值
        comparison = {}
        for sentiment, metrics in sentiment_metrics.items():
            tweet_count = len(metrics["tweets"])
            comparison[sentiment] = {
                "tweet_count": tweet_count,
                "avg_views": self.calc_avg(metrics["views"]),
                "avg_likes": self.calc_avg(metrics["likes"]),
                "avg_retweets": self.calc_avg(metrics["retweets"]),
                "avg_engagement_rate": self.calc_avg(metrics["engagement"]),
                "total_views": sum(metrics["views"]),
                "total_likes": sum(metrics["likes"]),
            }

        # 计算看涨/看跌差异
        bullish = comparison.get("bullish", {})
        bearish = comparison.get("bearish", {})
        insights = []

        if bullish.get("avg_likes", 0) > bearish.get("avg_likes", 0):
            diff = (
                round(
                    (bullish["avg_likes"] - bearish["avg_likes"])
                    / bearish["avg_likes"]
                    * 100,
                    1,
                )
                if bearish.get("avg_likes", 0) > 0
                else 0
            )
            insights.append(f"Bullish tweets get {diff}% more likes on average than bearish tweets")
        else:
            diff = round(
                (bearish.get("avg_likes", 0) - bullish.get("avg_likes", 0))
                / bullish.get("avg_likes", 1)
                * 100,
                1,
            )
            insights.append(f"Bearish tweets get {diff}% more likes on average than bullish tweets")

        if bullish.get("avg_engagement_rate", 0) > bearish.get(
            "avg_engagement_rate", 0
        ):
            insights.append("Bullish content has higher engagement rate, possible confirmation bias")
        else:
            insights.append("Bearish content has higher engagement rate, market may be in panic mode")

        return {
            "comparison": comparison,
            "insights": insights,
            "total_tweets": len(tweets),
        }

