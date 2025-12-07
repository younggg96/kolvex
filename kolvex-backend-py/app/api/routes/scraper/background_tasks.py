"""
爬虫后台任务
定义异步执行的爬取任务函数
"""

from typing import List

from app.services.scraper import BatchKOLScraper

from .task_manager import (
    set_task_running,
    set_task_completed,
    set_task_failed,
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
    执行 kol_profiles 表中所有 KOL 的爬取任务

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
