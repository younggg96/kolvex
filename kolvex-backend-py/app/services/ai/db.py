"""
AI 分析结果数据库操作模块
保存和批量处理推文分析结果
"""

from typing import Dict, Any

from .client import OllamaClient
from .analyzer import TweetAnalyzer


async def save_analysis_to_db(tweet_id: int, analysis: Dict[str, Any]) -> bool:
    """
    将 AI 分析结果保存到数据库

    Args:
        tweet_id: 推文 ID
        analysis: full_analysis 返回的分析结果

    Returns:
        bool: 保存成功返回 True
    """
    try:
        from app.core.supabase import get_supabase_service

        supabase = get_supabase_service()

        # 提取股市相关性数据
        stock_related_data = analysis.get("is_stock_related", {})

        # 构建更新数据
        update_data = {
            # 情感分析
            "ai_sentiment": analysis.get("sentiment", {}).get("sentiment"),
            "ai_sentiment_confidence": analysis.get("sentiment", {}).get("confidence"),
            "ai_sentiment_reasoning": analysis.get("sentiment", {}).get("reasoning"),
            # 股票代码和标签 (JSONB)
            "ai_tickers": analysis.get("tickers", []),
            "ai_tags": analysis.get("tags", []),
            # 投资信号 (JSONB)
            "ai_trading_signal": analysis.get("trading_signal"),
            # 摘要
            "ai_summary": analysis.get("summary"),
            # 股市相关性
            "ai_is_stock_related": stock_related_data.get("is_stock_related", False),
            "ai_stock_related_confidence": stock_related_data.get("confidence"),
            "ai_stock_related_reason": stock_related_data.get("reason"),
            # 元数据
            "ai_analyzed_at": analysis.get("analyzed_at"),
            "ai_model": analysis.get("model"),
        }

        # 更新数据库
        supabase.table("kol_tweets").update(update_data).eq("id", tweet_id).execute()

        return True

    except Exception as e:
        print(f"❌ 保存 AI 分析结果失败 (tweet_id={tweet_id}): {e}")
        return False


async def analyze_and_save_tweet(tweet_id: int, tweet_text: str) -> Dict[str, Any]:
    """
    分析推文并保存到数据库

    Args:
        tweet_id: 推文 ID
        tweet_text: 推文文本

    Returns:
        Dict: 分析结果
    """
    async with OllamaClient() as client:
        analyzer = TweetAnalyzer(client)
        analysis = await analyzer.full_analysis(tweet_text)

        # 保存到数据库
        await save_analysis_to_db(tweet_id, analysis)

        return analysis


async def batch_analyze_tweets(limit: int = 10) -> Dict[str, Any]:
    """
    批量分析未处理的推文

    Args:
        limit: 每批处理的推文数量

    Returns:
        Dict: 处理统计信息
    """
    try:
        from app.core.supabase import get_supabase_service

        supabase = get_supabase_service()

        # 查询未分析的推文
        result = (
            supabase.table("kol_tweets")
            .select("id, tweet_text")
            .is_("ai_analyzed_at", "null")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        tweets = result.data
        if not tweets:
            return {
                "processed": 0,
                "success": 0,
                "failed": 0,
                "message": "没有待分析的推文",
            }

        stats = {"processed": 0, "success": 0, "failed": 0, "results": []}

        async with OllamaClient() as client:
            analyzer = TweetAnalyzer(client)

            for tweet in tweets:
                tweet_id = tweet["id"]
                tweet_text = tweet["tweet_text"]

                try:
                    print(f"🔍 分析推文 #{tweet_id}: {tweet_text[:50]}...")

                    analysis = await analyzer.full_analysis(tweet_text)
                    saved = await save_analysis_to_db(tweet_id, analysis)

                    stats["processed"] += 1
                    if saved:
                        stats["success"] += 1
                        stats["results"].append(
                            {
                                "tweet_id": tweet_id,
                                "sentiment": analysis.get("sentiment", {}).get(
                                    "sentiment"
                                ),
                                "tickers": analysis.get("tickers", []),
                                "success": True,
                            }
                        )
                        print(
                            f"   ✅ 情感: {analysis.get('sentiment', {}).get('sentiment')} | "
                            f"股票: {analysis.get('tickers', [])}"
                        )
                    else:
                        stats["failed"] += 1
                        stats["results"].append(
                            {
                                "tweet_id": tweet_id,
                                "success": False,
                                "error": "保存失败",
                            }
                        )

                except Exception as e:
                    stats["processed"] += 1
                    stats["failed"] += 1
                    stats["results"].append(
                        {"tweet_id": tweet_id, "success": False, "error": str(e)}
                    )
                    print(f"   ❌ 分析失败: {e}")

        return stats

    except Exception as e:
        return {"processed": 0, "success": 0, "failed": 0, "error": str(e)}
