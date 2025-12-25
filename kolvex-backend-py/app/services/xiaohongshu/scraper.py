"""
核心爬虫类 - XiaohongshuScraper
"""

import random
import time
import re
from typing import List, Dict, Set, Tuple, Optional
from urllib.parse import quote, urljoin

# Playwright 相关导入
try:
    from playwright.sync_api import sync_playwright, Page

    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    Page = None

from .config import (
    COOKIES_FILE,
    USER_AGENTS,
    BASE_URL,
    SEARCH_URL,
    DEFAULT_MAX_POSTS,
    DEFAULT_DELAY_BETWEEN_POSTS,
    DEFAULT_DELAY_DURING_SCROLL,
    DEFAULT_MAX_SCROLLS,
    PAGE_LOAD_TIMEOUT,
    ELEMENT_WAIT_TIMEOUT,
    NETWORK_IDLE_TIMEOUT,
    SETUP_LOGIN_TIMEOUT,
    BROWSER_ARGS,
    BROWSER_VIEWPORT,
    BROWSER_LOCALE,
    BROWSER_TIMEZONE,
    SELECTORS,
)
from .database import (
    get_supabase_client,
    insert_post,
    get_stats,
    note_id_exists,
)
from .extractors import (
    extract_note_card,
    extract_note_detail,
    extract_all_note_cards,
    merge_note_data,
    extract_note_id_from_url,
)


def random_sleep(min_sec: float, max_sec: float, message: str = None) -> None:
    """
    随机延迟，模拟人类行为

    Args:
        min_sec: 最小延迟秒数
        max_sec: 最大延迟秒数
        message: 可选的提示信息
    """
    delay = random.uniform(min_sec, max_sec)
    if message:
        print(f"⏳ {message} (等待 {delay:.1f}s)")
    time.sleep(delay)


def load_cookies(cookies_file: str = None) -> Optional[List[Dict]]:
    """加载保存的 cookies"""
    import os
    import json

    if cookies_file is None:
        cookies_file = str(COOKIES_FILE)

    if os.path.exists(cookies_file):
        try:
            with open(cookies_file, "r") as f:
                cookies = json.load(f)
                print(f"🍪 已加载 cookies: {cookies_file}")
                return cookies
        except Exception as e:
            print(f"⚠️ 加载 cookies 失败: {e}")
    return None


def save_cookies(cookies: List[Dict], cookies_file: str = None) -> bool:
    """保存 cookies 到文件"""
    import json

    if cookies_file is None:
        cookies_file = str(COOKIES_FILE)

    try:
        with open(cookies_file, "w") as f:
            json.dump(cookies, f, indent=2)
        print(f"🍪 Cookies 已保存到: {cookies_file}")
        return True
    except Exception as e:
        print(f"⚠️ 保存 cookies 失败: {e}")
        return False


