"""
测试自动同步持仓功能
"""

import asyncio
import logging
from app.services.snaptrade.service import SnapTradeService
from app.core.supabase import get_supabase_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_sync_all_holdings():
    """测试同步所有用户持仓功能"""
    try:
        logger.info("开始测试同步所有用户持仓")
        
        supabase = get_supabase_service()
        snaptrade_service = SnapTradeService(supabase=supabase)
        
        # 获取所有已连接 SnapTrade 的用户
        result = (
            supabase.table("snaptrade_connections")
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
        
        logger.info(f"找到 {total_users} 个已连接的用户")
        
        # 逐个同步用户的持仓数据
        for connection in result.data:
            user_id = connection["user_id"]
            try:
                logger.info(f"正在同步用户 {user_id[:8]}...")
                
                # 先同步账户
                accounts = await snaptrade_service.sync_accounts(user_id)
                logger.info(f"  - 同步了 {len(accounts)} 个账户")
                
                # 再同步持仓
                positions = await snaptrade_service.sync_positions(user_id)
                logger.info(f"  - 同步了 {len(positions)} 个持仓")
                
                success_count += 1
                logger.info(f"✅ 用户 {user_id[:8]}... 同步成功")
                
            except Exception as e:
                error_count += 1
                logger.error(f"❌ 用户 {user_id[:8]}... 同步失败: {e}")
        
        logger.info(
            f"\n同步完成！\n"
            f"总计: {total_users} 个用户\n"
            f"成功: {success_count} 个\n"
            f"失败: {error_count} 个"
        )
        
    except Exception as e:
        logger.error(f"测试失败: {e}", exc_info=True)


if __name__ == "__main__":
    asyncio.run(test_sync_all_holdings())

