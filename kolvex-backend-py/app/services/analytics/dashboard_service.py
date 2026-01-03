"""
仪表盘服务
提供综合数据概览，直接从 kol_tweets 和 kol_profiles 表实时分析
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from collections import Counter
from .base_service import BaseAnalyticsService


class DashboardService(BaseAnalyticsService):
    """仪表盘服务 - 直接从数据库实时分析"""

    async def get_dashboard_summary(
        self,
        days: int = 7,
    ) -> Dict[str, Any]:
        """
        获取综合数据仪表盘（直接从 kol_tweets 实时分析）

        Args:
            days: 分析天数

        Returns:
            仪表盘概要数据
        """
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        end_date = datetime.now(timezone.utc)

        print(f"📊 Fetching dashboard data from kol_tweets (last {days} days)...")

        # 使用分页获取所有帖子数据（Supabase 默认限制 1000 条）
        posts = []
        page_size = 1000
        offset = 0

        while True:
            posts_result = (
                self.supabase.table("kol_tweets")
                .select(
                    "id, username, created_at, views_count, like_count, retweet_count, "
                    "reply_count, bookmark_count, ai_sentiment, ai_tickers, ai_is_stock_related, "
                    "ai_summary, ai_tags"
                )
                .gte("created_at", start_date.isoformat())
                .order("created_at", desc=True)
                .range(offset, offset + page_size - 1)
                .execute()
            )

            batch = posts_result.data or []
            posts.extend(batch)

            if len(batch) < page_size:
                # 没有更多数据了
                break

            offset += page_size
            print(f"📊 Fetched {len(posts)} posts so far...")

        print(f"📊 Found {len(posts)} total posts in the last {days} days")

        # 查询 KOL profiles 获取头像等信息
        profiles_result = (
            self.supabase.table("kol_profiles")
            .select("username, display_name, avatar_url, followers_count, is_verified")
            .execute()
        )

        profiles = {p["username"]: p for p in (profiles_result.data or [])}
        print(f"📊 Loaded {len(profiles)} KOL profiles")

        # 1. 基础统计
        total_posts = len(posts)
        total_views = sum(self.safe_get(t, "views_count", 0) for t in posts)
        total_engagement = sum(
            self.safe_get(t, "like_count", 0)
            + self.safe_get(t, "retweet_count", 0)
            + self.safe_get(t, "reply_count", 0)
            + self.safe_get(t, "bookmark_count", 0)
            for t in posts
        )

        unique_authors = len(set(t.get("username", "") for t in posts))
        stock_related = sum(1 for t in posts if t.get("ai_is_stock_related"))

        # 分析覆盖率
        analyzed_posts = sum(1 for t in posts if t.get("ai_sentiment") is not None)
        unanalyzed_posts = total_posts - analyzed_posts

        # 2. 情感分布
        sentiment_counts = {"bullish": 0, "bearish": 0, "neutral": 0}
        for t in posts:
            s = t.get("ai_sentiment", "neutral")
            if s in sentiment_counts:
                sentiment_counts[s] += 1
            else:
                sentiment_counts["neutral"] += 1

        # 3. Top 10 Tickers (增加到10个)
        ticker_counts: Counter = Counter()
        for t in posts:
            tickers = t.get("ai_tickers") or []
            if isinstance(tickers, list):
                for ticker in tickers:
                    if ticker:
                        ticker_counts[ticker.upper()] += 1

        top_tickers = [
            {
                "ticker": ticker,
                "count": count,
                "percentage": (
                    round(count / total_posts * 100, 1) if total_posts else 0
                ),
            }
            for ticker, count in ticker_counts.most_common(10)
        ]

        # 4. Top 10 KOLs (带详细信息)
        author_stats: Dict[str, Dict[str, Any]] = {}
        for t in posts:
            username = t.get("username", "")
            if not username:
                continue

            if username not in author_stats:
                profile = profiles.get(username, {})
                author_stats[username] = {
                    "username": username,
                    "display_name": profile.get("display_name", username),
                    "avatar_url": profile.get("avatar_url"),
                    "followers_count": profile.get("followers_count", 0),
                    "is_verified": profile.get("is_verified", False),
                    "total_views": 0,
                    "total_engagement": 0,
                    "post_count": 0,
                }

            author_stats[username]["total_views"] += self.safe_get(t, "views_count", 0)
            author_stats[username]["total_engagement"] += (
                self.safe_get(t, "like_count", 0)
                + self.safe_get(t, "retweet_count", 0)
                + self.safe_get(t, "reply_count", 0)
                + self.safe_get(t, "bookmark_count", 0)
            )
            author_stats[username]["post_count"] += 1

        top_kols = sorted(
            list(author_stats.values()),
            key=lambda x: x["total_views"],
            reverse=True,
        )[:10]

        # 5. 每日趋势
        daily_stats: Dict[str, Dict[str, Any]] = {}
        for t in posts:
            if t.get("created_at"):
                date_str = t["created_at"][:10]
                if date_str not in daily_stats:
                    daily_stats[date_str] = {
                        "date": date_str,
                        "count": 0,
                        "views": 0,
                        "engagement": 0,
                        "bullish": 0,
                        "bearish": 0,
                        "neutral": 0,
                    }

                daily_stats[date_str]["count"] += 1
                daily_stats[date_str]["views"] += self.safe_get(t, "views_count", 0)
                daily_stats[date_str]["engagement"] += (
                    self.safe_get(t, "like_count", 0)
                    + self.safe_get(t, "retweet_count", 0)
                    + self.safe_get(t, "reply_count", 0)
                    + self.safe_get(t, "bookmark_count", 0)
                )

                sentiment = t.get("ai_sentiment", "neutral")
                if sentiment in ["bullish", "bearish", "neutral"]:
                    daily_stats[date_str][sentiment] += 1

        daily_trend = sorted(
            list(daily_stats.values()),
            key=lambda x: x["date"],
        )

        # 6. 热门标签
        tag_counts: Counter = Counter()
        for t in posts:
            tags = t.get("ai_tags") or []
            if isinstance(tags, list):
                for tag in tags:
                    if tag:
                        tag_counts[tag.lower()] += 1

        top_tags = [
            {"tag": tag, "count": count} for tag, count in tag_counts.most_common(10)
        ]

        # 7. 最新热门帖子
        hot_posts = sorted(
            posts,
            key=lambda x: (
                self.safe_get(x, "views_count", 0)
                + self.safe_get(x, "like_count", 0) * 10
                + self.safe_get(x, "retweet_count", 0) * 20
            ),
            reverse=True,
        )[:5]

        hot_posts_formatted = []
        for t in hot_posts:
            username = t.get("username", "")
            profile = profiles.get(username, {})
            hot_posts_formatted.append(
                {
                    "id": t.get("id"),
                    "username": username,
                    "display_name": profile.get("display_name", username),
                    "avatar_url": profile.get("avatar_url"),
                    "summary": t.get("ai_summary", ""),
                    "sentiment": t.get("ai_sentiment"),
                    "tickers": t.get("ai_tickers", []),
                    "views": self.safe_get(t, "views_count", 0),
                    "engagement": (
                        self.safe_get(t, "like_count", 0)
                        + self.safe_get(t, "retweet_count", 0)
                        + self.safe_get(t, "reply_count", 0)
                    ),
                    "created_at": t.get("created_at"),
                }
            )

        result = {
            "period": {
                "days": days,
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d"),
            },
            "overview": {
                "total_posts": total_posts,
                "total_views": total_views,
                "total_engagement": total_engagement,
                "unique_authors": unique_authors,
                "stock_related_posts": stock_related,
                "avg_views_per_post": (
                    round(total_views / total_posts, 2) if total_posts else 0
                ),
                "avg_engagement_per_post": (
                    round(total_engagement / total_posts, 2) if total_posts else 0
                ),
            },
            "sentiment": {
                "distribution": sentiment_counts,
                "sentiment_score": (
                    round(
                        (sentiment_counts["bullish"] - sentiment_counts["bearish"])
                        / total_posts,
                        4,
                    )
                    if total_posts
                    else 0
                ),
            },
            "top_tickers": top_tickers,
            "top_kols": top_kols,
            "top_tags": top_tags,
            "daily_trend": daily_trend,
            "hot_posts": hot_posts_formatted,
            "data_quality": {
                "analyzed_posts": analyzed_posts,
                "unanalyzed_posts": unanalyzed_posts,
                "analysis_coverage": (
                    round(analyzed_posts / total_posts * 100, 1) if total_posts else 0
                ),
            },
            "_source": "realtime",
            "_generated_at": datetime.now(timezone.utc).isoformat(),
        }

        print(
            f"✅ Dashboard data generated: {total_posts} posts, {unique_authors} authors"
        )
        return result
