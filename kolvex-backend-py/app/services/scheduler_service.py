"""
定时任务调度服务
用于管理和执行定时任务，例如每日自动同步用户持仓数据
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from supabase import Client

from app.core.supabase import get_supabase_service
from app.services.ibkr import get_ibkr_flex_service

logger = logging.getLogger(__name__)


class SchedulerService:
    """定时任务调度服务"""
    
    def __init__(
        self,
        supabase: Optional[Client] = None,
    ):
        self.supabase = supabase or get_supabase_service()
        self.scheduler = AsyncIOScheduler()

    def _get_active_scheduler(self):
        try:
            from main import scheduler as main_scheduler
            if main_scheduler:
                return main_scheduler
        except ImportError:
            pass
        return self.scheduler

    def _serialize_job(self, job) -> Dict[str, Any]:
        trigger_type = type(job.trigger).__name__
        trigger_details = str(job.trigger)
        trigger_config: Dict[str, Any] = {"type": "unknown"}

        if isinstance(job.trigger, IntervalTrigger):
            interval: timedelta = job.trigger.interval
            hours = interval.total_seconds() / 3600
            trigger_config = {
                "type": "interval",
                "hours": int(hours) if hours.is_integer() else round(hours, 2),
            }
        elif isinstance(job.trigger, CronTrigger):
            def _get_field(name: str) -> Optional[str]:
                for field in job.trigger.fields:
                    if field.name == name:
                        return str(field)
                return None
            trigger_config = {
                "type": "cron",
                "hour": _get_field("hour"),
                "minute": _get_field("minute"),
                "timezone": str(job.trigger.timezone) if job.trigger.timezone else None,
            }

        return {
            "id": job.id,
            "name": job.name,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger_type": trigger_type,
            "trigger_details": trigger_details,
            "trigger_config": trigger_config,
            "is_paused": job.next_run_time is None,
        }
        
    def start(self):
        """启动调度器"""
        if self.scheduler.running:
            logger.warning("调度器已经在运行中")
            return
        
        self.scheduler.add_job(
            self.sync_all_robinhood_accounts,
            CronTrigger(
                day_of_week="mon-fri",
                hour=14,
                minute=15,
                timezone="America/Los_Angeles",
            ),
            id="robinhood_daily_sync",
            name="Robinhood 每日自动同步 - 下午 2:15 PST",
            replace_existing=True,
            misfire_grace_time=7200,
            max_instances=1,
            coalesce=True,
        )

        self.scheduler.add_job(
            self.sync_all_ibkr_accounts,
            CronTrigger(
                day_of_week="mon-fri",
                hour=14,
                minute=30,
                timezone="America/Los_Angeles",
            ),
            id="ibkr_daily_sync",
            name="IBKR Flex 每日自动同步 - 下午 2:30 PST",
            replace_existing=True,
            misfire_grace_time=7200,
            max_instances=1,
            coalesce=True,
        )
        
        self.scheduler.start()
        logger.info("定时任务调度器已启动")
        logger.info(f"已注册任务: {[job.id for job in self.scheduler.get_jobs()]}")
        
    def stop(self):
        """停止调度器"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("定时任务调度器已停止")
            
    async def sync_all_robinhood_accounts(self) -> Dict[str, Any]:
        """Sync every connected Robinhood account sequentially.

        robin_stocks keeps authentication in module-level state, so running
        multiple users concurrently can leak one user's session into another
        request. Sequential execution keeps the scheduled sync deterministic.
        """
        from app.services.robinhood.service import (
            RobinhoodService,
            RobinhoodSessionExpired,
        )

        logger.info("开始执行 Robinhood 每日自动同步任务")
        started_at = datetime.now()
        service = RobinhoodService(supabase=self.supabase)

        result = (
            self.supabase.table("robinhood_connections")
            .select("user_id, username, is_connected, last_synced_at")
            .eq("is_connected", True)
            .execute()
        )
        connections = result.data or []

        summary: Dict[str, Any] = {
            "total_users": len(connections),
            "success_count": 0,
            "error_count": 0,
            "session_expired_count": 0,
            "errors": [],
        }

        for connection in connections:
            user_id = connection["user_id"]
            try:
                positions = await service.sync(user_id)
                summary["success_count"] += 1
                logger.info(
                    "Robinhood 自动同步成功: user=%s positions=%s",
                    user_id[:8],
                    len(positions),
                )
            except RobinhoodSessionExpired as error:
                summary["session_expired_count"] += 1
                summary["error_count"] += 1
                summary["errors"].append(
                    {"user_id": user_id, "error": str(error)}
                )
                logger.warning(
                    "Robinhood 自动同步需要用户重新连接: user=%s error=%s",
                    user_id[:8],
                    error,
                )
            except Exception as error:
                summary["error_count"] += 1
                summary["errors"].append(
                    {"user_id": user_id, "error": str(error)[:500]}
                )
                logger.exception(
                    "Robinhood 自动同步失败: user=%s",
                    user_id[:8],
                )

        summary["duration_seconds"] = (
            datetime.now() - started_at
        ).total_seconds()
        summary["errors"] = summary["errors"][:20]
        logger.info(
            "Robinhood 每日自动同步完成: total=%s success=%s failed=%s expired=%s",
            summary["total_users"],
            summary["success_count"],
            summary["error_count"],
            summary["session_expired_count"],
        )
        return summary
            
    async def trigger_robinhood_sync_now(self) -> Dict[str, Any]:
        logger.info("手动触发所有 Robinhood 账户同步任务")
        return await self.sync_all_robinhood_accounts()

    async def trigger_sync_now(self) -> Dict[str, Any]:
        """Run each supported direct broker sync once."""
        return {
            "robinhood": await self.sync_all_robinhood_accounts(),
            "ibkr": await self.sync_all_ibkr_accounts(),
        }

    async def sync_all_ibkr_accounts(self) -> Dict[str, Any]:
        logger.info("开始执行 IBKR Flex 每日同步任务")
        return await get_ibkr_flex_service().sync_all_connected()
        
    def get_jobs_info(self) -> List[Dict[str, Any]]:
        """获取所有定时任务信息"""
        active_scheduler = self._get_active_scheduler()
        jobs = [self._serialize_job(job) for job in active_scheduler.get_jobs()]
        try:
            from main import scheduler_job_health

            for job in jobs:
                job["health"] = scheduler_job_health.get(job["id"], {})
        except ImportError:
            pass
        return jobs

    def pause_job(self, job_id: str) -> Dict[str, Any]:
        scheduler = self._get_active_scheduler()
        job = scheduler.get_job(job_id)
        if not job:
            raise ValueError("Job not found")
        job.pause()
        return self._serialize_job(job)

    def resume_job(self, job_id: str) -> Dict[str, Any]:
        scheduler = self._get_active_scheduler()
        job = scheduler.get_job(job_id)
        if not job:
            raise ValueError("Job not found")
        job.resume()
        return self._serialize_job(job)

    def reschedule_job(self, job_id: str, trigger_type: str, **kwargs) -> Dict[str, Any]:
        scheduler = self._get_active_scheduler()
        job = scheduler.get_job(job_id)
        if not job:
            raise ValueError("Job not found")

        if trigger_type == "interval":
            hours = int(kwargs.get("hours", 0))
            if hours <= 0:
                raise ValueError("Interval hours must be > 0")
            trigger = IntervalTrigger(hours=hours)
        elif trigger_type == "cron":
            hour = kwargs.get("hour")
            minute = kwargs.get("minute")
            timezone = kwargs.get("timezone") or getattr(job.trigger, "timezone", None)
            if hour is None or minute is None:
                raise ValueError("Cron hour and minute are required")
            trigger = CronTrigger(hour=int(hour), minute=int(minute), timezone=timezone)
        else:
            raise ValueError("Unsupported trigger type")

        job.reschedule(trigger=trigger)
        return self._serialize_job(job)


# 全局调度器实例
_scheduler_instance: Optional[SchedulerService] = None


def get_scheduler_service() -> SchedulerService:
    """获取调度器服务实例（单例模式）"""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = SchedulerService()
    return _scheduler_instance


def start_scheduler():
    """启动全局调度器"""
    scheduler = get_scheduler_service()
    scheduler.start()


def stop_scheduler():
    """停止全局调度器"""
    global _scheduler_instance
    if _scheduler_instance:
        _scheduler_instance.stop()
        _scheduler_instance = None
