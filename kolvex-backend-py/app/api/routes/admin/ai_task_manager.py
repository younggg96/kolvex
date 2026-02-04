"""
AI 分析任务管理
提供 AI 分析任务状态的存储和查询功能
用于前端显示分析进度
"""

from typing import Dict, List, Optional
from datetime import datetime, timezone
from enum import Enum


class AITaskStatus(str, Enum):
    """AI 任务状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ============================================================
# 任务存储（内存存储）
# ============================================================

_ai_tasks: Dict[str, Dict] = {}


def generate_task_id(prefix: str = "ai") -> str:
    """生成任务 ID"""
    return f"{prefix}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{id(datetime.now(timezone.utc)) % 10000}"


def create_ai_task(
    task_id: str,
    task_type: str,
    platform: Optional[str] = None,
    total_posts: int = 0,
    batch_size: int = 100,
) -> Dict:
    """
    创建 AI 分析任务

    Args:
        task_id: 任务 ID
        task_type: 任务类型 (analyze_posts, analyze_all, analyze_news)
        platform: 平台筛选
        total_posts: 要分析的帖子总数
        batch_size: 批次大小

    Returns:
        任务状态字典
    """
    task_data = {
        "task_id": task_id,
        "task_type": task_type,
        "status": AITaskStatus.PENDING,
        "platform": platform or "all",
        "total_posts": total_posts,
        "batch_size": batch_size,
        "analyzed_count": 0,
        "failed_count": 0,
        "skipped_count": 0,
        "current_batch": 0,
        "progress_percent": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "started_at": None,
        "completed_at": None,
        "error": None,
        "last_update": datetime.now(timezone.utc).isoformat(),
    }

    _ai_tasks[task_id] = task_data
    return task_data


def get_ai_task(task_id: str) -> Optional[Dict]:
    """获取任务状态"""
    return _ai_tasks.get(task_id)


def update_ai_task(task_id: str, **kwargs) -> None:
    """更新任务状态"""
    if task_id in _ai_tasks:
        kwargs["last_update"] = datetime.now(timezone.utc).isoformat()
        _ai_tasks[task_id].update(kwargs)


def set_ai_task_running(task_id: str) -> None:
    """设置任务为运行中"""
    update_ai_task(
        task_id,
        status=AITaskStatus.RUNNING,
        started_at=datetime.now(timezone.utc).isoformat(),
    )


def update_ai_task_progress(
    task_id: str,
    analyzed: int,
    failed: int,
    skipped: int = 0,
    current_batch: int = 0,
) -> None:
    """
    更新任务进度

    Args:
        task_id: 任务 ID
        analyzed: 已分析数量
        failed: 失败数量
        skipped: 跳过数量
        current_batch: 当前批次
    """
    task = get_ai_task(task_id)
    if not task:
        return

    total = task.get("total_posts", 0)
    processed = analyzed + failed + skipped
    progress = round((processed / total) * 100, 1) if total > 0 else 0

    update_ai_task(
        task_id,
        analyzed_count=analyzed,
        failed_count=failed,
        skipped_count=skipped,
        current_batch=current_batch,
        progress_percent=min(progress, 100),
    )


def set_ai_task_completed(task_id: str, stats: Dict = None) -> None:
    """设置任务为已完成"""
    completed_at = datetime.now(timezone.utc).isoformat()
    update_data = {
        "status": AITaskStatus.COMPLETED,
        "completed_at": completed_at,
        "progress_percent": 100,
    }

    if stats:
        update_data.update(stats)

    # 计算耗时
    task = get_ai_task(task_id)
    if task and task.get("started_at"):
        started = datetime.fromisoformat(task["started_at"])
        completed = datetime.fromisoformat(completed_at)
        duration = (completed - started).total_seconds()
        update_data["duration_seconds"] = duration
        update_data["duration_human"] = _format_duration(duration)

    update_ai_task(task_id, **update_data)


def set_ai_task_failed(task_id: str, error: str) -> None:
    """设置任务为失败"""
    update_ai_task(
        task_id,
        status=AITaskStatus.FAILED,
        error=error,
        completed_at=datetime.now(timezone.utc).isoformat(),
    )


def cancel_ai_task(task_id: str) -> bool:
    """取消任务"""
    task = get_ai_task(task_id)
    if task and task.get("status") == AITaskStatus.RUNNING:
        update_ai_task(
            task_id,
            status=AITaskStatus.CANCELLED,
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
        return True
    return False


def list_ai_tasks(limit: int = 10, status: Optional[str] = None) -> List[Dict]:
    """
    列出最近的 AI 任务

    Args:
        limit: 返回的最大任务数
        status: 按状态筛选

    Returns:
        任务列表
    """
    tasks = list(_ai_tasks.values())
    
    if status:
        tasks = [t for t in tasks if t.get("status") == status]
    
    # 按创建时间倒序
    tasks.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return tasks[:limit]


def get_running_ai_tasks() -> List[Dict]:
    """获取所有正在运行的任务"""
    return [
        task for task in _ai_tasks.values()
        if task.get("status") == AITaskStatus.RUNNING
    ]


def _format_duration(seconds: float) -> str:
    """格式化持续时间"""
    if seconds < 60:
        return f"{int(seconds)}s"
    elif seconds < 3600:
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins}m {secs}s"
    else:
        hours = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        return f"{hours}h {mins}m"


def cleanup_old_tasks(max_age_hours: int = 24) -> int:
    """
    清理旧任务

    Args:
        max_age_hours: 最大保留时间（小时）

    Returns:
        清理的任务数量
    """
    now = datetime.now(timezone.utc)
    to_delete = []

    for task_id, task in _ai_tasks.items():
        created_at = task.get("created_at")
        if created_at:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            age_hours = (now - created).total_seconds() / 3600
            if age_hours > max_age_hours and task.get("status") != AITaskStatus.RUNNING:
                to_delete.append(task_id)

    for task_id in to_delete:
        del _ai_tasks[task_id]

    return len(to_delete)
