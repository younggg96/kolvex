"""
小红书 Scraper API Pydantic 模型
定义请求和响应的数据结构
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from enum import Enum


# ============================================================
# 任务状态枚举
# ============================================================


class TaskStatus(str, Enum):
    """任务状态枚举"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# ============================================================
# 请求模型
# ============================================================


class KeywordScrapeRequest(BaseModel):
    """关键词爬取请求"""

    keywords: List[str] = Field(
        ..., description="要搜索的关键词列表", min_length=1, max_length=20
    )
    max_posts: int = Field(
        20, ge=1, le=100, description="每个关键词最多爬取的帖子数量"
    )
    fetch_details: bool = Field(
        True, description="是否获取详情页（更慢但数据更完整）"
    )


class SingleKeywordRequest(BaseModel):
    """单个关键词爬取请求"""

    keyword: str = Field(..., description="搜索关键词", min_length=1, max_length=50)
    max_posts: int = Field(
        20, ge=1, le=100, description="最多爬取的帖子数量"
    )
    fetch_details: bool = Field(
        True, description="是否获取详情页"
    )


# ============================================================
# 响应模型
# ============================================================


class ScrapeResponse(BaseModel):
    """爬取响应"""

    success: bool
    message: str
    task_id: Optional[str] = None
    stats: Optional[Dict] = None


class XhsStats(BaseModel):
    """小红书统计信息"""

    total_posts: int
    stock_related_posts: int
    by_keyword: Dict[str, int]
    by_sentiment: Optional[Dict[str, int]] = None


class PostInfo(BaseModel):
    """帖子信息"""

    id: int
    note_id: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    like_count: int = 0
    collect_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    search_keyword: Optional[str] = None
    permalink: Optional[str] = None
    note_type: Optional[str] = None
    # 媒体资源
    cover_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    video_url: Optional[str] = None
    tags: Optional[List[str]] = None
    # AI 分析结果
    ai_sentiment: Optional[str] = None
    ai_sentiment_confidence: Optional[float] = None
    ai_sentiment_reasoning: Optional[str] = None
    ai_tickers: Optional[List[str]] = None
    ai_tags: Optional[List[str]] = None
    ai_summary: Optional[str] = None
    ai_trading_signal: Optional[str] = None
    ai_is_stock_related: bool = False
    ai_stock_related_confidence: Optional[float] = None
    ai_stock_related_reason: Optional[str] = None
    ai_analyzed_at: Optional[str] = None
    ai_model: Optional[str] = None
    # 时间
    created_at: Optional[str] = None
    scraped_at: Optional[str] = None


class PostDetailResponse(BaseModel):
    """帖子详情响应（包含完整媒体和 AI 分析）"""
    
    success: bool
    post: PostInfo
    media: Optional[Dict] = None  # 媒体信息汇总
    ai_analysis: Optional[Dict] = None  # AI 分析信息汇总


class PostListResponse(BaseModel):
    """帖子列表响应"""

    success: bool
    posts: List[PostInfo]
    total: int


class AIAnalysisRequest(BaseModel):
    """AI 分析请求"""
    
    note_id: Optional[str] = Field(None, description="要分析的帖子笔记 ID")
    post_id: Optional[int] = Field(None, description="要分析的帖子数据库 ID")
    force: bool = Field(False, description="是否强制重新分析（即使已有分析结果）")


class AIAnalysisResponse(BaseModel):
    """AI 分析响应"""
    
    success: bool
    note_id: Optional[str] = None
    sentiment: Optional[str] = None
    sentiment_confidence: Optional[float] = None
    sentiment_reasoning: Optional[str] = None
    tickers: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    summary: Optional[str] = None
    trading_signal: Optional[str] = None
    is_stock_related: bool = False
    stock_related_confidence: Optional[float] = None
    analyzed_at: Optional[str] = None
    model: Optional[str] = None


class BatchAnalysisRequest(BaseModel):
    """批量 AI 分析请求"""
    
    limit: int = Field(10, ge=1, le=50, description="分析数量限制")
    force: bool = Field(False, description="是否强制重新分析")
    only_unanalyzed: bool = Field(True, description="是否只分析未分析的帖子")

