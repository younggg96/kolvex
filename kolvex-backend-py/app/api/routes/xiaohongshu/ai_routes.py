"""
小红书帖子 AI 分析 API 路由
提供 AI 分析功能，包括情感分析、股票代码提取、摘要生成等
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import Dict, List, Optional
from datetime import datetime, timezone

from app.services.xiaohongshu import get_supabase_client
from app.services.ai import TweetAnalyzer, OllamaClient

from .schemas import (
    AIAnalysisRequest,
    AIAnalysisResponse,
    BatchAnalysisRequest,
)

router = APIRouter()


# ============================================================
# AI 分析端点
# ============================================================


async def _analyze_post_content(content: str, title: str = "") -> Dict:
    """
    内部函数：对帖子内容进行 AI 分析
    """
    full_text = f"{title}\n\n{content}" if title else content

    async with OllamaClient() as client:
        analyzer = TweetAnalyzer(client)
        result = await analyzer.full_analysis(full_text)
        return result


def _update_post_with_analysis(supabase, post_id: int, analysis: Dict) -> bool:
    """
    内部函数：将 AI 分析结果更新到数据库
    
    注意：如果分析失败，将不会更新数据库，避免将错误数据写入
    """
    try:
        # 检查是否是分析失败的默认结果
        if analysis.get("analysis_failed"):
            print(f"⚠️ AI 分析失败，跳过数据库更新 (post_id={post_id})")
            return False
        
        sentiment_data = analysis.get("sentiment", {})
        is_stock_data = analysis.get("is_stock_related", {})
        trading_signal = analysis.get("trading_signal", {})

        update_data = {
            "ai_sentiment": sentiment_data.get("sentiment", "neutral"),
            "ai_sentiment_confidence": sentiment_data.get("confidence", 0.0),
            "ai_sentiment_reasoning": sentiment_data.get("reasoning", ""),
            "ai_tickers": analysis.get("tickers", []),
            "ai_tags": analysis.get("tags", []),
            "ai_summary": analysis.get("summary", ""),
            "ai_trading_signal": trading_signal.get("action"),
            "ai_is_stock_related": is_stock_data.get("is_stock_related", False),
            "ai_stock_related_confidence": is_stock_data.get("confidence", 0.0),
            "ai_stock_related_reason": is_stock_data.get("reason", ""),
            "ai_analyzed_at": datetime.now(timezone.utc).isoformat(),
            "ai_model": analysis.get("model", "unknown"),
        }

        supabase.table("xhs_posts").update(update_data).eq("id", post_id).execute()
        return True
    except Exception as e:
        print(f"❌ 更新分析结果失败: {e}")
        return False


@router.post("/analyze/{note_id}", response_model=AIAnalysisResponse)
async def analyze_single_post(
    note_id: str,
    force: bool = Query(False, description="是否强制重新分析"),
):
    """
    🤖 AI 分析单个帖子

    对指定帖子进行 AI 分析，提取：
    - 情感倾向 (bullish/bearish/neutral)
    - 股票代码 (如 NVDA, TSLA)
    - 关键标签
    - 内容摘要
    - 交易信号
    - 是否与股票相关

    参数：
    - note_id: 小红书笔记 ID
    - force: 是否强制重新分析（即使已有分析结果）
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    try:
        # 获取帖子
        result = (
            supabase.table("xhs_posts")
            .select("*")
            .eq("note_id", note_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail=f"帖子不存在: {note_id}")

        post = result.data[0]

        # 检查是否已分析且不强制重新分析
        if post.get("ai_analyzed_at") and not force:
            return AIAnalysisResponse(
                success=True,
                note_id=note_id,
                sentiment=post.get("ai_sentiment"),
                sentiment_confidence=post.get("ai_sentiment_confidence"),
                sentiment_reasoning=post.get("ai_sentiment_reasoning"),
                tickers=post.get("ai_tickers"),
                tags=post.get("ai_tags"),
                summary=post.get("ai_summary"),
                trading_signal=post.get("ai_trading_signal"),
                is_stock_related=post.get("ai_is_stock_related", False),
                stock_related_confidence=post.get("ai_stock_related_confidence"),
                analyzed_at=post.get("ai_analyzed_at"),
                model=post.get("ai_model"),
            )

        # 执行 AI 分析
        content = post.get("content", "")
        title = post.get("title", "")

        if not content and not title:
            raise HTTPException(status_code=400, detail="帖子内容为空，无法分析")

        analysis = await _analyze_post_content(content, title)

        # 更新数据库
        _update_post_with_analysis(supabase, post["id"], analysis)

        sentiment_data = analysis.get("sentiment", {})
        is_stock_data = analysis.get("is_stock_related", {})
        trading_signal = analysis.get("trading_signal", {})

        return AIAnalysisResponse(
            success=True,
            note_id=note_id,
            sentiment=sentiment_data.get("sentiment"),
            sentiment_confidence=sentiment_data.get("confidence"),
            sentiment_reasoning=sentiment_data.get("reasoning"),
            tickers=analysis.get("tickers"),
            tags=analysis.get("tags"),
            summary=analysis.get("summary"),
            trading_signal=trading_signal.get("action"),
            is_stock_related=is_stock_data.get("is_stock_related", False),
            stock_related_confidence=is_stock_data.get("confidence"),
            analyzed_at=analysis.get("analyzed_at"),
            model=analysis.get("model"),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


async def _batch_analyze_posts(supabase, posts: List[Dict], force: bool = False):
    """
    后台批量分析帖子
    """
    analyzed_count = 0
    failed_count = 0

    for post in posts:
        try:
            # 跳过已分析的（除非强制）
            if post.get("ai_analyzed_at") and not force:
                continue

            content = post.get("content", "")
            title = post.get("title", "")

            if not content and not title:
                continue

            print(f"🤖 分析帖子: {post.get('note_id', post['id'])} - {title[:30]}...")

            analysis = await _analyze_post_content(content, title)

            if _update_post_with_analysis(supabase, post["id"], analysis):
                analyzed_count += 1
                is_stock = analysis.get("is_stock_related", {}).get(
                    "is_stock_related", False
                )
                sentiment = analysis.get("sentiment", {}).get("sentiment", "neutral")
                tickers = analysis.get("tickers", [])
                print(
                    f"  ✅ 完成 | 股票相关: {is_stock} | 情感: {sentiment} | 代码: {tickers}"
                )
            else:
                failed_count += 1

        except Exception as e:
            print(f"  ❌ 分析失败: {e}")
            failed_count += 1

    print(f"\n📊 批量分析完成: 成功 {analyzed_count}, 失败 {failed_count}")
    return {"analyzed": analyzed_count, "failed": failed_count}


@router.post("/analyze-batch", response_model=Dict)
async def analyze_batch_posts(
    request: BatchAnalysisRequest,
    background_tasks: BackgroundTasks,
):
    """
    🤖 批量 AI 分析帖子

    后台任务批量分析多个帖子，返回任务状态。

    参数：
    - limit: 分析数量限制 (默认: 10, 最大: 50)
    - force: 是否强制重新分析
    - only_unanalyzed: 是否只分析未分析的帖子
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    try:
        # 构建查询
        query = supabase.table("xhs_posts").select("*").order("scraped_at", desc=True)

        if request.only_unanalyzed:
            query = query.is_("ai_analyzed_at", "null")

        result = query.limit(request.limit).execute()
        posts = result.data or []

        if not posts:
            return {
                "success": True,
                "message": "没有需要分析的帖子",
                "total": 0,
            }

        # 启动后台任务
        background_tasks.add_task(_batch_analyze_posts, supabase, posts, request.force)

        return {
            "success": True,
            "message": f"已启动批量分析任务，共 {len(posts)} 个帖子",
            "total": len(posts),
            "status": "processing",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动分析任务失败: {str(e)}")


@router.get("/analysis-stats", response_model=Dict)
def get_analysis_stats():
    """
    📊 获取 AI 分析统计

    返回 AI 分析的统计信息，包括：
    - 已分析/未分析帖子数量
    - 情感分布
    - 股票相关性分布
    - 热门股票代码
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    try:
        # 总数
        total_result = supabase.table("xhs_posts").select("id", count="exact").execute()
        total_count = total_result.count or 0

        # 已分析数量
        analyzed_result = (
            supabase.table("xhs_posts")
            .select("id", count="exact")
            .not_.is_("ai_analyzed_at", "null")
            .execute()
        )
        analyzed_count = analyzed_result.count or 0

        # 股票相关数量
        stock_related_result = (
            supabase.table("xhs_posts")
            .select("id", count="exact")
            .eq("ai_is_stock_related", True)
            .execute()
        )
        stock_related_count = stock_related_result.count or 0

        # 情感分布
        bullish_result = (
            supabase.table("xhs_posts")
            .select("id", count="exact")
            .eq("ai_sentiment", "bullish")
            .execute()
        )
        bearish_result = (
            supabase.table("xhs_posts")
            .select("id", count="exact")
            .eq("ai_sentiment", "bearish")
            .execute()
        )
        neutral_result = (
            supabase.table("xhs_posts")
            .select("id", count="exact")
            .eq("ai_sentiment", "neutral")
            .execute()
        )

        return {
            "success": True,
            "stats": {
                "total_posts": total_count,
                "analyzed_posts": analyzed_count,
                "unanalyzed_posts": total_count - analyzed_count,
                "stock_related_posts": stock_related_count,
                "sentiment_distribution": {
                    "bullish": bullish_result.count or 0,
                    "bearish": bearish_result.count or 0,
                    "neutral": neutral_result.count or 0,
                },
                "analysis_rate": (
                    round(analyzed_count / total_count * 100, 2)
                    if total_count > 0
                    else 0
                ),
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")


@router.get("/top-tickers", response_model=Dict)
def get_top_tickers(
    limit: int = Query(10, ge=1, le=50, description="返回数量"),
):
    """
    📈 获取热门股票代码

    返回被提及最多的股票代码及其帖子数量
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    try:
        # 获取所有有 tickers 的帖子
        result = (
            supabase.table("xhs_posts")
            .select("ai_tickers")
            .not_.is_("ai_tickers", "null")
            .execute()
        )

        # 统计 ticker 出现次数
        ticker_counts = {}
        for row in result.data or []:
            tickers = row.get("ai_tickers", [])
            if tickers:
                for ticker in tickers:
                    ticker_counts[ticker] = ticker_counts.get(ticker, 0) + 1

        # 排序并取 top N
        sorted_tickers = sorted(
            ticker_counts.items(), key=lambda x: x[1], reverse=True
        )[:limit]

        return {
            "success": True,
            "tickers": [{"ticker": t[0], "count": t[1]} for t in sorted_tickers],
            "total_unique_tickers": len(ticker_counts),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取热门代码失败: {str(e)}")
