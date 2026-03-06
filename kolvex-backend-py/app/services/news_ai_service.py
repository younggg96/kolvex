"""
新闻 AI 分析服务
用于自动分析新闻文章

功能：
- 分析单篇新闻
- 批量分析新闻
- 分析新保存的新闻
- 分析所有未分析的新闻
"""

import logging
import asyncio
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone

from app.core.supabase import get_supabase_service
from app.services.benzinga import NewsAnalyzer, NewsAIAnalysis
from app.services.ai import OllamaClient

logger = logging.getLogger(__name__)


class NewsAIService:
    """
    新闻 AI 分析服务
    """

    def __init__(self):
        self._analyzing = False
        self._last_analysis_at: Optional[datetime] = None
        self._last_analysis_count = 0
        self._last_analysis_duration = 0.0

    @property
    def is_analyzing(self) -> bool:
        return self._analyzing

    @property
    def status(self) -> Dict[str, Any]:
        return {
            "is_analyzing": self._analyzing,
            "last_analysis_at": self._last_analysis_at.isoformat() if self._last_analysis_at else None,
            "last_analysis_count": self._last_analysis_count,
            "last_analysis_duration": self._last_analysis_duration,
        }

    async def analyze_article(
        self,
        article_id: int,
        title: str,
        content: str,
        tickers: List[str] = None,
        force: bool = False,
    ) -> Optional[NewsAIAnalysis]:
        """
        分析单篇新闻

        Args:
            article_id: 文章 ID
            title: 标题
            content: 内容
            tickers: 已知的相关股票代码
            force: 是否强制重新分析

        Returns:
            NewsAIAnalysis 或 None
        """
        if not title and not content:
            logger.warning(f"文章 {article_id} 内容为空，跳过分析")
            return None

        try:
            async with OllamaClient() as client:
                analyzer = NewsAnalyzer(client)
                result = await analyzer.analyze_news(title, content, tickers)

                # 更新数据库
                supabase = get_supabase_service()
                if supabase:
                    self._update_article_with_analysis(supabase, article_id, result)

                return result

        except Exception as e:
            logger.error(f"分析文章 {article_id} 失败: {e}")
            return None

    def _update_article_with_analysis(
        self,
        supabase,
        article_id: int,
        analysis: NewsAIAnalysis,
    ) -> bool:
        """
        将 AI 分析结果更新到数据库
        """
        try:
            update_data = {
                "ai_summary": analysis.ai_summary,
                "sentiment": analysis.sentiment,
                "sentiment_confidence": analysis.sentiment_confidence,
                "sentiment_reasoning": analysis.sentiment_reasoning,
                "trading_action": analysis.trading_action,
                "trading_confidence": analysis.trading_confidence,
                "key_points": analysis.key_points,
                "market_impact": analysis.market_impact,
                "impact_confidence": analysis.impact_confidence,
                "us_market_relevance": analysis.us_market_relevance,
                "analyzed_at": analysis.analyzed_at or datetime.now(timezone.utc).isoformat(),
                "ai_model": analysis.ai_model,
                "analysis_version": analysis.analysis_version,
            }

            supabase.table("news_articles").update(update_data).eq("id", article_id).execute()
            return True
        except Exception as e:
            logger.error(f"更新分析结果失败 (article_id={article_id}): {e}")
            return False

    async def analyze_recent_articles(
        self,
        limit: int = 20,
        max_concurrent: int = 3,
    ) -> Dict[str, int]:
        """
        分析最近未分析的新闻

        Args:
            limit: 最大分析数量
            max_concurrent: 最大并发数

        Returns:
            {"analyzed": n, "failed": m, "skipped": k}
        """
        import time

        if self._analyzing:
            logger.warning("正在分析中，跳过此次请求")
            return {"analyzed": 0, "failed": 0, "skipped": 0, "reason": "already_analyzing"}

        start_ts = time.time()
        self._analyzing = True

        supabase = get_supabase_service()
        if not supabase:
            self._analyzing = False
            return {"analyzed": 0, "failed": 0, "skipped": 0, "reason": "no_database"}

        try:
            # 获取未分析的最新文章
            result = (
                supabase.table("news_articles")
                .select("id, title, summary, tickers")
                .is_("analyzed_at", "null")
                .order("published_at", desc=True)
                .limit(limit)
                .execute()
            )

            articles = result.data or []
            if not articles:
                self._analyzing = False
                return {"analyzed": 0, "failed": 0, "skipped": 0, "reason": "no_unanalyzed"}

            logger.info(f"🤖 开始分析 {len(articles)} 篇未分析的新闻...")

            analyzed_count = 0
            failed_count = 0
            skipped_count = 0

            semaphore = asyncio.Semaphore(max_concurrent)

            async def analyze_with_semaphore(article: Dict) -> str:
                async with semaphore:
                    title = article.get("title", "")
                    content = article.get("summary", "")

                    if not title and not content:
                        return "skipped"

                    result = await self.analyze_article(
                        article_id=article["id"],
                        title=title,
                        content=content,
                        tickers=article.get("tickers", []),
                    )

                    if result:
                        logger.info(
                            f"  ✅ #{article['id']} | "
                            f"情感: {result.sentiment} | "
                            f"影响: {result.market_impact}"
                        )
                        return "analyzed"
                    else:
                        return "failed"

            tasks = [analyze_with_semaphore(a) for a in articles]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for r in results:
                if isinstance(r, Exception):
                    failed_count += 1
                elif r == "analyzed":
                    analyzed_count += 1
                elif r == "skipped":
                    skipped_count += 1
                else:
                    failed_count += 1

            duration = time.time() - start_ts

            # 更新状态
            self._analyzing = False
            self._last_analysis_at = datetime.now(timezone.utc)
            self._last_analysis_count = analyzed_count
            self._last_analysis_duration = round(duration, 2)

            logger.info(
                f"📊 新闻 AI 分析完成: "
                f"成功 {analyzed_count}, 失败 {failed_count}, 跳过 {skipped_count}, "
                f"耗时 {duration:.2f}s"
            )

            return {
                "analyzed": analyzed_count,
                "failed": failed_count,
                "skipped": skipped_count,
            }

        except Exception as e:
            self._analyzing = False
            logger.error(f"批量分析新闻失败: {e}")
            return {"analyzed": 0, "failed": 0, "skipped": 0, "error": str(e)}

    async def analyze_all_unanalyzed(
        self,
        batch_size: int = 20,
        max_batches: int = 10,
        max_concurrent: int = 3,
    ) -> Dict[str, Any]:
        """
        分析所有未分析的新闻（分批处理）

        Args:
            batch_size: 每批分析数量
            max_batches: 最大批次数
            max_concurrent: 每批最大并发数

        Returns:
            总体分析结果统计
        """
        import time

        if self._analyzing:
            return {"success": False, "reason": "already_analyzing"}

        start_ts = time.time()
        total_analyzed = 0
        total_failed = 0
        total_skipped = 0
        batches_processed = 0

        supabase = get_supabase_service()
        if not supabase:
            return {"success": False, "reason": "no_database"}

        logger.info("🚀 开始分析所有未分析的新闻...")

        for batch_num in range(max_batches):
            # 检查是否还有未分析的文章
            count_result = (
                supabase.table("news_articles")
                .select("id", count="exact")
                .is_("analyzed_at", "null")
                .execute()
            )
            remaining = count_result.count or 0

            if remaining == 0:
                logger.info("✅ 所有新闻已分析完成")
                break

            logger.info(f"📦 批次 {batch_num + 1}: 剩余 {remaining} 篇未分析")

            batch_result = await self.analyze_recent_articles(
                limit=batch_size,
                max_concurrent=max_concurrent,
            )

            total_analyzed += batch_result.get("analyzed", 0)
            total_failed += batch_result.get("failed", 0)
            total_skipped += batch_result.get("skipped", 0)
            batches_processed += 1

            # 如果这批没有分析任何文章，退出
            if batch_result.get("analyzed", 0) == 0:
                break

            # 稍微休息一下，避免过载
            await asyncio.sleep(1)

        duration = time.time() - start_ts

        return {
            "success": True,
            "total_analyzed": total_analyzed,
            "total_failed": total_failed,
            "total_skipped": total_skipped,
            "batches_processed": batches_processed,
            "duration_seconds": round(duration, 2),
        }


# 全局单例
_news_ai_service: Optional[NewsAIService] = None


def get_news_ai_service() -> NewsAIService:
    """获取新闻 AI 分析服务单例"""
    global _news_ai_service
    if _news_ai_service is None:
        _news_ai_service = NewsAIService()
    return _news_ai_service


# ============================================================
# 便捷函数 - 供定时任务调用
# ============================================================


async def auto_analyze_news_after_scrape(
    limit: int = 20,
    max_concurrent: int = 3,
) -> Dict[str, int]:
    """
    爬虫完成后自动分析新闻

    此函数供定时任务在获取新闻后调用

    Args:
        limit: 分析数量限制
        max_concurrent: 最大并发数

    Returns:
        分析结果统计
    """
    service = get_news_ai_service()
    return await service.analyze_recent_articles(
        limit=limit,
        max_concurrent=max_concurrent,
    )
