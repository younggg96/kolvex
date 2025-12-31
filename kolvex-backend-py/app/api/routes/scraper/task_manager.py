"""
爬虫任务管理
提供任务状态的存储和查询功能
注意：当前使用内存存储，生产环境建议用 Redis
"""

from typing import Dict, List
from datetime import datetime, timezone

from .schemas import TaskStatus


# ============================================================
# 任务存储（简单内存存储）
# ============================================================

_scrape_tasks: Dict[str, Dict] = {}


def generate_task_id() -> str:
    """生成任务 ID"""
    return f"scrape_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{id(datetime.now(timezone.utc)) % 10000}"


def create_task(
    task_id: str,
    usernames: List[str] = None,
    categories: List[str] = None,
    source: str = None,
    total_kols: int = None,
    platforms: Dict[str, int] = None,
    kols_by_platform: Dict[str, List[Dict]] = None,
) -> Dict:
    """
    创建新任务并初始化状态

    Args:
        task_id: 任务 ID
        usernames: 用户名列表
        categories: 类别列表
        source: 数据来源
        total_kols: KOL 总数
        platforms: 各平台 KOL 数量统计
        kols_by_platform: 按平台分组的 KOL 列表

    Returns:
        任务状态字典
    """
    task_data = {
        "status": TaskStatus.PENDING,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "stats": None,
        "error": None,
        "progress": {},
    }

    if usernames:
        task_data["usernames"] = usernames
    if categories:
        task_data["categories"] = categories
    if source:
        task_data["source"] = source
    if total_kols:
        task_data["total_kols"] = total_kols
    if platforms:
        task_data["platforms"] = platforms
    if kols_by_platform:
        # 只存储用户名，不存储完整的 KOL 数据
        task_data["kols_by_platform_summary"] = {
            plat: [k.get("username") for k in kols]
            for plat, kols in kols_by_platform.items()
        }

    _scrape_tasks[task_id] = task_data
    return task_data


def get_task(task_id: str) -> Dict:
    """获取任务状态"""
    return _scrape_tasks.get(task_id)


def update_task(task_id: str, **kwargs) -> None:
    """更新任务状态"""
    if task_id in _scrape_tasks:
        _scrape_tasks[task_id].update(kwargs)


def set_task_running(task_id: str) -> None:
    """设置任务为运行中"""
    update_task(
        task_id,
        status=TaskStatus.RUNNING,
        started_at=datetime.now(timezone.utc).isoformat(),
    )


def set_task_completed(task_id: str, stats: Dict = None) -> None:
    """设置任务为已完成"""
    completed_at = datetime.now(timezone.utc).isoformat()
    update_data = {
        "status": TaskStatus.COMPLETED,
        "completed_at": completed_at,
    }

    if stats:
        update_data["stats"] = stats

    # 计算耗时
    task = get_task(task_id)
    if task and task.get("started_at"):
        started = datetime.fromisoformat(task["started_at"])
        completed = datetime.fromisoformat(completed_at)
        duration = (completed - started).total_seconds()
        update_data["duration_seconds"] = duration
        update_data["duration_human"] = f"{int(duration // 60)}分{int(duration % 60)}秒"

    update_task(task_id, **update_data)


def set_task_failed(task_id: str, error: str) -> None:
    """设置任务为失败"""
    update_task(
        task_id,
        status=TaskStatus.FAILED,
        error=error,
        failed_at=datetime.now(timezone.utc).isoformat(),
    )


def update_task_progress(
    task_id: str,
    platform: str,
    status: str = None,
    stats: Dict = None,
    error: str = None,
) -> None:
    """
    更新任务中某个平台的进度

    Args:
        task_id: 任务 ID
        platform: 平台名称
        status: 平台爬取状态 (pending, running, completed, failed)
        stats: 平台爬取统计
        error: 平台爬取错误信息
    """
    task = get_task(task_id)
    if not task:
        return

    if "progress" not in task:
        task["progress"] = {}

    if platform not in task["progress"]:
        task["progress"][platform] = {}

    if status:
        task["progress"][platform]["status"] = status
    if stats:
        task["progress"][platform]["stats"] = stats
    if error:
        task["progress"][platform]["error"] = error

    task["progress"][platform]["updated_at"] = datetime.now(timezone.utc).isoformat()


def list_tasks(limit: int = 10) -> List[Dict]:
    """
    列出最近的任务

    Args:
        limit: 返回的最大任务数

    Returns:
        任务列表
    """
    tasks = list(_scrape_tasks.items())
    # 按创建时间倒序
    tasks.sort(key=lambda x: x[1].get("created_at", ""), reverse=True)
    return [{"task_id": task_id, **task_data} for task_id, task_data in tasks[:limit]]

