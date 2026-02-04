"""
KOL 帖子 AI 分析 API 路由
提供对现有帖子进行 AI 分析的功能，包括情感分析、股票代码提取、摘要生成等
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import Dict, List, Optional
from datetime import datetime, timezone

from app.core.supabase import get_supabase_service
from app.services.ai import TweetAnalyzer, OllamaClient

from .schemas import (
    PostAIAnalysisRequest,
    PostAIAnalysisResponse,
    BatchPostAnalysisRequest,
    BatchPostAnalysisResponse,
    PostAnalysisStatsResponse,
    TopTickersResponse,
    TickerCount,
)

router = APIRouter(prefix="/ai", tags=["KOL Posts AI Analysis"])


# ============================================================
# 内部辅助函数
# ============================================================


async def _analyze_post_content(content: str, title: str = "") -> Dict:
    """
    内部函数：对帖子内容进行 AI 分析

    Args:
        content: 帖子内容
        title: 帖子标题（可选）

    Returns:
        Dict: AI 分析结果
    """
    full_text = f"{title}\n\n{content}" if title else content

    async with OllamaClient() as client:
        analyzer = TweetAnalyzer(client)
        result = await analyzer.full_analysis(full_text)
        return result


def _update_post_with_analysis(supabase, post_id: int, analysis: Dict) -> bool:
    """
    内部函数：将 AI 分析结果更新到数据库

    Args:
        supabase: Supabase 客户端
        post_id: 帖子数据库 ID
        analysis: AI 分析结果

    Returns:
        bool: 更新成功返回 True

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
            "ai_trading_signal": trading_signal if trading_signal else None,
            "ai_is_stock_related": is_stock_data.get("is_stock_related", False),
            "ai_stock_related_confidence": is_stock_data.get("confidence", 0.0),
            "ai_stock_related_reason": is_stock_data.get("reason", ""),
            "ai_analyzed_at": datetime.now(timezone.utc).isoformat(),
            "ai_model": analysis.get("model", "unknown"),
        }

        supabase.table("kol_tweets").update(update_data).eq("id", post_id).execute()
        return True
    except Exception as e:
        print(f"❌ 更新分析结果失败 (post_id={post_id}): {e}")
        return False


# ============================================================
# API 端点
# ============================================================


