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
    upsert_kol,
    kol_exists,
)
from .extractors import (
    extract_note_detail,
    extract_all_note_cards,
    merge_note_data,
    extract_kol_profile,
    extract_kol_recent_notes,
    extract_author_id_from_note,
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
        scrape_kols: bool = True,
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
            scrape_kols: 是否爬取 KOL 资料
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
        self.scrape_kols = scrape_kols

        # 已爬取的 KOL ID（避免重复）
        self.scraped_kol_ids: Set[str] = set()

        # 统计信息
        self.stats = {
            "keywords_processed": 0,
            "posts_scraped": 0,
            "posts_new": 0,
            "posts_duplicate": 0,
            "posts_failed": 0,
            "kols_scraped": 0,
            "kols_new": 0,
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
        会同时验证首页和搜索页面的登录状态

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

                # 🔑 额外步骤：访问搜索页面完成验证
                print("\n📍 正在验证搜索页面权限...")
                search_url = self._build_search_url("美股")
                page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
                time.sleep(3)

                # 检查搜索页面是否需要验证
                max_verify_attempts = 3
                for attempt in range(max_verify_attempts):
                    if not self._check_login_required(page):
                        print("✅ 搜索页面验证成功！")
                        break

                    print("\n" + "🔴 " * 20)
                    print(
                        f"【搜索页面需要二维码验证】(尝试 {attempt + 1}/{max_verify_attempts})"
                    )
                    print("👀 请在浏览器中用手机小红书 App 扫描二维码")
                    print("⏳ 扫码完成后，页面会自动刷新...")
                    print("🔴 " * 20 + "\n")

                    # 等待用户扫码，同时检测页面变化
                    for _ in range(60):  # 最多等待 60 秒
                        time.sleep(1)
                        # 检查是否有搜索结果出现（说明验证通过了）
                        try:
                            has_results = page.evaluate(
                                """
                                () => {
                                    const cards = document.querySelectorAll('section.note-item, .note-item, [class*="note-item"]');
                                    return cards.length > 0;
                                }
                            """
                            )
                            if has_results:
                                print("✅ 检测到搜索结果，验证成功！")
                                break
                        except Exception:
                            pass

                        # 也检查是否还在验证页面
                        if not self._check_login_required(page):
                            break

                    # 刷新确认
                    page.reload(wait_until="domcontentloaded", timeout=30000)
                    time.sleep(2)

                    if not self._check_login_required(page):
                        print("✅ 搜索页面验证成功！")
                        break

                    if attempt == max_verify_attempts - 1:
                        print("\n" + "❌ " * 10)
                        print("验证多次失败！请手动确认是否已扫码完成")
                        input("👉 确认已扫码验证后，按【回车键】继续...")
                        page.reload(wait_until="domcontentloaded", timeout=30000)
                        time.sleep(2)

                # 保存 cookies
                cookies = context.cookies()
                if not cookies:
                    print("❌ 未获取到任何 Cookies！")
                    return False

                print(f"\n📊 获取到 {len(cookies)} 个 Cookies")

                if save_cookies(cookies, self.cookies_file):
                    print(f"✅ Cookies 已保存成功！文件路径: {self.cookies_file}")

                    # 验证文件是否真的保存成功
                    import os

                    if os.path.exists(self.cookies_file):
                        file_size = os.path.getsize(self.cookies_file)
                        print(f"   📁 文件大小: {file_size} bytes")
                        if file_size < 100:
                            print("   ⚠️ 文件过小，Cookies 可能不完整！")
                    else:
                        print(f"   ❌ 文件未找到: {self.cookies_file}")
                        return False

                    return True
                else:
                    print("❌ Cookies 保存失败")
                    return False

            except Exception as e:
                print(f"❌ 发生错误: {e}")
                import traceback

                traceback.print_exc()
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

        Raises:
            RuntimeError: 如果在 headless 模式下需要登录
        """
        # 如果是 headless 模式，直接抛出异常，因为无法手动登录
        if self.headless:
            raise RuntimeError(
                "❌ 需要登录但当前为无界面模式！\n"
                "请先运行登录命令保存 Cookies：\n"
                "  python -m app.services.xiaohongshu --login\n"
                "或者使用 setup_mode() 进行登录。"
            )

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
                # 方法 B: 手动确认（兜底方案）- 只在非 headless 模式下使用
                print("⏳ 自动检测超时，等待用户手动确认...")
                try:
                    import sys

                    if sys.stdin.isatty():
                        input("👉 登录完成后，请在此处按【回车键】继续...")
                    else:
                        raise RuntimeError("非交互式环境，无法等待用户输入")
                except (EOFError, RuntimeError) as e:
                    print(f"⚠️ 无法等待用户输入: {e}")
                    raise RuntimeError(
                        "❌ 登录超时且无法等待用户输入！\n"
                        "请先运行登录命令保存 Cookies：\n"
                        "  python -m app.services.xiaohongshu --login"
                    )

            # 保存 cookies
            cookies = context.cookies()
            if save_cookies(cookies, self.cookies_file):
                print(f"✅ Cookies 已保存！文件路径: {self.cookies_file}")
                print("🚀 继续爬取...\n")
                return True
            else:
                print("⚠️ Cookies 保存失败，但将继续尝试爬取")
                return True

        except RuntimeError:
            # 重新抛出 RuntimeError
            raise
        except Exception as e:
            print(f"❌ 登录过程出错: {e}")
            return False

    def _check_login_required(self, page: "Page") -> bool:
        """
        检测页面是否需要登录或需要二维码验证

        Args:
            page: Playwright 页面对象

        Returns:
            bool: 需要登录返回 True
        """
        try:
            # 使用 JavaScript 一次性检测登录状态
            login_check = page.evaluate(
                """
                () => {
                    const html = document.body?.innerText || '';
                    const result = { needLogin: false, reason: '' };
                    
                    // 检查是否有登录弹窗（更全面的选择器）
                    const loginSelectors = [
                        '[class*="login-modal"]',
                        '[class*="login-container"]:not([class*="side"])',
                        '[class*="login-dialog"]',
                        '[class*="login-popup"]',
                        '.reds-modal-wrapper', // 小红书弹窗容器
                        '[class*="reds-modal"]',
                    ];
                    
                    for (const selector of loginSelectors) {
                        const el = document.querySelector(selector);
                        if (el && el.offsetParent !== null) {
                            // 进一步检查弹窗内容是否包含登录相关文本
                            const modalText = el.innerText || '';
                            if (modalText.includes('登录') || modalText.includes('扫码') || 
                                modalText.includes('微信') || modalText.includes('小红书号')) {
                                result.needLogin = true;
                                result.reason = 'login_popup';
                                return result;
                            }
                        }
                    }
                    
                    // 检查二维码验证页面的特征文本
                    // 这些组合出现才是真正的验证页面
                    if (html.includes('扫码验证') || html.includes('扫描二维码')) {
                        if (html.includes('为保护账号安全') || html.includes('验证身份')) {
                            result.needLogin = true;
                            result.reason = 'qrcode_verify';
                            return result;
                        }
                    }
                    
                    // 检查"登录后查看"等提示
                    if (html.includes('登录后查看') || html.includes('请先登录')) {
                        result.needLogin = true;
                        result.reason = 'login_required_text';
                        return result;
                    }
                    
                    // 新增：检查"登录后查看搜索结果"
                    if (html.includes('登录后查看搜索结果')) {
                        result.needLogin = true;
                        result.reason = 'search_login_required';
                        return result;
                    }
                    
                    // 检查二维码元素 + 没有正常内容
                    const qrcodeImg = document.querySelector('img[src*="qrcode"], img[src*="qr_code"], canvas');
                    if (qrcodeImg && qrcodeImg.offsetParent !== null) {
                        const hasNotes = document.querySelector('section.note-item, .note-item');
                        if (!hasNotes) {
                            result.needLogin = true;
                            result.reason = 'qrcode_no_content';
                            return result;
                        }
                    }
                    
                    return result;
                }
            """
            )

            if login_check and login_check.get("needLogin"):
                reason = login_check.get("reason", "unknown")
                print(f"   🔐 检测到需要登录 (原因: {reason})")
                return True

        except Exception as e:
            print(f"   ⚠️ 登录检测出错: {e}")

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
            login_required_attempts = 0
            max_login_attempts = 3
            
            while self._check_login_required(page) and login_required_attempts < max_login_attempts:
                login_required_attempts += 1
                print(f"\n   🔐 检测到登录要求 (尝试 {login_required_attempts}/{max_login_attempts})")
                
                # 等待用户登录
                self._wait_for_manual_login(context, page)
                
                # 保存新 cookies
                new_cookies = context.cookies()
                save_cookies(new_cookies, self.cookies_file)
                print("   🍪 已保存新的 cookies")
                
                # 登录后刷新页面
                print("   🔄 刷新搜索页面...")
                page.goto(
                    search_url, wait_until="domcontentloaded", timeout=PAGE_LOAD_TIMEOUT
                )
                random_sleep(2, 3)
                
                # 再次检查
                if not self._check_login_required(page):
                    print("   ✅ 登录成功，继续爬取")
                    break
            
            if login_required_attempts >= max_login_attempts:
                print(f"   ❌ 多次登录尝试失败，跳过关键词: {keyword}")
                return []

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

                                # 爬取 KOL 资料（在成功保存帖子后）
                                self._extract_and_save_kol(
                                    context, page, card_data, keyword
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

    def _fetch_kol_profile(
        self,
        context,
        page: "Page",
        author_id: str,
        source_keyword: str = None,
        source_note_id: str = None,
    ) -> Optional[Dict]:
        """
        获取 KOL 个人主页资料和最近帖子

        Args:
            context: 浏览器上下文
            page: Playwright 页面对象
            author_id: 作者用户 ID
            source_keyword: 来源搜索关键词
            source_note_id: 来源笔记 ID

        Returns:
            Optional[Dict]: KOL 资料数据
        """
        if not author_id:
            return None

        # 检查是否已爬取过
        if author_id in self.scraped_kol_ids:
            return None

        # 检查数据库是否已存在（避免频繁请求）
        if self.supabase and kol_exists(self.supabase, author_id):
            self.scraped_kol_ids.add(author_id)
            return None

        original_url = page.url
        profile_url = f"https://www.xiaohongshu.com/user/profile/{author_id}"

        try:
            print(f"      👤 获取 KOL 资料: {author_id}")
            page.goto(
                profile_url, wait_until="domcontentloaded", timeout=PAGE_LOAD_TIMEOUT
            )
            random_sleep(2, 4)

            # 检测是否需要登录
            if self._check_login_required(page):
                self._wait_for_manual_login(context, page)
                page.goto(
                    profile_url,
                    wait_until="domcontentloaded",
                    timeout=PAGE_LOAD_TIMEOUT,
                )
                random_sleep(1, 2)

            # 提取 KOL 资料
            kol_data = extract_kol_profile(page)

            if kol_data and kol_data.get("user_id"):
                self.scraped_kol_ids.add(author_id)

                # 保存 KOL 到数据库
                if self.supabase:
                    success, kol_id = upsert_kol(
                        self.supabase,
                        kol_data,
                        source_keyword=source_keyword,
                        source_note_id=source_note_id,
                    )
                    if success:
                        self.stats["kols_new"] += 1
                        print(
                            f"      ✅ KOL 已保存: {kol_data.get('nickname', author_id)}"
                        )

                self.stats["kols_scraped"] += 1

                # ========== 爬取 KOL 最近的帖子 ==========
                self._scrape_kol_recent_posts(
                    context, page, author_id, kol_data.get("nickname"), source_keyword
                )

                return kol_data

            return None

        except Exception as e:
            print(f"      ⚠️ 获取 KOL 资料失败: {e}")
            return None

        finally:
            # 返回原页面
            try:
                page.goto(
                    original_url,
                    wait_until="domcontentloaded",
                    timeout=PAGE_LOAD_TIMEOUT,
                )
                random_sleep(1, 2)
            except Exception:
                pass

    def _scrape_kol_recent_posts(
        self,
        context,
        page: "Page",
        author_id: str,
        author_name: str = None,
        source_keyword: str = None,
        max_posts: int = 5,
    ) -> int:
        """
        爬取 KOL 最近的帖子

        Args:
            context: 浏览器上下文
            page: Playwright 页面对象（应该已经在 KOL 主页上）
            author_id: 作者用户 ID
            author_name: 作者昵称
            source_keyword: 来源搜索关键词
            max_posts: 最多爬取的帖子数量

        Returns:
            int: 成功保存的帖子数量
        """
        saved_count = 0

        try:
            print(f"      📚 爬取 KOL 最近帖子...")

            # 提取最近帖子列表
            recent_notes = extract_kol_recent_notes(page, limit=max_posts)

            if not recent_notes:
                # 截图调试
                clean_author = (author_name or author_id or "unknown").replace("/", "_")
                debug_path = f"debug_xhs_{clean_author}.png"
                try:
                    page.screenshot(path=debug_path)
                    print(f"      ⚠️ 未找到 KOL 最近帖子，截图已保存: {debug_path}")
                except Exception:
                    print(f"      ℹ️ 未找到 KOL 最近帖子")
                return 0

            print(f"      📋 找到 {len(recent_notes)} 条帖子")

            for i, note in enumerate(recent_notes):
                note_id = note.get("note_id")
                if not note_id:
                    continue

                # 检查是否已存在
                if self.supabase and note_id_exists(self.supabase, note_id):
                    continue

                # 补充作者信息
                note["author_id"] = author_id
                note["author_name"] = author_name
                note["search_keyword"] = source_keyword

                # 是否获取详情
                if self.fetch_details and note.get("permalink"):
                    print(
                        f"         📖 [{i+1}/{len(recent_notes)}] 获取: {note.get('title', '')[:25]}..."
                    )
                    detail_data = self._fetch_note_detail(
                        context, page, note["permalink"]
                    )
                    if detail_data:
                        note = merge_note_data(note, detail_data)
                        # 确保作者 ID 不被覆盖
                        note["author_id"] = author_id
                        note["author_name"] = author_name
                    random_sleep(*self.delay_between_posts)

                # 保存到数据库
                if self.supabase:
                    inserted, post_id = insert_post(self.supabase, note)
                    if inserted:
                        saved_count += 1
                        self.stats["posts_new"] += 1
                        print(f"         ✅ 保存帖子: {note.get('title', '')[:30]}...")
                    else:
                        self.stats["posts_duplicate"] += 1

            print(f"      📊 KOL 帖子爬取完成: 新增 {saved_count} 条")
            return saved_count

        except Exception as e:
            print(f"      ⚠️ 爬取 KOL 最近帖子失败: {e}")
            return saved_count

    def _extract_and_save_kol(
        self,
        context,
        page: "Page",
        post_data: Dict,
        keyword: str,
    ) -> None:
        """
        从帖子数据中提取作者 ID 并爬取 KOL 资料

        Args:
            context: 浏览器上下文
            page: Playwright 页面对象
            post_data: 帖子数据
            keyword: 搜索关键词
        """
        if not self.scrape_kols:
            return

        # 尝试从帖子数据获取作者 ID
        author_id = post_data.get("author_id")

        # 如果没有 author_id，尝试从详情页提取
        if not author_id and post_data.get("permalink"):
            try:
                # 先获取当前页面 URL
                current_url = page.url
                # 如果当前不在详情页，先导航到详情页
                if "/explore/" not in current_url:
                    page.goto(
                        post_data["permalink"],
                        wait_until="domcontentloaded",
                        timeout=PAGE_LOAD_TIMEOUT,
                    )
                    random_sleep(1, 2)

                author_id = extract_author_id_from_note(page)
                if author_id:
                    post_data["author_id"] = author_id
            except Exception:
                pass

        if author_id and author_id not in self.scraped_kol_ids:
            self._fetch_kol_profile(
                context,
                page,
                author_id,
                source_keyword=keyword,
                source_note_id=post_data.get("note_id"),
            )

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
                print(f"🍪 正在加载 {len(cookies)} 个 cookies...")
                context.add_cookies(cookies)
                
                # 验证 cookies 是否有效 - 访问首页
                print("🔍 验证 cookies 有效性...")
                page = context.new_page()
                self._add_stealth_scripts(page)
                
                try:
                    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                    random_sleep(2, 3)
                    
                    # 检查是否需要登录
                    if self._check_login_required(page):
                        print("\n⚠️ Cookies 已失效或需要重新验证！")
                        print("请运行以下命令重新登录:")
                        print("   python -m app.services.xiaohongshu --login")
                        
                        if self.headless:
                            raise RuntimeError(
                                "❌ Cookies 已失效且当前为无头模式！\n"
                                "请先运行: python -m app.services.xiaohongshu --login"
                            )
                        else:
                            # 非 headless 模式，等待用户登录
                            self._wait_for_manual_login(context, page)
                            # 登录后保存新 cookies
                            new_cookies = context.cookies()
                            save_cookies(new_cookies, self.cookies_file)
                    else:
                        print("✅ Cookies 有效！")
                except Exception as e:
                    print(f"⚠️ 验证 cookies 时出错: {e}")
            else:
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

            except RuntimeError as e:
                # 登录需求错误等严重错误，向上传播
                print(f"\n❌ 严重错误: {e}")
                raise

            except Exception as e:
                print(f"\n❌ 爬取过程出错: {e}")

            finally:
                # 更新 cookies（安全关闭）
                try:
                    # 尝试保存 cookies
                    new_cookies = context.cookies()
                    save_cookies(new_cookies, self.cookies_file)
                except (KeyboardInterrupt, Exception) as e:
                    # 在 Ctrl+C 或其他错误时，忽略 cookie 保存错误
                    if isinstance(e, KeyboardInterrupt):
                        # 用户中断，不需要打印错误
                        pass
                    else:
                        # 其他错误，可能是浏览器已关闭
                        pass

                # 安全关闭浏览器
                try:
                    browser.close()
                except Exception:
                    # 浏览器可能已经关闭，忽略错误
                    pass

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
        print(f"  👤 爬取 KOL: {self.stats['kols_scraped']}")
        print(f"  🆕 新增 KOL: {self.stats['kols_new']}")
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
