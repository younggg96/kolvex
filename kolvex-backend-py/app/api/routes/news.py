"""
金融新闻 API 路由
提供多数据源新闻数据的获取和存储功能

数据源：
1. Benzinga - 金融新闻 API
2. Yahoo Finance - 股票相关新闻

功能：
1. 获取单只股票的新闻并保存到数据库
2. 定时任务：每小时获取所有 KOL 提到过的标的的新闻
3. 聚合多个数据源的新闻
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime, date, timedelta, timezone
import logging
import asyncio

from app.core.supabase import get_supabase_service
from app.services.benzinga import BenzingaClient, NewsArticle
from app.services.news_aggregator import get_news_aggregator

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/news", tags=["News"])


# ============================================================
# 全局状态 - 记录定时任务执行状态
# ============================================================


class SchedulerStatus:
    """KOL 标的新闻定时任务状态"""

    last_run_at: Optional[datetime] = None
    last_run_tickers: List[str] = []
    last_run_articles_saved: int = 0
    last_run_duration_seconds: float = 0.0
    is_running: bool = False
    next_run_at: Optional[datetime] = None
    error_message: Optional[str] = None


scheduler_status = SchedulerStatus()


class BulkNewsSchedulerStatus:
    """批量新闻定时任务状态"""

    is_enabled: bool = False
    is_running: bool = False
    last_run_at: Optional[datetime] = None
    last_run_fetched: int = 0
    last_run_saved: int = 0
    last_run_duration_seconds: float = 0.0
    next_run_at: Optional[datetime] = None
    error_message: Optional[str] = None
    interval_hours: int = 1


bulk_news_scheduler_status = BulkNewsSchedulerStatus()


# ============================================================
# Pydantic 模型
# ============================================================


class NewsArticleResponse(BaseModel):
    """新闻文章响应模型"""

    id: Optional[int] = None
    published_at: str = Field(..., description="发布时间 (ISO 格式)")
    title: str = Field(..., description="文章标题")
    summary: str = Field(..., description="文章摘要")
    url: str = Field(..., description="文章 URL")
    tags: List[str] = Field(default_factory=list, description="标签列表")
    tickers: List[str] = Field(default_factory=list, description="相关股票代码")
    source: str = Field(default="benzinga", description="新闻来源")
    created_at: Optional[datetime] = None
    # AI 分析字段
    ai_summary: Optional[str] = Field(default=None, description="AI 生成的摘要")
    sentiment: Optional[str] = Field(default=None, description="情感: bullish/bearish/neutral")
    sentiment_confidence: Optional[float] = Field(default=None, description="情感置信度")
    trading_action: Optional[str] = Field(default=None, description="交易信号: buy/sell/hold")
    market_impact: Optional[str] = Field(default=None, description="市场影响: high/medium/low")
    ai_tickers: List[str] = Field(default_factory=list, description="AI 识别的股票代码")
    ai_tags: List[str] = Field(default_factory=list, description="AI 提取的标签")
    key_points: List[str] = Field(default_factory=list, description="关键要点")
    analyzed_at: Optional[str] = Field(default=None, description="分析时间")


class NewsListResponse(BaseModel):
    """新闻列表响应"""

    articles: List[NewsArticleResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class FetchNewsResponse(BaseModel):
    """获取新闻响应"""

    success: bool
    message: str
    ticker: str
    articles_fetched: int
    articles_saved: int
    fetch_time: str  # ISO 格式时间


class SchedulerStatusResponse(BaseModel):
    """定时任务状态响应"""

    is_running: bool
    last_run_at: Optional[str] = None
    last_run_tickers: List[str] = []
    last_run_articles_saved: int = 0
    last_run_duration_seconds: float = 0.0
    next_run_at: Optional[str] = None
    error_message: Optional[str] = None


class FetchAllKOLTickersResponse(BaseModel):
    """获取所有 KOL 标的新闻响应"""

    success: bool
    message: str
    tickers_processed: List[str]
    total_articles_saved: int
    start_time: str
    end_time: str
    duration_seconds: float


class FetchBulkNewsResponse(BaseModel):
    """批量获取全量新闻响应"""

    success: bool
    message: str
    total_articles_fetched: int
    total_articles_saved: int
    time_periods: List[dict] = Field(
        default_factory=list, description="每个时间段的获取详情"
    )
    start_time: str
    end_time: str
    duration_seconds: float


class BulkNewsSchedulerStatusResponse(BaseModel):
    """批量新闻定时任务状态响应"""

    is_enabled: bool = Field(..., description="定时任务是否已启用")
    is_running: bool = Field(..., description="是否正在执行")
    last_run_at: Optional[str] = Field(None, description="上次执行时间")
    last_run_fetched: int = Field(0, description="上次获取的文章数")
    last_run_saved: int = Field(0, description="上次保存的文章数")
    last_run_duration_seconds: float = Field(0.0, description="上次执行耗时")
    next_run_at: Optional[str] = Field(None, description="下次执行时间")
    interval_hours: int = Field(1, description="执行间隔（小时）")
    error_message: Optional[str] = Field(None, description="错误信息")


class SchedulerControlResponse(BaseModel):
    """定时任务控制响应"""

    success: bool
    message: str
    is_enabled: bool
    next_run_at: Optional[str] = None


# ============================================================
# 辅助函数
# ============================================================


async def save_articles_to_db(articles: List[NewsArticle]) -> int:
    """
    将新闻文章保存到数据库

    Args:
        articles: 新闻文章列表

    Returns:
        int: 成功保存的文章数量
    """
    if not articles:
        return 0

    supabase = get_supabase_service()
    saved_count = 0

    # 批量 upsert：显著减少 Supabase 往返次数，避免逐条写入导致慢/容易触发限流
    payload: List[dict] = []
    for article in articles:
        # URL 是唯一键；缺失 URL 的数据无法去重，也无法写入（schema: url NOT NULL UNIQUE）
        if not article.url:
            continue
        payload.append(
            {
                "published_at": article.published_at,
                "title": article.title,
                "summary": article.summary,
                "url": article.url,
                "tags": article.tags,
                "tickers": [
                    t.upper()
                    for t in (article.tickers or [])
                    if isinstance(t, str) and t
                ],
                "source": "benzinga",
            }
        )

    if not payload:
        return 0

    # 单个 ticker 最大 50 篇；这里仍做 chunk 以防未来调大 limit 或其他调用复用
    chunk_size = 200
    for i in range(0, len(payload), chunk_size):
        chunk = payload[i : i + chunk_size]
        try:
            result = (
                supabase.table("news_articles")
                .upsert(chunk, on_conflict="url")
                .execute()
            )

            # supabase-py 通常会返回写入后的行数据；但在某些配置下可能为空数组
            if getattr(result, "data", None) is not None:
                saved_count += len(result.data or [])
            else:
                # 无返回数据时，保守认为写入成功（若失败通常会抛异常）
                saved_count += len(chunk)
        except Exception as e:
            # 记录更完整的错误信息，便于定位 RLS/key/schema 问题
            logger.exception(f"批量保存新闻失败 (chunk={i}-{i+len(chunk)-1}): {e}")

    return saved_count


def db_row_to_response(row: dict) -> NewsArticleResponse:
    """将数据库行转换为 API 响应模型"""
    return NewsArticleResponse(
        id=row.get("id"),
        published_at=str(row.get("published_at") or ""),
        title=row.get("title", ""),
        summary=str(row.get("summary") or ""),
        url=row.get("url", ""),
        tags=row.get("tags") or [],
        tickers=row.get("tickers") or [],
        source=row.get("source", "benzinga"),
        created_at=row.get("created_at"),
        # AI 分析字段
        ai_summary=row.get("ai_summary"),
        sentiment=row.get("sentiment"),
        sentiment_confidence=row.get("sentiment_confidence"),
        trading_action=row.get("trading_action"),
        market_impact=row.get("market_impact"),
        ai_tickers=row.get("ai_tickers") or [],
        ai_tags=row.get("ai_tags") or [],
        key_points=row.get("key_points") or [],
        analyzed_at=row.get("analyzed_at"),
    )


def _normalize_ticker(raw: str) -> Optional[str]:
    """
    清理并验证 ticker 格式
    - 去掉 $ 符号
    - 只保留 1-5 位大写字母的标准 ticker
    """
    import re

    if not raw:
        return None
    # 去掉 $ 符号和空格
    cleaned = raw.strip().lstrip("$").upper()
    # 标准 ticker: 1-5 位大写字母
    if re.match(r"^[A-Z]{1,5}$", cleaned):
        return cleaned
    return None


async def get_all_kol_mentioned_tickers() -> List[str]:
    """
    获取所有被 KOL 讨论过的唯一股票代码列表

    Returns:
        List[str]: 唯一的股票代码列表（按字母排序）
    """
    supabase = get_supabase_service()

    result = (
        supabase.table("kol_tweets")
        .select("ai_tickers")
        .not_.is_("ai_tickers", "null")
        .execute()
    )

    all_tickers = set()
    for row in result.data or []:
        tickers = row.get("ai_tickers")
        if tickers:
            if isinstance(tickers, str):
                try:
                    import json

                    tickers = json.loads(tickers)
                except json.JSONDecodeError:
                    continue
            if isinstance(tickers, list):
                for ticker in tickers:
                    normalized = _normalize_ticker(ticker)
                    if normalized:
                        all_tickers.add(normalized)

    return sorted(list(all_tickers))


async def fetch_and_save_ticker_news(
    ticker: str,
    limit: int = 10,
    days: int = 7,
) -> tuple[int, int]:
    """
    获取单个股票的新闻并保存

    Returns:
        (articles_fetched, articles_saved)
    """
    date_to = date.today()
    date_from = date_to - timedelta(days=days)

    async with BenzingaClient() as client:
        response = await client.get_news(
            tickers=ticker,
            limit=limit,
            date_from=date_from.isoformat(),
            date_to=date_to.isoformat(),
        )

    if not response.success or not response.articles:
        return 0, 0

    saved_count = await save_articles_to_db(response.articles)
    return len(response.articles), saved_count


# ============================================================
# API 路由
# ============================================================


@router.get("/", response_model=NewsListResponse, summary="获取新闻列表")
async def get_news_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    ticker: Optional[str] = Query(None, description="按股票代码筛选"),
    tag: Optional[str] = Query(None, description="按标签筛选"),
    include_yfinance: bool = Query(True, description="是否包含 Yahoo Finance 新闻"),
):
    """
    获取新闻列表（聚合多个数据源）

    - **page**: 页码，从 1 开始
    - **page_size**: 每页数量，默认 20
    - **ticker**: 可选，按股票代码筛选
    - **tag**: 可选，按标签筛选
    - **include_yfinance**: 是否包含 Yahoo Finance 实时新闻，默认 True
    
    当不指定 ticker 时，会自动获取 trending 热门新闻
    """
    try:
        supabase = get_supabase_service()
        offset = (page - 1) * page_size
        
        all_articles = []
        
        # 1. 从数据库获取 Benzinga 新闻
        query = supabase.table("news_articles").select("*", count="exact")

        if ticker:
            query = query.contains("tickers", [ticker.upper()])
        
        if tag:
            query = query.contains("tags", [tag])

        result = (
            query.order("published_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        db_articles = [db_row_to_response(row) for row in (result.data or [])]
        all_articles.extend(db_articles)
        
        # 2. 获取 Yahoo Finance 新闻（仅第一页）
        if include_yfinance and page == 1:
            try:
                aggregator = get_news_aggregator()
                
                if ticker:
                    # 指定 ticker 时获取该股票的新闻
                    yf_articles = await aggregator.get_yfinance_news(ticker.upper(), limit=10)
                else:
                    # 未指定 ticker 时获取 trending 新闻
                    yf_articles = await aggregator.get_trending_news(limit=15)
                
                # 转换为响应模型并添加 source 标记
                for article in yf_articles:
                    yf_article = NewsArticleResponse(
                        id=None,
                        published_at=article.published_at,
                        title=article.title,
                        summary=article.summary,
                        url=article.url,
                        tags=article.tags,
                        tickers=article.tickers,
                        source="yahoo_finance",
                        created_at=None,
                    )
                    all_articles.append(yf_article)
            except Exception as e:
                logger.warning(f"获取 Yahoo Finance 新闻失败: {e}")
        
        # 3. 去重（基于 URL）
        seen_urls = set()
        unique_articles = []
        for article in all_articles:
            url_key = article.url.lower().rstrip("/")
            if url_key not in seen_urls:
                seen_urls.add(url_key)
                unique_articles.append(article)
        
        # 4. 按时间排序
        def parse_date(article: NewsArticleResponse) -> datetime:
            try:
                return datetime.fromisoformat(article.published_at.replace("Z", "+00:00"))
            except:
                return datetime.min.replace(tzinfo=timezone.utc)
        
        sorted_articles = sorted(unique_articles, key=parse_date, reverse=True)
        
        # 5. 分页处理
        final_articles = sorted_articles[:page_size]
        total = result.count or 0
        
        # 如果有 yfinance 数据，total 需要调整
        if include_yfinance:
            total = max(total, len(unique_articles))
        
        has_more = offset + len(final_articles) < total

        return NewsListResponse(
            articles=final_articles,
            total=total,
            page=page,
            page_size=page_size,
            has_more=has_more,
        )

    except Exception as e:
        logger.error(f"获取新闻列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取新闻列表失败: {str(e)}")


@router.get(
    "/fetch/{ticker}",
    response_model=FetchNewsResponse,
    summary="获取单只股票的新闻并保存",
)
async def fetch_ticker_news(
    ticker: str,
    limit: int = Query(10, ge=1, le=50, description="获取数量"),
    days: int = Query(7, ge=1, le=30, description="获取最近多少天的新闻"),
):
    """
    从 Benzinga API 获取指定股票的新闻并保存到数据库

    - **ticker**: 股票代码 (如 NVDA, AAPL)
    - **limit**: 获取的新闻数量 (1-50)
    - **days**: 获取最近多少天的新闻 (1-30)
    """
    ticker = ticker.upper()
    fetch_time = datetime.now(timezone.utc)

    try:
        articles_fetched, articles_saved = await fetch_and_save_ticker_news(
            ticker=ticker,
            limit=limit,
            days=days,
        )

        return FetchNewsResponse(
            success=True,
            message=f"成功获取 {ticker} 的新闻",
            ticker=ticker,
            articles_fetched=articles_fetched,
            articles_saved=articles_saved,
            fetch_time=fetch_time.isoformat(),
        )

    except Exception as e:
        logger.error(f"获取 {ticker} 新闻失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取新闻失败: {str(e)}")


@router.get("/kol-tickers", summary="获取所有被 KOL 讨论过的股票代码")
async def get_kol_tickers():
    """
    获取所有被 KOL 讨论过的唯一股票代码列表
    """
    tickers = await get_all_kol_mentioned_tickers()

    return {
        "tickers": tickers,
        "total": len(tickers),
    }


@router.post(
    "/fetch-kol-tickers",
    response_model=FetchAllKOLTickersResponse,
    summary="获取所有 KOL 标的的新闻",
)
async def fetch_all_kol_tickers_news(
    limit_per_ticker: int = Query(
        10, ge=1, le=50, description="每个股票获取的新闻数量"
    ),
    days: int = Query(7, ge=1, le=30, description="获取最近多少天的新闻"),
    max_concurrent: int = Query(3, ge=1, le=10, description="最大并发数"),
):
    """
    获取所有被 KOL 讨论过的股票的新闻并保存到数据库

    此端点会：
    1. 从 kol_tweets 表中获取所有被 KOL 讨论过的股票代码
    2. 对每个股票从 Benzinga 获取最新新闻
    3. 将新闻保存到数据库

    - **limit_per_ticker**: 每个股票获取的新闻数量
    - **days**: 获取最近多少天的新闻
    - **max_concurrent**: 最大并发数
    """
    import time

    start_time = datetime.now(timezone.utc)
    start_ts = time.time()

    # 更新状态
    scheduler_status.is_running = True
    scheduler_status.error_message = None

    try:
        tickers = await get_all_kol_mentioned_tickers()

        if not tickers:
            scheduler_status.is_running = False
            return FetchAllKOLTickersResponse(
                success=True,
                message="没有找到被 KOL 讨论过的股票",
                tickers_processed=[],
                total_articles_saved=0,
                start_time=start_time.isoformat(),
                end_time=datetime.now(timezone.utc).isoformat(),
                duration_seconds=0.0,
            )

        # 并发获取新闻
        semaphore = asyncio.Semaphore(max_concurrent)
        total_saved = 0

        async def fetch_with_semaphore(t: str) -> int:
            async with semaphore:
                _, saved = await fetch_and_save_ticker_news(
                    ticker=t,
                    limit=limit_per_ticker,
                    days=days,
                )
                return saved

        tasks = [fetch_with_semaphore(t) for t in tickers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for r in results:
            if isinstance(r, int):
                total_saved += r
            elif isinstance(r, Exception):
                logger.error(f"获取新闻失败: {r}")

        end_time = datetime.now(timezone.utc)
        duration = time.time() - start_ts

        # 更新状态
        scheduler_status.is_running = False
        scheduler_status.last_run_at = start_time
        scheduler_status.last_run_tickers = tickers
        scheduler_status.last_run_articles_saved = total_saved
        scheduler_status.last_run_duration_seconds = round(duration, 2)
        scheduler_status.next_run_at = start_time + timedelta(hours=1)

        logger.info(
            f"KOL 标的新闻获取完成: {len(tickers)} 个股票, "
            f"保存 {total_saved} 篇, 耗时 {duration:.2f}s"
        )

        return FetchAllKOLTickersResponse(
            success=True,
            message=f"完成 {len(tickers)} 个 KOL 标的的新闻获取",
            tickers_processed=tickers,
            total_articles_saved=total_saved,
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
            duration_seconds=round(duration, 2),
        )

    except Exception as e:
        scheduler_status.is_running = False
        scheduler_status.error_message = str(e)
        logger.error(f"获取 KOL 标的新闻失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.post(
    "/fetch-bulk",
    response_model=FetchBulkNewsResponse,
    summary="批量获取全量新闻",
)
async def fetch_bulk_news(
    days: int = Query(30, ge=1, le=90, description="获取最近多少天的新闻"),
    batch_size: int = Query(100, ge=10, le=500, description="每批获取的新闻数量"),
    batch_days: int = Query(7, ge=1, le=14, description="每批覆盖的天数"),
):
    """
    批量获取 Benzinga 全量新闻并保存到数据库

    此端点不按 ticker 过滤，直接获取所有新闻，能获取更多独特的文章。

    工作方式：
    1. 将时间范围分成多个批次（每批 batch_days 天）
    2. 对每个时间段调用 Benzinga API
    3. 将所有新闻保存到数据库（自动去重）

    - **days**: 获取最近多少天的新闻（默认 30 天）
    - **batch_size**: 每批获取的最大新闻数量（默认 100）
    - **batch_days**: 每批覆盖的天数（默认 7 天）

    注意：Benzinga API 每次请求最多返回约 25 篇，会自动分批请求。
    """
    import time

    start_time = datetime.now(timezone.utc)
    start_ts = time.time()

    try:
        date_to = date.today()
        total_fetched = 0
        total_saved = 0
        time_periods = []

        async with BenzingaClient() as client:
            # 分批获取不同时间段
            for days_ago in range(0, days, batch_days):
                period_end = date_to - timedelta(days=days_ago)
                period_start = date_to - timedelta(
                    days=min(days_ago + batch_days, days)
                )

                response = await client.get_news(
                    tickers="",  # 空字符串 = 获取全部
                    limit=batch_size,
                    date_from=period_start.isoformat(),
                    date_to=period_end.isoformat(),
                )

                fetched_count = len(response.articles) if response.articles else 0
                saved_count = 0

                if response.articles:
                    saved_count = await save_articles_to_db(response.articles)

                total_fetched += fetched_count
                total_saved += saved_count

                period_info = {
                    "period_start": period_start.isoformat(),
                    "period_end": period_end.isoformat(),
                    "articles_fetched": fetched_count,
                    "articles_saved": saved_count,
                }
                time_periods.append(period_info)

                logger.info(
                    f"批次 {period_start} ~ {period_end}: "
                    f"获取 {fetched_count}, 保存 {saved_count}"
                )

        end_time = datetime.now(timezone.utc)
        duration = time.time() - start_ts

        logger.info(
            f"批量新闻获取完成: 共获取 {total_fetched} 篇, "
            f"保存 {total_saved} 篇, 耗时 {duration:.2f}s"
        )

        return FetchBulkNewsResponse(
            success=True,
            message=f"完成 {days} 天新闻的批量获取",
            total_articles_fetched=total_fetched,
            total_articles_saved=total_saved,
            time_periods=time_periods,
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
            duration_seconds=round(duration, 2),
        )

    except Exception as e:
        logger.error(f"批量获取新闻失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.get(
    "/scheduler-status",
    response_model=SchedulerStatusResponse,
    summary="获取定时任务状态",
)
async def get_scheduler_status():
    """
    获取定时任务的执行状态

    返回：
    - 是否正在运行
    - 上次运行时间
    - 上次处理的股票列表
    - 上次保存的文章数量
    - 下次运行时间
    """
    return SchedulerStatusResponse(
        is_running=scheduler_status.is_running,
        last_run_at=(
            scheduler_status.last_run_at.isoformat()
            if scheduler_status.last_run_at
            else None
        ),
        last_run_tickers=scheduler_status.last_run_tickers,
        last_run_articles_saved=scheduler_status.last_run_articles_saved,
        last_run_duration_seconds=scheduler_status.last_run_duration_seconds,
        next_run_at=(
            scheduler_status.next_run_at.isoformat()
            if scheduler_status.next_run_at
            else None
        ),
        error_message=scheduler_status.error_message,
    )


# ============================================================
# 定时任务函数 (供外部调用)
# ============================================================


async def scheduled_fetch_kol_news(
    limit_per_ticker: int = 10,
    days: int = 7,
    max_concurrent: int = 3,
):
    """
    定时任务：获取所有 KOL 标的的新闻

    此函数供定时任务调度器调用（如 APScheduler）

    Args:
        limit_per_ticker: 每个股票获取的新闻数量
        days: 获取最近多少天的新闻
        max_concurrent: 最大并发数
    """
    import time

    start_time = datetime.now(timezone.utc)
    start_ts = time.time()

    scheduler_status.is_running = True
    scheduler_status.error_message = None

    try:
        tickers = await get_all_kol_mentioned_tickers()

        if not tickers:
            logger.info("定时任务: 没有找到 KOL 标的")
            scheduler_status.is_running = False
            return

        logger.info(f"定时任务开始: 获取 {len(tickers)} 个 KOL 标的的新闻")

        semaphore = asyncio.Semaphore(max_concurrent)
        total_saved = 0

        async def fetch_with_semaphore(t: str) -> int:
            async with semaphore:
                _, saved = await fetch_and_save_ticker_news(
                    ticker=t,
                    limit=limit_per_ticker,
                    days=days,
                )
                return saved

        tasks = [fetch_with_semaphore(t) for t in tickers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for r in results:
            if isinstance(r, int):
                total_saved += r

        duration = time.time() - start_ts

        # 更新状态
        scheduler_status.is_running = False
        scheduler_status.last_run_at = start_time
        scheduler_status.last_run_tickers = tickers
        scheduler_status.last_run_articles_saved = total_saved
        scheduler_status.last_run_duration_seconds = round(duration, 2)
        scheduler_status.next_run_at = start_time + timedelta(hours=1)

        logger.info(
            f"定时任务完成: {len(tickers)} 个股票, "
            f"保存 {total_saved} 篇, 耗时 {duration:.2f}s"
        )

        # 🤖 自动进行 AI 分析
        if total_saved > 0:
            try:
                from app.services.news_ai_service import auto_analyze_news_after_scrape

                logger.info("🤖 [KOL] 开始自动 AI 分析新保存的新闻...")
                analysis_result = await auto_analyze_news_after_scrape(
                    limit=min(total_saved, 30),  # 最多分析 30 篇
                    max_concurrent=2,
                )
                logger.info(
                    f"🤖 [KOL] AI 分析完成: "
                    f"成功 {analysis_result.get('analyzed', 0)}, "
                    f"失败 {analysis_result.get('failed', 0)}"
                )
            except Exception as ai_error:
                logger.error(f"❌ [KOL] AI 分析失败: {ai_error}")

    except Exception as e:
        scheduler_status.is_running = False
        scheduler_status.error_message = str(e)
        logger.error(f"定时任务失败: {e}")


async def scheduled_fetch_bulk_news(
    days: int = 1,
    batch_size: int = 100,
):
    """
    定时任务：获取全量新闻

    此函数供定时任务调度器调用，每小时获取最近 1 天的新闻

    Args:
        days: 获取最近多少天的新闻（默认 1 天，只获取最新的）
        batch_size: 每批获取数量
    """
    import time

    start_time = datetime.now(timezone.utc)
    start_ts = time.time()

    bulk_news_scheduler_status.is_running = True
    bulk_news_scheduler_status.error_message = None

    try:
        date_to = date.today()
        date_from = date_to - timedelta(days=days)
        total_fetched = 0
        total_saved = 0

        logger.info(f"⏰ 定时任务开始: 获取 {date_from} ~ {date_to} 的全量新闻")

        async with BenzingaClient() as client:
            response = await client.get_news(
                tickers="",  # 获取全部
                limit=batch_size,
                date_from=date_from.isoformat(),
                date_to=date_to.isoformat(),
            )

            if response.articles:
                total_fetched = len(response.articles)
                total_saved = await save_articles_to_db(response.articles)

        duration = time.time() - start_ts

        # 更新状态
        bulk_news_scheduler_status.is_running = False
        bulk_news_scheduler_status.last_run_at = start_time
        bulk_news_scheduler_status.last_run_fetched = total_fetched
        bulk_news_scheduler_status.last_run_saved = total_saved
        bulk_news_scheduler_status.last_run_duration_seconds = round(duration, 2)
        bulk_news_scheduler_status.next_run_at = start_time + timedelta(
            hours=bulk_news_scheduler_status.interval_hours
        )

        logger.info(
            f"✅ 定时任务完成: 获取 {total_fetched} 篇, "
            f"保存 {total_saved} 篇, 耗时 {duration:.2f}s"
        )

        # 🤖 自动进行 AI 分析
        if total_saved > 0:
            try:
                from app.services.news_ai_service import auto_analyze_news_after_scrape

                logger.info("🤖 [BULK] 开始自动 AI 分析新保存的新闻...")
                analysis_result = await auto_analyze_news_after_scrape(
                    limit=min(total_saved, 50),  # 最多分析 50 篇
                    max_concurrent=3,
                )
                logger.info(
                    f"🤖 [BULK] AI 分析完成: "
                    f"成功 {analysis_result.get('analyzed', 0)}, "
                    f"失败 {analysis_result.get('failed', 0)}"
                )
            except Exception as ai_error:
                logger.error(f"❌ [BULK] AI 分析失败: {ai_error}")

    except Exception as e:
        bulk_news_scheduler_status.is_running = False
        bulk_news_scheduler_status.error_message = str(e)
        logger.error(f"❌ 批量新闻定时任务失败: {e}")


# ============================================================
# 定时任务控制 API
# ============================================================


@router.get(
    "/bulk-scheduler-status",
    response_model=BulkNewsSchedulerStatusResponse,
    summary="获取批量新闻定时任务状态",
)
async def get_bulk_scheduler_status():
    """
    获取批量新闻定时任务的执行状态

    返回：
    - 是否已启用
    - 是否正在运行
    - 上次运行时间和结果
    - 下次运行时间
    """
    return BulkNewsSchedulerStatusResponse(
        is_enabled=bulk_news_scheduler_status.is_enabled,
        is_running=bulk_news_scheduler_status.is_running,
        last_run_at=(
            bulk_news_scheduler_status.last_run_at.isoformat()
            if bulk_news_scheduler_status.last_run_at
            else None
        ),
        last_run_fetched=bulk_news_scheduler_status.last_run_fetched,
        last_run_saved=bulk_news_scheduler_status.last_run_saved,
        last_run_duration_seconds=bulk_news_scheduler_status.last_run_duration_seconds,
        next_run_at=(
            bulk_news_scheduler_status.next_run_at.isoformat()
            if bulk_news_scheduler_status.next_run_at
            else None
        ),
        interval_hours=bulk_news_scheduler_status.interval_hours,
        error_message=bulk_news_scheduler_status.error_message,
    )


@router.post(
    "/bulk-scheduler/start",
    response_model=SchedulerControlResponse,
    summary="启动批量新闻定时任务",
)
async def start_bulk_scheduler(
    interval_hours: int = Query(1, ge=1, le=24, description="执行间隔（小时）"),
):
    """
    启动批量新闻定时任务

    - **interval_hours**: 执行间隔，默认每 1 小时执行一次
    """
    try:
        from main import scheduler

        if scheduler is None:
            raise HTTPException(status_code=500, detail="调度器未初始化")

        # 检查任务是否已存在
        existing_job = scheduler.get_job("fetch_bulk_news")
        if existing_job:
            scheduler.remove_job("fetch_bulk_news")

        # 添加新任务
        from apscheduler.triggers.interval import IntervalTrigger

        scheduler.add_job(
            scheduled_fetch_bulk_news,
            IntervalTrigger(hours=interval_hours),
            id="fetch_bulk_news",
            name="获取全量新闻",
            replace_existing=True,
        )

        # 更新状态
        bulk_news_scheduler_status.is_enabled = True
        bulk_news_scheduler_status.interval_hours = interval_hours

        job = scheduler.get_job("fetch_bulk_news")
        next_run = job.next_run_time if job else None
        bulk_news_scheduler_status.next_run_at = next_run

        logger.info(f"✅ 批量新闻定时任务已启动 (每 {interval_hours} 小时)")

        return SchedulerControlResponse(
            success=True,
            message=f"定时任务已启动，每 {interval_hours} 小时执行一次",
            is_enabled=True,
            next_run_at=next_run.isoformat() if next_run else None,
        )

    except ImportError:
        raise HTTPException(status_code=500, detail="APScheduler 未安装")
    except Exception as e:
        logger.error(f"启动定时任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/bulk-scheduler/stop",
    response_model=SchedulerControlResponse,
    summary="停止批量新闻定时任务",
)
async def stop_bulk_scheduler():
    """
    停止批量新闻定时任务
    """
    try:
        from main import scheduler

        if scheduler is None:
            raise HTTPException(status_code=500, detail="调度器未初始化")

        job = scheduler.get_job("fetch_bulk_news")
        if job:
            scheduler.remove_job("fetch_bulk_news")
            bulk_news_scheduler_status.is_enabled = False
            bulk_news_scheduler_status.next_run_at = None

            logger.info("🛑 批量新闻定时任务已停止")

            return SchedulerControlResponse(
                success=True,
                message="定时任务已停止",
                is_enabled=False,
            )
        else:
            return SchedulerControlResponse(
                success=True,
                message="定时任务未在运行",
                is_enabled=False,
            )

    except Exception as e:
        logger.error(f"停止定时任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/bulk-scheduler/run-now",
    response_model=FetchBulkNewsResponse,
    summary="立即执行一次批量新闻获取",
)
async def run_bulk_scheduler_now():
    """
    立即执行一次批量新闻获取（不影响定时任务）
    """
    # 复用 fetch_bulk_news 的逻辑
    return await fetch_bulk_news(days=1, batch_size=100, batch_days=1)