@router.post("/analyze/{post_id}", response_model=PostAIAnalysisResponse)
async def analyze_single_post(
    post_id: int,
    force: bool = Query(False, description="是否强制重新分析（即使已有分析结果）"),
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
    - post_id: 帖子数据库 ID
    - force: 是否强制重新分析（即使已有分析结果）
    """
    supabase = get_supabase_service()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库服务未连接")

    try:
        # 获取帖子
        result = (
            supabase.table("kol_tweets")
            .select("*")
            .eq("id", post_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail=f"帖子不存在: {post_id}")

        post = result.data[0]

        # 检查是否已分析且不强制重新分析
        if post.get("ai_analyzed_at") and not force:
            trading_signal = post.get("ai_trading_signal", {})
            return PostAIAnalysisResponse(
                success=True,
                post_id=post_id,
                sentiment=post.get("ai_sentiment"),
                sentiment_confidence=post.get("ai_sentiment_confidence"),
                sentiment_reasoning=post.get("ai_sentiment_reasoning"),
                tickers=post.get("ai_tickers"),
                tags=post.get("ai_tags"),
                summary=post.get("ai_summary"),
                trading_signal=trading_signal.get("action") if trading_signal else None,
                is_stock_related=post.get("ai_is_stock_related", False),
                stock_related_confidence=post.get("ai_stock_related_confidence"),
                stock_related_reason=post.get("ai_stock_related_reason"),
                analyzed_at=post.get("ai_analyzed_at"),
                model=post.get("ai_model"),
                cached=True,
            )

        # 执行 AI 分析
        content = post.get("tweet_text", "")
        title = post.get("title", "")

        if not content and not title:
            raise HTTPException(status_code=400, detail="帖子内容为空，无法分析")

        analysis = await _analyze_post_content(content, title)

        # 更新数据库
        _update_post_with_analysis(supabase, post_id, analysis)

        sentiment_data = analysis.get("sentiment", {})
        is_stock_data = analysis.get("is_stock_related", {})
        trading_signal = analysis.get("trading_signal", {})

        return PostAIAnalysisResponse(
            success=True,
            post_id=post_id,
            sentiment=sentiment_data.get("sentiment"),
            sentiment_confidence=sentiment_data.get("confidence"),
            sentiment_reasoning=sentiment_data.get("reasoning"),
            tickers=analysis.get("tickers"),
            tags=analysis.get("tags"),
            summary=analysis.get("summary"),
            trading_signal=trading_signal.get("action") if trading_signal else None,
            is_stock_related=is_stock_data.get("is_stock_related", False),
            stock_related_confidence=is_stock_data.get("confidence"),
            stock_related_reason=is_stock_data.get("reason"),
            analyzed_at=analysis.get("analyzed_at"),
            model=analysis.get("model"),
            cached=False,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


async def _batch_analyze_posts(supabase, posts: List[Dict], force: bool = False):
    """
    后台批量分析帖子

    Args:
        supabase: Supabase 客户端
        posts: 帖子列表
        force: 是否强制重新分析
    """
    analyzed_count = 0
    failed_count = 0
    skipped_count = 0

    for post in posts:
        try:
            # 跳过已分析的（除非强制）
            if post.get("ai_analyzed_at") and not force:
                skipped_count += 1
                continue

            content = post.get("tweet_text", "")
            title = post.get("title", "")

            if not content and not title:
                skipped_count += 1
                continue

            print(f"🤖 分析帖子 #{post['id']}: {content[:50]}...")

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

    print(
        f"\n📊 批量分析完成: 成功 {analyzed_count}, 失败 {failed_count}, 跳过 {skipped_count}"
    )
    return {
        "analyzed": analyzed_count,
        "failed": failed_count,
        "skipped": skipped_count,
    }


@router.post("/analyze-batch", response_model=BatchPostAnalysisResponse)
async def analyze_batch_posts(
    request: BatchPostAnalysisRequest,
    background_tasks: BackgroundTasks,
):
    """
    🤖 批量 AI 分析帖子

    后台任务批量分析多个帖子，返回任务状态。

    参数：
    - limit: 分析数量限制 (默认: 10, 最大: 500)
    - force: 是否强制重新分析
    - only_unanalyzed: 是否只分析未分析的帖子 (默认: True)
    - platform: 可选，按平台筛选 (twitter, xiaohongshu)
    - username: 可选，按用户名筛选
    """
    # 限制最大值为 500
    limit = min(request.limit, 500)
    supabase = get_supabase_service()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库服务未连接")

    try:
        # 构建查询
        query = supabase.table("kol_tweets").select("*").order("created_at", desc=True)

        if request.only_unanalyzed:
            query = query.is_("ai_analyzed_at", "null")

        if request.platform:
            query = query.eq("platform", request.platform)

        if request.username:
            query = query.eq("username", request.username)

        result = query.limit(limit).execute()
        posts = result.data or []

        if not posts:
            return BatchPostAnalysisResponse(
                success=True,
                message="没有需要分析的帖子",
                total=0,
                status="completed",
            )

        # 启动后台任务
        background_tasks.add_task(_batch_analyze_posts, supabase, posts, request.force)

        return BatchPostAnalysisResponse(
            success=True,
            message=f"已启动批量分析任务，共 {len(posts)} 个帖子",
            total=len(posts),
            status="processing",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动分析任务失败: {str(e)}")


@router.get("/analysis-stats", response_model=PostAnalysisStatsResponse)
def get_analysis_stats(
    platform: Optional[str] = Query(
        None, description="按平台筛选 (twitter, xiaohongshu)"
    ),
):
    """
    📊 获取 AI 分析统计

    返回 AI 分析的统计信息，包括：
    - 已分析/未分析帖子数量
    - 情感分布
    - 股票相关性分布
    - 分析覆盖率
    """
    supabase = get_supabase_service()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库服务未连接")

    try:
        # 基础查询
        base_query = supabase.table("kol_tweets").select("id", count="exact")
        if platform:
            base_query = base_query.eq("platform", platform)

        # 总数
        total_result = base_query.execute()
        total_count = total_result.count or 0

        # 已分析数量
        analyzed_query = supabase.table("kol_tweets").select("id", count="exact")
        if platform:
            analyzed_query = analyzed_query.eq("platform", platform)
        analyzed_result = analyzed_query.not_.is_("ai_analyzed_at", "null").execute()
        analyzed_count = analyzed_result.count or 0

        # 股票相关数量
        stock_query = supabase.table("kol_tweets").select("id", count="exact")
        if platform:
            stock_query = stock_query.eq("platform", platform)
        stock_related_result = stock_query.eq("ai_is_stock_related", True).execute()
        stock_related_count = stock_related_result.count or 0

        # 情感分布
        def count_sentiment(sentiment: str) -> int:
            query = supabase.table("kol_tweets").select("id", count="exact")
            if platform:
                query = query.eq("platform", platform)
            result = query.eq("ai_sentiment", sentiment).execute()
            return result.count or 0

        bullish_count = count_sentiment("bullish")
        bearish_count = count_sentiment("bearish")
        neutral_count = count_sentiment("neutral")

        return PostAnalysisStatsResponse(
            success=True,
            total_posts=total_count,
            analyzed_posts=analyzed_count,
            unanalyzed_posts=total_count - analyzed_count,
            stock_related_posts=stock_related_count,
            sentiment_distribution={
                "bullish": bullish_count,
                "bearish": bearish_count,
                "neutral": neutral_count,
            },
            analysis_rate=(
                round(analyzed_count / total_count * 100, 2) if total_count > 0 else 0
            ),
            platform=platform,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")


@router.get("/top-tickers", response_model=TopTickersResponse)
def get_top_tickers(
    limit: int = Query(10, ge=1, le=50, description="返回数量"),
    platform: Optional[str] = Query(
        None, description="按平台筛选 (twitter, xiaohongshu)"
    ),
):
    """
    📈 获取热门股票代码

    返回被提及最多的股票代码及其帖子数量
    """
    supabase = get_supabase_service()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库服务未连接")

    try:
        # 获取所有有 tickers 的帖子
        query = (
            supabase.table("kol_tweets")
            .select("ai_tickers")
            .not_.is_("ai_tickers", "null")
        )

        if platform:
            query = query.eq("platform", platform)

        result = query.execute()

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

        return TopTickersResponse(
            success=True,
            tickers=[TickerCount(ticker=t[0], count=t[1]) for t in sorted_tickers],
            total_unique_tickers=len(ticker_counts),
            platform=platform,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取热门代码失败: {str(e)}")


@router.post("/analyze-all", response_model=BatchPostAnalysisResponse)
async def analyze_all_posts(
    background_tasks: BackgroundTasks,
    batch_size: int = Query(100, ge=10, le=500, description="每批次分析数量"),
    max_posts: int = Query(None, description="最大分析数量（不设置则分析所有）"),
    platform: Optional[str] = Query(
        None, description="按平台筛选 (twitter, xiaohongshu)"
    ),
    username: Optional[str] = Query(None, description="按用户名筛选"),
):
    """
    🤖 分析所有未分析的帖子（后台任务）

    此功能会在后台批量分析所有未分析的帖子，**无数量限制**。

    参数：
    - batch_size: 每批次处理数量 (默认: 100, 最大: 500)
    - max_posts: 最大处理数量（不设置则分析所有）
    - platform: 可选，按平台筛选 (twitter, xiaohongshu)
    - username: 可选，按用户名筛选
    """
    supabase = get_supabase_service()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库服务未连接")

    try:
        # 获取未分析帖子总数
        count_query = (
            supabase.table("kol_tweets")
            .select("id", count="exact")
            .is_("ai_analyzed_at", "null")
        )
        if platform:
            count_query = count_query.eq("platform", platform)
        if username:
            count_query = count_query.eq("username", username)

        count_response = count_query.execute()
        total_unanalyzed = count_response.count or 0

        if total_unanalyzed == 0:
            return BatchPostAnalysisResponse(
                success=True,
                message="没有需要分析的帖子",
                total=0,
                status="completed",
            )

        # 计算要分析的数量
        posts_to_analyze = (
            min(total_unanalyzed, max_posts) if max_posts else total_unanalyzed
        )

        # 启动后台任务
        background_tasks.add_task(
            _analyze_all_posts_task,
            platform=platform,
            username=username,
            batch_size=batch_size,
            max_posts=posts_to_analyze,
        )

        return BatchPostAnalysisResponse(
            success=True,
            message=f"已启动后台分析任务，共 {posts_to_analyze} 个帖子",
            total=posts_to_analyze,
            status="processing",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动分析任务失败: {str(e)}")


async def _analyze_all_posts_task(
    platform: Optional[str],
    username: Optional[str],
    batch_size: int,
    max_posts: int,
):
    """
    后台任务：分析所有帖子
    """
    import asyncio
    from app.services.ai import TweetAnalyzer, OllamaClient
    from app.core.supabase import get_supabase_service

    supabase = get_supabase_service()
    total_analyzed = 0
    total_failed = 0

    print(
        f"\n🚀 开始分析 {max_posts} 个帖子 (platform: {platform or 'all'}, user: {username or 'all'})"
    )

    try:
        async with OllamaClient() as client:
            analyzer = TweetAnalyzer(client)

            while total_analyzed + total_failed < max_posts:
                # 获取下一批未分析的帖子
                query = (
                    supabase.table("kol_tweets")
                    .select("id, tweet_text, title, platform")
                    .is_("ai_analyzed_at", "null")
                    .order("created_at", desc=True)
                    .limit(batch_size)
                )
                if platform:
                    query = query.eq("platform", platform)
                if username:
                    query = query.eq("username", username)

                response = query.execute()
                posts = response.data or []

                if not posts:
                    print(f"📭 没有更多帖子需要分析")
                    break

                print(f"\n📦 处理批次: {len(posts)} 个帖子 (已完成: {total_analyzed})")

                for post in posts:
                    if total_analyzed + total_failed >= max_posts:
                        break

                    try:
                        content = post.get("tweet_text", "")
                        title = post.get("title", "")
                        full_text = f"{title}\n\n{content}" if title else content

                        if not full_text.strip():
                            continue

                        analysis = await analyzer.full_analysis(full_text)

                        if analysis and not analysis.get("analysis_failed"):
                            sentiment_data = analysis.get("sentiment", {})
                            is_stock_data = analysis.get("is_stock_related", {})
                            trading_signal = analysis.get("trading_signal", {})

                            from datetime import datetime, timezone

                            supabase.table("kol_tweets").update(
                                {
                                    "ai_sentiment": sentiment_data.get(
                                        "sentiment", "neutral"
                                    ),
                                    "ai_sentiment_confidence": sentiment_data.get(
                                        "confidence", 0.0
                                    ),
                                    "ai_sentiment_reasoning": sentiment_data.get(
                                        "reasoning", ""
                                    ),
                                    "ai_tickers": analysis.get("tickers", []),
                                    "ai_tags": analysis.get("tags", []),
                                    "ai_summary": analysis.get("summary", ""),
                                    "ai_trading_signal": (
                                        trading_signal if trading_signal else None
                                    ),
                                    "ai_is_stock_related": is_stock_data.get(
                                        "is_stock_related", False
                                    ),
                                    "ai_stock_related_confidence": is_stock_data.get(
                                        "confidence", 0.0
                                    ),
                                    "ai_stock_related_reason": is_stock_data.get(
                                        "reason", ""
                                    ),
                                    "ai_analyzed_at": datetime.now(
                                        timezone.utc
                                    ).isoformat(),
                                    "ai_model": analysis.get("model", "unknown"),
                                }
                            ).eq("id", post["id"]).execute()

                            total_analyzed += 1

                            if total_analyzed % 10 == 0:
                                print(
                                    f"  📊 进度: {total_analyzed} 已分析, {total_failed} 失败"
                                )
                        else:
                            print(
                                f"  ⚠️ AI 分析失败 (post_id={post['id']}), 跳过数据库更新"
                            )
                            total_failed += 1

                    except Exception as e:
                        print(f"  ❌ 分析失败 (post_id={post['id']}): {e}")
                        total_failed += 1

                # 批次间延迟，避免过载
                await asyncio.sleep(0.5)

    except Exception as e:
        print(f"❌ 分析任务失败: {e}")

    print(f"\n✅ 分析完成!")
    print(f"   📊 成功: {total_analyzed}")
    print(f"   ❌ 失败: {total_failed}")


@router.post("/analyze-by-ids", response_model=BatchPostAnalysisResponse)
async def analyze_posts_by_ids(
    request: PostAIAnalysisRequest,
    background_tasks: BackgroundTasks,
):
    """
    🤖 按 ID 列表分析帖子

    对指定的帖子 ID 列表进行 AI 分析

    参数：
    - post_ids: 帖子 ID 列表
    - force: 是否强制重新分析
    """
    supabase = get_supabase_service()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库服务未连接")

    if not request.post_ids:
        raise HTTPException(status_code=400, detail="帖子 ID 列表不能为空")

    try:
        # 查询指定的帖子
        result = (
            supabase.table("kol_tweets")
            .select("*")
            .in_("id", request.post_ids)
            .execute()
        )

        posts = result.data or []

        if not posts:
            return BatchPostAnalysisResponse(
                success=True,
                message="未找到指定的帖子",
                total=0,
                status="completed",
            )

        # 启动后台任务
        background_tasks.add_task(_batch_analyze_posts, supabase, posts, request.force)

        return BatchPostAnalysisResponse(
            success=True,
            message=f"已启动分析任务，共 {len(posts)} 个帖子",
            total=len(posts),
            status="processing",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动分析任务失败: {str(e)}")
