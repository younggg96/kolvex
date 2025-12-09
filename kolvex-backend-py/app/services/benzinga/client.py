"""
Benzinga News API 客户端
用于获取金融新闻数据，支持 AI 投资分析管道

Features:
- 异步和同步两种客户端实现
- HTML 标签清理 (LLM 友好)
- 完善的错误处理 (401/429/连接错误)
- Pydantic 数据验证
"""

import re
import logging
from datetime import date, datetime, timedelta
from html import unescape
from typing import List, Optional, Literal, Union

import httpx

from .models import NewsArticle, BenzingaRawArticle, BenzingaNewsResponse

# 配置日志
logger = logging.getLogger(__name__)

# API 配置
BENZINGA_BASE_URL = "https://api.benzinga.com/api/v2"
DEFAULT_TIMEOUT = 30.0

# 显示输出类型
DisplayOutput = Literal["headline", "teaser", "body", "abstract", "full"]


def _load_api_key() -> str:
    """
    从环境变量加载 API 密钥

    Returns:
        str: API 密钥

    Raises:
        ValueError: 如果未设置 API 密钥
    """
    import os
    from dotenv import load_dotenv

    load_dotenv()

    api_key = os.getenv("BENZINGA_API_KEY", "")
    if not api_key:
        logger.warning("BENZINGA_API_KEY 未设置，请在 .env 文件中配置")
    return api_key


class HTMLCleaner:
    """
    HTML 清理工具类
    将包含 HTML 标签的文本转换为纯文本
    """

    # 预编译的正则表达式模式
    _HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
    _MULTIPLE_SPACES_PATTERN = re.compile(r"\s+")
    _MULTIPLE_NEWLINES_PATTERN = re.compile(r"\n{3,}")

    # 需要添加换行的块级标签
    _BLOCK_TAGS = re.compile(
        r"<\s*/?\s*(p|div|br|h[1-6]|li|ul|ol|blockquote|pre|table|tr)\s*/?[^>]*>",
        re.IGNORECASE,
    )

    @classmethod
    def strip_html(cls, text: Optional[str]) -> str:
        """
        从文本中移除所有 HTML 标签

        Args:
            text: 可能包含 HTML 的原始文本

        Returns:
            str: 清洗后的纯文本
        """
        if not text:
            return ""

        # 1. 将块级标签替换为换行
        text = cls._BLOCK_TAGS.sub("\n", text)

        # 2. 移除所有剩余的 HTML 标签
        text = cls._HTML_TAG_PATTERN.sub("", text)

        # 3. 解码 HTML 实体 (&amp; -> &, &lt; -> <, etc.)
        text = unescape(text)

        # 4. 规范化空白字符
        text = cls._MULTIPLE_SPACES_PATTERN.sub(" ", text)

        # 5. 规范化换行 (最多保留两个连续换行)
        text = cls._MULTIPLE_NEWLINES_PATTERN.sub("\n\n", text)

        # 6. 清理首尾空白
        return text.strip()

    @classmethod
    def clean_for_llm(cls, text: Optional[str], max_length: int = 0) -> str:
        """
        为 LLM 处理清理文本

        Args:
            text: 原始文本
            max_length: 最大长度 (0 = 不限制)

        Returns:
            str: 清洗并可能截断的文本
        """
        cleaned = cls.strip_html(text)

        if max_length > 0 and len(cleaned) > max_length:
            # 在单词边界截断
            cleaned = cleaned[:max_length].rsplit(" ", 1)[0] + "..."

        return cleaned


