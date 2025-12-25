"""
小红书帖子数据库操作
"""

import os
import json
import hashlib
from typing import Dict, Optional, Tuple, List
from datetime import datetime, timedelta, timezone

# Supabase 相关导入
try:
    from supabase import create_client, Client

    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from .config import DEFAULT_POST_MAX_AGE_DAYS


def get_supabase_client() -> Optional[Client]:
    """
    获取 Supabase 客户端

    Returns:
        Optional[Client]: Supabase 客户端，如果未配置返回 None
    """
    if not SUPABASE_AVAILABLE:
        print("⚠️ Supabase 未安装，请运行: pip install supabase")
        return None

    # 从环境变量获取配置
    from dotenv import load_dotenv

    load_dotenv()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        print(
            "⚠️ Supabase 配置未找到，请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY 环境变量"
        )
        return None

    return create_client(supabase_url, supabase_key)


def compute_post_hash(note_id: str, content: str) -> str:
    """
    计算帖子的唯一哈希值

    Args:
        note_id: 小红书笔记 ID
        content: 帖子内容

    Returns:
        str: SHA256 哈希值的前 16 位
    """
    unique_content = f"xhs:{note_id}:{content[:200]}"
    return hashlib.sha256(unique_content.encode()).hexdigest()[:16]


def post_exists(client: Client, post_hash: str) -> bool:
    """
    检查帖子是否已存在于数据库中

    Args:
        client: Supabase 客户端
        post_hash: 帖子哈希值

    Returns:
        bool: 如果存在返回 True
    """
    try:
        result = (
            client.table("xhs_posts")
            .select("id")
            .eq("post_hash", post_hash)
            .limit(1)
            .execute()
        )
        return len(result.data) > 0
    except Exception as e:
        print(f"⚠️ 检查帖子是否存在失败: {e}")
        return False


def note_id_exists(client: Client, note_id: str) -> bool:
    """
    检查笔记 ID 是否已存在

    Args:
        client: Supabase 客户端
        note_id: 小红书笔记 ID

    Returns:
        bool: 如果存在返回 True
    """
    try:
        result = (
            client.table("xhs_posts")
            .select("id")
            .eq("note_id", note_id)
            .limit(1)
            .execute()
        )
        return len(result.data) > 0
    except Exception as e:
        print(f"⚠️ 检查笔记 ID 是否存在失败: {e}")
        return False


def insert_post(
    client: Client,
    post_data: Dict,
    max_age_days: int = DEFAULT_POST_MAX_AGE_DAYS,
    enable_ai_analysis: bool = True,
) -> Tuple[bool, Optional[int]]:
    """
    插入帖子到 Supabase 数据库（如果不存在且不太旧），并进行 AI 分析

    Args:
        client: Supabase 客户端
        post_data: 帖子数据字典，包含:
            - note_id: 小红书笔记 ID
            - title: 标题
            - content: 帖子内容
            - author_name: 作者名称
            - author_id: 作者 ID
            - author_avatar: 作者头像 URL
            - cover_url: 封面图 URL
            - image_urls: 图片 URL 列表
            - video_url: 视频 URL（如果是视频笔记）
            - like_count: 点赞数
            - collect_count: 收藏数
            - comment_count: 评论数
            - share_count: 分享数
            - tags: 标签列表
            - note_type: 笔记类型（normal/video）
            - permalink: 帖子链接
            - created_at: 创建时间
        max_age_days: 最大帖子年龄（天），超过此天数的帖子不会被插入
        enable_ai_analysis: 是否启用 AI 分析（默认 True）

    Returns:
        Tuple[bool, Optional[int]]: (插入成功返回 True，帖子 ID 或 None)
    """
    note_id = post_data.get("note_id")
    
    # 检查笔记 ID 是否已存在（快速去重）
    if note_id and note_id_exists(client, note_id):
        return False, None
    
    # 检查帖子时间，如果太旧就跳过
    created_at_str = post_data.get("created_at")
    if created_at_str:
        try:
            # 解析时间
            if isinstance(created_at_str, str):
                if created_at_str.endswith("Z"):
                    created_at_str = created_at_str[:-1] + "+00:00"
                post_time = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            else:
                post_time = created_at_str

            # 如果是 naive datetime，假设为 UTC+8
            if post_time.tzinfo is None:
                post_time = post_time.replace(tzinfo=timezone(timedelta(hours=8)))

            cutoff_time = datetime.now(timezone.utc) - timedelta(days=max_age_days)

            if post_time < cutoff_time:
                print(
                    f"   ⏭️ 跳过旧帖子 ({str(created_at_str)[:10]}): {post_data.get('title', '')[:30]}..."
                )
                return False, None
        except Exception:
            # 解析失败就继续插入
            pass

    content = post_data.get("content", "") or post_data.get("title", "")
    post_hash = compute_post_hash(note_id or "", content)

    if post_exists(client, post_hash):
        return False, None

    # 进行 AI 分析（在插入前）
    ai_analysis = None
    if enable_ai_analysis:
        ai_analysis = _perform_ai_analysis(content, post_data.get("title", ""))

    try:
        # 处理列表字段 - 转换为 JSON
        image_urls = post_data.get("image_urls", [])
        image_urls_json = json.dumps(image_urls) if image_urls else None
        
        tags = post_data.get("tags", [])
        tags_json = json.dumps(tags) if tags else None

        # 辅助函数：安全截断字符串
        def safe_str(value, max_len: int) -> Optional[str]:
            if value is None:
                return None
            return str(value)[:max_len] if value else None

        data = {
            # 基础信息（按数据库字段长度截断）
            "note_id": safe_str(note_id, 64),
            "post_hash": post_hash,
            "title": post_data.get("title"),
            "content": content,
            "author_name": safe_str(post_data.get("author_name"), 255),
            "author_id": safe_str(post_data.get("author_id"), 64),
            "author_avatar": post_data.get("author_avatar"),
            "cover_url": post_data.get("cover_url"),
            "image_urls": image_urls_json,
            "video_url": post_data.get("video_url"),
            "note_type": safe_str(post_data.get("note_type", "normal"), 20),
            "permalink": post_data.get("permalink"),
            # 互动数据
            "like_count": post_data.get("like_count", 0),
            "collect_count": post_data.get("collect_count", 0),
            "comment_count": post_data.get("comment_count", 0),
            "share_count": post_data.get("share_count", 0),
            # 标签
            "tags": tags_json,
            # 搜索关键词
            "search_keyword": safe_str(post_data.get("search_keyword"), 100),
            # 时间
            "created_at": post_data.get("created_at"),
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }

        # 添加 AI 分析结果
        if ai_analysis:
            stock_related_data = ai_analysis.get("is_stock_related", {})
            trading_signal = ai_analysis.get("trading_signal")
            # 处理 trading_signal 可能是 dict 的情况
            if isinstance(trading_signal, dict):
                trading_signal = trading_signal.get("action")
            
            data.update(
                {
                    # 情感分析（VARCHAR(20)）
                    "ai_sentiment": safe_str(
                        ai_analysis.get("sentiment", {}).get("sentiment"), 20
                    ),
                    "ai_sentiment_confidence": ai_analysis.get("sentiment", {}).get(
                        "confidence"
                    ),
                    "ai_sentiment_reasoning": ai_analysis.get("sentiment", {}).get(
                        "reasoning"
                    ),
                    # 股票代码和标签 (JSONB)
                    "ai_tickers": ai_analysis.get("tickers", []),
                    "ai_tags": ai_analysis.get("tags", []),
                    # 摘要和投资信号（VARCHAR(20)）
                    "ai_summary": ai_analysis.get("summary"),
                    "ai_trading_signal": safe_str(trading_signal, 20),
                    # 股市相关性
                    "ai_is_stock_related": stock_related_data.get(
                        "is_stock_related", False
                    ),
                    "ai_stock_related_confidence": stock_related_data.get("confidence"),
                    "ai_stock_related_reason": stock_related_data.get("reason"),
                    # 元数据（VARCHAR(50)）
                    "ai_analyzed_at": ai_analysis.get("analyzed_at"),
                    "ai_model": safe_str(ai_analysis.get("model"), 50),
                }
            )

        result = client.table("xhs_posts").insert(data).execute()
        # 获取插入的帖子 ID
        post_id = result.data[0]["id"] if result.data else None
        return True, post_id
    except Exception as e:
        # 可能是唯一约束冲突（并发情况）
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return False, None
        print(f"⚠️ 插入帖子失败: {e}")
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


