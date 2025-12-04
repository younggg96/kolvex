"""
Twitter/X 内容爬虫服务 - 使用 Playwright 进行浏览器自动化爬取
支持手动登录和反检测措施
"""

import time
import random
from typing import List, Dict, Optional, Set
from datetime import datetime

# Playwright 相关导入
try:
    from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext

    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


# 真实的 User-Agent 列表，用于轮换
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]


def _random_sleep(min_sec: float = 1.0, max_sec: float = 3.0) -> None:
    """
    随机延迟，模拟人类行为

    Args:
        min_sec: 最小延迟秒数
        max_sec: 最大延迟秒数
    """
    time.sleep(random.uniform(min_sec, max_sec))


def _extract_tweet_text(article) -> Optional[str]:
    """
    从 article 元素中提取推文文本内容

    Args:
        article: Playwright 的 article 元素

    Returns:
        Optional[str]: 推文文本，如果提取失败返回 None
    """
    try:
        # 方法1: 使用 data-testid="tweetText" 选择器
        tweet_text_element = article.query_selector('[data-testid="tweetText"]')
        if tweet_text_element:
            return tweet_text_element.inner_text().strip()

        # 方法2: 查找 article 内的主要文本区域
        # Twitter 的推文文本通常在 lang 属性的 div 中
        lang_div = article.query_selector("div[lang]")
        if lang_div:
            return lang_div.inner_text().strip()

        # 方法3: 获取整个 article 的文本（最后手段）
        full_text = article.inner_text()
        # 清理文本，移除多余的空白
        lines = [line.strip() for line in full_text.split("\n") if line.strip()]
        if lines:
            # 跳过用户名等元信息，尝试找到主要内容
            return "\n".join(lines[2:]) if len(lines) > 2 else "\n".join(lines)

        return None
    except Exception as e:
        print(f"[警告] 提取推文文本失败: {e}")
        return None


def _extract_tweet_metadata(article) -> Dict:
    """
    从 article 元素中提取推文元数据

    Args:
        article: Playwright 的 article 元素

    Returns:
        Dict: 包含用户名、时间等元数据的字典
    """
    metadata = {
        "user_name": None,
        "user_display_name": None,
        "created_at": None,
        "permalink": None,
        "like_count": 0,
        "retweet_count": 0,
        "reply_count": 0,
    }

    try:
        # 提取用户名 (handle)
        user_link = article.query_selector('a[href*="/status/"]')
        if user_link:
            href = user_link.get_attribute("href")
            if href:
                parts = href.split("/")
                if len(parts) >= 2:
                    metadata["user_name"] = parts[1] if parts[1] else parts[0]
                metadata["permalink"] = (
                    f"https://x.com{href}" if href.startswith("/") else href
                )

        # 提取用户显示名称
        user_name_element = article.query_selector('[data-testid="User-Name"]')
        if user_name_element:
            spans = user_name_element.query_selector_all("span")
            if spans:
                metadata["user_display_name"] = spans[0].inner_text().strip()

        # 提取时间
        time_element = article.query_selector("time")
        if time_element:
            datetime_str = time_element.get_attribute("datetime")
            if datetime_str:
                metadata["created_at"] = datetime_str

        # 提取互动数据（点赞、转发、回复）
        # 这些数据位于 aria-label 属性中
        def _parse_count(selector: str, article) -> int:
            try:
                element = article.query_selector(selector)
                if element:
                    aria_label = element.get_attribute("aria-label")
                    if aria_label:
                        # 解析类似 "123 Likes" 的格式
                        parts = aria_label.split()
                        if parts and parts[0].replace(",", "").isdigit():
                            return int(parts[0].replace(",", ""))
            except:
                pass
            return 0

        metadata["like_count"] = _parse_count('[data-testid="like"]', article)
        metadata["retweet_count"] = _parse_count('[data-testid="retweet"]', article)
        metadata["reply_count"] = _parse_count('[data-testid="reply"]', article)

    except Exception as e:
        print(f"[警告] 提取元数据失败: {e}")

    return metadata