class XiaohongshuScraper:
    """
    小红书美股帖子爬虫类

    支持两种模式:
    1. Setup Mode: headless=False，用于手动登录并保存 cookies
    2. Scrape Mode: 利用已保存的 cookies 进行批量爬取
    """

    def __init__(
        self,
        cookies_file: str = None,
        headless: bool = False,
        max_posts: int = DEFAULT_MAX_POSTS,
        delay_between_posts: Tuple[float, float] = DEFAULT_DELAY_BETWEEN_POSTS,
        delay_during_scroll: Tuple[float, float] = DEFAULT_DELAY_DURING_SCROLL,
        fetch_details: bool = True,
    ):
        """
        初始化爬虫

        Args:
            cookies_file: cookies 文件路径
            headless: 是否使用无头模式
            max_posts: 每次搜索最多爬取的帖子数量
            delay_between_posts: 帖子间延迟范围 (min, max) 秒
            delay_during_scroll: 滚动时延迟范围 (min, max) 秒
            fetch_details: 是否抓取详情页（会更慢但数据更完整）
        """
        if not PLAYWRIGHT_AVAILABLE:
            raise RuntimeError(
                "❌ Playwright 未安装。请运行:\n"
                "   pip install playwright\n"
                "   playwright install chromium"
            )

        self.cookies_file = str(cookies_file or COOKIES_FILE)
        self.headless = headless
        self.max_posts = max_posts
        self.delay_between_posts = delay_between_posts
        self.delay_during_scroll = delay_during_scroll
        self.fetch_details = fetch_details

        # 统计信息
        self.stats = {
            "keywords_processed": 0,
            "posts_scraped": 0,
            "posts_new": 0,
            "posts_duplicate": 0,
            "posts_failed": 0,
        }

        # 初始化 Supabase 客户端
        self.supabase = get_supabase_client()
        if self.supabase:
            print("✅ Supabase 连接成功")
        else:
            print("⚠️ Supabase 未连接，将只打印帖子而不保存")

    def setup_mode(self, timeout: int = SETUP_LOGIN_TIMEOUT) -> bool:
        """
        Setup 模式: 打开浏览器让用户手动登录

        增强版本：支持自动检测 + 手动确认两种方式

        Args:
            timeout: 等待登录的超时时间（秒）

        Returns:
            bool: 登录成功返回 True
        """
        print("\n" + "=" * 60)
        print("🔧 SETUP MODE - 请手动登录小红书")
        print("=" * 60)

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=False,  # 必须有头模式才能看到浏览器
                args=BROWSER_ARGS,
            )

            context = browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport=BROWSER_VIEWPORT,
                locale=BROWSER_LOCALE,
                timezone_id=BROWSER_TIMEZONE,
            )

            page = context.new_page()
            self._add_stealth_scripts(page)

            try:
                print("📱 正在打开小红书...")
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)

                print("\n" + "⚠️ " * 20)
                print("【重要提示】")
                print("1. 请在弹出的浏览器中，使用手机小红书 App 扫码登录")
                print("2. 登录成功后，程序会自动检测。")
                print(
                    "3. 如果程序没有反应，请在下方控制台按【回车键】强制保存 Cookie！"
                )
                print("⚠️ " * 20 + "\n")

                # 方法 A: 自动检测登录状态
                try:
                    page.wait_for_selector(
                        '.user-avatar, .user-info, [class*="user-menu"], .side-bar .user',
                        timeout=timeout * 1000,
                        state="visible",
                    )
                    print("✅ 自动检测到已登录！")
                except Exception:
                    # 方法 B: 手动确认（兜底方案）
                    print("⏳ 自动检测超时，等待用户手动确认...")
                    input("👉 登录完成后，请在此处按【回车键】继续...")

                # 保存 cookies
                cookies = context.cookies()
                if save_cookies(cookies, self.cookies_file):
                    print(f"✅ Cookies 已保存成功！文件路径: {self.cookies_file}")
                    return True
                else:
                    print("❌ Cookies 保存失败")
                    return False

            except Exception as e:
                print(f"❌ 发生错误: {e}")
                return False

            finally:
                print("\n浏览器将在 3 秒后关闭...")
                time.sleep(3)
                browser.close()

        return False

    def _wait_for_manual_login(self, context, page: "Page", timeout: int = 300) -> bool:
        """
        等待用户手动扫码登录

        当检测到登录弹窗时，暂停爬取，等待用户扫码登录后继续

        Args:
            context: 浏览器上下文（用于保存 cookies）
            page: Playwright 页面对象
            timeout: 等待超时时间（秒）

        Returns:
            bool: 登录成功返回 True
        """
        print("\n" + "=" * 60)
        print("🔑 检测到需要登录！")
        print("=" * 60)
        print("\n【请按以下步骤操作】")
        print("1. 在浏览器中使用手机小红书 App 扫描二维码登录")
        print("2. 登录成功后，程序会自动检测")
        print("3. 如果程序没有反应，请在终端按【回车键】强制继续")
        print("\n" + "=" * 60 + "\n")

        try:
            # 方法 A: 自动检测登录成功
            try:
                page.wait_for_selector(
                    '.user-avatar, .user-info, [class*="user-menu"], .side-bar .user',
                    timeout=timeout * 1000,
                    state="visible",
                )
                print("✅ 自动检测到已登录！")
            except Exception:
                # 方法 B: 手动确认（兜底方案）
                print("⏳ 自动检测超时，等待用户手动确认...")
                input("👉 登录完成后，请在此处按【回车键】继续...")

            # 保存 cookies
            cookies = context.cookies()
            if save_cookies(cookies, self.cookies_file):
                print(f"✅ Cookies 已保存！文件路径: {self.cookies_file}")
                print("🚀 继续爬取...\n")
                return True
            else:
                print("⚠️ Cookies 保存失败，但将继续尝试爬取")
                return True

        except Exception as e:
            print(f"❌ 登录过程出错: {e}")
            return False

    def _check_login_required(self, page: "Page") -> bool:
        """
        检测页面是否需要登录

        Args:
            page: Playwright 页面对象

        Returns:
            bool: 需要登录返回 True
        """
        # 检测登录弹窗选择器
        login_popup_selectors = [
            '[class*="login-modal"]',
            '[class*="login-container"]',
            '[class*="login-dialog"]',
            '[class*="login-popup"]',
        ]

        for selector in login_popup_selectors:
            try:
                popup = page.query_selector(selector)
                if popup and popup.is_visible():
                    return True
            except Exception:
                continue

        # 检查页面内容
        try:
            page_html = page.content()
            if (
                "登录后查看" in page_html
                or "请登录" in page_html
                or "登录后查看搜索结果" in page_html
            ):
                return True
        except Exception:
            pass

        return False

    def _handle_login_if_needed(self, context, page: "Page") -> bool:
        """
        如果需要登录，则等待用户手动登录

        Args:
            context: 浏览器上下文
            page: Playwright 页面对象

        Returns:
            bool: 处理成功返回 True
        """
        if self._check_login_required(page):
            return self._wait_for_manual_login(context, page)
        return True

    def _add_stealth_scripts(self, page: "Page") -> None:
        """添加反检测脚本"""
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
                get: () => ['zh-CN', 'zh', 'en-US', 'en']
            });
            
            // 隐藏自动化痕迹
            window.chrome = { runtime: {} };
            
            // 覆盖 permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        """
        )

    def _build_search_url(self, keyword: str) -> str:
        """
        构建搜索 URL

        Args:
            keyword: 搜索关键词

        Returns:
            str: 完整的搜索 URL
        """
        encoded_keyword = quote(keyword)
        return f"{SEARCH_URL}?keyword={encoded_keyword}&source=unknown"

    def _scrape_search_results(self, context, page: "Page", keyword: str) -> List[Dict]:
        """
        爬取搜索结果页面

        Args:
            context: 浏览器上下文（用于保存 cookies）
            page: Playwright 页面对象
            keyword: 搜索关键词

        Returns:
            List[Dict]: 爬取到的帖子列表
        """
        search_url = self._build_search_url(keyword)
        collected_posts = []
        seen_note_ids: Set[str] = set()

        print(f"\n🔍 搜索关键词: {keyword}")
        print(f"   URL: {search_url}")

        try:
            page.goto(
                search_url, wait_until="domcontentloaded", timeout=PAGE_LOAD_TIMEOUT
            )
            random_sleep(3, 5)

            # 🔑 检测是否需要登录，如需要则等待用户手动扫码
            if self._check_login_required(page):
                self._wait_for_manual_login(context, page)
                # 登录后刷新页面
                page.goto(
                    search_url, wait_until="domcontentloaded", timeout=PAGE_LOAD_TIMEOUT
                )
                random_sleep(2, 3)

            # 等待搜索结果加载
            try:
                # 尝试多种选择器
                selectors_to_try = [
                    "section.note-item",
                    ".note-item",
                    '[class*="note-item"]',
                    ".feeds-page section",
                    'a[href*="/explore/"]',
                ]

                found = False
                for selector in selectors_to_try:
                    try:
                        page.wait_for_selector(
                            selector, timeout=ELEMENT_WAIT_TIMEOUT, state="visible"
                        )
                        found = True
                        print(f"   ✅ 找到内容选择器: {selector}")
                        break
                    except Exception:
                        continue

                if not found:
                    # 再次检查是否需要登录
                    if self._check_login_required(page):
                        print("   🔑 仍需要登录，等待用户扫码...")
                        self._wait_for_manual_login(context, page)
                        # 登录后刷新页面
                        page.goto(
                            search_url,
                            wait_until="domcontentloaded",
                            timeout=PAGE_LOAD_TIMEOUT,
                        )
                        random_sleep(2, 3)

                        # 再次尝试查找内容
                        for selector in selectors_to_try:
                            try:
                                page.wait_for_selector(
                                    selector, timeout=5000, state="visible"
                                )
                                found = True
                                print(f"   ✅ 登录后找到内容: {selector}")
                                break
                            except Exception:
                                continue

                    if not found:
                        # 截图调试
                        debug_path = f"debug_search_{keyword[:10]}.png"
                        page.screenshot(path=debug_path)
                        print(f"   ⚠️ 未找到搜索结果，截图已保存: {debug_path}")
                        print(f"   💡 提示: 可能需要登录，请运行 --login 进行登录")
                        return []

            except Exception as e:
                print(f"   ⚠️ 加载搜索结果超时: {e}")
                return []

            # 滚动和爬取
            scroll_count = 0
            no_new_count = 0

            while (
                len(collected_posts) < self.max_posts
                and scroll_count < DEFAULT_MAX_SCROLLS
            ):
                scroll_count += 1

                # 使用 JS 批量提取所有笔记卡片（避免元素失效问题）
                cards_data = extract_all_note_cards(page)

                new_in_batch = 0

                for card_data in cards_data:
                    if len(collected_posts) >= self.max_posts:
                        break

                    try:
                        note_id = card_data.get("note_id")
                        if not note_id or note_id in seen_note_ids:
                            continue

                        seen_note_ids.add(note_id)
                        card_data["search_keyword"] = keyword

                        # 检查数据库是否已存在
                        if self.supabase and note_id_exists(self.supabase, note_id):
                            self.stats["posts_duplicate"] += 1
                            continue

                        # 是否获取详情
                        if self.fetch_details and card_data.get("permalink"):
                            print(
                                f"   📖 [{len(collected_posts)+1}/{self.max_posts}] 获取: {card_data.get('title', '')[:30]}..."
                            )
                            detail_data = self._fetch_note_detail(
                                context, page, card_data["permalink"]
                            )
                            if detail_data:
                                card_data = merge_note_data(card_data, detail_data)
                            random_sleep(*self.delay_between_posts)

                        collected_posts.append(card_data)
                        new_in_batch += 1

                        # 保存到 Supabase（含 AI 分析）
                        if self.supabase:
                            inserted, post_id = insert_post(self.supabase, card_data)
                            if inserted:
                                self.stats["posts_new"] += 1
                                print(
                                    f"   ✅ [{len(collected_posts)}/{self.max_posts}] {card_data.get('title', '')[:40]}..."
                                )
                            else:
                                self.stats["posts_duplicate"] += 1
                        else:
                            print(
                                f"   📝 [{len(collected_posts)}/{self.max_posts}] {card_data.get('title', '')[:40]}..."
                            )

                    except Exception as e:
                        print(f"   ⚠️ 处理卡片失败: {e}")
                        self.stats["posts_failed"] += 1
                        continue

                if new_in_batch == 0:
                    no_new_count += 1
                    if no_new_count >= 3:
                        print(f"   ℹ️ 连续 {no_new_count} 次无新内容，停止滚动")
                        break
                else:
                    no_new_count = 0

                if len(collected_posts) >= self.max_posts:
                    break

                # 滚动页面
                page.evaluate(
                    """
                    window.scrollBy({
                        top: window.innerHeight * 0.8,
                        behavior: 'smooth'
                    });
                """
                )

                random_sleep(*self.delay_during_scroll)

                try:
                    page.wait_for_load_state(
                        "networkidle", timeout=NETWORK_IDLE_TIMEOUT
                    )
                except Exception:
                    pass

            self.stats["posts_scraped"] += len(collected_posts)
            print(f"\n   📊 关键词 '{keyword}': 爬取 {len(collected_posts)} 条帖子")

        except Exception as e:
            print(f"   ❌ 爬取失败: {e}")
            # 截图保存错误现场
            try:
                page.screenshot(path=f"error_search_{keyword[:10]}.png")
            except Exception:
                pass

        return collected_posts

    def _fetch_note_detail(self, context, page: "Page", url: str) -> Optional[Dict]:
        """
        获取笔记详情页内容

        Args:
            context: 浏览器上下文（用于保存 cookies）
            page: Playwright 页面对象
            url: 笔记详情页 URL

        Returns:
            Optional[Dict]: 详情数据
        """
        # 保存当前 URL 以便返回
        original_url = page.url

        try:
            page.goto(url, wait_until="domcontentloaded", timeout=PAGE_LOAD_TIMEOUT)
            random_sleep(2, 4)

            # 检测是否需要登录
            if self._check_login_required(page):
                self._wait_for_manual_login(context, page)
                # 重新加载详情页
                page.goto(url, wait_until="domcontentloaded", timeout=PAGE_LOAD_TIMEOUT)
                random_sleep(1, 2)

            detail_data = extract_note_detail(page)
            return detail_data

        except Exception as e:
            print(f"      ⚠️ 获取详情失败: {e}")
            return None

        finally:
            # 返回搜索结果页面
            try:
                page.goto(
                    original_url,
                    wait_until="domcontentloaded",
                    timeout=PAGE_LOAD_TIMEOUT,
                )
                random_sleep(1, 2)
            except Exception:
                pass

    def scrape(self, keywords: List[str]) -> Dict:
        """
        爬取多个关键词的搜索结果

        Args:
            keywords: 搜索关键词列表

        Returns:
            Dict: 统计信息
        """
        if not keywords:
            print("❌ 没有要搜索的关键词")
            return self.stats

        # 检查 cookies
        cookies = load_cookies(self.cookies_file)
        if cookies is None:
            print("\n⚠️ 未找到 cookies 文件，将以游客模式运行（可能功能受限）")
            print("建议先运行 Setup Mode 进行登录:")
            print("   python -m app.services.xiaohongshu --setup")

        print("\n" + "=" * 60)
        print(f"🚀 开始爬取小红书美股帖子")
        print(f"📋 关键词: {', '.join(keywords)}")
        print(f"📝 每关键词最多: {self.max_posts} 条帖子")
        print(f"📖 获取详情: {'是' if self.fetch_details else '否'}")
        print(f"💾 存储: {'Supabase' if self.supabase else '仅打印'}")
        print("=" * 60)

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=self.headless,
                args=BROWSER_ARGS,
            )

            context = browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport=BROWSER_VIEWPORT,
                locale=BROWSER_LOCALE,
                timezone_id=BROWSER_TIMEZONE,
            )

            # 加载 cookies（如果有）
            if cookies:
                context.add_cookies(cookies)

            page = context.new_page()
            self._add_stealth_scripts(page)

            # 保存 context 引用供内部方法使用
            self._current_context = context

            try:
                for i, keyword in enumerate(keywords, 1):
                    print(f"\n[{i}/{len(keywords)}] 🔎 关键词: {keyword}")

                    self._scrape_search_results(context, page, keyword)
                    self.stats["keywords_processed"] += 1

                    # 关键词间延迟
                    if i < len(keywords):
                        random_sleep(5, 10, "切换到下一个关键词前等待")

            except KeyboardInterrupt:
                print("\n\n⚠️ 用户中断，正在保存数据...")

            except Exception as e:
                print(f"\n❌ 爬取过程出错: {e}")

            finally:
                # 更新 cookies
                try:
                    new_cookies = context.cookies()
                    save_cookies(new_cookies, self.cookies_file)
                except Exception:
                    pass

                browser.close()

        # 打印最终统计
        self._print_final_stats()

        return self.stats

    def _print_final_stats(self) -> None:
        """打印最终统计信息"""
        print("\n" + "=" * 60)
        print("📊 爬取完成！统计信息:")
        print("=" * 60)
        print(f"  🔍 处理关键词: {self.stats['keywords_processed']}")
        print(f"  📝 爬取帖子: {self.stats['posts_scraped']}")
        print(f"  🆕 新增帖子: {self.stats['posts_new']}")
        print(f"  📋 重复帖子: {self.stats['posts_duplicate']}")
        print(f"  ❌ 失败帖子: {self.stats['posts_failed']}")
        print("=" * 60)

        # 数据库统计
        if self.supabase:
            db_stats = get_stats(self.supabase)
            print(f"\n📦 Supabase 数据库总计:")
            print(f"  📝 总帖子数: {db_stats['total']}")
            print(f"  📈 股票相关: {db_stats.get('stock_related', 0)}")

            if db_stats.get("by_keyword"):
                print(f"\n📋 按关键词统计:")
                for kw, count in list(db_stats["by_keyword"].items())[:10]:
                    print(f"  '{kw}': {count}")

    def close(self) -> None:
        """关闭资源（保留接口兼容性）"""
        pass