def _perform_ai_analysis(content: str, title: str = "") -> Optional[Dict]:
    """
    执行 AI 分析（同步）

    Args:
        content: 帖子内容
        title: 帖子标题

    Returns:
        Optional[Dict]: 分析结果，失败返回 None
    """
    analyzer = _get_ai_analyzer()
    if not analyzer:
        return None

    try:
        # 合并标题和内容进行分析
        full_text = f"{title}\n{content}" if title else content
        analysis = analyzer.basic_analysis(full_text)
        sentiment = analysis.get("sentiment", {}).get("sentiment", "neutral")
        tickers = analysis.get("tickers", [])
        print(f"   🤖 AI: {sentiment} | 股票: {tickers if tickers else '无'}")
        return analysis
    except Exception as e:
        print(f"   ⚠️ AI 分析失败: {e}")
        return None


def get_stats(client: Client) -> Dict:
    """
    获取数据库统计信息

    Returns:
        Dict: 包含总数、各关键词数量等统计信息
    """
    try:
        # 总帖子数
        total_result = client.table("xhs_posts").select("id", count="exact").execute()
        total = total_result.count or 0

        # 按搜索关键词统计
        by_keyword = {}
        try:
            result = client.table("xhs_posts").select("search_keyword").execute()
            for row in result.data:
                keyword = row.get("search_keyword") or "未知"
                by_keyword[keyword] = by_keyword.get(keyword, 0) + 1
        except Exception:
            pass

        # 按股票相关性统计
        stock_related_count = 0
        try:
            result = (
                client.table("xhs_posts")
                .select("id", count="exact")
                .eq("ai_is_stock_related", True)
                .execute()
            )
            stock_related_count = result.count or 0
        except Exception:
            pass

        return {
            "total": total,
            "by_keyword": dict(
                sorted(by_keyword.items(), key=lambda x: x[1], reverse=True)
            ),
            "stock_related": stock_related_count,
        }
    except Exception as e:
        print(f"⚠️ 获取统计信息失败: {e}")
        return {"total": 0, "by_keyword": {}, "stock_related": 0}


def get_recent_posts(
    client: Client,
    limit: int = 50,
    keyword: str = None,
    stock_related_only: bool = False,
) -> List[Dict]:
    """
    获取最近的帖子

    Args:
        client: Supabase 客户端
        limit: 返回数量限制
        keyword: 筛选关键词
        stock_related_only: 是否只返回股票相关帖子

    Returns:
        List[Dict]: 帖子列表
    """
    try:
        query = client.table("xhs_posts").select("*").order("scraped_at", desc=True)

        if keyword:
            query = query.eq("search_keyword", keyword)

        if stock_related_only:
            query = query.eq("ai_is_stock_related", True)

        result = query.limit(limit).execute()
        return result.data or []
    except Exception as e:
        print(f"⚠️ 获取帖子失败: {e}")
        return []