def scrape_x_user(
    username: str,
    max_posts: int = 20,
    login_timeout: int = 120,
    headless: bool = True,
    save_cookies: bool = True,
    cookies_file: Optional[str] = None,
) -> List[Dict]:
    """
    使用 Playwright 爬取指定 X (Twitter) 用户的推文

    该函数会启动一个可见的浏览器窗口，让用户可以手动处理登录和验证码。
    爬取过程会自动滚动页面并收集推文，直到达到目标数量或无法加载更多内容。

    Args:
        username: X 用户名（不带 @ 符号）
        max_posts: 最大爬取推文数量（默认 20）
        login_timeout: 等待登录的超时时间（秒）（默认 120）
        headless: 是否使用无头模式（默认 False，建议保持 False 以便手动登录）
        save_cookies: 是否保存 cookies 以便下次登录（默认 True）
        cookies_file: cookies 文件路径（默认为 None，使用默认路径）

    Returns:
        List[Dict]: 爬取到的推文列表，每个推文包含以下字段：
            - text: 推文文本
            - user_name: 用户名
            - user_display_name: 显示名称
            - created_at: 创建时间
            - permalink: 推文链接
            - like_count: 点赞数
            - retweet_count: 转发数
            - reply_count: 回复数

    Raises:
        RuntimeError: 如果 Playwright 未安装
        TimeoutError: 如果登录超时

    Example:
        >>> tweets = scrape_x_user("elonmusk", max_posts=10)
        >>> for tweet in tweets:
        ...     print(tweet["text"])

    注意:
        1. 首次运行时需要手动登录 X 账户
        2. 建议在有图形界面的环境中运行（headless=False）
        3. 如果遇到验证码，需要手动完成验证
    """
    if not PLAYWRIGHT_AVAILABLE:
        raise RuntimeError(
            "Playwright 未安装。请运行: pip install playwright && playwright install chromium"
        )

    # 清理用户名
    clean_username = username.lstrip("@").strip()
    target_url = f"https://x.com/{clean_username}"

    # 默认 cookies 文件路径
    if cookies_file is None:
        cookies_file = f".x_cookies_{clean_username}.json"

    collected_tweets: List[Dict] = []
    seen_texts: Set[str] = set()  # 用于去重

    print(f"[信息] 开始爬取用户 @{clean_username} 的推文...")
    print(f"[信息] 目标数量: {max_posts}")
    print(f"[信息] 浏览器模式: {'无头' if headless else '有头'}")

    with sync_playwright() as p:
        # 选择随机 User-Agent
        user_agent = random.choice(USER_AGENTS)

        # 启动浏览器
        # headless=False 是必须的，以便用户可以手动登录
        browser: Browser = p.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",  # 隐藏自动化特征
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ],
        )

        # 创建浏览器上下文
        context: BrowserContext = browser.new_context(
            user_agent=user_agent,
            viewport={"width": 1280, "height": 900},
            locale="en-US",
            timezone_id="America/New_York",
        )

        # 尝试加载已保存的 cookies
        try:
            import json
            import os

            if os.path.exists(cookies_file):
                with open(cookies_file, "r") as f:
                    cookies = json.load(f)
                    context.add_cookies(cookies)
                    print(f"[信息] 已加载保存的 cookies")
        except Exception as e:
            print(f"[警告] 无法加载 cookies: {e}")

        page: Page = context.new_page()

        # 添加反检测脚本
        page.add_init_script(
            """
            // 隐藏 webdriver 属性
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // 模拟真实的 plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            // 模拟真实的 languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
        """
        )

        try:
            # 导航到目标用户页面
            print(f"[信息] 正在导航到 {target_url}...")
            page.goto(target_url, wait_until="domcontentloaded", timeout=60000)

            _random_sleep(2, 4)

            # ========================================
            # 登录检测和等待
            # ========================================
            # X.com 如果未登录会重定向到登录页面或显示登录提示
            # 我们通过检测 <article> 标签（代表推文）来判断是否成功进入用户页面

            print("\n" + "=" * 60)
            print("⚠️  如果看到登录页面，请手动完成登录！")
            print("⚠️  完成登录后，脚本会自动继续爬取。")
            print(f"⚠️  等待超时: {login_timeout} 秒")
            print("=" * 60 + "\n")

            try:
                # 等待 article 标签出现，这表示推文已加载
                # 使用较长的超时时间给用户手动登录
                page.wait_for_selector(
                    "article",
                    timeout=login_timeout * 1000,  # 转换为毫秒
                    state="visible",
                )
                print("[成功] 检测到推文，开始爬取...")

            except Exception as e:
                print(f"[错误] 等待推文超时: {e}")
                print("[提示] 可能原因: 1) 登录超时 2) 用户不存在 3) 网络问题")
                browser.close()
                return []

            # 保存登录后的 cookies
            if save_cookies:
                try:
                    cookies = context.cookies()
                    import json

                    with open(cookies_file, "w") as f:
                        json.dump(cookies, f)
                    print(f"[信息] Cookies 已保存到 {cookies_file}")
                except Exception as e:
                    print(f"[警告] 保存 cookies 失败: {e}")

            _random_sleep(1, 2)

            # ========================================
            # 滚动和爬取逻辑
            # ========================================
            no_new_content_count = 0
            max_no_new_content = 3  # 连续 3 次没有新内容则停止
            scroll_count = 0
            max_scrolls = 50  # 最大滚动次数，防止无限循环

            while len(collected_tweets) < max_posts and scroll_count < max_scrolls:
                scroll_count += 1

                # 获取当前页面上的所有推文 article
                articles = page.query_selector_all("article")

                new_tweets_in_batch = 0

                for article in articles:
                    if len(collected_tweets) >= max_posts:
                        break

                    # 提取推文文本
                    text = _extract_tweet_text(article)

                    if text and text not in seen_texts:
                        seen_texts.add(text)

                        # 提取元数据
                        metadata = _extract_tweet_metadata(article)

                        tweet_data = {
                            "text": text,
                            "user_name": metadata["user_name"] or clean_username,
                            "user_display_name": metadata["user_display_name"],
                            "created_at": metadata["created_at"],
                            "permalink": metadata["permalink"],
                            "like_count": metadata["like_count"],
                            "retweet_count": metadata["retweet_count"],
                            "reply_count": metadata["reply_count"],
                            "scraped_at": datetime.utcnow().isoformat(),
                            "scrape_method": "playwright",
                        }

                        collected_tweets.append(tweet_data)
                        new_tweets_in_batch += 1

                        # 实时打印爬取进度
                        print(f"\n[{len(collected_tweets)}/{max_posts}] 新推文:")
                        print(f"  文本: {text[:100]}{'...' if len(text) > 100 else ''}")
                        if metadata["created_at"]:
                            print(f"  时间: {metadata['created_at']}")

                # 检查是否有新内容
                if new_tweets_in_batch == 0:
                    no_new_content_count += 1
                    print(
                        f"[信息] 本次滚动无新内容 ({no_new_content_count}/{max_no_new_content})"
                    )

                    if no_new_content_count >= max_no_new_content:
                        print("[信息] 连续多次无新内容，停止爬取")
                        break
                else:
                    no_new_content_count = 0  # 重置计数器

                # 如果已达到目标数量，退出循环
                if len(collected_tweets) >= max_posts:
                    print(f"[成功] 已达到目标数量 {max_posts}，停止爬取")
                    break

                # 滚动页面
                print(f"[信息] 滚动页面 (第 {scroll_count} 次)...")

                # 使用更自然的滚动方式
                page.evaluate(
                    """
                    window.scrollBy({
                        top: window.innerHeight * 0.8,
                        behavior: 'smooth'
                    });
                """
                )

                # 随机延迟，模拟人类行为
                _random_sleep(2.0, 4.0)

                # 等待新内容加载
                try:
                    page.wait_for_load_state("networkidle", timeout=5000)
                except:
                    pass  # 超时也继续

            print(f"\n[完成] 共爬取 {len(collected_tweets)} 条推文")

        except Exception as e:
            print(f"[错误] 爬取过程出错: {e}")
            import traceback

            traceback.print_exc()

        finally:
            # 给用户一些时间查看浏览器
            if not headless:
                print("\n[信息] 浏览器将在 3 秒后关闭...")
                time.sleep(3)
            browser.close()

    return collected_tweets


