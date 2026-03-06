"""
新闻 AI 分析 API 路由
提供对新闻文章进行 AI 分析的功能
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import logging

from app.core.supabase import get_supabase_service
from app.services.benzinga import NewsAnalyzer, NewsAIAnalysis
from app.services.ai import OllamaClient
from app.services.news_ai_service import get_news_ai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/news/ai", tags=["News AI Analysis"])


# ============================================================
# Pydantic 响应模型
# ============================================================


class NewsAIAnalysisResponse(BaseModel):
    """单篇新闻 AI 分析响应"""

    success: bool
    article_id: int
    ai_summary: Optional[str] = None
    sentiment: Optional[str] = None
    sentiment_confidence: Optional[float] = None
    sentiment_reasoning: Optional[str] = None
    trading_action: Optional[str] = None
    trading_confidence: Optional[float] = None
    key_points: List[str] = Field(default_factory=list)
    market_impact: Optional[str] = None
    impact_confidence: Optional[float] = None
    us_market_relevance: Optional[str] = None
    analyzed_at: Optional[str] = None
    ai_model: Optional[str] = None
    cached: bool = False


class BatchNewsAnalysisRequest(BaseModel):
    """批量分析请求"""

    limit: int = Field(default=10, ge=1, le=50, description="分析数量限制")
    force: bool = Field(default=False, description="是否强制重新分析")
    only_unanalyzed: bool = Field(default=True, description="只分析未分析的")
    source: Optional[str] = Field(default=None, description="按来源筛选")


class BatchNewsAnalysisResponse(BaseModel):
    """批量分析响应"""

    success: bool
    message: str
    total: int
    status: str  # "processing", "completed"


class NewsAnalysisStatsResponse(BaseModel):
    """分析统计响应"""

    success: bool
    total_articles: int
    analyzed_articles: int
    unanalyzed_articles: int
    sentiment_distribution: Dict[str, int]
    market_impact_distribution: Dict[str, int]
    analysis_rate: float
    source: Optional[str] = None


# ============================================================
# 内部辅助函数
# ============================================================


async def _analyze_news_content(title: str, content: str, tickers: List[str] = None) -> NewsAIAnalysis:
    """
    对新闻内容进行 AI 分析
    """
    async with OllamaClient() as client:
        analyzer = NewsAnalyzer(client)
        result = await analyzer.analyze_news(title, content, tickers)
        return result


def _update_article_with_analysis(supabase, article_id: int, analysis: NewsAIAnalysis) -> bool:
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


# ============================================================
# API 端点
# ============================================================


@router.post("/analyze/{article_id}", response_model=NewsAIAnalysisResponse)
async def analyze_single_article(
    article_id: int,
    force: bool = Query(False, description="是否强制重新分析"),
):
    """
    🤖 AI 分析单篇新闻

    对指定新闻进行 AI 分析，提取：
    - 情感倾向 (bullish/bearish/neutral)
    - 交易信号 (buy/sell/hold)
    - 股票代码识别
    - 关键要点
    - 市场影响评估
    - 智能摘要
    """
    supabase = get_supabase_service()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库服务未连接")

    try:
        # 获取文章
        result = (
            supabase.table("news_articles")
            .select("*")
            .eq("id", article_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail=f"文章不存在: {article_id}")

        article = result.data[0]

        # 检查是否已分析且不强制重新分析
        if article.get("analyzed_at") and not force:
            return NewsAIAnalysisResponse(
                success=True,
                article_id=article_id,
                ai_summary=article.get("ai_summary"),
                sentiment=article.get("sentiment"),
                sentiment_confidence=article.get("sentiment_confidence"),
                sentiment_reasoning=article.get("sentiment_reasoning"),
                trading_action=article.get("trading_action"),
                trading_confidence=article.get("trading_confidence"),
                key_points=article.get("key_points") or [],
                market_impact=article.get("market_impact"),
                impact_confidence=article.get("impact_confidence"),
                us_market_relevance=article.get("us_market_relevance"),
                analyzed_at=article.get("analyzed_at"),
                ai_model=article.get("ai_model"),
                cached=True,
            )

        # 执行 AI 分析
        title = article.get("title", "")
        content = article.get("summary", "")
        existing_tickers = article.get("tickers", [])

        if not title and not content:
            raise HTTPException(status_code=400, detail="文章内容为空，无法分析")

        analysis = await _analyze_news_content(title, content, existing_tickers)

        # 更新数据库
        _update_article_with_analysis(supabase, article_id, analysis)

        return NewsAIAnalysisResponse(
            success=True,
            article_id=article_id,
            ai_summary=analysis.ai_summary,
            sentiment=analysis.sentiment,
            sentiment_confidence=analysis.sentiment_confidence,
            sentiment_reasoning=analysis.sentiment_reasoning,
            trading_action=analysis.trading_action,
            trading_confidence=analysis.trading_confidence,
            key_points=analysis.key_points,
            market_impact=analysis.market_impact,
            impact_confidence=analysis.impact_confidence,
            us_market_relevance=analysis.us_market_relevance,
            analyzed_at=analysis.analyzed_at,
            ai_model=analysis.ai_model,
            cached=False,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"分析新闻失败: {e}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


async def _batch_analyze_articles(supabase, articles: List[Dict], force: bool = False):
    """
    后台批量分析新闻
    """
    analyzed_count = 0
    failed_count = 0
    skipped_count = 0

    for article in articles:
        try:
            # 跳过已分析的（除非强制）
            if article.get("analyzed_at") and not force:
                skipped_count += 1
                continue

            title = article.get("title", "")
            content = article.get("summary", "")
            existing_tickers = article.get("tickers", [])

            if not title and not content:
                skipped_count += 1
                continue

            logger.info(f"🤖 分析新闻 #{article['id']}: {title[:50]}...")

            analysis = await _analyze_news_content(title, content, existing_tickers)

            if _update_article_with_analysis(supabase, article["id"], analysis):
                analyzed_count += 1
                logger.info(
                    f"  ✅ 完成 | 情感: {analysis.sentiment} | 影响: {analysis.market_impact}"
                )
            else:
                failed_count += 1

        except Exception as e:
            logger.error(f"  ❌ 分析失败: {e}")
            failed_count += 1

    logger.info(
        f"📊 批量分析完成: 成功 {analyzed_count}, 失败 {failed_count}, 跳过 {skipped_count}"
    )
    return {
        "analyzed": analyzed_count,
        "failed": failed_count,
        "skipped": skipped_count,
    }


@router.post("/analyze-batch", response_model=BatchNewsAnalysisResponse)
async def analyze_batch_articles(
    request: BatchNewsAnalysisRequest,
    background_tasks: BackgroundTasks,
):
    """
    🤖 批量 AI 分析新闻

    后台任务批量分析多篇新闻文章
    """
    supabase = get_supabase_service()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库服务未连接")

    try:
        # 构建查询
        query = supabase.table("news_articles").select("*").order("published_at", desc=True)

        if request.only_unanalyzed:
            query = query.is_("analyzed_at", "null")

        if request.source:
            query = query.eq("source", request.source)

        result = query.limit(request.limit).execute()
        articles = result.data or []

        if not articles:
            return BatchNewsAnalysisResponse(
                success=True,
                message="没有需要分析的新闻",
                total=0,
                status="completed",
            )

        # 启动后台任务
        background_tasks.add_task(_batch_analyze_articles, supabase, articles, request.force)

        return BatchNewsAnalysisResponse(
            success=True,
            message=f"已启动批量分析任务，共 {len(articles)} 篇新闻",
            total=len(articles),
            status="processing",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动分析任务失败: {str(e)}")


@router.get("/stats", response_model=NewsAnalysisStatsResponse)
def get_analysis_stats(
    source: Optional[str] = Query(None, description="按来源筛选"),
):
    """
    📊 获取新闻 AI 分析统计

    返回分析统计信息
    """
    supabase = get_supabase_service()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库服务未连接")

    try:
        # 总数
        base_query = supabase.table("news_articles").select("id", count="exact")
        if source:
            base_query = base_query.eq("source", source)
        total_result = base_query.execute()
        total_count = total_result.count or 0

        # 已分析数量
        analyzed_query = supabase.table("news_articles").select("id", count="exact")
        if source:
            analyzed_query = analyzed_query.eq("source", source)
        analyzed_result = analyzed_query.not_.is_("analyzed_at", "null").execute()
        analyzed_count = analyzed_result.count or 0

        # 情感分布
        def count_sentiment(sentiment: str) -> int:
            query = supabase.table("news_articles").select("id", count="exact")
            if source:
                query = query.eq("source", source)
            result = query.eq("sentiment", sentiment).execute()
            return result.count or 0

        # 市场影响分布
        def count_impact(impact: str) -> int:
            query = supabase.table("news_articles").select("id", count="exact")
            if source:
                query = query.eq("source", source)
            result = query.eq("market_impact", impact).execute()
            return result.count or 0

        return NewsAnalysisStatsResponse(
            success=True,
            total_articles=total_count,
            analyzed_articles=analyzed_count,
            unanalyzed_articles=total_count - analyzed_count,
            sentiment_distribution={
                "bullish": count_sentiment("bullish"),
                "bearish": count_sentiment("bearish"),
                "neutral": count_sentiment("neutral"),
            },
            market_impact_distribution={
                "high": count_impact("high"),
                "medium": count_impact("medium"),
                "low": count_impact("low"),
                "none": count_impact("none"),
            },
            analysis_rate=(
                round(analyzed_count / total_count * 100, 2) if total_count > 0 else 0
            ),
            source=source,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计失败: {str(e)}")


# ============================================================
# 分析所有未分析新闻的 API（必须放在 /{article_id} 之前）
# ============================================================


class AnalyzeAllResponse(BaseModel):
    """分析所有未分析新闻的响应"""

    success: bool
    message: str
    total_analyzed: int = 0
    total_failed: int = 0
    total_skipped: int = 0
    batches_processed: int = 0
    duration_seconds: float = 0.0
    status: str = "completed"


class AnalysisServiceStatusResponse(BaseModel):
    """AI 分析服务状态"""

    is_analyzing: bool
    last_analysis_at: Optional[str] = None
    last_analysis_count: int = 0
    last_analysis_duration: float = 0.0


@router.get("/service-status", response_model=AnalysisServiceStatusResponse)
async def get_analysis_service_status():
    """
    📊 获取 AI 分析服务状态

    返回当前分析服务的运行状态
    """
    service = get_news_ai_service()
    status = service.status

    return AnalysisServiceStatusResponse(
        is_analyzing=status["is_analyzing"],
        last_analysis_at=status["last_analysis_at"],
        last_analysis_count=status["last_analysis_count"],
        last_analysis_duration=status["last_analysis_duration"],
    )


@router.post("/analyze-all", response_model=AnalyzeAllResponse)
async def analyze_all_unanalyzed_news(
    batch_size: int = Query(20, ge=5, le=50, description="每批分析数量"),
    max_batches: int = Query(10, ge=1, le=50, description="最大批次数"),
    max_concurrent: int = Query(3, ge=1, le=5, description="最大并发数"),
    background_tasks: BackgroundTasks = None,
    run_in_background: bool = Query(False, description="是否后台执行"),
):
    """
    🤖 分析所有未分析的新闻

    分批处理所有未分析的新闻文章，支持前台同步执行或后台异步执行。

    - **batch_size**: 每批分析的新闻数量 (5-50)
    - **max_batches**: 最大批次数 (1-50)，用于限制单次执行的总量
    - **max_concurrent**: 每批中并发分析的数量 (1-5)
    - **run_in_background**: 是否后台执行，默认前台同步执行
    """
    service = get_news_ai_service()

    if service.is_analyzing:
        raise HTTPException(
            status_code=409,
            detail="AI 分析服务正在运行中，请稍后再试",
        )

    if run_in_background and background_tasks:
        # 后台执行
        async def _run_analysis():
            await service.analyze_all_unanalyzed(
                batch_size=batch_size,
                max_batches=max_batches,
                max_concurrent=max_concurrent,
            )

        background_tasks.add_task(_run_analysis)

        return AnalyzeAllResponse(
            success=True,
            message=f"已启动后台分析任务，每批 {batch_size} 篇，最多 {max_batches} 批",
            status="processing",
        )

    # 前台同步执行
    try:
        result = await service.analyze_all_unanalyzed(
            batch_size=batch_size,
            max_batches=max_batches,
            max_concurrent=max_concurrent,
        )

        if not result.get("success", False):
            return AnalyzeAllResponse(
                success=False,
                message=result.get("reason", "分析失败"),
                status="failed",
            )

        return AnalyzeAllResponse(
            success=True,
            message="分析完成",
            total_analyzed=result.get("total_analyzed", 0),
            total_failed=result.get("total_failed", 0),
            total_skipped=result.get("total_skipped", 0),
            batches_processed=result.get("batches_processed", 0),
            duration_seconds=result.get("duration_seconds", 0),
            status="completed",
        )

    except Exception as e:
        logger.error(f"分析所有新闻失败: {e}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.post("/trigger-recent", response_model=BatchNewsAnalysisResponse)
async def trigger_recent_news_analysis(
    limit: int = Query(20, ge=1, le=100, description="分析数量"),
    max_concurrent: int = Query(3, ge=1, le=5, description="最大并发数"),
):
    """
    🤖 触发最新未分析新闻的 AI 分析

    立即分析最近 N 篇未分析的新闻（同步执行）
    """
    service = get_news_ai_service()

    if service.is_analyzing:
        raise HTTPException(
            status_code=409,
            detail="AI 分析服务正在运行中，请稍后再试",
        )

    try:
        result = await service.analyze_recent_articles(
            limit=limit,
            max_concurrent=max_concurrent,
        )

        analyzed = result.get("analyzed", 0)
        failed = result.get("failed", 0)

        return BatchNewsAnalysisResponse(
            success=True,
            message=f"分析完成: 成功 {analyzed} 篇, 失败 {failed} 篇",
            total=analyzed + failed,
            status="completed",
        )

    except Exception as e:
        logger.error(f"触发分析失败: {e}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


# ============================================================
# 动态路由（必须放在最后）
# ============================================================


@router.get("/{article_id}", response_model=NewsAIAnalysisResponse)
async def get_article_analysis(article_id: int):
    """
    获取单篇新闻的 AI 分析结果（不执行分析）
    """
    supabase = get_supabase_service()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库服务未连接")

    try:
        result = (
            supabase.table("news_articles")
            .select("*")
            .eq("id", article_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail=f"文章不存在: {article_id}")

        article = result.data[0]

        return NewsAIAnalysisResponse(
            success=True,
            article_id=article_id,
            ai_summary=article.get("ai_summary"),
            sentiment=article.get("sentiment"),
            sentiment_confidence=article.get("sentiment_confidence"),
            sentiment_reasoning=article.get("sentiment_reasoning"),
            trading_action=article.get("trading_action"),
            trading_confidence=article.get("trading_confidence"),
            key_points=article.get("key_points") or [],
            market_impact=article.get("market_impact"),
            impact_confidence=article.get("impact_confidence"),
            us_market_relevance=article.get("us_market_relevance"),
            analyzed_at=article.get("analyzed_at"),
            ai_model=article.get("ai_model"),
            cached=True,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取分析结果失败: {str(e)}")
