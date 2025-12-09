"""
Stocks API Pydantic 模型
定义请求和响应的数据结构
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ============================================================
# 趋势股票模型
# ============================================================


class TopAuthor(BaseModel):
    """Top Author 简要信息"""

    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    tweet_count: int = 0
    sentiment: Optional[str] = None  # bullish, bearish, neutral


class TrendingStock(BaseModel):
    """趋势股票模型"""

    ticker: str
    company_name: Optional[str] = None
    platform: str = "TWITTER"
    mention_count: int = 0
    sentiment_score: Optional[float] = None  # -100 to 100
    trending_score: Optional[float] = None
    engagement_score: Optional[float] = None
    unique_authors_count: int = 0
    top_authors: List[TopAuthor] = []
    last_seen_at: Optional[datetime] = None
    first_seen_at: Optional[datetime] = None


class TrendingStocksResponse(BaseModel):
    """趋势股票列表响应"""

    stocks: List[TrendingStock]
    total: int
    page: int
    page_size: int
    has_more: bool


# ============================================================
# 股票讨论相关模型
# ============================================================


class MediaItem(BaseModel):
    """媒体项模型"""

    type: str
    url: Optional[str] = None
    poster: Optional[str] = None


class SentimentAnalysis(BaseModel):
    """情感分析结果"""

    value: Optional[str] = None
    confidence: Optional[float] = None
    reasoning: Optional[str] = None


class TradingSignal(BaseModel):
    """投资信号"""

    action: Optional[str] = None
    tickers: List[str] = []
    confidence: Optional[float] = None


class StockTweet(BaseModel):
    """股票相关推文"""

    id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    tweet_text: str
    created_at: Optional[datetime] = None
    permalink: Optional[str] = None
    media_urls: Optional[List[MediaItem]] = None
    is_repost: bool = False
    original_author: Optional[str] = None
    like_count: int = 0
    retweet_count: int = 0
    reply_count: int = 0
    bookmark_count: int = 0
    views_count: int = 0
    # AI 分析字段
    sentiment: Optional[SentimentAnalysis] = None
    tickers: List[str] = []
    tags: List[str] = []
    trading_signal: Optional[TradingSignal] = None
    summary: Optional[str] = None
    ai_analyzed_at: Optional[datetime] = None
    ai_model: Optional[str] = None


class KOLSummary(BaseModel):
    """讨论股票的 KOL 摘要"""

    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    followers_count: int = 0
    is_verified: bool = False
    tweet_count: int = 0
    avg_sentiment: Optional[float] = None
    latest_tweet_at: Optional[datetime] = None


class StockDiscussionsResponse(BaseModel):
    """股票讨论响应"""

    ticker: str
    total_tweets: int
    total_kols: int
    kols: List[KOLSummary]
    tweets: List[StockTweet]
    page: int
    page_size: int
    has_more: bool


# ============================================================
# 股票代码列表响应
# ============================================================


class TickersResponse(BaseModel):
    """股票代码列表响应"""

    tickers: List[str]
    count: int


# ============================================================
# 用户追踪股票模型
# ============================================================


class TrackedStockCreate(BaseModel):
    """创建追踪股票请求"""

    symbol: str
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
    notify: bool = True


class TrackedStockUpdate(BaseModel):
    """更新追踪股票请求"""

    notify: Optional[bool] = None


class TrackedStockResponse(BaseModel):
    """追踪股票响应（包含 KOL 数据）"""

    id: str
    user_id: str
    symbol: str
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
    notify: bool = True
    created_at: datetime
    # KOL 相关数据
    mention_count: int = 0
    sentiment_score: Optional[float] = None
    trending_score: Optional[float] = None
    engagement_score: Optional[float] = None
    unique_authors_count: int = 0
    top_authors: List[TopAuthor] = []
    last_seen_at: Optional[datetime] = None


class TrackedStocksListResponse(BaseModel):
    """追踪股票列表响应"""

    stocks: List[TrackedStockResponse]
    total: int


class MessageResponse(BaseModel):
    """通用消息响应"""

    message: str
    success: bool = True


class StockTrackedCheckResponse(BaseModel):
    """股票追踪状态检查响应"""

    symbol: str
    is_tracked: bool
    stock_id: Optional[str] = None

