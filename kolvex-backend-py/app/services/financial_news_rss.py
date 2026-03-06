"""
Financial News RSS Crawler Service
爬取金融新闻 RSS 源，替代 FinancialJuice 插件

数据源：公开的金融新闻 RSS feeds
- Yahoo Finance
- Reuters (via public RSS)
- 其他金融新闻源

流程：RSS 爬取 -> 存入 DB -> 触发 AI 分析 -> 前端展示
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional
import re

import feedparser

from app.services.benzinga import NewsArticle

logger = logging.getLogger(__name__)

# 金融新闻 RSS 源配置 (name, url, 用于提取 ticker 的正则)
RSS_FEEDS = [
    {
        "name": "yahoo_finance",
        "url": "https://finance.yahoo.com/news/rssindex",
        "source": "yahoo_finance",
    },
    {
        "name": "reuters_business",
        "url": "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best",
        "source": "reuters",
    },
    {
        "name": "cnbc",
        "url": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
        "source": "cnbc",
    },
    {
        "name": "marketwatch",
        "url": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
        "source": "marketwatch",
    },
]

# 用于从标题/摘要中提取股票代码的正则 (如 $AAPL, AAPL, (AAPL))
TICKER_PATTERN = re.compile(
    r"\$([A-Z]{1,5})\b|(?<![a-zA-Z])([A-Z]{1,5})(?=\s|$|,|\))",
    re.IGNORECASE,
)

# 常见非股票词（避免误识别）
NON_TICKER_WORDS = {
    "USA", "US", "UK", "EU", "CEO", "CFO", "IPO", "ETF", "GDP", "AI", "IT",
    "SEC", "FDA", "FBI", "NASA", "COVID", "NYSE", "NASDAQ", "AM", "PM",
}


def _extract_tickers(text: str) -> List[str]:
    """从文本中提取可能的股票代码"""
    if not text:
        return []
    tickers = set()
    for match in TICKER_PATTERN.finditer(text):
        for g in match.groups():
            if g:
                t = g.upper()
                if t not in NON_TICKER_WORDS and len(t) >= 2:
                    tickers.add(t)
    return list(tickers)[:10]  # 最多 10 个


def _parse_rss_datetime(entry) -> str:
    """解析 RSS 条目的发布时间"""
    for attr in ("published_parsed", "updated_parsed", "created_parsed"):
        parsed = getattr(entry, attr, None)
        if parsed:
            try:
                dt = datetime(*parsed[:6], tzinfo=timezone.utc)
                return dt.isoformat()
            except (TypeError, ValueError):
                pass
    return datetime.now(timezone.utc).isoformat()


def _entry_to_article(entry, source: str) -> Optional[NewsArticle]:
    """将 RSS 条目转换为 NewsArticle"""
    try:
        title = (entry.get("title") or "").strip()
        link = entry.get("link") or ""
        if not title or not link:
            return None

        summary = ""
        if hasattr(entry, "summary"):
            summary = (entry.get("summary") or "").strip()
        if not summary and hasattr(entry, "description"):
            summary = (entry.get("description") or "").strip()
        # 简单清理 HTML
        if summary and "<" in summary:
            summary = re.sub(r"<[^>]+>", " ", summary).strip()[:500]
        summary = summary or title

        published_at = _parse_rss_datetime(entry)

        # 从标题和摘要提取 tickers
        tickers = _extract_tickers(title + " " + summary)

        return NewsArticle(
            published_at=published_at,
            title=title,
            summary=summary,
            url=link,
            tags=[],
            tickers=tickers,
        )
    except Exception as e:
        logger.warning(f"Parse RSS entry failed: {e}")
        return None


def fetch_rss_feed(feed_config: dict) -> List[NewsArticle]:
    """
    从单个 RSS 源获取新闻

    Args:
        feed_config: 包含 url, source 的配置

    Returns:
        NewsArticle 列表
    """
    url = feed_config.get("url", "")
    source = feed_config.get("source", "rss")
    articles = []

    try:
        import httpx

        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            content = resp.text
    except Exception as e:
        logger.warning(f"Fetch RSS {url} failed: {e}")
        return articles

    try:
        parsed = feedparser.parse(content)
        for entry in parsed.entries[:30]:  # 每个源最多 30 条
            article = _entry_to_article(entry, source)
            if article:
                articles.append(article)
    except Exception as e:
        logger.warning(f"Parse RSS {url} failed: {e}")

    return articles


def fetch_all_financial_news(limit_per_feed: int = 25) -> List[NewsArticle]:
    """
    从所有配置的 RSS 源获取金融新闻

    Args:
        limit_per_feed: 每个源最多获取条数

    Returns:
        去重后的 NewsArticle 列表（按时间降序）
    """
    all_articles = []
    seen_urls = set()

    for feed in RSS_FEEDS:
        try:
            articles = fetch_rss_feed(feed)[:limit_per_feed]
            for a in articles:
                url_key = a.url.lower().rstrip("/")
                if url_key not in seen_urls:
                    seen_urls.add(url_key)
                    all_articles.append(a)
        except Exception as e:
            logger.warning(f"Fetch {feed.get('name')} failed: {e}")

    # 按时间排序
    def parse_dt(a: NewsArticle) -> datetime:
        try:
            return datetime.fromisoformat(
                a.published_at.replace("Z", "+00:00")
            )
        except (ValueError, TypeError):
            return datetime.min.replace(tzinfo=timezone.utc)

    all_articles.sort(key=parse_dt, reverse=True)
    return all_articles
