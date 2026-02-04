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
from app.services.snaptrade.service import SnapTradeService
from app.services.portfolio_snapshot_service import get_portfolio_snapshot_service

logger = logging.getLogger(__name__)


class SchedulerService:
    """定时任务调度服务"""
    
    def __init__(
        self,
        supabase: Optional[Client] = None,
        snaptrade_service: Optional[SnapTradeService] = None,
    ):
        self.supabase = supabase or get_supabase_service()
        self.snaptrade_service = snaptrade_service or SnapTradeService()
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
        
        # 添加每日同步任务 - 每天早上 8:00 (UTC) 执行
        # 这相当于美东时间凌晨 3:00 或 4:00 (取决于夏令时)
        self.scheduler.add_job(
            self.sync_all_users_holdings,
            CronTrigger(hour=8, minute=0),
            id='daily_sync_holdings',
            name='每日同步所有用户持仓',
            replace_existing=True,
            misfire_grace_time=3600,  # 如果错过执行时间，在1小时内仍然执行
        )
        
        # 可选：添加一个下午的同步任务 - 每天下午 20:00 (UTC)
        # 这相当于美东时间下午 3:00 或 4:00，市场收盘后
        self.scheduler.add_job(
            self.sync_all_users_holdings,
            CronTrigger(hour=20, minute=0),
            id='afternoon_sync_holdings',
            name='下午同步所有用户持仓',
            replace_existing=True,
            misfire_grace_time=3600,
        )
        
        # 📸 每日记录 Portfolio Snapshot - 每天 21:00 (UTC) 执行
        # 在下午持仓同步后1小时执行，确保数据是最新的
        # 用于生成用户盈利曲线
        self.scheduler.add_job(
            self.record_all_users_snapshots,
            CronTrigger(hour=21, minute=0),
            id='daily_portfolio_snapshot',
            name='每日记录投资组合快照',
            replace_existing=True,
            misfire_grace_time=3600,
        )
        
        self.scheduler.start()
        logger.info("定时任务调度器已启动")
        logger.info(f"已注册任务: {[job.id for job in self.scheduler.get_jobs()]}")
        
    def stop(self):
        """停止调度器"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("定时任务调度器已停止")
            
    async def sync_all_users_holdings(self):
        """
        同步所有已连接用户的持仓数据
        这个方法会被定时任务调用
        """
        try:
            logger.info("开始执行每日持仓同步任务")
            start_time = datetime.now()
            
            # 获取所有已连接 SnapTrade 的用户
            result = (
                self.supabase.table("snaptrade_connections")
                .select("user_id, snaptrade_user_id, is_connected")
                .eq("is_connected", True)
                .execute()
            )
            
            if not result.data:
                logger.info("没有已连接的用户需要同步")
                return
            
            total_users = len(result.data)
            success_count = 0
            error_count = 0
            errors = []
            
            logger.info(f"找到 {total_users} 个已连接的用户，开始同步...")
            
            # 逐个同步用户的持仓数据
            for connection in result.data:
                user_id = connection["user_id"]
                try:
                    # 先同步账户
                    await self.snaptrade_service.sync_accounts(user_id)
                    # 再同步持仓
                    positions = await self.snaptrade_service.sync_positions(user_id)
                    success_count += 1
                    logger.info(f"用户 {user_id} 同步成功，共 {len(positions)} 个持仓")
                    
                except Exception as e:
                    error_count += 1
                    error_msg = f"用户 {user_id} 同步失败: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    
            # 记录任务完成情况
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            summary = {
                "total_users": total_users,
                "success_count": success_count,
                "error_count": error_count,
                "duration_seconds": duration,
                "errors": errors[:10],  # 只保留前10个错误
            }
            
            logger.info(
                f"每日持仓同步任务完成 - "
                f"总用户: {total_users}, "
                f"成功: {success_count}, "
                f"失败: {error_count}, "
                f"耗时: {duration:.2f}秒"
            )
            
            # 保存同步日志到数据库（可选）
            await self._save_sync_log(summary)
            
            return summary
            
        except Exception as e:
            logger.error(f"执行每日持仓同步任务失败: {e}", exc_info=True)
            raise
            
    async def _save_sync_log(self, summary: Dict[str, Any]):
        """保存同步日志到数据库"""
        try:
            # 可以创建一个 sync_logs 表来记录同步历史
            # 这里暂时只记录到日志
            pass
        except Exception as e:
            logger.error(f"保存同步日志失败: {e}")
    
    async def record_all_users_snapshots(self):
        """
        📸 为所有已连接用户记录 Portfolio 快照
        这个方法会被定时任务调用，用于生成盈利曲线
        """
        try:
            logger.info("📸 开始执行每日 Portfolio 快照任务")
            start_time = datetime.now()
            
            snapshot_service = get_portfolio_snapshot_service()
            
            # 获取所有已连接 SnapTrade 的用户
            result = (
                self.supabase.table("snaptrade_connections")
                .select("user_id, snaptrade_user_id, is_connected")
                .eq("is_connected", True)
                .execute()
            )
            
            if not result.data:
                logger.info("没有已连接的用户需要记录快照")
                return {"total_users": 0, "success_count": 0, "error_count": 0}
            
            total_users = len(result.data)
            success_count = 0
            error_count = 0
            
            logger.info(f"找到 {total_users} 个已连接的用户，开始记录快照...")
            
            for connection in result.data:
                user_id = connection["user_id"]
                try:
                    # 获取用户最新持仓数据
                    holdings = await self.snaptrade_service.get_user_holdings(user_id)
                    
                    if not holdings or not holdings.get("accounts"):
                        logger.warning(f"用户 {user_id[:8]}... 没有持仓数据，跳过")
                        continue
                    
                    # 计算总值
                    total_value = 0.0
                    total_cost_basis = 0.0
                    total_pnl = 0.0
                    positions_count = 0
                    accounts_count = len(holdings["accounts"])
                    
                    for account in holdings["accounts"]:
                        positions = account.get("snaptrade_positions", [])
                        for pos in positions:
                            price = pos.get("price", 0) or 0
                            units = pos.get("units", 0) or 0
                            avg_cost = pos.get("average_purchase_price", 0) or 0
                            position_type = pos.get("position_type", "equity")
                            
                            multiplier = 100 if position_type == "option" else 1
                            position_value = price * units * multiplier
                            cost_basis = avg_cost * units
                            
                            total_value += position_value
                            total_cost_basis += cost_basis
                            positions_count += 1
                            
                            if position_type == "option":
                                pnl = position_value - cost_basis
                            else:
                                pnl = pos.get("open_pnl") or (position_value - cost_basis)
                            total_pnl += pnl
                    
                    # 记录快照
                    await snapshot_service.record_snapshot(
                        user_id=user_id,
                        total_value=total_value,
                        total_cost_basis=total_cost_basis,
                        unrealized_pnl=total_pnl,
                        positions_count=positions_count,
                        accounts_count=accounts_count,
                    )
                    
                    success_count += 1
                    logger.info(f"✅ 用户 {user_id[:8]}... 快照记录成功: ${total_value:.2f}")
                    
                except Exception as e:
                    error_count += 1
                    logger.error(f"❌ 用户 {user_id[:8]}... 快照记录失败: {e}")
            
            # 记录任务完成情况
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            summary = {
                "total_users": total_users,
                "success_count": success_count,
                "error_count": error_count,
                "duration_seconds": duration,
            }
            
            logger.info(
                f"📸 每日 Portfolio 快照任务完成 - "
                f"总用户: {total_users}, "
                f"成功: {success_count}, "
                f"失败: {error_count}, "
                f"耗时: {duration:.2f}秒"
            )
            
            return summary
            
        except Exception as e:
            logger.error(f"执行每日 Portfolio 快照任务失败: {e}", exc_info=True)
            raise
            
    async def trigger_sync_now(self) -> Dict[str, Any]:
        """
        立即触发同步所有用户持仓
        用于手动触发或测试
        """
        logger.info("手动触发持仓同步任务")
        return await self.sync_all_users_holdings()
        
    def get_jobs_info(self) -> List[Dict[str, Any]]:
        """获取所有定时任务信息"""
        active_scheduler = self._get_active_scheduler()
        return [self._serialize_job(job) for job in active_scheduler.get_jobs()]

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







