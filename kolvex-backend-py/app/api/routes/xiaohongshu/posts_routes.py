"""
小红书帖子 API 路由
获取爬取的帖子数据（包含完整媒体和 AI 分析）
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta

from app.services.xiaohongshu import get_supabase_client

router = APIRouter()


def _format_post(post: Dict) -> Dict:
    """
    格式化单个帖子数据，确保返回完整结构
    """

    # 处理 JSONB 字段
    def parse_jsonb(value):
        if value is None:
            return []
        if isinstance(value, str):
            import json

            try:
                return json.loads(value)
            except:
                return []
        return value if isinstance(value, list) else []

    return {
        # === 基础信息 ===
        "id": post.get("id"),
        "note_id": post.get("note_id"),
        "post_hash": post.get("post_hash"),
        "title": post.get("title"),
        "content": post.get("content"),
        "note_type": post.get("note_type", "normal"),
        "permalink": post.get("permalink"),
        # === 作者信息 ===
        "author_name": post.get("author_name"),
        "author_id": post.get("author_id"),
        "author_avatar": post.get("author_avatar"),
        # === 媒体资源 ===
        "cover_url": post.get("cover_url"),
        "image_urls": parse_jsonb(post.get("image_urls")),
        "video_url": post.get("video_url"),
        # === 互动数据 ===
        "like_count": post.get("like_count", 0),
        "collect_count": post.get("collect_count", 0),
        "comment_count": post.get("comment_count", 0),
        "share_count": post.get("share_count", 0),
        # === 标签 ===
        "tags": parse_jsonb(post.get("tags")),
        "search_keyword": post.get("search_keyword"),
        # === AI 分析结果 ===
        "ai_sentiment": post.get("ai_sentiment"),
        "ai_sentiment_confidence": float(post.get("ai_sentiment_confidence") or 0),
        "ai_sentiment_reasoning": post.get("ai_sentiment_reasoning"),
        "ai_tickers": parse_jsonb(post.get("ai_tickers")),
        "ai_tags": parse_jsonb(post.get("ai_tags")),
        "ai_summary": post.get("ai_summary"),
        "ai_trading_signal": post.get("ai_trading_signal"),
        "ai_is_stock_related": post.get("ai_is_stock_related", False),
        "ai_stock_related_confidence": float(
            post.get("ai_stock_related_confidence") or 0
        ),
        "ai_stock_related_reason": post.get("ai_stock_related_reason"),
        "ai_analyzed_at": post.get("ai_analyzed_at"),
        "ai_model": post.get("ai_model"),
        # === 时间戳 ===
        "created_at": post.get("created_at"),
        "scraped_at": post.get("scraped_at"),
        "updated_at": post.get("updated_at"),
    }


@router.get("/posts", response_model=Dict)
def get_xhs_posts(
    # 分页
    limit: int = Query(50, ge=1, le=200, description="返回数量"),
    offset: int = Query(0, ge=0, description="偏移量（用于分页）"),
    # 筛选条件
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    ticker: Optional[str] = Query(None, description="股票代码（如 NVDA）"),
    sentiment: Optional[str] = Query(None, description="情感: bullish/bearish/neutral"),
    stock_related: Optional[bool] = Query(None, description="是否股票相关"),
    has_images: Optional[bool] = Query(None, description="是否有图片"),
    has_video: Optional[bool] = Query(None, description="是否有视频"),
    # 排序
    sort_by: str = Query("scraped_at", description="排序字段"),
    sort_desc: bool = Query(True, description="是否降序"),
):
    """
    📋 获取小红书帖子列表

    返回爬取的帖子数据，包含完整的媒体资源和 AI 分析结果。

    ### 筛选参数
    - `keyword`: 按搜索关键词筛选
    - `ticker`: 按股票代码筛选（如 NVDA, TSLA）
    - `sentiment`: 按 AI 情感分析结果筛选（bullish/bearish/neutral）
    - `stock_related`: 是否只返回股票相关帖子
    - `has_images`: 是否有图片
    - `has_video`: 是否有视频

    ### 返回数据
    每个帖子包含：
    - 基础信息（标题、内容、链接）
    - 作者信息（名称、头像）
    - 媒体资源（封面图、图片列表、视频）
    - 互动数据（点赞、收藏、评论、分享）
    - AI 分析（情感、股票代码、摘要、交易信号）
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库未连接")

    try:
        # 构建查询
        query = supabase.table("xhs_posts").select("*", count="exact")

        # 应用筛选条件
        if keyword:
            query = query.eq("search_keyword", keyword)

        if ticker:
            query = query.contains("ai_tickers", [ticker.upper()])

        if sentiment:
            query = query.eq("ai_sentiment", sentiment)

        if stock_related is True:
            query = query.eq("ai_is_stock_related", True)
        elif stock_related is False:
            query = query.eq("ai_is_stock_related", False)

        if has_video is True:
            query = query.not_.is_("video_url", "null")
        elif has_video is False:
            query = query.is_("video_url", "null")

        # 排序
        query = query.order(sort_by, desc=sort_desc)

        # 分页
        query = query.range(offset, offset + limit - 1)

        # 执行查询
        result = query.execute()
        posts = result.data or []
        total = result.count or 0

        # 内存中过滤 has_images（JSONB 数组非空查询复杂）
        if has_images is not None:
            formatted = []
            for post in posts:
                image_urls = post.get("image_urls")
                has_img = bool(image_urls and len(image_urls) > 0)
                if has_images == has_img:
                    formatted.append(_format_post(post))
            posts = formatted
        else:
            posts = [_format_post(p) for p in posts]

        return {
            "success": True,
            "data": posts,
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(posts) < total,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/posts/{note_id}", response_model=Dict)
def get_xhs_post_detail(note_id: str):
    """
    📄 获取单个帖子详情

    根据小红书笔记 ID 获取完整帖子数据。
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="数据库未连接")

    try:
        result = (
            supabase.table("xhs_posts")
            .select("*")
            .eq("note_id", note_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail=f"帖子不存在: {note_id}")

        return {
            "success": True,
            "data": _format_post(result.data[0]),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")
