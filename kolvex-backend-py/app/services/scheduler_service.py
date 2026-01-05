"""
定时任务调度服务
用于管理和执行定时任务，例如每日自动同步用户持仓数据
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from supabase import Client

from app.core.supabase import get_supabase_service
from app.services.snaptrade.service import SnapTradeService

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
            
    async def trigger_sync_now(self) -> Dict[str, Any]:
        """
        立即触发同步所有用户持仓
        用于手动触发或测试
        """
        logger.info("手动触发持仓同步任务")
        return await self.sync_all_users_holdings()
        
    def get_jobs_info(self) -> List[Dict[str, Any]]:
        """获取所有定时任务信息"""
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            })
        return jobs


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


