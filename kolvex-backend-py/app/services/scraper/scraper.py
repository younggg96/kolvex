"""
核心爬虫类 - BatchKOLScraper
"""

import random
import time
from typing import List, Dict, Set, Tuple, Optional

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
    DEFAULT_MAX_POSTS_PER_USER,
    DEFAULT_DELAY_BETWEEN_USERS,
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
)
from .database import (
    get_supabase_client,
    insert_tweet,
    upsert_kol_profile,
    get_stats,
)
from .utils import random_sleep, load_cookies, save_cookies
from .extractors import extract_user_profile, extract_tweet_text, extract_tweet_metadata


class BatchKOLScraper:
    """
    批量 KOL 爬虫类

    支持两种模式:
    1. Setup Mode: headless=False，用于手动登录并保存 cookies
    2. Batch Mode: 利用已保存的 cookies 进行批量爬取
    """

    def __init__(
        self,
        cookies_file: str = None,
        headless: bool = False,
        max_posts_per_user: int = DEFAULT_MAX_POSTS_PER_USER,
        delay_between_users: Tuple[float, float] = DEFAULT_DELAY_BETWEEN_USERS,
        delay_during_scroll: Tuple[float, float] = DEFAULT_DELAY_DURING_SCROLL,
    ):
        """
        初始化爬虫

        Args:
            cookies_file: cookies 文件路径
            headless: 是否使用无头模式
            max_posts_per_user: 每个用户最多爬取的推文数量
            delay_between_users: 用户间延迟范围 (min, max) 秒
            delay_during_scroll: 滚动时延迟范围 (min, max) 秒
        """
        if not PLAYWRIGHT_AVAILABLE:
            raise RuntimeError(
                "❌ Playwright 未安装。请运行:\n"
                "   pip install playwright\n"
                "   playwright install chromium"
            )

        self.cookies_file = str(cookies_file or COOKIES_FILE)
        self.headless = headless
        self.max_posts_per_user = max_posts_per_user
        self.delay_between_users = delay_between_users
        self.delay_during_scroll = delay_during_scroll

        # 统计信息
        self.stats = {
            "users_processed": 0,
            "users_failed": 0,
            "tweets_scraped": 0,
            "tweets_new": 0,
            "tweets_duplicate": 0,
        }

        # 初始化 Supabase 客户端
        self.supabase = get_supabase_client()
        if self.supabase:
            print("✅ Supabase 连接成功")
        else:
            print("⚠️ Supabase 未连接，将只打印推文而不保存")

    def setup_mode(self, timeout: int = SETUP_LOGIN_TIMEOUT) -> bool:
        """
        Setup 模式: 打开浏览器让用户手动登录

        Args:
            timeout: 等待登录的超时时间（秒）

        Returns:
            bool: 登录成功返回 True
        """
        print("\n" + "=" * 60)
        print("🔧 SETUP MODE - 请手动登录 X.com")
        print("=" * 60)

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=False,  # Setup 模式必须有头
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
                print("📱 正在打开 X.com...")
                page.goto(
                    "https://x.com/login", wait_until="domcontentloaded", timeout=60000
                )

                print("\n" + "⚠️ " * 20)
                print("请在浏览器窗口中完成登录！")
                print(f"超时时间: {timeout} 秒")
                print("⚠️ " * 20 + "\n")

                # 等待用户完成登录（检测主页元素）
                try:
                    page.wait_for_selector(
                        '[data-testid="primaryColumn"]',
                        timeout=timeout * 1000,
                        state="visible",
                    )
                    print("✅ 检测到已登录！")

                    # 保存 cookies
                    cookies = context.cookies()
                    if save_cookies(cookies, self.cookies_file):
                        print("✅ Setup 完成！现在可以运行 Batch Mode 了。")
                        return True

                except Exception as e:
                    print(f"❌ 登录超时或失败: {e}")
                    return False

            finally:
                print("\n浏览器将在 3 秒后关闭...")
                time.sleep(3)
                browser.close()

        return False

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
                get: () => ['en-US', 'en']
            });
            
            // 隐藏自动化痕迹
            window.chrome = { runtime: {} };
        """
        )

    def _scrape_single_user(self, page: "Page", username: str) -> List[Dict]:
        """
        爬取单个用户的推文和 profile 信息

        Args:
            page: Playwright 页面对象
            username: 用户名

        Returns:
            List[Dict]: 爬取到的推文列表
        """
        clean_username = username.lstrip("@").strip()
        profile_url = f"https://x.com/{clean_username}"

        # 使用搜索 URL 并按时间排序（f=live 表示最新）
        search_url = (
            f"https://x.com/search?q=from%3A{clean_username}&src=typed_query&f=live"
        )

        collected_tweets = []
        seen_texts: Set[str] = set()

        print(f"\n📍 正在访问 @{clean_username}...")

        try:
            # ========== 第一步：访问用户主页获取 Profile 信息 ==========
            page.goto(
                profile_url, wait_until="domcontentloaded", timeout=PAGE_LOAD_TIMEOUT
            )
            random_sleep(2, 4)

            # 检测是否成功加载用户页面
            try:
                page.wait_for_selector(
                    "article", timeout=ELEMENT_WAIT_TIMEOUT, state="visible"
                )
            except Exception:
                print(f"   ⚠️ 无法加载 @{clean_username} 的页面（可能不存在或被封禁）")
                return []

            # ========== 提取并保存 Profile 信息 ==========
            profile_data = extract_user_profile(page)
            profile_data["username"] = clean_username  # 确保用户名正确

            if self.supabase:
                if upsert_kol_profile(self.supabase, profile_data):
                    self.stats["profiles_updated"] = (
                        self.stats.get("profiles_updated", 0) + 1
                    )
                    # 打印 profile 信息
                    display_name = profile_data.get("display_name", clean_username)
                    followers = profile_data.get("followers_count", 0)
                    following = profile_data.get("following_count", 0)
                    verified = profile_data.get("verification_type", "None")

                    # 认证徽章
                    badge = ""
                    if verified == "Gold":
                        badge = "🏢"
                    elif verified == "Blue":
                        badge = "✓"
                    elif verified == "Grey":
                        badge = "🏛️"

                    print(f"   👤 {display_name} {badge}")
                    print(
                        f"      📊 粉丝: {followers:,} | 关注: {following:,}"
                    )

                    # 额外信息
                    extras = []
                    if profile_data.get("avatar_url"):
                        extras.append("头像✓")
                    if profile_data.get("banner_url"):
                        extras.append("背景✓")
                    if profile_data.get("location"):
                        extras.append(f"📍{profile_data['location']}")
                    if profile_data.get("join_date"):
                        extras.append(f"📅{profile_data['join_date']}")
                    if profile_data.get("website"):
                        extras.append(f"🔗")

                    if extras:
                        print(f"      {' | '.join(extras)}")

            # ========== 第二步：跳转到搜索页面获取最新推文（按时间排序）==========
            print(f"   🔍 切换到最新推文视图 (搜索: from:{clean_username})...")
            page.goto(
                search_url, wait_until="domcontentloaded", timeout=PAGE_LOAD_TIMEOUT
            )
            random_sleep(2, 4)

            # 等待搜索结果加载
            try:
                page.wait_for_selector(
                    "article", timeout=ELEMENT_WAIT_TIMEOUT, state="visible"
                )
            except Exception:
                # 截图保存，方便调试
                debug_path = f"debug_{clean_username}.png"
                try:
                    page.screenshot(path=debug_path)
                    print(f"   ⚠️ 搜索结果为空或加载失败，截图已保存: {debug_path}")
                except Exception:
                    print(f"   ⚠️ 搜索结果为空或加载失败")

                # 检查是否有错误提示或需要验证
                page_content = page.content().lower()
                if "verify" in page_content or "captcha" in page_content:
                    print(f"   🔒 检测到验证码/人机验证，请重新运行 --setup 登录")
                elif "something went wrong" in page_content:
                    print(f"   ❌ 页面显示 'Something went wrong'，可能是账号问题")
                elif "log in" in page_content or "sign in" in page_content:
                    print(f"   🔑 需要登录，请删除 cookies 文件并重新运行 --setup")

                return []

            # 滚动和爬取最新推文
            scroll_count = 0
            no_new_count = 0

            while (
                len(collected_tweets) < self.max_posts_per_user
                and scroll_count < DEFAULT_MAX_SCROLLS
            ):
                scroll_count += 1

                articles = page.query_selector_all("article")
                new_in_batch = 0

                for article in articles:
                    if len(collected_tweets) >= self.max_posts_per_user:
                        break

                    text = extract_tweet_text(article)

                    if text and text not in seen_texts:
                        seen_texts.add(text)
                        metadata = extract_tweet_metadata(article)

                        tweet_data = {
                            "username": clean_username,
                            "text": text,
                            **metadata,
                        }

                        collected_tweets.append(tweet_data)
                        new_in_batch += 1

                        # 保存到 Supabase（含 AI 分析）
                        if self.supabase:
                            inserted, tweet_id = insert_tweet(self.supabase, tweet_data)
                            if inserted:
                                self.stats["tweets_new"] += 1
                                # 显示推文时间，方便确认是否是最新推文
                                created_at = metadata.get("created_at", "")
                                time_str = created_at[:16] if created_at else "未知时间"
                                print(
                                    f"   ✅ [{len(collected_tweets)}/{self.max_posts_per_user}] 🕐{time_str} | {text[:40]}..."
                                )
                            else:
                                self.stats["tweets_duplicate"] += 1
                                print(
                                    f"   📋 [{len(collected_tweets)}/{self.max_posts_per_user}] 已存在: {text[:40]}..."
                                )
                        else:
                            created_at = metadata.get("created_at", "")
                            time_str = created_at[:16] if created_at else "未知时间"
                            print(
                                f"   📝 [{len(collected_tweets)}/{self.max_posts_per_user}] 🕐{time_str} | {text[:40]}..."
                            )

                if new_in_batch == 0:
                    no_new_count += 1
                    if no_new_count >= 2:
                        break
                else:
                    no_new_count = 0

                if len(collected_tweets) >= self.max_posts_per_user:
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

            self.stats["tweets_scraped"] += len(collected_tweets)

            # 如果没有找到任何推文，截图调试
            if len(collected_tweets) == 0:
                debug_path = f"debug_empty_{clean_username}.png"
                try:
                    page.screenshot(path=debug_path)
                    print(f"   ⚠️ 未找到推文，截图已保存: {debug_path}")
                except Exception:
                    pass
            else:
                print(
                    f"   📊 @{clean_username}: 爬取 {len(collected_tweets)} 条最新推文"
                )

        except Exception as e:
            print(f"   ❌ 爬取 @{clean_username} 失败: {e}")
            # 截图保存错误现场
            try:
                page.screenshot(path=f"error_{clean_username}.png")
                print(f"   📸 错误截图已保存: error_{clean_username}.png")
            except Exception:
                pass
            self.stats["users_failed"] += 1

        return collected_tweets

    def batch_scrape(self, usernames: List[str]) -> Dict:
        """
        批量爬取 KOL 推文

        Args:
            usernames: 用户名列表

        Returns:
            Dict: 统计信息
        """
        if not usernames:
            print("❌ 没有要爬取的用户")
            return self.stats

        # 检查 cookies
        cookies = load_cookies(self.cookies_file)
        if cookies is None:
            print("\n❌ 未找到 cookies 文件！")
            print("请先运行 Setup Mode 进行登录:")
            print("   python -m app.services.scraper --setup")
            return self.stats

        print("\n" + "=" * 60)
        print(f"🚀 BATCH MODE - 开始批量爬取")
        print(f"📋 目标: {len(usernames)} 个 KOL")
        print(f"📝 每用户最多: {self.max_posts_per_user} 条推文")
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

            # 加载 cookies
            context.add_cookies(cookies)

            page = context.new_page()
            self._add_stealth_scripts(page)

            try:
                for i, username in enumerate(usernames, 1):
                    print(f"\n[{i}/{len(usernames)}] 🎯 @{username}")

                    self._scrape_single_user(page, username)
                    self.stats["users_processed"] += 1

                    # 用户间延迟（最后一个用户不需要）
                    if i < len(usernames):
                        random_sleep(
                            *self.delay_between_users, f"切换到下一个用户前等待"
                        )

            except KeyboardInterrupt:
                print("\n\n⚠️ 用户中断，正在保存数据...")

            except Exception as e:
                print(f"\n❌ 爬取过程出错: {e}")

            finally:
                # 更新 cookies（可能已刷新）
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
        print(f"  ✅ 处理用户: {self.stats['users_processed']}")
        print(f"  ❌ 失败用户: {self.stats['users_failed']}")
        print(f"  👤 更新 Profile: {self.stats.get('profiles_updated', 0)}")
        print(f"  📝 爬取推文: {self.stats['tweets_scraped']}")
        print(f"  🆕 新增推文: {self.stats['tweets_new']}")
        print(f"  📋 重复推文: {self.stats['tweets_duplicate']}")
        print("=" * 60)

        # 数据库统计
        if self.supabase:
            db_stats = get_stats(self.supabase)
            print(f"\n📦 Supabase 数据库总计: {db_stats['total']} 条推文")

            # 统计 kol_profiles 表数量
            try:
                profiles_result = (
                    self.supabase.table("kol_profiles")
                    .select("username, verification_type", count="exact")
                    .execute()
                )
                total_profiles = profiles_result.count or 0
                print(f"👤 KOL Profiles: {total_profiles} 个")

                # 按认证类型统计
                if profiles_result.data:
                    verified_counts = {}
                    for profile in profiles_result.data:
                        v_type = profile.get("verification_type") or "None"
                        verified_counts[v_type] = verified_counts.get(v_type, 0) + 1
                    if verified_counts and any(k != "None" for k in verified_counts):
                        badges = {"Gold": "🏢", "Blue": "✓", "Grey": "🏛️", "None": "○"}
                        parts = [
                            f"{badges.get(k, '')} {k}: {v}"
                            for k, v in verified_counts.items()
                        ]
                        print(f"   认证: {' | '.join(parts)}")
            except Exception:
                pass

    def close(self) -> None:
        """关闭资源（保留接口兼容性）"""
        pass