# ============================================================
# 直接运行入口
# ============================================================
if __name__ == "__main__":
    import argparse
    import sys

    # 创建命令行参数解析器
    parser = argparse.ArgumentParser(description="小红书采集工具")

    # 添加 --login 参数
    parser.add_argument(
        "--login",
        "--setup",
        action="store_true",
        dest="login",
        help="启动登录模式 (手动扫码保存 Cookie)",
    )

    # 添加 --keywords 参数
    parser.add_argument(
        "--keywords", nargs="+", help="开始爬取指定的关键词，例如: --keywords 美股 投资"
    )

    # 添加 --max-posts 参数
    parser.add_argument(
        "--max-posts",
        type=int,
        default=20,
        help="每个关键词最多爬取的帖子数量 (默认: 20)",
    )

    # 解析参数
    args = parser.parse_args()

    # 初始化爬虫
    scraper = XiaohongshuScraper(
        headless=True,
        max_posts=args.max_posts,
    )

    if args.login:
        # 模式 1: 运行登录
        scraper.setup_mode()

    elif args.keywords:
        # 模式 2: 运行爬虫
        scraper.scrape(args.keywords)

    else:
        # 如果没传参数，打印帮助信息
        print("❌ 未指定操作模式。")
        print("\n使用方法:")
        print("  1. 登录: python scraper.py --login")
        print("  2. 爬取: python scraper.py --keywords 关键词1 关键词2")
        print("\n示例:")
        print("  python scraper.py --login")
        print("  python scraper.py --keywords 美股 英伟达 特斯拉")
        print("\n或使用模块方式运行:")
        print("  python -m app.services.xiaohongshu --login")
        print("  python -m app.services.xiaohongshu 美股 英伟达")
