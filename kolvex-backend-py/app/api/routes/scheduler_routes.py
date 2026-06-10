"""
调度器管理 API 路由
提供定时任务的状态查询和手动触发功能
"""

from fastapi import APIRouter, Depends, HTTPException
from starlette import status as http_status
from typing import Dict, List, Any, Optional, Literal
import logging
import asyncio
import inspect
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user_id
from app.services.scheduler_service import get_scheduler_service, SchedulerService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scheduler", tags=["Scheduler"])


class RescheduleRequest(BaseModel):
    trigger_type: Literal["interval", "cron"]
    hours: Optional[int] = Field(default=None, ge=1, le=168)
    hour: Optional[int] = Field(default=None, ge=0, le=23)
    minute: Optional[int] = Field(default=None, ge=0, le=59)
    timezone: Optional[str] = None


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


@router.post("/portfolio-snapshot/trigger", response_model=Dict[str, Any])
async def trigger_portfolio_snapshot(
    current_user_id: str = Depends(get_current_user_id),
    scheduler: SchedulerService = Depends(get_scheduler_service),
):
    """
    📸 手动触发 Portfolio Snapshot
    
    立即为所有用户记录投资组合快照，用于生成盈利曲线
    注意：这个操作可能需要较长时间
    """
    try:
        logger.info(f"用户 {current_user_id} 手动触发 Portfolio Snapshot")
        result = await scheduler.record_all_users_snapshots()
        return {
            "success": True,
            "message": f"Snapshot completed for {result.get('success_count', 0)}/{result.get('total_users', 0)} users",
            "details": result,
        }
    except Exception as e:
        logger.error(f"手动触发 Portfolio Snapshot 失败: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger snapshot: {str(e)}",
        )


@router.post("/robinhood-sync/trigger", response_model=Dict[str, Any])
async def trigger_robinhood_sync(
    current_user_id: str = Depends(get_current_user_id),
    scheduler: SchedulerService = Depends(get_scheduler_service),
):
    """Immediately run the same all-account Robinhood sync used by cron."""
    try:
        logger.info(
            "用户 %s 手动触发所有 Robinhood 账户同步",
            current_user_id,
        )
        result = await scheduler.trigger_robinhood_sync_now()
        return {
            "success": result.get("error_count", 0) == 0,
            "message": (
                f"Robinhood sync completed for "
                f"{result.get('success_count', 0)}/"
                f"{result.get('total_users', 0)} users"
            ),
            "details": result,
        }
    except Exception as e:
        logger.error("手动触发 Robinhood 同步失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger Robinhood sync: {str(e)}",
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
        # 尝试从主调度器获取状态
        is_running = False
        try:
            from main import scheduler as main_scheduler
            if main_scheduler:
                is_running = main_scheduler.running
        except ImportError:
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


@router.post("/jobs/{job_id}/pause", response_model=Dict[str, Any])
async def pause_job(
    job_id: str,
    current_user_id: str = Depends(get_current_user_id),
    scheduler: SchedulerService = Depends(get_scheduler_service),
):
    try:
        job = scheduler.pause_job(job_id)
        return {"success": True, "job": job}
    except ValueError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"暂停任务失败: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to pause job: {str(e)}",
        )


@router.post("/jobs/{job_id}/resume", response_model=Dict[str, Any])
async def resume_job(
    job_id: str,
    current_user_id: str = Depends(get_current_user_id),
    scheduler: SchedulerService = Depends(get_scheduler_service),
):
    try:
        job = scheduler.resume_job(job_id)
        return {"success": True, "job": job}
    except ValueError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"恢复任务失败: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resume job: {str(e)}",
        )


@router.post("/jobs/{job_id}/run-now", response_model=Dict[str, Any])
async def run_job_now(
    job_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """
    手动触发 main.py 中已注册的 APScheduler job。
    用于诊断 KOL、新闻、期权异动等自动化任务是否能正常执行。
    """
    try:
        from main import scheduler as main_scheduler

        if main_scheduler is None:
            raise HTTPException(
                status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Main scheduler is not initialized",
            )

        job = main_scheduler.get_job(job_id)
        if not job:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Job not found: {job_id}",
            )

        func = job.func

        async def runner():
            if inspect.iscoroutinefunction(func):
                await func(*job.args, **job.kwargs)
            else:
                await asyncio.to_thread(func, *job.args, **job.kwargs)

        asyncio.create_task(runner())
        return {
            "success": True,
            "message": f"Job {job_id} triggered",
            "job_id": job_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"手动触发任务失败: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run job: {str(e)}",
        )


@router.post("/jobs/{job_id}/reschedule", response_model=Dict[str, Any])
async def reschedule_job(
    job_id: str,
    payload: RescheduleRequest,
    current_user_id: str = Depends(get_current_user_id),
    scheduler: SchedulerService = Depends(get_scheduler_service),
):
    try:
        if payload.trigger_type == "interval":
            if payload.hours is None:
                raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="hours required")
            job = scheduler.reschedule_job(job_id, "interval", hours=payload.hours)
        else:
            if payload.hour is None or payload.minute is None:
                raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="hour/minute required")
            job = scheduler.reschedule_job(
                job_id,
                "cron",
                hour=payload.hour,
                minute=payload.minute,
                timezone=payload.timezone,
            )
        return {"success": True, "job": job}
    except ValueError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"重设任务失败: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reschedule job: {str(e)}",
        )





