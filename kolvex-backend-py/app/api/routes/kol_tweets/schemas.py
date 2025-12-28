"""
KOL Tweets API Pydantic 模型
定义请求和响应的数据结构
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


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
# 推文模型
# ============================================================


class KOLTweet(BaseModel):
    """KOL 推文模型"""

    id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    tweet_text: str
    created_at: Optional[datetime] = None
    permalink: Optional[str] = None
    # 媒体
    media_urls: Optional[List[MediaItem]] = None
    # 转发信息
    is_repost: bool = False
    original_author: Optional[str] = None
    # 互动数据
    like_count: int = 0
    retweet_count: int = 0
    reply_count: int = 0
    bookmark_count: int = 0
    views_count: int = 0
    # 元数据
    scraped_at: Optional[datetime] = None

    # ========== AI 分析字段 ==========
    # 情感分析
    sentiment: Optional[SentimentAnalysis] = None
    # 股票代码
    tickers: List[str] = []
    # AI 标签
    tags: List[str] = []
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
# Profile 模型
# ============================================================


class KOLProfile(BaseModel):
    """KOL 完整 Profile 模型 - 匹配 kol_profiles 表"""

    id: int
    username: str
    display_name: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    is_active: bool = True
    is_verified: bool = False
    verification_type: Optional[str] = "None"
    rest_id: Optional[str] = None
    join_date: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    bio: Optional[str] = None
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






