def scrape_x_search(
    query: str,
    max_posts: int = 20,
    login_timeout: int = 120,
    headless: bool = False,
) -> List[Dict]:
    """
    使用 Playwright 搜索并爬取 X (Twitter) 推文

    Args:
        query: 搜索关键词或高级搜索语句
        max_posts: 最大爬取推文数量
        login_timeout: 等待登录的超时时间（秒）
        headless: 是否使用无头模式

    Returns:
        List[Dict]: 爬取到的推文列表

    Example:
        >>> tweets = scrape_x_search("TSLA stock", max_posts=10)
    """
    if not PLAYWRIGHT_AVAILABLE:
        raise RuntimeError(
            "Playwright 未安装。请运行: pip install playwright && playwright install chromium"
        )

    # URL 编码搜索词
    import urllib.parse

    encoded_query = urllib.parse.quote(query)
    target_url = f"https://x.com/search?q={encoded_query}&src=typed_query&f=live"

    collected_tweets: List[Dict] = []
    seen_texts: Set[str] = set()

    print(f"[信息] 开始搜索: {query}")
    print(f"[信息] 目标数量: {max_posts}")

    with sync_playwright() as p:
        user_agent = random.choice(USER_AGENTS)

        browser: Browser = p.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ],
        )

        context: BrowserContext = browser.new_context(
            user_agent=user_agent,
            viewport={"width": 1280, "height": 900},
            locale="en-US",
            timezone_id="America/New_York",
        )

        # 尝试加载通用 cookies
        try:
            import json
            import os

            cookies_file = ".x_cookies_search.json"
            if os.path.exists(cookies_file):
                with open(cookies_file, "r") as f:
                    cookies = json.load(f)
                    context.add_cookies(cookies)
                    print(f"[信息] 已加载保存的 cookies")
        except Exception as e:
            print(f"[警告] 无法加载 cookies: {e}")

        page: Page = context.new_page()

        page.add_init_script(
            """
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """
        )

        try:
            print(f"[信息] 正在导航到搜索页面...")
            page.goto(target_url, wait_until="domcontentloaded", timeout=60000)

            _random_sleep(2, 4)

            print("\n" + "=" * 60)
            print("⚠️  如果看到登录页面，请手动完成登录！")
            print(f"⚠️  等待超时: {login_timeout} 秒")
            print("=" * 60 + "\n")

            try:
                page.wait_for_selector(
                    "article", timeout=login_timeout * 1000, state="visible"
                )
                print("[成功] 检测到搜索结果，开始爬取...")
            except Exception as e:
                print(f"[错误] 等待搜索结果超时: {e}")
                browser.close()
                return []

            # 保存 cookies
            try:
                cookies = context.cookies()
                import json

                with open(".x_cookies_search.json", "w") as f:
                    json.dump(cookies, f)
            except:
                pass

            _random_sleep(1, 2)

            # 滚动和爬取
            no_new_content_count = 0
            max_no_new_content = 3
            scroll_count = 0
            max_scrolls = 50

            while len(collected_tweets) < max_posts and scroll_count < max_scrolls:
                scroll_count += 1

                articles = page.query_selector_all("article")
                new_tweets_in_batch = 0

                for article in articles:
                    if len(collected_tweets) >= max_posts:
                        break

                    text = _extract_tweet_text(article)

                    if text and text not in seen_texts:
                        seen_texts.add(text)
                        metadata = _extract_tweet_metadata(article)

                        tweet_data = {
                            "text": text,
                            "user_name": metadata["user_name"],
                            "user_display_name": metadata["user_display_name"],
                            "created_at": metadata["created_at"],
                            "permalink": metadata["permalink"],
                            "like_count": metadata["like_count"],
                            "retweet_count": metadata["retweet_count"],
                            "reply_count": metadata["reply_count"],
                            "scraped_at": datetime.utcnow().isoformat(),
                            "scrape_method": "playwright",
                            "search_query": query,
                        }

                        collected_tweets.append(tweet_data)
                        new_tweets_in_batch += 1

                        print(f"\n[{len(collected_tweets)}/{max_posts}] 新推文:")
                        print(f"  文本: {text[:100]}{'...' if len(text) > 100 else ''}")

                if new_tweets_in_batch == 0:
                    no_new_content_count += 1
                    if no_new_content_count >= max_no_new_content:
                        print("[信息] 连续多次无新内容，停止爬取")
                        break
                else:
                    no_new_content_count = 0

                if len(collected_tweets) >= max_posts:
                    break

                page.evaluate(
                    """
                    window.scrollBy({
                        top: window.innerHeight * 0.8,
                        behavior: 'smooth'
                    });
                """
                )

                _random_sleep(2.0, 4.0)

                try:
                    page.wait_for_load_state("networkidle", timeout=5000)
                except:
                    pass

            print(f"\n[完成] 共爬取 {len(collected_tweets)} 条推文")

        except Exception as e:
            print(f"[错误] 爬取过程出错: {e}")

        finally:
            if not headless:
                time.sleep(3)
            browser.close()

    return collected_tweets