class BenzingaClient:
    """
    Benzinga News API 异步客户端

    使用示例:
        ```python
        async with BenzingaClient() as client:
            news = await client.get_news("NVDA", limit=10)
            for article in news.articles:
                print(article.title)
        ```
    """

    # 默认请求头 - 必须指定 Accept: application/json，否则返回 XML
    DEFAULT_HEADERS = {"Accept": "application/json", "User-Agent": "Kolvex/1.0"}

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = BENZINGA_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        """
        初始化 Benzinga 客户端

        Args:
            api_key: Benzinga API 密钥 (可选，默认从环境变量加载)
            base_url: API 基础 URL
            timeout: 请求超时时间 (秒)
        """
        self.api_key = api_key or _load_api_key()
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = httpx.AsyncClient(timeout=timeout, headers=self.DEFAULT_HEADERS)
        self._cleaner = HTMLCleaner()

    async def close(self):
        """关闭 HTTP 客户端"""
        await self._client.aclose()

    @staticmethod
    def _format_date(dt: Union[str, date, datetime]) -> str:
        """
        将日期转换为 Benzinga API 所需的格式 (YYYY-MM-DD)

        Args:
            dt: 日期字符串、date 或 datetime 对象

        Returns:
            str: 格式化的日期字符串 (YYYY-MM-DD)
        """
        if isinstance(dt, str):
            return dt
        elif isinstance(dt, datetime):
            return dt.strftime("%Y-%m-%d")
        elif isinstance(dt, date):
            return dt.strftime("%Y-%m-%d")
        return str(dt)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    def _transform_article(self, raw: BenzingaRawArticle) -> NewsArticle:
        """
        将原始 API 响应转换为清洗后的文章模型

        Args:
            raw: 原始 API 响应数据

        Returns:
            NewsArticle: 清洗后的文章
        """
        # 优先使用 body，其次 teaser
        content = raw.body or raw.teaser or ""
        summary = self._cleaner.clean_for_llm(content)

        # 提取标签名称
        tags = [tag.name for tag in (raw.tags or []) if tag.name]

        # 提取股票代码
        tickers = [stock.name for stock in (raw.stocks or []) if stock.name]

        return NewsArticle(
            published_at=raw.created or "",
            title=self._cleaner.strip_html(raw.title or ""),
            summary=summary,
            url=raw.url or "",
            tags=tags,
            tickers=tickers,
        )

    async def get_news(
        self,
        tickers: str,
        limit: int = 10,
        display_output: DisplayOutput = "full",
        date_from: Optional[Union[str, date, datetime]] = None,
        date_to: Optional[Union[str, date, datetime]] = None,
        updated_since: Optional[Union[str, date, datetime]] = None,
    ) -> BenzingaNewsResponse:
        """
        获取指定股票的新闻

        Args:
            tickers: 股票代码 (如 "NVDA" 或 "NVDA,AAPL")
            limit: 返回的新闻数量 (默认 10)
            display_output: 显示内容级别
                - "headline": 仅标题
                - "teaser": 标题 + 摘要
                - "body": 标题 + 正文
                - "abstract": 标题 + 摘要
                - "full": 完整内容
            date_from: 开始日期 (格式: YYYY-MM-DD 或 date/datetime 对象)
            date_to: 结束日期 (格式: YYYY-MM-DD 或 date/datetime 对象)
            updated_since: 获取此时间之后更新的新闻 (格式: YYYY-MM-DD 或 date/datetime 对象)

        Returns:
            BenzingaNewsResponse: 包含新闻文章列表的响应对象

        Note:
            如果请求失败，返回空列表但会记录错误日志
        """
        if not self.api_key:
            logger.error("Benzinga API 密钥未配置")
            return BenzingaNewsResponse(
                articles=[], success=False, error_message="API key not configured"
            )

        url = f"{self.base_url}/news"
        params = {
            "token": self.api_key,
            "symbols": tickers,  # Benzinga API 使用 symbols 参数
            "pageSize": limit,
            "displayOutput": display_output,
        }

        # 添加时间筛选参数
        if date_from:
            params["dateFrom"] = self._format_date(date_from)
        if date_to:
            params["dateTo"] = self._format_date(date_to)
        if updated_since:
            params["updatedSince"] = self._format_date(updated_since)

        try:
            response = await self._client.get(url, params=params)

            # 处理特定错误状态码
            if response.status_code == 401:
                logger.error("Benzinga API 认证失败 (401): API 密钥无效或已过期")
                return BenzingaNewsResponse(
                    articles=[],
                    success=False,
                    error_message="Authentication failed: Invalid or expired API key",
                )

            if response.status_code == 429:
                logger.warning("Benzinga API 请求频率限制 (429): 请稍后重试")
                return BenzingaNewsResponse(
                    articles=[],
                    success=False,
                    error_message="Rate limit exceeded: Please retry later",
                )

            response.raise_for_status()

            # 解析响应
            data = response.json()

            # Benzinga API 直接返回数组
            if isinstance(data, list):
                raw_articles = [BenzingaRawArticle(**item) for item in data]
            else:
                # 某些端点可能返回包装对象
                raw_articles = [
                    BenzingaRawArticle(**item)
                    for item in data.get("data", data.get("articles", []))
                ]

            # 转换为清洗后的文章
            articles = [self._transform_article(raw) for raw in raw_articles]

            logger.info(f"成功获取 {len(articles)} 篇关于 {tickers} 的新闻")

            return BenzingaNewsResponse(
                articles=articles, total_count=len(articles), success=True
            )

        except httpx.ConnectError as e:
            logger.error(f"Benzinga API 连接失败: {e}")
            return BenzingaNewsResponse(
                articles=[], success=False, error_message=f"Connection failed: {str(e)}"
            )

        except httpx.TimeoutException as e:
            logger.error(f"Benzinga API 请求超时: {e}")
            return BenzingaNewsResponse(
                articles=[], success=False, error_message=f"Request timeout: {str(e)}"
            )

        except httpx.HTTPStatusError as e:
            logger.error(f"Benzinga API HTTP 错误: {e.response.status_code}")
            return BenzingaNewsResponse(
                articles=[],
                success=False,
                error_message=f"HTTP error: {e.response.status_code}",
            )

        except Exception as e:
            logger.error(f"Benzinga API 未知错误: {e}")
            return BenzingaNewsResponse(
                articles=[], success=False, error_message=f"Unexpected error: {str(e)}"
            )

    async def get_news_multi_ticker(
        self,
        tickers: List[str],
        limit_per_ticker: int = 5,
        date_from: Optional[Union[str, date, datetime]] = None,
        date_to: Optional[Union[str, date, datetime]] = None,
    ) -> BenzingaNewsResponse:
        """
        获取多个股票的新闻

        Args:
            tickers: 股票代码列表 (如 ["NVDA", "AAPL", "MSFT"])
            limit_per_ticker: 每个股票的新闻数量
            date_from: 开始日期 (格式: YYYY-MM-DD 或 date/datetime 对象)
            date_to: 结束日期 (格式: YYYY-MM-DD 或 date/datetime 对象)

        Returns:
            BenzingaNewsResponse: 合并后的新闻响应
        """
        # 将股票代码合并为逗号分隔的字符串
        tickers_str = ",".join(tickers)
        total_limit = len(tickers) * limit_per_ticker

        return await self.get_news(
            tickers=tickers_str,
            limit=total_limit,
            date_from=date_from,
            date_to=date_to,
        )

    async def health_check(self) -> bool:
        """
        健康检查 - 验证 API 连接和密钥

        Returns:
            bool: API 是否可用
        """
        try:
            # 使用最小请求测试 API
            response = await self.get_news("AAPL", limit=1)
            return response.success
        except Exception:
            return False


