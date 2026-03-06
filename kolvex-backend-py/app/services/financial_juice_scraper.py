"""
FinancialJuice News Scraper Service
纯主页抓取版：移除所有 Widget 依赖，专注拦截 https://www.financialjuice.com/home 的 API 与 DOM。

数据流：
  scrape_financial_juice_news()
    → FinancialJuiceHomeScraper.scrape()
    → List[NewsArticle]
    → save_articles_to_db(articles, source="financial_juice")   [在 webhook / scheduler 中调用]
    → news_articles 表 (Supabase)
    → auto_analyze_news_after_scrape()                          [后台 AI 分析]
    → 前端 LiveNewsList 按 source=financial_juice 展示
"""

import hashlib
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Set

from app.services.benzinga import NewsArticle

logger = logging.getLogger(__name__)

# --- 常量配置 ---
FJ_HOME_URL = "https://www.financialjuice.com/home"

TICKER_PATTERN = re.compile(
    r"\$([A-Z]{1,5})\b|(?<![a-zA-Z])([A-Z]{1,5})(?=\s|$|,|\))",
    re.IGNORECASE,
)
NON_TICKER_WORDS = {
    "USA", "US", "UK", "EU", "CEO", "CFO", "IPO", "ETF", "GDP", "AI", "IT",
    "SEC", "FDA", "FBI", "NASA", "COVID", "NYSE", "NASDAQ", "AM", "PM",
    "ECB", "BOE", "FED", "MOC", "NAS", "DOW", "MAG",
}


