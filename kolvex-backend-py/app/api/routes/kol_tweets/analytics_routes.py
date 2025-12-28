"""
KOL 推文数据分析 API 路由
提供多维度的数据分析功能，包括：
- 趋势分析：每日推文量变化
- 影响力分析：Top KOL 排名
- 情感分析：市场情绪分布
- 互动分析：engagement 指标相关性
- 热门股票分析：Ticker 提及频率
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from app.services.analytics import (
    TrendsService,
    KOLsService,
    SentimentService,
    EngagementService,
    TickersService,
    DashboardService,
    KeywordsService,
)

router = APIRouter()


# ============================================================
# 1. 趋势分析 - 每日推文量
# ============================================================


@router.get("/analytics/trends")
async def get_tweet_trends(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    username: Optional[str] = Query(None, description="Filter by username"),
):
    """
    📈 推文趋势分析

    返回每日推文量变化，用于识别讨论热度高峰期

    - **days**: 分析的天数范围（默认30天）
    - **username**: 可选，按特定用户筛选
    """
    try:
        service = TrendsService()
        data = await service.get_tweet_trends(days=days, username=username)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get trend analysis: {str(e)}"
        )


# ============================================================
# 2. 影响力分析 - Top KOLs
# ============================================================


@router.get("/analytics/top-kols")
async def get_top_kols(
    limit: int = Query(10, ge=1, le=50, description="Number of results to return"),
    sort_by: str = Query(
        "views", description="Sort by: views, likes, retweets, tweets"
    ),
    days: Optional[int] = Query(
        None, ge=1, le=365, description="Number of days to analyze"
    ),
):
    """
    👑 KOL 影响力排名

    根据不同指标对 KOL 进行排名分析

    - **limit**: 返回的 KOL 数量
    - **sort_by**: 排序依据 (views=浏览量, likes=点赞, retweets=转发, tweets=发帖量)
    - **days**: 可选，限定时间范围
    """
    try:
        service = KOLsService()
        data = await service.get_top_kols(limit=limit, sort_by=sort_by, days=days)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get KOL rankings: {str(e)}"
        )


# ============================================================
# 3. 情感分析 - 市场情绪分布
# ============================================================


@router.get("/analytics/sentiment")
async def get_sentiment_analysis(
    days: Optional[int] = Query(
        None, ge=1, le=365, description="Number of days to analyze"
    ),
    ticker: Optional[str] = Query(None, description="Filter by ticker symbol"),
    include_daily: bool = Query(False, description="Include daily sentiment trends"),
):
    """
    📊 市场情感分析

    分析推文的整体情绪分布及置信度分布

    - **days**: 限定时间范围
    - **ticker**: 按特定股票代码筛选
    - **include_daily**: 是否返回每日情绪变化
    """
    try:
        service = SentimentService()
        data = await service.get_sentiment_analysis(
            days=days, ticker=ticker, include_daily=include_daily
        )
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get sentiment analysis: {str(e)}"
        )


# ============================================================
# 4. 互动分析 - Engagement 相关性
# ============================================================


@router.get("/analytics/engagement")
async def get_engagement_analysis(
    days: Optional[int] = Query(
        None, ge=1, le=365, description="Number of days to analyze"
    ),
):
    """
    📉 互动指标分析

    分析各互动指标（浏览、点赞、转发等）的统计特征和相关性

    - **days**: 限定时间范围
    """
    try:
        service = EngagementService()
        data = await service.get_engagement_analysis(days=days)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get engagement analysis: {str(e)}"
        )


# ============================================================
# 5. 热门股票分析 - Ticker 提及
# ============================================================


@router.get("/analytics/tickers")
async def get_ticker_analysis(
    limit: int = Query(20, ge=1, le=100, description="Number of results to return"),
    days: Optional[int] = Query(
        None, ge=1, le=365, description="Number of days to analyze"
    ),
    include_sentiment: bool = Query(
        True, description="Include sentiment distribution per ticker"
    ),
):
    """
    📊 股票代码热度分析

    分析被提及最多的股票代码及其相关情感

    - **limit**: 返回的股票数量
    - **days**: 限定时间范围
    - **include_sentiment**: 是否包含每个股票的情感分布
    """
    try:
        service = TickersService()
        data = await service.get_ticker_analysis(
            limit=limit, days=days, include_sentiment=include_sentiment
        )
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get ticker analysis: {str(e)}"
        )


# ============================================================
# 6. 综合仪表盘 - Dashboard Summary
# ============================================================


@router.get("/analytics/dashboard")
async def get_dashboard_summary(
    days: int = Query(7, ge=1, le=30, description="Number of days to analyze"),
):
    """
    🎯 综合数据仪表盘

    返回所有分析维度的概要数据，适合前端仪表盘展示

    - **days**: 分析的天数范围（默认7天）
    """
    try:
        service = DashboardService()
        data = await service.get_dashboard_summary(days=days)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get dashboard data: {str(e)}"
        )


# ============================================================
# 7. 关键词分析 (Word Cloud 数据)
# ============================================================


@router.get("/analytics/keywords")
async def get_keyword_analysis(
    limit: int = Query(50, ge=10, le=200, description="Number of keywords to return"),
    days: Optional[int] = Query(
        None, ge=1, le=365, description="Number of days to analyze"
    ),
    exclude_tickers: bool = Query(
        True, description="Exclude ticker symbols from results"
    ),
):
    """
    ☁️ 关键词分析

    提取推文中的高频关键词，可用于生成词云

    - **limit**: 返回的关键词数量
    - **days**: 限定时间范围
    - **exclude_tickers**: 是否排除已识别的股票代码
    """
    try:
        service = KeywordsService()
        data = await service.get_keyword_analysis(
            limit=limit, days=days, exclude_tickers=exclude_tickers
        )
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get keyword analysis: {str(e)}"
        )


# ============================================================
# 8. 情感与互动交叉分析
# ============================================================


@router.get("/analytics/sentiment-engagement")
async def get_sentiment_engagement_analysis(
    days: Optional[int] = Query(
        None, ge=1, le=365, description="Number of days to analyze"
    ),
):
    """
    🔗 情感与互动交叉分析

    分析不同情感的推文是否有不同的互动表现（验证确认偏误）

    - **days**: 限定时间范围
    """
    try:
        service = SentimentService()
        data = await service.get_sentiment_engagement_analysis(days=days)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get sentiment-engagement analysis: {str(e)}",
        )