class BenzingaClientSync:
    """
    Benzinga News API 同步客户端
    用于非异步环境或简单脚本

    使用示例:
        ```python
        client = BenzingaClientSync()
        news = client.get_news("NVDA", limit=10)
        for article in news.articles:
            print(article.title)
        ```
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = BENZINGA_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        """
        初始化同步 Benzinga 客户端

        Args:
            api_key: Benzinga API 密钥 (可选，默认从环境变量加载)
            base_url: API 基础 URL
            timeout: 请求超时时间 (秒)
        """
        self.api_key = api_key or _load_api_key()
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._cleaner = HTMLCleaner()

    @staticmethod
    def _format_date(dt: Union[str, date, datetime]) -> str:
        """
        将日期转换为 Benzinga API 所需的格式 (YYYY-MM-DD)

        Args:
            dt: 日期字符串、date 或 datetime 对象

        Returns:
            str: 格式化的日期字符串 (YYYY-MM-DD)
        """
        if isinstance(dt, str):
            return dt
        elif isinstance(dt, datetime):
            return dt.strftime("%Y-%m-%d")
        elif isinstance(dt, date):
            return dt.strftime("%Y-%m-%d")
        return str(dt)

    def _transform_article(self, raw: BenzingaRawArticle) -> NewsArticle:
        """将原始 API 响应转换为清洗后的文章模型"""
        content = raw.body or raw.teaser or ""
        summary = self._cleaner.clean_for_llm(content)

        tags = [tag.name for tag in (raw.tags or []) if tag.name]
        tickers = [stock.name for stock in (raw.stocks or []) if stock.name]

        return NewsArticle(
            published_at=raw.created or "",
            title=self._cleaner.strip_html(raw.title or ""),
            summary=summary,
            url=raw.url or "",
            tags=tags,
            tickers=tickers,
        )

    def get_news(
        self,
        tickers: str,
        limit: int = 10,
        display_output: DisplayOutput = "full",
        date_from: Optional[Union[str, date, datetime]] = None,
        date_to: Optional[Union[str, date, datetime]] = None,
        updated_since: Optional[Union[str, date, datetime]] = None,
    ) -> BenzingaNewsResponse:
        """
        获取指定股票的新闻 (同步版本)

        Args:
            tickers: 股票代码 (如 "NVDA" 或 "NVDA,AAPL")
            limit: 返回的新闻数量 (默认 10)
            display_output: 显示内容级别
            date_from: 开始日期 (格式: YYYY-MM-DD 或 date/datetime 对象)
            date_to: 结束日期 (格式: YYYY-MM-DD 或 date/datetime 对象)
            updated_since: 获取此时间之后更新的新闻 (格式: YYYY-MM-DD 或 date/datetime 对象)

        Returns:
            BenzingaNewsResponse: 包含新闻文章列表的响应对象
        """
        if not self.api_key:
            logger.error("Benzinga API 密钥未配置")
            return BenzingaNewsResponse(
                articles=[], success=False, error_message="API key not configured"
            )

        url = f"{self.base_url}/news"
        params = {
            "token": self.api_key,
            "symbols": tickers,  # Benzinga API 使用 symbols 参数
            "pageSize": limit,
            "displayOutput": display_output,
        }

        # 添加时间筛选参数
        if date_from:
            params["dateFrom"] = self._format_date(date_from)
        if date_to:
            params["dateTo"] = self._format_date(date_to)
        if updated_since:
            params["updatedSince"] = self._format_date(updated_since)

        # 必须指定 Accept: application/json，否则返回 XML
        headers = {"Accept": "application/json", "User-Agent": "Kolvex/1.0"}

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(url, params=params, headers=headers)

                if response.status_code == 401:
                    logger.error("Benzinga API 认证失败 (401): API 密钥无效或已过期")
                    return BenzingaNewsResponse(
                        articles=[],
                        success=False,
                        error_message="Authentication failed: Invalid or expired API key",
                    )

                if response.status_code == 429:
                    logger.warning("Benzinga API 请求频率限制 (429): 请稍后重试")
                    return BenzingaNewsResponse(
                        articles=[],
                        success=False,
                        error_message="Rate limit exceeded: Please retry later",
                    )

                response.raise_for_status()

                data = response.json()

                if isinstance(data, list):
                    raw_articles = [BenzingaRawArticle(**item) for item in data]
                else:
                    raw_articles = [
                        BenzingaRawArticle(**item)
                        for item in data.get("data", data.get("articles", []))
                    ]

                articles = [self._transform_article(raw) for raw in raw_articles]

                logger.info(f"成功获取 {len(articles)} 篇关于 {tickers} 的新闻")

                return BenzingaNewsResponse(
                    articles=articles, total_count=len(articles), success=True
                )

        except httpx.ConnectError as e:
            logger.error(f"Benzinga API 连接失败: {e}")
            return BenzingaNewsResponse(
                articles=[], success=False, error_message=f"Connection failed: {str(e)}"
            )

        except httpx.TimeoutException as e:
            logger.error(f"Benzinga API 请求超时: {e}")
            return BenzingaNewsResponse(
                articles=[], success=False, error_message=f"Request timeout: {str(e)}"
            )

        except httpx.HTTPStatusError as e:
            logger.error(f"Benzinga API HTTP 错误: {e.response.status_code}")
            return BenzingaNewsResponse(
                articles=[],
                success=False,
                error_message=f"HTTP error: {e.response.status_code}",
            )

        except Exception as e:
            logger.error(f"Benzinga API 未知错误: {e}")
            return BenzingaNewsResponse(
                articles=[], success=False, error_message=f"Unexpected error: {str(e)}"
            )

    def health_check(self) -> bool:
        """健康检查 - 验证 API 连接和密钥"""
        try:
            response = self.get_news("AAPL", limit=1)
            return response.success
        except Exception:
            return False


# 便捷函数
def get_news_for_llm(
    tickers: str,
    limit: int = 10,
    api_key: Optional[str] = None,
    date_from: Optional[Union[str, date, datetime]] = None,
    date_to: Optional[Union[str, date, datetime]] = None,
) -> List[dict]:
    """
    便捷函数: 获取新闻并返回字典列表

    适用于快速集成到 LLM 管道

    Args:
        tickers: 股票代码
        limit: 新闻数量
        api_key: API 密钥 (可选)
        date_from: 开始日期 (格式: YYYY-MM-DD 或 date/datetime 对象)
        date_to: 结束日期 (格式: YYYY-MM-DD 或 date/datetime 对象)

    Returns:
        List[dict]: 文章字典列表，失败时返回空列表
    """
    client = BenzingaClientSync(api_key=api_key)
    response = client.get_news(tickers, limit, date_from=date_from, date_to=date_to)

    if not response.success:
        return []

    return [article.model_dump() for article in response.articles]


def get_recent_news_for_llm(
    tickers: str,
    days: int = 7,
    limit: int = 20,
    api_key: Optional[str] = None,
) -> List[dict]:
    """
    便捷函数: 获取最近 N 天的新闻

    Args:
        tickers: 股票代码
        days: 获取最近多少天的新闻 (默认 7 天)
        limit: 新闻数量
        api_key: API 密钥 (可选)

    Returns:
        List[dict]: 文章字典列表，失败时返回空列表
    """
    date_to = date.today()
    date_from = date_to - timedelta(days=days)

    return get_news_for_llm(
        tickers=tickers,
        limit=limit,
        api_key=api_key,
        date_from=date_from,
        date_to=date_to,
    )
