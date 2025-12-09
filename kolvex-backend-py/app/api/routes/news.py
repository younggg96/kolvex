"""
金融新闻 API 路由
提供 Benzinga 新闻数据的获取和存储功能

功能：
1. 获取单只股票的新闻并保存到数据库
2. 定时任务：每小时获取所有 KOL 提到过的标的的新闻
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime, date, timedelta, timezone
import logging
import asyncio

from app.core.supabase import get_supabase_service
from app.services.benzinga import BenzingaClient, NewsArticle

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/news", tags=["News"])


# ============================================================
# 全局状态 - 记录定时任务执行状态
# ============================================================


class SchedulerStatus:
    """定时任务状态"""

    last_run_at: Optional[datetime] = None
    last_run_tickers: List[str] = []
    last_run_articles_saved: int = 0
    last_run_duration_seconds: float = 0.0
    is_running: bool = False
    next_run_at: Optional[datetime] = None
    error_message: Optional[str] = None


scheduler_status = SchedulerStatus()


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

    for article in articles:
        try:
            data = {
                "published_at": article.published_at,
                "title": article.title,
                "summary": article.summary,
                "url": article.url,
                "tags": article.tags,
                "tickers": article.tickers,
                "source": "benzinga",
            }

            # 使用 upsert 避免重复 (基于 URL 唯一性)
            result = (
                supabase.table("news_articles")
                .upsert(data, on_conflict="url")
                .execute()
            )

            if result.data:
                saved_count += 1

        except Exception as e:
            logger.error(f"保存文章失败: {article.title[:50]}... - {e}")
            continue

    return saved_count


def db_row_to_response(row: dict) -> NewsArticleResponse:
    """将数据库行转换为 API 响应模型"""
    return NewsArticleResponse(
        id=row.get("id"),
        published_at=row.get("published_at", ""),
        title=row.get("title", ""),
        summary=row.get("summary", ""),
        url=row.get("url", ""),
        tags=row.get("tags") or [],
        tickers=row.get("tickers") or [],
        source=row.get("source", "benzinga"),
        created_at=row.get("created_at"),
    )


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
                    if ticker and isinstance(ticker, str):
                        all_tickers.add(ticker.upper())

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
):
    """
    获取数据库中的新闻列表

    - **page**: 页码，从 1 开始
    - **page_size**: 每页数量，默认 20
    - **ticker**: 可选，按股票代码筛选
    """
    try:
        supabase = get_supabase_service()
        offset = (page - 1) * page_size

        query = supabase.table("news_articles").select("*", count="exact")

        if ticker:
            query = query.contains("tickers", [ticker.upper()])

        result = (
            query.order("published_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        articles = [db_row_to_response(row) for row in (result.data or [])]
        total = result.count or 0
        has_more = offset + len(articles) < total

        return NewsListResponse(
            articles=articles,
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

    except Exception as e:
        scheduler_status.is_running = False
        scheduler_status.error_message = str(e)
        logger.error(f"定时任务失败: {e}")
