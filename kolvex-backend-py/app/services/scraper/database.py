"""
Supabase 数据库操作
支持统一的 kol_profiles 和 kol_tweets 表结构
"""

import os
import json
import hashlib
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta, timezone

# Supabase 相关导入
try:
    from supabase import create_client, Client

    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from .config import DEFAULT_TWEET_MAX_AGE_DAYS, ENABLE_AI_ANALYSIS

# 平台标识
PLATFORM_TWITTER = "twitter"


def get_supabase_client() -> Optional[Client]:
    """
    获取 Supabase 客户端

    Returns:
        Optional[Client]: Supabase 客户端，如果未配置返回 None
    """
    if not SUPABASE_AVAILABLE:
        print("⚠️ Supabase 未安装，请运行: pip install supabase")
        return None

    # 从统一配置获取
    from app.core.config import settings

    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY

    if not supabase_url or not supabase_key:
        print(
            "⚠️ Supabase 配置未找到，请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY 环境变量"
        )
        return None

    return create_client(supabase_url, supabase_key)


def compute_tweet_hash(text: str, username: str) -> str:
    """
    计算推文的唯一哈希值

    Args:
        text: 推文文本
        username: 用户名

    Returns:
        str: SHA256 哈希值的前 16 位
    """
    content = f"{username}:{text}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def tweet_exists(client: Client, tweet_hash: str) -> bool:
    """
    检查推文是否已存在于数据库中

    Args:
        client: Supabase 客户端
        tweet_hash: 推文哈希值

    Returns:
        bool: 如果存在返回 True
    """
    try:
        result = (
            client.table("kol_tweets")
            .select("id")
            .eq("tweet_hash", tweet_hash)
            .limit(1)
            .execute()
        )
        return len(result.data) > 0
    except Exception as e:
        print(f"⚠️ 检查推文是否存在失败: {e}")
        return False


