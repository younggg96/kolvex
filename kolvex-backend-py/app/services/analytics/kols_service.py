"""
KOL 影响力分析服务
分析 Top KOL 排名
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from .base_service import BaseAnalyticsService


class KOLsService(BaseAnalyticsService):
    """KOL 影响力分析服务"""

    async def get_top_kols(
        self,
        limit: int = 10,
        sort_by: str = "views",
        days: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取 KOL 影响力排名

        Args:
            limit: 返回数量
            sort_by: 排序字段 (views, likes, retweets, tweets, engagement)
            days: 分析天数范围

        Returns:
            KOL 排名数据
        """
        # 构建查询
        query = self.supabase.table("kol_tweets").select(
            "username, views_count, like_count, retweet_count, "
            "reply_count, bookmark_count, avatar_url"
        )

        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.gte("created_at", start_date.isoformat())

        result = query.execute()
        tweets = result.data or []

        # 按用户聚合数据
        user_stats: Dict[str, Dict] = {}
        for tweet in tweets:
            username = tweet.get("username", "")
            if username not in user_stats:
                user_stats[username] = {
                    "username": username,
                    "avatar_url": tweet.get("avatar_url"),
                    "total_views": 0,
                    "total_likes": 0,
                    "total_retweets": 0,
                    "total_replies": 0,
                    "total_bookmarks": 0,
                    "tweet_count": 0,
                }

            stats = user_stats[username]
            stats["total_views"] += self.safe_get(tweet, "views_count", 0)
            stats["total_likes"] += self.safe_get(tweet, "like_count", 0)
            stats["total_retweets"] += self.safe_get(tweet, "retweet_count", 0)
            stats["total_replies"] += self.safe_get(tweet, "reply_count", 0)
            stats["total_bookmarks"] += self.safe_get(tweet, "bookmark_count", 0)
            stats["tweet_count"] += 1
            if tweet.get("avatar_url"):
                stats["avatar_url"] = tweet.get("avatar_url")

        # 计算平均互动率
        for stats in user_stats.values():
            if stats["total_views"] > 0:
                engagement = (
                    stats["total_likes"]
                    + stats["total_retweets"]
                    + stats["total_replies"]
                    + stats["total_bookmarks"]
                )
                stats["engagement_rate"] = round(
                    (engagement / stats["total_views"]) * 100, 4
                )
            else:
                stats["engagement_rate"] = 0

        # 排序映射
        sort_map = {
            "views": "total_views",
            "likes": "total_likes",
            "retweets": "total_retweets",
            "tweets": "tweet_count",
            "engagement": "engagement_rate",
        }
        sort_key = sort_map.get(sort_by, "total_views")

        # 排序并截取
        sorted_users = sorted(
            user_stats.values(), key=lambda x: x.get(sort_key, 0), reverse=True
        )[:limit]

        # 添加排名
        for i, user in enumerate(sorted_users, 1):
            user["rank"] = i

        return {
            "kols": sorted_users,
            "sort_by": sort_by,
            "total_kols": len(user_stats),
        }

