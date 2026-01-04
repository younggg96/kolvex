"""
调度器管理 API 路由
提供定时任务的状态查询和手动触发功能
"""

from fastapi import APIRouter, Depends, HTTPException
from starlette import status as http_status
from typing import Dict, List, Any
import logging

from app.api.dependencies.auth import get_current_user_id
from app.services.scheduler_service import get_scheduler_service, SchedulerService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scheduler", tags=["Scheduler"])


@router.get("/jobs", response_model=List[Dict[str, Any]])
async def get_scheduled_jobs(
    current_user_id: str = Depends(get_current_user_id),
    scheduler: SchedulerService = Depends(get_scheduler_service),
):
    """
    获取所有定时任务信息
    
    返回所有已注册的定时任务及其下次执行时间
    注意：需要登录才能访问
    """
    try:
        jobs = scheduler.get_jobs_info()
        return jobs
    except Exception as e:
        logger.error(f"获取定时任务信息失败: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get jobs info: {str(e)}",
        )


@router.post("/sync-holdings/trigger", response_model=Dict[str, Any])
async def trigger_holdings_sync(
    current_user_id: str = Depends(get_current_user_id),
    scheduler: SchedulerService = Depends(get_scheduler_service),
):
    """
    手动触发所有用户持仓同步
    
    立即执行一次所有用户的持仓同步任务，无需等待定时任务
    注意：这个操作可能需要较长时间，建议管理员使用
    """
    try:
        logger.info(f"用户 {current_user_id} 手动触发持仓同步")
        result = await scheduler.trigger_sync_now()
        return {
            "success": True,
            "message": "Sync completed",
            "details": result,
        }
    except Exception as e:
        logger.error(f"手动触发持仓同步失败: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger sync: {str(e)}",
        )


@router.get("/status", response_model=Dict[str, Any])
async def get_scheduler_status(
    current_user_id: str = Depends(get_current_user_id),
    scheduler: SchedulerService = Depends(get_scheduler_service),
):
    """
    获取调度器状态
    
    返回调度器是否正在运行以及已注册的任务数量
    """
    try:
        is_running = scheduler.scheduler.running
        jobs = scheduler.get_jobs_info()
        return {
            "is_running": is_running,
            "jobs_count": len(jobs),
            "jobs": jobs,
        }
    except Exception as e:
        logger.error(f"获取调度器状态失败: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get scheduler status: {str(e)}",
        )

