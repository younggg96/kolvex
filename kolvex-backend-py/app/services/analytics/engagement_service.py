"""
互动分析服务
分析 engagement 指标相关性
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from .base_service import BaseAnalyticsService


class EngagementService(BaseAnalyticsService):
    """互动分析服务"""

    def _correlation(self, x: List[int], y: List[int]) -> float:
        """计算皮尔逊相关系数"""
        n = len(x)
        if n == 0:
            return 0

        mean_x = sum(x) / n
        mean_y = sum(y) / n

        numerator = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))

        var_x = sum((xi - mean_x) ** 2 for xi in x)
        var_y = sum((yi - mean_y) ** 2 for yi in y)

        denominator = (var_x * var_y) ** 0.5

        return round(numerator / denominator, 4) if denominator > 0 else 0

    async def get_engagement_analysis(
        self,
        days: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取互动指标分析

        Args:
            days: 分析天数

        Returns:
            互动分析数据
        """
        # 构建查询
        query = self.supabase.table("kol_tweets").select(
            "views_count, like_count, retweet_count, reply_count, bookmark_count"
        )

        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.gte("created_at", start_date.isoformat())

        result = query.execute()
        tweets = result.data or []

        if not tweets:
            return {"message": "没有数据可供分析"}

        # 提取各指标数据
        metrics = {
            "views": [],
            "likes": [],
            "retweets": [],
            "replies": [],
            "bookmarks": [],
        }

        for tweet in tweets:
            metrics["views"].append(self.safe_get(tweet, "views_count", 0))
            metrics["likes"].append(self.safe_get(tweet, "like_count", 0))
            metrics["retweets"].append(self.safe_get(tweet, "retweet_count", 0))
            metrics["replies"].append(self.safe_get(tweet, "reply_count", 0))
            metrics["bookmarks"].append(self.safe_get(tweet, "bookmark_count", 0))

        # 计算统计摘要
        stats_summary = {name: self.calc_stats(values) for name, values in metrics.items()}

        # 计算相关性矩阵
        metric_names = list(metrics.keys())
        correlation_matrix = {}

        for name1 in metric_names:
            correlation_matrix[name1] = {}
            for name2 in metric_names:
                correlation_matrix[name1][name2] = self._correlation(
                    metrics[name1], metrics[name2]
                )

        # 计算互动率分布
        engagement_rates = []
        for tweet in tweets:
            views = self.safe_get(tweet, "views_count", 0) or 1
            engagement = (
                self.safe_get(tweet, "like_count", 0)
                + self.safe_get(tweet, "retweet_count", 0)
                + self.safe_get(tweet, "reply_count", 0)
                + self.safe_get(tweet, "bookmark_count", 0)
            )
            engagement_rates.append(round((engagement / views) * 100, 4))

        # 分箱统计
        rate_buckets = {
            "0-1%": 0,
            "1-2%": 0,
            "2-5%": 0,
            "5-10%": 0,
            "10%+": 0,
        }

        for rate in engagement_rates:
            if rate < 1:
                rate_buckets["0-1%"] += 1
            elif rate < 2:
                rate_buckets["1-2%"] += 1
            elif rate < 5:
                rate_buckets["2-5%"] += 1
            elif rate < 10:
                rate_buckets["5-10%"] += 1
            else:
                rate_buckets["10%+"] += 1

        return {
            "statistics": stats_summary,
            "correlation_matrix": correlation_matrix,
            "engagement_rate": {
                "distribution": rate_buckets,
                "average": (
                    round(sum(engagement_rates) / len(engagement_rates), 4)
                    if engagement_rates
                    else 0
                ),
                "median": (
                    sorted(engagement_rates)[len(engagement_rates) // 2]
                    if engagement_rates
                    else 0
                ),
            },
            "total_tweets": len(tweets),
        }

