"""
小红书爬虫后台任务
定义异步执行的爬取任务函数

注意：
- API 模式下使用 headless=True（无界面），无法进行交互式登录。
- 用户必须先通过 CLI 命令登录：python -m app.services.xiaohongshu --login
- 爬虫任务在独立进程中运行，不会阻塞其他 API 请求
"""

from typing import List, Dict
import os
from concurrent.futures import ProcessPoolExecutor, Future
import threading

from app.services.xiaohongshu import XiaohongshuScraper, COOKIES_FILE
from app.services.xiaohongshu.scraper import load_cookies

from .task_manager import (
    set_task_running,
    set_task_completed,
    set_task_failed,
)


# ============================================================
# 进程池管理
# ============================================================

# 使用单个进程的进程池，确保爬虫任务顺序执行
# max_workers=1 保证同时只有一个爬虫任务运行
_executor: ProcessPoolExecutor = None
_executor_lock = threading.Lock()


def _get_executor() -> ProcessPoolExecutor:
    """获取或创建进程池"""
    global _executor
    with _executor_lock:
        if _executor is None:
            _executor = ProcessPoolExecutor(max_workers=1)
    return _executor


def _check_cookies_exist() -> bool:
    """检查 cookies 文件是否存在"""
    cookies = load_cookies()
    return cookies is not None and len(cookies) > 0


# ============================================================
# 进程内执行的函数（必须是顶层函数才能被 pickle）
# ============================================================

def _execute_scrape_in_process(
    keywords: List[str],
    max_posts: int,
    fetch_details: bool = True,
) -> Dict:
    """
    在独立进程中执行爬取任务
    
    注意：此函数会在新进程中执行，需要重新导入依赖
    """
    # 在新进程中重新导入
    from app.services.xiaohongshu import XiaohongshuScraper
    from app.services.xiaohongshu.scraper import load_cookies
    
    # 检查 cookies
    cookies = load_cookies()
    if not cookies or len(cookies) == 0:
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
    return stats


def _handle_scrape_result(task_id: str, future: Future):
    """处理爬取任务结果的回调"""
    try:
        stats = future.result()
        set_task_completed(task_id, stats)
    except Exception as e:
        set_task_failed(task_id, str(e))


# ============================================================
# 后台任务入口函数
# ============================================================

def run_xhs_scrape_task(
    task_id: str,
    keywords: List[str],
    max_posts: int,
    fetch_details: bool = True,
):
    """
    执行小红书爬取任务（在独立进程中运行，不阻塞主进程）

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

        # 提交到进程池执行
        executor = _get_executor()
        future = executor.submit(
            _execute_scrape_in_process,
            keywords,
            max_posts,
            fetch_details,
        )
        
        # 添加完成回调
        future.add_done_callback(
            lambda f: _handle_scrape_result(task_id, f)
        )

    except Exception as e:
        set_task_failed(task_id, str(e))


def run_xhs_default_keywords_task(
    task_id: str,
    max_posts: int,
    fetch_details: bool = True,
):
    """
    执行默认关键词的爬取任务（美股相关，在独立进程中运行）

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

        # 提交到进程池执行
        executor = _get_executor()
        future = executor.submit(
            _execute_scrape_in_process,
            DEFAULT_KEYWORDS,
            max_posts,
            fetch_details,
        )
        
        # 添加完成回调
        future.add_done_callback(
            lambda f: _handle_scrape_result(task_id, f)
        )

    except Exception as e:
        set_task_failed(task_id, str(e))


def run_xhs_single_keyword_task(
    task_id: str,
    keyword: str,
    max_posts: int,
    fetch_details: bool = True,
):
    """
    执行单个关键词的爬取任务（在独立进程中运行）

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

        # 提交到进程池执行
        executor = _get_executor()
        future = executor.submit(
            _execute_scrape_in_process,
            [keyword],
            max_posts,
            fetch_details,
        )
        
        # 添加完成回调
        future.add_done_callback(
            lambda f: _handle_scrape_result(task_id, f)
        )

    except Exception as e:
        set_task_failed(task_id, str(e))

