"""
小红书爬虫后台任务
定义异步执行的爬取任务函数

注意：API 模式下使用 headless=True（无界面），无法进行交互式登录。
用户必须先通过 CLI 命令登录：python -m app.services.xiaohongshu --login
"""

from typing import List
import os

from app.services.xiaohongshu import XiaohongshuScraper, COOKIES_FILE
from app.services.xiaohongshu.scraper import load_cookies

from .task_manager import (
    set_task_running,
    set_task_completed,
    set_task_failed,
)


def _check_cookies_exist() -> bool:
    """检查 cookies 文件是否存在"""
    cookies = load_cookies()
    return cookies is not None and len(cookies) > 0


def run_xhs_scrape_task(
    task_id: str,
    keywords: List[str],
    max_posts: int,
    fetch_details: bool = True,
):
    """
    执行小红书爬取任务

    Args:
        task_id: 任务 ID
        keywords: 关键词列表
        max_posts: 每个关键词最多爬取的帖子数量
        fetch_details: 是否获取详情页
    """
    try:
        set_task_running(task_id)
        
        # 检查是否已登录（有 cookies）
        if not _check_cookies_exist():
            raise Exception(
                "未找到登录凭证。请先在服务器上运行登录命令：\n"
                "python -m app.services.xiaohongshu --login"
            )

        scraper = XiaohongshuScraper(
            headless=True,
            max_posts=max_posts,
            fetch_details=fetch_details,
        )

        stats = scraper.scrape(keywords=keywords)
        set_task_completed(task_id, stats)

    except Exception as e:
        set_task_failed(task_id, str(e))


def run_xhs_default_keywords_task(
    task_id: str,
    max_posts: int,
    fetch_details: bool = True,
):
    """
    执行默认关键词的爬取任务（美股相关）

    Args:
        task_id: 任务 ID
        max_posts: 每个关键词最多爬取的帖子数量
        fetch_details: 是否获取详情页
    """
    from app.services.xiaohongshu.config import DEFAULT_KEYWORDS

    try:
        set_task_running(task_id)
        
        # 检查是否已登录（有 cookies）
        if not _check_cookies_exist():
            raise Exception(
                "未找到登录凭证。请先在服务器上运行登录命令：\n"
                "python -m app.services.xiaohongshu --login"
            )

        scraper = XiaohongshuScraper(
            headless=True,
            max_posts=max_posts,
            fetch_details=fetch_details,
        )

        stats = scraper.scrape(keywords=DEFAULT_KEYWORDS)
        set_task_completed(task_id, stats)

    except Exception as e:
        set_task_failed(task_id, str(e))


def run_xhs_single_keyword_task(
    task_id: str,
    keyword: str,
    max_posts: int,
    fetch_details: bool = True,
):
    """
    执行单个关键词的爬取任务

    Args:
        task_id: 任务 ID
        keyword: 搜索关键词
        max_posts: 最多爬取的帖子数量
        fetch_details: 是否获取详情页
    """
    try:
        set_task_running(task_id)
        
        # 检查是否已登录（有 cookies）
        if not _check_cookies_exist():
            raise Exception(
                "未找到登录凭证。请先在服务器上运行登录命令：\n"
                "python -m app.services.xiaohongshu --login"
            )

        scraper = XiaohongshuScraper(
            headless=True,
            max_posts=max_posts,
            fetch_details=fetch_details,
        )

        stats = scraper.scrape(keywords=[keyword])
        set_task_completed(task_id, stats)

    except Exception as e:
        set_task_failed(task_id, str(e))

