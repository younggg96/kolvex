"""
趋势分析服务
分析每日帖子量变化，支持按平台分组
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from .base_service import BaseAnalyticsService


class TrendsService(BaseAnalyticsService):
    """趋势分析服务"""

    async def get_post_trends(
        self,
        days: int = 30,
        username: Optional[str] = None,
        platform: Optional[str] = None,
        include_platform_breakdown: bool = True,
    ) -> Dict[str, Any]:
        """
        获取帖子趋势分析

        Args:
            days: 分析天数
            username: 按用户名筛选
            platform: 按平台筛选 (twitter, xiaohongshu, reddit, youtube)
            include_platform_breakdown: 是否包含按平台分组的数据

        Returns:
            趋势数据和统计摘要
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # 使用分页获取所有数据（Supabase 默认限制 1000 条）
        posts = []
        page_size = 1000
        offset = 0

        while True:
            query = (
                self.supabase.table("kol_tweets")
                .select("created_at, username, platform")
                .gte("created_at", start_date.isoformat())
            )

            if username:
                query = query.eq("username", username)
            if platform:
                query = query.eq("platform", platform)

            result = (
                query.order("created_at", desc=False)
                .range(offset, offset + page_size - 1)
                .execute()
            )

            batch = result.data or []
            posts.extend(batch)

            if len(batch) < page_size:
                break

            offset += page_size

        # 按日期分组统计（总计）
        daily_counts: Dict[str, int] = {}
        # 按日期和平台分组统计
        daily_platform_counts: Dict[str, Dict[str, int]] = {}
        # 平台总计
        platform_totals: Dict[str, int] = {}

        for post in posts:
            if post.get("created_at"):
                date_str = post["created_at"][:10]
                post_platform = post.get("platform", "twitter") or "twitter"

                # 总计
                daily_counts[date_str] = daily_counts.get(date_str, 0) + 1

                # 按平台分组
                if date_str not in daily_platform_counts:
                    daily_platform_counts[date_str] = {}
                daily_platform_counts[date_str][post_platform] = (
                    daily_platform_counts[date_str].get(post_platform, 0) + 1
                )

                # 平台总计
                platform_totals[post_platform] = (
                    platform_totals.get(post_platform, 0) + 1
                )

        # 填充缺失日期
        date_list: List[Dict[str, Any]] = []
        current = start_date
        while current <= end_date:
            date_str = current.strftime("%Y-%m-%d")
            platform_data = daily_platform_counts.get(date_str, {})

            entry: Dict[str, Any] = {
                "date": date_str,
                "count": daily_counts.get(date_str, 0),
            }

            if include_platform_breakdown:
                entry["twitter"] = platform_data.get("twitter", 0)
                entry["xiaohongshu"] = platform_data.get("xiaohongshu", 0)
                entry["reddit"] = platform_data.get("reddit", 0)
                entry["youtube"] = platform_data.get("youtube", 0)

            date_list.append(entry)
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

        result_data: Dict[str, Any] = {
            "trends": date_list,
            "summary": {
                "total_posts": total,
                "average_daily": avg,
                "max_daily": max_count,
                "min_daily": min_count,
                "peak_date": peak_date,
                "days_analyzed": len(date_list),
            },
        }

        if include_platform_breakdown:
            result_data["platform_breakdown"] = {
                "twitter": platform_totals.get("twitter", 0),
                "xiaohongshu": platform_totals.get("xiaohongshu", 0),
                "reddit": platform_totals.get("reddit", 0),
                "youtube": platform_totals.get("youtube", 0),
            }

        return result_data

    # 向后兼容别名
    async def get_tweet_trends(
        self,
        days: int = 30,
        username: Optional[str] = None,
    ) -> Dict[str, Any]:
        """向后兼容别名"""
        return await self.get_post_trends(days=days, username=username)