# ============================================================
# 用于 API 调用的异步包装器
# ============================================================


def playwright_scrape_user_sync(
    username: str,
    max_posts: int = 20,
    headless: bool = True,  # API 调用默认使用无头模式
) -> List[Dict]:
    """
    供 API 使用的同步爬取函数（无头模式）

    注意：无头模式可能会被 X 检测到，建议先在有头模式下登录保存 cookies

    Args:
        username: X 用户名
        max_posts: 最大爬取数量
        headless: 是否使用无头模式

    Returns:
        List[Dict]: 爬取到的推文列表
    """
    return scrape_x_user(
        username=username,
        max_posts=max_posts,
        login_timeout=30,  # API 模式缩短超时
        headless=headless,
        save_cookies=True,
    )


def playwright_scrape_search_sync(
    query: str,
    max_posts: int = 20,
    headless: bool = True,
) -> List[Dict]:
    """
    供 API 使用的同步搜索函数（无头模式）

    Args:
        query: 搜索关键词
        max_posts: 最大爬取数量
        headless: 是否使用无头模式

    Returns:
        List[Dict]: 爬取到的推文列表
    """
    return scrape_x_search(
        query=query,
        max_posts=max_posts,
        login_timeout=30,
        headless=headless,
    )


def check_playwright_available() -> bool:
    """检查 Playwright 是否可用"""
    return PLAYWRIGHT_AVAILABLE