class FinancialJuiceHomeScraper:
    """
    纯主页爬虫：加载 financialjuice.com/home，拦截 API + 解析 DOM。
    不依赖任何 FJWidgets / iframe 嵌入。
    """

    def __init__(self, headless: bool = True, timeout_ms: int = 30000):
        self.headless = headless
        self.timeout_ms = timeout_ms
        self.seen_urls: Set[str] = set()
        self.seen_titles: Set[str] = set()
        self.articles: List[NewsArticle] = []
        self.api_responses: List[Any] = []

    # ==================== 主入口 ====================

    def scrape(self) -> List[NewsArticle]:
        """执行抓取流程"""
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            logger.error(
                "Playwright not installed. "
                "Run: pip install playwright && playwright install chromium"
            )
            return []

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=self.headless,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-blink-features=AutomationControlled",
                    ],
                )
                context = browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    ),
                    viewport={"width": 1280, "height": 900},
                    locale="en-US",
                    timezone_id="America/New_York",
                )

                page = context.new_page()
                self._inject_stealth_scripts(page)
                page.on("response", self._handle_network_response)

                self._execute_home_strategy(page)

                browser.close()

        except Exception as e:
            logger.exception(f"FinancialJuice scrape critical failure: {e}")

        return self._finalize_articles()

    # ==================== 页面策略 ====================

    def _execute_home_strategy(self, page):
        """访问主页 → 拦截 API → 提取 DOM"""
        try:
            logger.info(f"Loading {FJ_HOME_URL}")
            page.goto(
                FJ_HOME_URL,
                wait_until="networkidle",
                timeout=self.timeout_ms,
            )

            # 智能等待：优先等待新闻容器，超时则回退到固定等待
            try:
                page.wait_for_selector(
                    "div.headline-container, li.news-item, "
                    ".feed-item, .headline, [class*='news']",
                    timeout=5000,
                    state="attached",
                )
                page.wait_for_timeout(1000)
            except Exception:
                logger.debug("Headline DOM not found quickly, falling back to wait.")
                page.wait_for_timeout(3000)

            # 1. 优先解析拦截到的 API 数据
            self._parse_intercepted_apis()

            # 2. API 数据不足时用 DOM 兜底
            if not self.articles:
                logger.info("No API data parsed, falling back to DOM extraction.")
                self._extract_from_dom(page.main_frame)

            # 3. 检查 iframe（某些金融组件嵌在 iframe 里）
            for frame in page.frames:
                if frame == page.main_frame:
                    continue
                frame_url = frame.url or ""
                if "financialjuice" in frame_url or "feed" in frame_url:
                    self._extract_from_dom(frame)

        except Exception as e:
            logger.warning(f"Home strategy failed: {e}")

    # ==================== 网络拦截 ====================

    def _handle_network_response(self, response):
        """捕获 JSON 格式的 News API 响应"""
        try:
            if response.status != 200:
                return
            ct = response.headers.get("content-type", "") or ""
            url = response.url.lower()

            if "json" in ct and any(
                kw in url
                for kw in ["financialjuice", "feed.", "/api/", "headline"]
            ):
                body = response.json()
                self.api_responses.append(body)
        except Exception:
            pass

    def _parse_intercepted_apis(self):
        """遍历并解析所有拦截到的 API JSON"""
        for body in self.api_responses:
            items = self._flatten_json_items(body)
            for item in items:
                if not isinstance(item, dict):
                    continue

                title = (
                    item.get("title")
                    or item.get("headline")
                    or item.get("text")
                    or ""
                )
                url = item.get("url") or item.get("link") or ""
                if not title:
                    continue

                if not url:
                    h = hashlib.sha256(title.encode()).hexdigest()[:12]
                    url = f"https://www.financialjuice.com/headline/{h}"

                if self._is_duplicate(url):
                    continue
                norm = self._normalize_title(title)
                if norm and norm in self.seen_titles:
                    continue

                summary = (
                    item.get("summary")
                    or item.get("description")
                    or item.get("body")
                    or title
                )
                pub_time = self._parse_time(
                    item.get("published_at")
                    or item.get("published")
                    or item.get("date")
                    or item.get("time")
                )
                tickers = self._resolve_tickers(item, title + " " + summary)

                self._add_article(title, summary, url, pub_time, tickers)

    # ==================== DOM 提取 ====================

    def _extract_from_dom(self, frame):
        """CSS 选择器从 DOM 中提取新闻"""
        selectors = [
            "div.headline-container",
            "li.news-item",
            "div[class*='feed-item']",
            ".article",
            "li.headline",
            "[class*='headline']",
            "[class*='breaking']",
            "article",
        ]

        for selector in selectors:
            try:
                elements = frame.query_selector_all(selector)
                for el in elements[:50]:
                    text = (el.inner_text() or "").strip()
                    if len(text) < 15:
                        continue

                    link_el = el.query_selector("a")
                    href = link_el.get_attribute("href") if link_el else ""

                    if href and href.startswith("/"):
                        href = "https://www.financialjuice.com" + href

                    if not href or not href.startswith("http"):
                        h = hashlib.sha256(text.encode()).hexdigest()[:12]
                        href = f"https://www.financialjuice.com/news/{h}"

                    if self._is_duplicate(href):
                        continue

                    skip = ("login", "signup", "register", "javascript", "#")
                    if any(x in href.lower() for x in skip):
                        continue

                    tickers = self._extract_tickers(text)
                    self._add_article(
                        title=text[:500],
                        summary=text[:800],
                        url=href,
                        pub_time=datetime.now(timezone.utc).isoformat(),
                        tickers=tickers,
                    )
            except Exception as e:
                logger.debug(f"DOM selector {selector} failed: {e}")

    # ==================== 数据工具方法 ====================

    @staticmethod
    def _normalize_title(title: str) -> str:
        t = re.sub(r"\d{1,2}:\d{2}\s*(AM|PM|am|pm)?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{0,2}\.?", "", title)
        return re.sub(r"[^a-z0-9]", "", t.lower())

    _JUNK_PATTERNS = re.compile(
        r"join us|go real[- ]?time|don'?t like ads|go pro|subscribe now|sign up|"
        r"free trial|premium access|upgrade your|limited time offer|need to know market risk",
        re.IGNORECASE,
    )

    def _add_article(
        self,
        title: str,
        summary: str,
        url: str,
        pub_time: str,
        tickers: List[str],
    ):
        if self._JUNK_PATTERNS.search(title):
            return
        norm = self._normalize_title(title)
        if norm and norm in self.seen_titles:
            return
        url_key = url.lower().rstrip("/")
        self.seen_urls.add(url_key)
        if norm:
            self.seen_titles.add(norm)
        self.articles.append(
            NewsArticle(
                published_at=pub_time,
                title=title[:500],
                summary=summary[:800],
                url=url,
                tags=[],
                tickers=tickers,
            )
        )

    def _is_duplicate(self, url: str) -> bool:
        return url.lower().rstrip("/") in self.seen_urls

    def _finalize_articles(self) -> List[NewsArticle]:
        def sort_key(a: NewsArticle) -> datetime:
            try:
                return datetime.fromisoformat(
                    a.published_at.replace("Z", "+00:00")
                )
            except (ValueError, TypeError):
                return datetime.min.replace(tzinfo=timezone.utc)

        self.articles.sort(key=sort_key, reverse=True)
        logger.info(
            f"FinancialJuice scrape completed: {len(self.articles)} articles fetched."
        )
        return self.articles

    # ==================== 静态工具 ====================

    @staticmethod
    def _inject_stealth_scripts(page):
        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US','en'] });
            window.chrome = { runtime: {} };
        """)

    @staticmethod
    def _flatten_json_items(obj: Any) -> list:
        if isinstance(obj, list):
            return obj
        if isinstance(obj, dict):
            for key in (
                "items", "articles", "news", "headlines",
                "data", "feeds", "results",
            ):
                if key in obj and isinstance(obj[key], list):
                    return obj[key]
        return []

    @staticmethod
    def _extract_tickers(text: str) -> List[str]:
        if not text:
            return []
        tickers = {
            g.upper()
            for match in TICKER_PATTERN.finditer(text)
            for g in match.groups()
            if g and len(g) >= 2 and g.upper() not in NON_TICKER_WORDS
        }
        return list(tickers)[:10]

    def _resolve_tickers(self, item: Dict, fallback_text: str) -> List[str]:
        tickers = (
            item.get("tickers")
            or item.get("symbols")
            or item.get("symbol")
            or []
        )
        if isinstance(tickers, str):
            tickers = [t.strip().upper() for t in tickers.split(",") if t.strip()]
        if not tickers:
            tickers = self._extract_tickers(fallback_text)
        return [t.upper() for t in tickers if isinstance(t, str) and t]

    @staticmethod
    def _parse_time(pub_val: Any) -> str:
        now = datetime.now(timezone.utc)
        if not pub_val:
            return now.isoformat()

        if isinstance(pub_val, (int, float)):
            # 毫秒时间戳
            if pub_val > 1e11:
                pub_val /= 1000
            return datetime.fromtimestamp(pub_val, tz=timezone.utc).isoformat()

        if isinstance(pub_val, str):
            text = pub_val.strip().lower()
            if "t" in text or "-" in text[:10]:
                return pub_val

            match = re.search(r"\d+", text)
            if match:
                n = int(match.group())
                if "min" in text or "m " in text:
                    return (now - timedelta(minutes=n)).isoformat()
                if "hour" in text or "h " in text:
                    return (now - timedelta(hours=n)).isoformat()

        return now.isoformat()


# ==================== 对外暴露接口 ====================


def scrape_financial_juice_news(
    headless: bool = True,
    timeout_ms: int = 30000,
) -> List[NewsArticle]:
    """
    供 webhook / scheduler 调用的兼容接口

    Returns:
        List[NewsArticle]: 爬取到的新闻列表
    """
    scraper = FinancialJuiceHomeScraper(
        headless=headless,
        timeout_ms=timeout_ms,
    )
    return scraper.scrape()
