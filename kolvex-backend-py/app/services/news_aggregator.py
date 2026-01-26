"""
News Aggregator Service
聚合多个新闻数据源的服务

支持的数据源:
1. Benzinga - 金融新闻 API
2. Yahoo Finance - 股票相关新闻（支持 trending 模式）
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import logging
import asyncio

from app.services.benzinga import NewsArticle
from app.services.yfinance import get_yfinance_service

logger = logging.getLogger(__name__)

# 用于获取 trending 新闻的热门股票/指数
TRENDING_SYMBOLS = [
    "SPY",
    "QQQ",
    "AAPL",
    "MSFT",
    "NVDA",
    "GOOGL",
    "AMZN",
    "META",
    "TSLA",
]


class AggregatedNewsResponse(BaseModel):
    """聚合新闻响应模型"""

    articles: List[NewsArticle] = Field(default_factory=list)
    sources: Dict[str, int] = Field(
        default_factory=dict, description="各数据源的文章数量"
    )
    total_count: int = 0
    success: bool = True
    error_message: Optional[str] = None


class NewsAggregator:
    """
    新闻聚合器

    聚合多个数据源的新闻，并进行去重和排序
    """

    def __init__(self):
        self.yfinance = get_yfinance_service()

    def _transform_yfinance_article(
        self, item: Dict[str, Any], ticker: Optional[str] = None
    ) -> Optional[NewsArticle]:
        """
        将 yfinance 新闻转换为统一的 NewsArticle 格式

        Args:
            item: yfinance 新闻项
            ticker: 相关股票代码（可选）

        Returns:
            NewsArticle 或 None（如果转换失败）
        """
        try:
            # 解析时间戳
            publish_time = item.get("publish_time")
            if publish_time:
                if isinstance(publish_time, (int, float)):
                    published_at = datetime.fromtimestamp(
                        publish_time, tz=timezone.utc
                    ).isoformat()
                else:
                    published_at = str(publish_time)
            else:
                published_at = datetime.now(timezone.utc).isoformat()

            # 获取标题和链接
            title = item.get("title", "")
            url = item.get("link", "")

            if not title or not url:
                return None

            # 获取相关 tickers
            related_tickers = item.get("related_tickers", [])
            if ticker and ticker.upper() not in [t.upper() for t in related_tickers]:
                related_tickers = [ticker.upper()] + related_tickers

            # 构建摘要（yfinance 通常没有摘要，用 publisher 信息补充）
            publisher = item.get("publisher", "Yahoo Finance")
            summary = f"News from {publisher}"

            return NewsArticle(
                published_at=published_at,
                title=title,
                summary=summary,
                url=url,
                tags=[],
                tickers=[t.upper() for t in related_tickers if t],
            )
        except Exception as e:
            logger.warning(f"Failed to transform yfinance article: {e}")
            return None

    async def get_yfinance_news(
        self,
        ticker: Optional[str] = None,
        limit: int = 20,
    ) -> List[NewsArticle]:
        """
        从 Yahoo Finance 获取新闻

        Args:
            ticker: 股票代码（可选）
            limit: 最大返回数量

        Returns:
            List[NewsArticle]: 新闻文章列表
        """
        if not ticker:
            return []

        try:
            # yfinance 是同步的，使用线程池执行
            loop = asyncio.get_event_loop()
            news_items = await loop.run_in_executor(
                None, self.yfinance.get_news, ticker
            )

            articles = []
            for item in news_items[:limit]:
                article = self._transform_yfinance_article(item, ticker)
                if article:
                    articles.append(article)

            return articles
        except Exception as e:
            logger.error(f"Failed to get yfinance news for {ticker}: {e}")
            return []

    async def get_trending_news(
        self,
        limit: int = 30,
    ) -> List[NewsArticle]:
        """
        获取 trending 新闻（从多个热门股票聚合）

        Args:
            limit: 最大返回数量

        Returns:
            List[NewsArticle]: 新闻文章列表
        """
        try:
            # 并发获取多个热门股票的新闻
            tasks = []
            for symbol in TRENDING_SYMBOLS[:5]:  # 限制并发数
                tasks.append(self.get_yfinance_news(symbol, limit=10))

            results = await asyncio.gather(*tasks, return_exceptions=True)

            all_articles = []
            for result in results:
                if isinstance(result, list):
                    all_articles.extend(result)

            # 去重
            unique_articles = self._deduplicate_articles(all_articles)

            # 按时间排序
            sorted_articles = self._sort_by_date(unique_articles)

            return sorted_articles[:limit]

        except Exception as e:
            logger.error(f"Failed to get trending news: {e}")
            return []

    def _deduplicate_articles(
        self,
        articles: List[NewsArticle],
    ) -> List[NewsArticle]:
        """
        去重文章（基于 URL）

        Args:
            articles: 文章列表

        Returns:
            去重后的文章列表
        """
        seen_urls = set()
        unique_articles = []

        for article in articles:
            # 标准化 URL 用于比较
            url_key = article.url.lower().rstrip("/")
            if url_key not in seen_urls:
                seen_urls.add(url_key)
                unique_articles.append(article)

        return unique_articles

    def _sort_by_date(
        self,
        articles: List[NewsArticle],
        descending: bool = True,
    ) -> List[NewsArticle]:
        """
        按发布时间排序

        Args:
            articles: 文章列表
            descending: 是否降序（最新在前）

        Returns:
            排序后的文章列表
        """

        def parse_date(article: NewsArticle) -> datetime:
            try:
                return datetime.fromisoformat(
                    article.published_at.replace("Z", "+00:00")
                )
            except:
                return datetime.min.replace(tzinfo=timezone.utc)

        return sorted(articles, key=parse_date, reverse=descending)

    async def aggregate_news(
        self,
        ticker: Optional[str] = None,
        include_benzinga: bool = True,
        include_yfinance: bool = True,
        limit: int = 50,
    ) -> AggregatedNewsResponse:
        """
        聚合多个数据源的新闻

        Args:
            ticker: 股票代码（可选）
            include_benzinga: 是否包含 Benzinga 数据
            include_yfinance: 是否包含 Yahoo Finance 数据
            limit: 最大返回数量

        Returns:
            AggregatedNewsResponse: 聚合后的新闻响应
        """
        all_articles = []
        sources = {}

        try:
            tasks = []

            # Yahoo Finance 新闻
            if include_yfinance and ticker:
                tasks.append(("yfinance", self.get_yfinance_news(ticker, limit=20)))

            # 并发获取所有数据源
            if tasks:
                results = await asyncio.gather(
                    *[task[1] for task in tasks], return_exceptions=True
                )

                for (source_name, _), result in zip(tasks, results):
                    if isinstance(result, Exception):
                        logger.error(f"Error fetching from {source_name}: {result}")
                        sources[source_name] = 0
                    else:
                        # 为每篇文章添加来源标记
                        for article in result:
                            # 创建新文章对象，避免修改原对象
                            article_dict = article.model_dump()
                            all_articles.append(NewsArticle(**article_dict))
                        sources[source_name] = len(result)

            # 去重和排序
            unique_articles = self._deduplicate_articles(all_articles)
            sorted_articles = self._sort_by_date(unique_articles)

            # 限制数量
            final_articles = sorted_articles[:limit]

            return AggregatedNewsResponse(
                articles=final_articles,
                sources=sources,
                total_count=len(final_articles),
                success=True,
            )

        except Exception as e:
            logger.error(f"Failed to aggregate news: {e}")
            return AggregatedNewsResponse(
                articles=[],
                sources={},
                total_count=0,
                success=False,
                error_message=str(e),
            )


# 全局实例
_news_aggregator: Optional[NewsAggregator] = None


def get_news_aggregator() -> NewsAggregator:
    """获取新闻聚合器实例"""
    global _news_aggregator
    if _news_aggregator is None:
        _news_aggregator = NewsAggregator()
    return _news_aggregator
