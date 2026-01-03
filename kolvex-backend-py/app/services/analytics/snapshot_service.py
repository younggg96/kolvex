"""
分析快照服务
负责生成和管理分析数据快照
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from collections import Counter
import json

from .base_service import BaseAnalyticsService


class AnalyticsSnapshotService(BaseAnalyticsService):
    """分析快照服务 - 生成并存储分析数据"""

    async def generate_dashboard_snapshot(
        self,
        days: int = 7,
    ) -> Dict[str, Any]:
        """
        生成仪表盘分析快照并保存到数据库

        Args:
            days: 分析天数

        Returns:
            生成的快照数据
        """
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=days)

        # 1. 查询基础数据
        result = (
            self.supabase.table("kol_tweets")
            .select(
                "id, username, created_at, views_count, like_count, retweet_count, "
                "reply_count, bookmark_count, ai_sentiment, ai_tickers, "
                "ai_is_stock_related, ai_analyzed_at"
            )
            .gte("created_at", start_date.isoformat())
            .execute()
        )

        posts = result.data or []

        # 2. 计算统计数据
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

        # 3. 情感分析统计
        sentiment_counts = {"bullish": 0, "bearish": 0, "neutral": 0}
        for t in posts:
            s = t.get("ai_sentiment", "neutral")
            if s in sentiment_counts:
                sentiment_counts[s] += 1

        sentiment_score = 0
        if total_posts > 0:
            sentiment_score = round(
                (sentiment_counts["bullish"] - sentiment_counts["bearish"]) / total_posts,
                4,
            )

        # 4. Top Tickers（带情感）
        ticker_data: Dict[str, Dict] = {}
        for t in posts:
            sentiment = t.get("ai_sentiment", "neutral")
            for ticker in t.get("ai_tickers") or []:
                ticker_upper = ticker.upper()
                if ticker_upper not in ticker_data:
                    ticker_data[ticker_upper] = {
                        "ticker": ticker_upper,
                        "count": 0,
                        "bullish": 0,
                        "bearish": 0,
                        "neutral": 0,
                    }
                ticker_data[ticker_upper]["count"] += 1
                if sentiment in ["bullish", "bearish", "neutral"]:
                    ticker_data[ticker_upper][sentiment] += 1

        top_tickers = sorted(
            list(ticker_data.values()),
            key=lambda x: x["count"],
            reverse=True,
        )[:10]

        # 5. Top KOLs（带详细数据）
        author_stats: Dict[str, Dict] = {}
        for t in posts:
            username = t.get("username", "")
            if not username:
                continue
            if username not in author_stats:
                author_stats[username] = {
                    "username": username,
                    "total_views": 0,
                    "post_count": 0,
                    "total_engagement": 0,
                }
            author_stats[username]["total_views"] += self.safe_get(t, "views_count", 0)
            author_stats[username]["post_count"] += 1
            author_stats[username]["total_engagement"] += (
                self.safe_get(t, "like_count", 0)
                + self.safe_get(t, "retweet_count", 0)
                + self.safe_get(t, "reply_count", 0)
            )

        top_kols = sorted(
            list(author_stats.values()),
            key=lambda x: x["total_views"],
            reverse=True,
        )[:10]

        # 6. 每日趋势（带详细数据）
        daily_data: Dict[str, Dict] = {}
        for t in posts:
            if t.get("created_at"):
                date_str = t["created_at"][:10]
                if date_str not in daily_data:
                    daily_data[date_str] = {
                        "date": date_str,
                        "count": 0,
                        "views": 0,
                        "bullish": 0,
                        "bearish": 0,
                        "neutral": 0,
                    }
                daily_data[date_str]["count"] += 1
                daily_data[date_str]["views"] += self.safe_get(t, "views_count", 0)
                sentiment = t.get("ai_sentiment", "neutral")
                if sentiment in ["bullish", "bearish", "neutral"]:
                    daily_data[date_str][sentiment] += 1

        daily_trend = sorted(
            list(daily_data.values()),
            key=lambda x: x["date"],
        )

        # 7. 数据质量统计
        analyzed_posts = sum(1 for t in posts if t.get("ai_analyzed_at"))
        unanalyzed_posts = total_posts - analyzed_posts
        analysis_coverage = round(
            (analyzed_posts / total_posts * 100) if total_posts else 0, 2
        )

        # 8. 保存到数据库（注意：数据库列名保持不变）
        snapshot_data = {
            "snapshot_type": "dashboard",
            "period_days": days,
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": now.strftime("%Y-%m-%d"),
            "total_tweets": total_posts,  # 数据库列名
            "total_views": total_views,
            "total_engagement": total_engagement,
            "unique_authors": unique_authors,
            "stock_related_tweets": stock_related,  # 数据库列名
            "avg_views_per_tweet": round(total_views / total_posts, 2) if total_posts else 0,
            "avg_engagement_per_tweet": round(total_engagement / total_posts, 2) if total_posts else 0,
            "sentiment_bullish": sentiment_counts["bullish"],
            "sentiment_bearish": sentiment_counts["bearish"],
            "sentiment_neutral": sentiment_counts["neutral"],
            "sentiment_score": sentiment_score,
            "top_tickers": top_tickers,
            "top_kols": top_kols,
            "daily_trend": daily_trend,
            "analyzed_tweets": analyzed_posts,  # 数据库列名
            "unanalyzed_tweets": unanalyzed_posts,  # 数据库列名
            "analysis_coverage": analysis_coverage,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        # 插入新快照
        insert_result = (
            self.supabase.table("analytics_snapshots")
            .insert(snapshot_data)
            .execute()
        )

        if insert_result.data:
            snapshot_data["id"] = insert_result.data[0].get("id")

        return {
            "success": True,
            "message": f"Dashboard snapshot generated for {days} days",
            "snapshot": snapshot_data,
            "stats": {
                "posts_analyzed": total_posts,
                "ai_coverage": f"{analysis_coverage}%",
                "generated_at": now.isoformat(),
            },
        }

    async def get_latest_snapshot(
        self,
        snapshot_type: str = "dashboard",
        period_days: int = 7,
    ) -> Optional[Dict[str, Any]]:
        """
        获取最新的分析快照

        Args:
            snapshot_type: 快照类型
            period_days: 分析周期

        Returns:
            快照数据，如果不存在返回 None
        """
        result = (
            self.supabase.table("analytics_snapshots")
            .select("*")
            .eq("snapshot_type", snapshot_type)
            .eq("period_days", period_days)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if result.data:
            return result.data[0]
        return None

    async def get_snapshot_or_generate(
        self,
        days: int = 7,
        max_age_minutes: int = 60,
    ) -> Dict[str, Any]:
        """
        获取快照，如果过期则重新生成

        Args:
            days: 分析周期
            max_age_minutes: 快照最大有效时间（分钟）

        Returns:
            快照数据
        """
        snapshot = await self.get_latest_snapshot("dashboard", days)

        if snapshot:
            # 检查是否过期
            created_at = snapshot.get("created_at")
            if created_at:
                try:
                    created_dt = datetime.fromisoformat(
                        created_at.replace("Z", "+00:00")
                    )
                    age_minutes = (
                        datetime.now(timezone.utc) - created_dt
                    ).total_seconds() / 60

                    if age_minutes <= max_age_minutes:
                        # 快照仍然有效
                        return {
                            "success": True,
                            "source": "cache",
                            "age_minutes": round(age_minutes, 1),
                            "data": self._format_snapshot_for_dashboard(snapshot),
                        }
                except Exception:
                    pass

        # 快照不存在或已过期，重新生成
        result = await self.generate_dashboard_snapshot(days)
        return {
            "success": True,
            "source": "generated",
            "age_minutes": 0,
            "data": self._format_snapshot_for_dashboard(result["snapshot"]),
        }

    def _format_snapshot_for_dashboard(self, snapshot: Dict) -> Dict[str, Any]:
        """
        将快照数据格式化为 Dashboard 需要的格式
        """
        return {
            "period": {
                "days": snapshot.get("period_days", 7),
                "start_date": snapshot.get("start_date"),
                "end_date": snapshot.get("end_date"),
            },
            "overview": {
                "total_posts": snapshot.get("total_tweets", 0),  # 数据库列名 -> API 字段名
                "total_views": snapshot.get("total_views", 0),
                "total_engagement": snapshot.get("total_engagement", 0),
                "unique_authors": snapshot.get("unique_authors", 0),
                "stock_related_posts": snapshot.get("stock_related_tweets", 0),
                "avg_views_per_post": float(snapshot.get("avg_views_per_tweet", 0)),
                "avg_engagement_per_post": float(snapshot.get("avg_engagement_per_tweet", 0)),
            },
            "sentiment": {
                "distribution": {
                    "bullish": snapshot.get("sentiment_bullish", 0),
                    "bearish": snapshot.get("sentiment_bearish", 0),
                    "neutral": snapshot.get("sentiment_neutral", 0),
                },
                "sentiment_score": float(snapshot.get("sentiment_score", 0)),
            },
            "top_tickers": snapshot.get("top_tickers", []),
            "top_kols": snapshot.get("top_kols", []),
            "daily_trend": snapshot.get("daily_trend", []),
            "data_quality": {
                "analyzed_posts": snapshot.get("analyzed_tweets", 0),
                "unanalyzed_posts": snapshot.get("unanalyzed_tweets", 0),
                "analysis_coverage": float(snapshot.get("analysis_coverage", 0)),
            },
            "snapshot_info": {
                "id": snapshot.get("id"),
                "created_at": snapshot.get("created_at"),
                "updated_at": snapshot.get("updated_at"),
            },
        }

    async def list_snapshots(
        self,
        snapshot_type: str = "dashboard",
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        列出历史快照

        Args:
            snapshot_type: 快照类型
            limit: 返回数量

        Returns:
            快照列表
        """
        result = (
            self.supabase.table("analytics_snapshots")
            .select("id, snapshot_type, period_days, start_date, end_date, "
                    "total_tweets, sentiment_score, analysis_coverage, created_at")
            .eq("snapshot_type", snapshot_type)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        return result.data or []

    async def delete_old_snapshots(
        self,
        keep_count: int = 10,
        snapshot_type: str = "dashboard",
    ) -> Dict[str, Any]:
        """
        删除旧快照，保留最新的 N 个

        Args:
            keep_count: 保留数量
            snapshot_type: 快照类型

        Returns:
            删除结果
        """
        # 获取所有快照 ID
        result = (
            self.supabase.table("analytics_snapshots")
            .select("id")
            .eq("snapshot_type", snapshot_type)
            .order("created_at", desc=True)
            .execute()
        )

        all_ids = [r["id"] for r in (result.data or [])]

        if len(all_ids) <= keep_count:
            return {"deleted": 0, "kept": len(all_ids)}

        # 删除旧的
        ids_to_delete = all_ids[keep_count:]
        for snapshot_id in ids_to_delete:
            self.supabase.table("analytics_snapshots").delete().eq(
                "id", snapshot_id
            ).execute()

        return {"deleted": len(ids_to_delete), "kept": keep_count}


