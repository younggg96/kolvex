"""
爬虫后台任务
定义异步执行的爬取任务函数
支持多平台：Twitter、小红书等
"""

from typing import List, Dict

from app.services.scraper import BatchKOLScraper
from app.services.xiaohongshu import XiaohongshuScraper

from .task_manager import (
    set_task_running,
    set_task_completed,
    set_task_failed,
    update_task_progress,
)


def run_scrape_task(
    task_id: str,
    usernames: List[str],
    max_posts_per_user: int,
):
    """
    执行爬取任务

    Args:
        task_id: 任务 ID
        usernames: 用户名列表
        max_posts_per_user: 每个用户最多爬取的推文数量
    """
    try:
        set_task_running(task_id)

        scraper = BatchKOLScraper(
            headless=True,
            max_posts_per_user=max_posts_per_user,
        )

        stats = scraper.batch_scrape(usernames=usernames)
        set_task_completed(task_id, stats)

    except Exception as e:
        set_task_failed(task_id, str(e))


def run_all_profiles_scrape_task(
    task_id: str,
    usernames: List[str],
    max_posts_per_user: int,
):
    """
    执行 kol_profiles 表中所有 KOL 的爬取任务（仅 Twitter）

    Args:
        task_id: 任务 ID
        usernames: 用户名列表
        max_posts_per_user: 每个用户最多爬取的推文数量
    """
    try:
        set_task_running(task_id)

        scraper = BatchKOLScraper(
            headless=True,
            max_posts_per_user=max_posts_per_user,
        )

        stats = scraper.batch_scrape(usernames=usernames)
        set_task_completed(task_id, stats)

    except Exception as e:
        set_task_failed(task_id, str(e))


def run_multi_platform_scrape_task(
    task_id: str,
    kols_by_platform: Dict[str, List[Dict]],
    max_posts_per_user: int,
):
    """
    执行多平台 KOL 爬取任务

    根据平台调用不同的爬虫服务：
    - twitter: 使用 BatchKOLScraper
    - xiaohongshu: 使用 XiaohongshuScraper

    Args:
        task_id: 任务 ID
        kols_by_platform: 按平台分组的 KOL 字典
            格式: {"twitter": [{"username": "xxx", "platform_user_id": "xxx"}, ...]}
        max_posts_per_user: 每个用户最多爬取的帖子数量
    """
    try:
        set_task_running(task_id)

        all_stats = {}
        errors = []

        # ========== Twitter 平台 ==========
        if "twitter" in kols_by_platform:
            twitter_kols = kols_by_platform["twitter"]
            twitter_usernames = [k["username"] for k in twitter_kols]

            print(f"\n🐦 开始爬取 Twitter 平台 ({len(twitter_usernames)} 个 KOL)")
            update_task_progress(task_id, "twitter", status="running")

            try:
                scraper = BatchKOLScraper(
                    headless=True,
                    max_posts_per_user=max_posts_per_user,
                )
                twitter_stats = scraper.batch_scrape(usernames=twitter_usernames)
                all_stats["twitter"] = twitter_stats
                update_task_progress(task_id, "twitter", status="completed", stats=twitter_stats)
                print(f"✅ Twitter 爬取完成: {twitter_stats}")

            except Exception as e:
                error_msg = f"Twitter 爬取失败: {str(e)}"
                errors.append(error_msg)
                update_task_progress(task_id, "twitter", status="failed", error=str(e))
                print(f"❌ {error_msg}")

        # ========== 小红书平台 ==========
        if "xiaohongshu" in kols_by_platform:
            xhs_kols = kols_by_platform["xiaohongshu"]

            print(f"\n📕 开始爬取小红书平台 ({len(xhs_kols)} 个 KOL)")
            update_task_progress(task_id, "xiaohongshu", status="running")

            try:
                xhs_stats = _scrape_xiaohongshu_kols(xhs_kols, max_posts_per_user)
                all_stats["xiaohongshu"] = xhs_stats
                update_task_progress(task_id, "xiaohongshu", status="completed", stats=xhs_stats)
                print(f"✅ 小红书爬取完成: {xhs_stats}")

            except Exception as e:
                error_msg = f"小红书爬取失败: {str(e)}"
                errors.append(error_msg)
                update_task_progress(task_id, "xiaohongshu", status="failed", error=str(e))
                print(f"❌ {error_msg}")

        # ========== 其他平台（暂不支持）==========
        for platform in kols_by_platform.keys():
            if platform not in ["twitter", "xiaohongshu"]:
                update_task_progress(
                    task_id,
                    platform,
                    status="skipped",
                    error=f"平台 {platform} 暂不支持自动爬取",
                )

        # 完成任务
        final_stats = {
            "platforms": all_stats,
            "errors": errors if errors else None,
        }
        set_task_completed(task_id, final_stats)

    except Exception as e:
        set_task_failed(task_id, str(e))


