"""
趋势分析服务
分析每日推文量变化
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from .base_service import BaseAnalyticsService


class TrendsService(BaseAnalyticsService):
    """趋势分析服务"""

    async def get_tweet_trends(
        self,
        days: int = 30,
        username: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        获取推文趋势分析

        Args:
            days: 分析天数
            username: 按用户名筛选

        Returns:
            趋势数据和统计摘要
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # 构建查询
        query = (
            self.supabase.table("kol_tweets")
            .select("created_at, username")
            .gte("created_at", start_date.isoformat())
        )

        if username:
            query = query.eq("username", username)

        result = query.order("created_at", desc=False).execute()
        tweets = result.data or []

        # 按日期分组统计
        daily_counts: Dict[str, int] = {}
        for tweet in tweets:
            if tweet.get("created_at"):
                date_str = tweet["created_at"][:10]
                daily_counts[date_str] = daily_counts.get(date_str, 0) + 1

        # 填充缺失日期
        date_list = []
        current = start_date
        while current <= end_date:
            date_str = current.strftime("%Y-%m-%d")
            date_list.append({"date": date_str, "count": daily_counts.get(date_str, 0)})
            current += timedelta(days=1)

        # 计算统计指标
        counts = [d["count"] for d in date_list]
        total = sum(counts)
        avg = round(total / len(counts), 2) if counts else 0
        max_count = max(counts) if counts else 0
        min_count = min(counts) if counts else 0

        # 找出峰值日期
        peak_date = None
        for d in date_list:
            if d["count"] == max_count:
                peak_date = d["date"]
                break

        return {
            "trends": date_list,
            "summary": {
                "total_tweets": total,
                "average_daily": avg,
                "max_daily": max_count,
                "min_daily": min_count,
                "peak_date": peak_date,
                "days_analyzed": len(date_list),
            },
        }