def insert_tweet(
    client: Client,
    tweet_data: Dict,
    max_age_days: int = DEFAULT_TWEET_MAX_AGE_DAYS,
    enable_ai_analysis: bool = None,  # None 表示使用配置文件的值
) -> Tuple[bool, Optional[int]]:
    """
    插入推文到 Supabase 数据库（如果不存在且不太旧），并进行 AI 分析

    Args:
        client: Supabase 客户端
        tweet_data: 推文数据字典，包含:
            - username: 用户名
            - text: 推文文本
            - created_at: 创建时间
            - permalink: 推文链接
            - avatar_url: KOL 头像 URL
            - media_urls: 媒体 URL 列表
            - is_repost: 是否是转发
            - original_author: 原作者
            - reply_count, repost_count, like_count, bookmark_count, views_count
        max_age_days: 最大推文年龄（天），超过此天数的推文不会被插入
        enable_ai_analysis: 是否启用 AI 分析（默认 True）

    Returns:
        Tuple[bool, Optional[int]]: (插入成功返回 True，推文 ID 或 None)
    """
    # 检查推文时间，如果太旧就跳过
    created_at_str = tweet_data.get("created_at")
    if created_at_str:
        try:
            # 解析 ISO 格式时间
            if created_at_str.endswith("Z"):
                created_at_str = created_at_str[:-1] + "+00:00"
            tweet_time = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))

            # 如果是 naive datetime，假设为 UTC
            if tweet_time.tzinfo is None:
                tweet_time = tweet_time.replace(tzinfo=timezone.utc)

            cutoff_time = datetime.now(timezone.utc) - timedelta(days=max_age_days)

            if tweet_time < cutoff_time:
                print(
                    f"   ⏭️ 跳过旧推文 ({created_at_str[:10]}): {tweet_data['text'][:30]}..."
                )
                return False, None
        except Exception:
            # 解析失败就继续插入
            pass

    tweet_hash = compute_tweet_hash(tweet_data["text"], tweet_data["username"])

    if tweet_exists(client, tweet_hash):
        return False, None

    # 进行 AI 分析（在插入前）
    # 如果 enable_ai_analysis 为 None，使用配置文件的值
    should_analyze = enable_ai_analysis if enable_ai_analysis is not None else ENABLE_AI_ANALYSIS
    ai_analysis = None
    if should_analyze:
        ai_analysis = _perform_ai_analysis(tweet_data["text"])

    try:
        # 处理 media_urls - 转换为 JSON 字符串存储
        media_urls = tweet_data.get("media_urls", [])
        media_urls_json = json.dumps(media_urls) if media_urls else None

        data = {
            # === 平台信息 ===
            "platform": PLATFORM_TWITTER,
            "platform_post_id": tweet_data.get("tweet_id"),  # Twitter 推文 ID
            "author_platform_id": tweet_data["username"],  # Twitter 用户名作为平台 ID
            # === 基础信息 ===
            "username": tweet_data["username"],
            "tweet_text": tweet_data["text"],
            "tweet_hash": tweet_hash,
            "post_type": "retweet" if tweet_data.get("is_repost") else "tweet",
            "created_at": tweet_data.get("created_at"),
            "permalink": tweet_data.get("permalink"),
            # 头像和媒体
            "avatar_url": tweet_data.get("avatar_url"),
            "media_urls": media_urls_json,
            "is_repost": tweet_data.get("is_repost", False),
            "original_author": tweet_data.get("original_author"),
            # 互动数据
            "like_count": tweet_data.get("like_count", 0),
            "retweet_count": tweet_data.get("repost_count", 0),  # 兼容旧字段名
            "reply_count": tweet_data.get("reply_count", 0),
            "bookmark_count": tweet_data.get("bookmark_count", 0),
            "views_count": tweet_data.get("views_count", 0),
            # 元数据
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }

        # 添加 AI 分析结果
        if ai_analysis:
            stock_related_data = ai_analysis.get("is_stock_related", {})
            data.update(
                {
                    # 情感分析
                    "ai_sentiment": ai_analysis.get("sentiment", {}).get("sentiment"),
                    "ai_sentiment_confidence": ai_analysis.get("sentiment", {}).get(
                        "confidence"
                    ),
                    "ai_sentiment_reasoning": ai_analysis.get("sentiment", {}).get(
                        "reasoning"
                    ),
                    # 股票代码和标签 (JSONB)
                    "ai_tickers": ai_analysis.get("tickers", []),
                    "ai_tags": ai_analysis.get("tags", []),
                    # 摘要和投资信号
                    "ai_summary": ai_analysis.get("summary"),
                    "ai_trading_signal": ai_analysis.get("trading_signal"),
                    # 股市相关性
                    "ai_is_stock_related": stock_related_data.get(
                        "is_stock_related", False
                    ),
                    "ai_stock_related_confidence": stock_related_data.get("confidence"),
                    "ai_stock_related_reason": stock_related_data.get("reason"),
                    # 元数据
                    "ai_analyzed_at": ai_analysis.get("analyzed_at"),
                    "ai_model": ai_analysis.get("model"),
                }
            )

        result = client.table("kol_tweets").insert(data).execute()
        # 获取插入的推文 ID
        tweet_id = result.data[0]["id"] if result.data else None
        return True, tweet_id
    except Exception as e:
        # 可能是唯一约束冲突（并发情况）
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return False, None
        print(f"⚠️ 插入推文失败: {e}")
        return False, None


# AI 分析器单例（避免重复创建）
_ai_analyzer = None


def _get_ai_analyzer():
    """获取 AI 分析器单例"""
    global _ai_analyzer
    if _ai_analyzer is None:
        try:
            from app.services.ai import TweetAnalyzerSync, OllamaClientSync

            client = OllamaClientSync()
            # 先检查 AI 服务是否可用
            if client.health_check():
                _ai_analyzer = TweetAnalyzerSync(client)
                print("🤖 AI 分析器已初始化")
            else:
                print("⚠️ AI 服务不可用，跳过 AI 分析")
                _ai_analyzer = False  # 标记为不可用
        except Exception as e:
            print(f"⚠️ AI 分析器初始化失败: {e}")
            _ai_analyzer = False
    return _ai_analyzer if _ai_analyzer else None


