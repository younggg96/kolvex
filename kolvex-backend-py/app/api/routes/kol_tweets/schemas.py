"""
KOL Tweets API Pydantic 模型
定义请求和响应的数据结构
支持多平台统一数据结构 (Twitter, Xiaohongshu, Reddit, YouTube)
"""

from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime
from enum import Enum


# ============================================================
# 平台枚举
# ============================================================


class Platform(str, Enum):
    """支持的平台"""
    TWITTER = "twitter"
    XIAOHONGSHU = "xiaohongshu"
    REDDIT = "reddit"
    YOUTUBE = "youtube"


# ============================================================
# 基础模型
# ============================================================


class MediaItem(BaseModel):
    """媒体项模型"""

    type: str  # "photo", "video", "gif", "card"
    url: Optional[str] = None
    poster: Optional[str] = None


class SentimentAnalysis(BaseModel):
    """情感分析结果"""

    value: Optional[str] = None  # "bullish", "bearish", "neutral"
    confidence: Optional[float] = None  # 0.0 - 1.0
    reasoning: Optional[str] = None


class TradingSignal(BaseModel):
    """投资信号"""

    action: Optional[str] = None  # "buy", "sell", "hold"
    tickers: List[str] = []
    confidence: Optional[float] = None  # 0.0 - 1.0


class StockRelatedInfo(BaseModel):
    """股市相关性信息"""

    is_related: bool = False
    confidence: Optional[float] = None  # 0.0 - 1.0
    reason: Optional[str] = None


# ============================================================
# 推文/帖子模型（统一多平台）
# ============================================================


class KOLTweet(BaseModel):
    """KOL 推文/帖子模型（支持多平台）"""

    id: int
    # === 平台信息 ===
    platform: str = "twitter"  # twitter, xiaohongshu, reddit, youtube
    platform_post_id: Optional[str] = None  # 平台特定帖子ID
    
    # === 作者信息 ===
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    author_platform_id: Optional[str] = None  # 作者平台ID
    
    # === 内容 ===
    title: Optional[str] = None  # 标题（小红书特有）
    tweet_text: str
    post_type: str = "tweet"  # tweet, retweet, note, video
    created_at: Optional[datetime] = None
    permalink: Optional[str] = None
    
    # === 媒体 ===
    cover_url: Optional[str] = None  # 封面图（小红书特有）
    media_urls: Optional[List[MediaItem]] = None
    video_url: Optional[str] = None
    
    # === 转发信息 ===
    is_repost: bool = False
    original_author: Optional[str] = None
    
    # === 互动数据 ===
    like_count: int = 0
    retweet_count: int = 0  # Twitter 转发数
    reply_count: int = 0  # 评论数
    bookmark_count: int = 0  # 书签数
    views_count: int = 0
    collect_count: int = 0  # 收藏数（小红书特有）
    share_count: int = 0  # 分享数（小红书特有）
    
    # === 标签和分类 ===
    tags: List[str] = []
    search_keyword: Optional[str] = None  # 搜索关键词
    
    # === 元数据 ===
    scraped_at: Optional[datetime] = None

    # ========== AI 分析字段 ==========
    # 情感分析
    sentiment: Optional[SentimentAnalysis] = None
    # 股票代码
    tickers: List[str] = []
    # 投资信号
    trading_signal: Optional[TradingSignal] = None
    # 摘要
    summary: Optional[str] = None
    # 股市相关性
    is_stock_related: Optional[StockRelatedInfo] = None
    # AI 分析元数据
    ai_analyzed_at: Optional[datetime] = None
    ai_model: Optional[str] = None


class KOLTweetsResponse(BaseModel):
    """KOL 推文列表响应"""

    tweets: List[KOLTweet]
    total: int
    page: int
    page_size: int
    has_more: bool


# ============================================================
# Profile 模型（统一多平台）
# ============================================================


class KOLProfile(BaseModel):
    """KOL 完整 Profile 模型 - 支持多平台"""

    id: int
    # === 平台信息 ===
    platform: str = "twitter"  # twitter, xiaohongshu, reddit, youtube
    platform_user_id: Optional[str] = None  # 平台特定用户ID
    
    # === 基础信息 ===
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    profile_url: Optional[str] = None
    
    # === 认证信息 ===
    is_verified: bool = False
    verification_type: Optional[str] = "None"
    verified_info: Optional[str] = None
    
    # === 互动数据 ===
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    likes_count: int = 0  # 获赞数（小红书特有）
    collected_count: int = 0  # 收藏数（小红书特有）
    
    # === Twitter 特有字段 ===
    rest_id: Optional[str] = None
    join_date: Optional[str] = None
    
    # === 小红书特有字段 ===
    red_id: Optional[str] = None  # 小红书号
    gender: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    source_keyword: Optional[str] = None
    source_note_id: Optional[str] = None
    
    # === 状态和时间 ===
    is_active: bool = True
    scraped_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class KOLProfilesResponse(BaseModel):
    """KOL 列表响应"""

    profiles: List[KOLProfile]
    total: int


class KOLProfileDetail(BaseModel):
    """KOL 详细信息"""

    profile: KOLProfile
    recent_tweets: List[KOLTweet] = []


# ============================================================
# 统计模型
# ============================================================


class StatsResponse(BaseModel):
    """统计响应"""

    total_tweets: int
    total_kols: int


# ============================================================
# 数据分析模型
# ============================================================


class TrendDataPoint(BaseModel):
    """趋势数据点"""
    date: str
    count: int


class TrendSummary(BaseModel):
    """趋势统计摘要"""
    total_tweets: int
    average_daily: float
    max_daily: int
    min_daily: int
    peak_date: Optional[str] = None
    days_analyzed: int


class TrendAnalysisData(BaseModel):
    """趋势分析数据"""
    trends: List[TrendDataPoint]
    summary: TrendSummary


class TrendAnalysisResponse(BaseModel):
    """趋势分析响应"""
    success: bool
    data: TrendAnalysisData


class KOLRanking(BaseModel):
    """KOL 排名数据"""
    rank: int
    username: str
    avatar_url: Optional[str] = None
    total_views: int
    total_likes: int
    total_retweets: int
    total_replies: int
    total_bookmarks: int
    tweet_count: int
    engagement_rate: float


class SentimentDistribution(BaseModel):
    """情感分布"""
    bullish: int
    bearish: int
    neutral: int


class SentimentMetrics(BaseModel):
    """情感指标"""
    total_analyzed: int
    sentiment_score: float
    sentiment_label: str
    bull_bear_ratio: float


class TickerAnalysis(BaseModel):
    """股票代码分析"""
    rank: int
    ticker: str
    mention_count: int
    total_views: int
    total_likes: int
    total_retweets: int
    unique_author_count: int
    sentiment_score: float
    sentiment_counts: Optional[SentimentDistribution] = None


class DashboardOverview(BaseModel):
    """仪表盘概览"""
    total_tweets: int
    total_views: int
    total_engagement: int
    unique_authors: int
    stock_related_tweets: int
    avg_views_per_tweet: float
    avg_engagement_per_tweet: float


class KeywordItem(BaseModel):
    """关键词项"""
    word: str
    count: int


class TagItem(BaseModel):
    """标签项"""
    tag: str
    count: int


class SentimentEngagementComparison(BaseModel):
    """情感互动对比"""
    tweet_count: int
    avg_views: float
    avg_likes: float
    avg_retweets: float
    avg_engagement_rate: float
    total_views: int
    total_likes: int






