def _scrape_xiaohongshu_kols(
    kols: List[Dict],
    max_posts_per_user: int,
) -> Dict:
    """
    爬取小红书 KOL 的最近帖子

    Args:
        kols: KOL 列表，每个包含 username 和 platform_user_id
        max_posts_per_user: 每个用户最多爬取的帖子数量

    Returns:
        Dict: 统计信息
    """
    from playwright.sync_api import sync_playwright
    import random
    import time

    from app.services.xiaohongshu.config import (
        USER_AGENTS,
        BROWSER_ARGS,
        BROWSER_VIEWPORT,
        BROWSER_LOCALE,
        BROWSER_TIMEZONE,
        PAGE_LOAD_TIMEOUT,
    )
    from app.services.xiaohongshu.scraper import load_cookies, save_cookies
    from app.services.xiaohongshu.database import (
        get_supabase_client,
        insert_post,
        note_id_exists,
    )
    from app.services.xiaohongshu.extractors import (
        extract_kol_recent_notes,
        extract_note_detail,
        merge_note_data,
    )

    stats = {
        "kols_processed": 0,
        "kols_success": 0,
        "kols_failed": 0,
        "posts_scraped": 0,
        "posts_new": 0,
        "posts_duplicate": 0,
    }

    # 加载 cookies
    cookies = load_cookies()
    if not cookies:
        raise RuntimeError("小红书未登录，请先运行: python -m app.services.xiaohongshu --login")

    supabase = get_supabase_client()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=BROWSER_ARGS,
        )

        context = browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport=BROWSER_VIEWPORT,
            locale=BROWSER_LOCALE,
            timezone_id=BROWSER_TIMEZONE,
        )

        if cookies:
            context.add_cookies(cookies)

        page = context.new_page()

        # 添加反检测脚本
        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });
            window.chrome = { runtime: {} };
        """)

        try:
            for kol in kols:
                username = kol.get("username")
                platform_user_id = kol.get("platform_user_id")

                if not platform_user_id:
                    print(f"   ⚠️ KOL {username} 没有 platform_user_id，跳过")
                    stats["kols_failed"] += 1
                    continue

                stats["kols_processed"] += 1
                print(f"\n   👤 [{stats['kols_processed']}/{len(kols)}] 爬取 KOL: {username}")

                try:
                    # 访问用户主页
                    profile_url = f"https://www.xiaohongshu.com/user/profile/{platform_user_id}"
                    page.goto(profile_url, wait_until="domcontentloaded", timeout=PAGE_LOAD_TIMEOUT)
                    time.sleep(random.uniform(2, 4))

                    # 提取最近帖子
                    recent_notes = extract_kol_recent_notes(page, limit=max_posts_per_user)

                    if not recent_notes:
                        print(f"      ℹ️ 未找到帖子")
                        stats["kols_success"] += 1
                        continue

                    print(f"      📋 找到 {len(recent_notes)} 条帖子")

                    for note in recent_notes:
                        note_id = note.get("note_id")
                        if not note_id:
                            continue

                        # 检查是否已存在
                        if supabase and note_id_exists(supabase, note_id):
                            stats["posts_duplicate"] += 1
                            continue

                        # 补充作者信息
                        note["author_id"] = platform_user_id
                        note["author_name"] = username

                        # 保存到数据库
                        if supabase:
                            inserted, post_id = insert_post(supabase, note)
                            if inserted:
                                stats["posts_new"] += 1
                                stats["posts_scraped"] += 1
                                print(f"      ✅ 新帖子: {note.get('title', '')[:30]}...")
                            else:
                                stats["posts_duplicate"] += 1

                    stats["kols_success"] += 1

                    # KOL 间延迟
                    time.sleep(random.uniform(3, 6))

                except Exception as e:
                    print(f"      ❌ 爬取失败: {e}")
                    stats["kols_failed"] += 1
                    continue

        finally:
            # 保存更新后的 cookies
            try:
                new_cookies = context.cookies()
                save_cookies(new_cookies)
            except Exception:
                pass

            browser.close()

    return stats