def _perform_ai_analysis(tweet_text: str) -> Optional[Dict]:
    """
    执行 AI 分析（同步）

    Args:
        tweet_text: 推文文本

    Returns:
        Optional[Dict]: 分析结果，失败返回 None（避免将错误数据写入数据库）
    """
    analyzer = _get_ai_analyzer()
    if not analyzer:
        return None

    try:
        analysis = analyzer.basic_analysis(tweet_text)
        
        # 检查是否是分析失败的默认结果
        # 如果分析失败，返回 None 避免将错误的 stock_related=False 写入数据库
        if analysis.get("analysis_failed"):
            print(f"   ⚠️ AI 分析失败（将跳过 AI 字段更新）")
            return None
        
        sentiment = analysis.get("sentiment", {}).get("sentiment", "neutral")
        tickers = analysis.get("tickers", [])
        print(f"   🤖 AI: {sentiment} | 股票: {tickers if tickers else '无'}")
        return analysis
    except Exception as e:
        print(f"   ⚠️ AI 分析失败: {e}")
        return None


def upsert_kol_profile(client: Client, profile_data: Dict) -> bool:
    """
    插入或更新 KOL profile 到统一的 kol_profiles 表

    Args:
        client: Supabase 客户端
        profile_data: 完整的 profile 数据字典

    Returns:
        bool: 操作成功返回 True
    """
    try:
        username = profile_data["username"]

        data = {
            # === 平台信息 ===
            "platform": PLATFORM_TWITTER,
            "platform_user_id": username,  # Twitter 用户名作为平台 ID
            # 核心身份信息
            "username": username,
            "rest_id": profile_data.get("rest_id"),
            "display_name": profile_data.get("display_name"),
            # 认证状态
            "is_verified": profile_data.get("is_verified", False),
            "verification_type": profile_data.get("verification_type", "None"),
            # 影响力指标
            "followers_count": profile_data.get("followers_count", 0),
            "following_count": profile_data.get("following_count", 0),
            # 时间信息
            "join_date": profile_data.get("join_date"),
            # 外部链接与位置
            "location": profile_data.get("location"),
            "website": profile_data.get("website"),
            "bio": profile_data.get("bio"),
            # 视觉素材
            "avatar_url": profile_data.get("avatar_url"),
            "banner_url": profile_data.get("banner_url"),
            # 元数据
            "is_active": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # 检查是否已存在
        existing = (
            client.table("kol_profiles")
            .select("id")
            .eq("platform", PLATFORM_TWITTER)
            .eq("platform_user_id", username)
            .limit(1)
            .execute()
        )

        if existing.data:
            # 更新现有记录
            client.table("kol_profiles").update(data).eq(
                "platform", PLATFORM_TWITTER
            ).eq("platform_user_id", username).execute()
        else:
            # 插入新记录
            data["created_at"] = datetime.now(timezone.utc).isoformat()
            client.table("kol_profiles").insert(data).execute()

        return True
    except Exception as e:
        print(f"⚠️ 保存 KOL profile 失败: {e}")
        return False


# 保留旧函数名作为别名，保持兼容性
upsert_user_profile = upsert_kol_profile


def get_stats(client: Client) -> Dict:
    """
    获取数据库统计信息

    Returns:
        Dict: 包含总数、各用户数量等统计信息
    """
    try:
        # 总推文数
        total_result = client.table("kol_tweets").select("id", count="exact").execute()
        total = total_result.count or 0

        # 简单查询各用户推文数
        by_user = {}
        try:
            users_result = client.table("kol_tweets").select("username").execute()
            for row in users_result.data:
                username = row["username"]
                by_user[username] = by_user.get(username, 0) + 1
        except Exception:
            pass

        return {
            "total": total,
            "by_user": dict(sorted(by_user.items(), key=lambda x: x[1], reverse=True)),
        }
    except Exception as e:
        print(f"⚠️ 获取统计信息失败: {e}")
        return {"total": 0, "by_user": {}}