# ============================================================
# CLI 入口点（直接运行此脚本时使用）
# ============================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="X (Twitter) Playwright 爬虫")
    parser.add_argument(
        "username",
        type=str,
        help="要爬取的 X 用户名（不带 @）",
    )
    parser.add_argument(
        "-n",
        "--max-posts",
        type=int,
        default=20,
        help="最大爬取推文数量（默认 20）",
    )
    parser.add_argument(
        "-t",
        "--timeout",
        type=int,
        default=120,
        help="登录等待超时时间（秒）（默认 120）",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="使用无头模式（不推荐，会被检测）",
    )

    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  X (Twitter) Playwright 爬虫")
    print("=" * 60)
    print(f"  用户: @{args.username}")
    print(f"  目标数量: {args.max_posts}")
    print(f"  超时时间: {args.timeout} 秒")
    print(f"  无头模式: {args.headless}")
    print("=" * 60 + "\n")

    tweets = scrape_x_user(
        username=args.username,
        max_posts=args.max_posts,
        login_timeout=args.timeout,
        headless=args.headless,
    )

    print("\n" + "=" * 60)
    print(f"  爬取完成！共 {len(tweets)} 条推文")
    print("=" * 60)

    for i, tweet in enumerate(tweets, 1):
        print(f"\n--- 推文 {i} ---")
        print(f"文本: {tweet['text'][:200]}{'...' if len(tweet['text']) > 200 else ''}")
        print(f"用户: @{tweet['user_name']}")
        print(f"时间: {tweet['created_at']}")
        print(f"链接: {tweet['permalink']}")
        print(
            f"点赞: {tweet['like_count']} | 转发: {tweet['retweet_count']} | 回复: {tweet['reply_count']}"
        )
