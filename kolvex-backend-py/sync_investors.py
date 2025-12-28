#!/usr/bin/env python3
"""
Dataroma 超级投资者同步脚本
用于定期从 Dataroma 抓取投资者名单并同步到 Supabase

使用方法:
    python sync_investors.py

环境变量:
    SUPABASE_URL: Supabase 项目 URL
    SUPABASE_KEY: Supabase API Key (需要 service_role key 以绕过 RLS)
"""

import os
import sys
import logging
from datetime import datetime

# 确保可以导入 app 模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger("sync_investors")


def main():
    """主函数"""
    logger.info("=" * 60)
    logger.info("🚀 Dataroma 超级投资者同步脚本")
    logger.info(f"   时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)
    
    # 检查环境变量
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        logger.error("❌ 环境变量未配置!")
        logger.error("   请确保 .env 文件中包含:")
        logger.error("   - SUPABASE_URL")
        logger.error("   - SUPABASE_SERVICE_KEY (或 SUPABASE_KEY)")
        sys.exit(1)
    
    logger.info(f"✓ Supabase URL: {supabase_url[:30]}...")
    logger.info(f"✓ Supabase Key: {supabase_key[:10]}...{supabase_key[-4:]}")
    
    try:
        # 导入依赖
        from app.core.supabase import get_supabase_service
        from app.services.dataroma.scraper import DataromaScraper
        from app.services.dataroma.sync import sync_superinvestors
        
        # 创建客户端
        logger.info("\n📡 连接 Supabase...")
        supabase = get_supabase_service()
        logger.info("✓ 连接成功")
        
        # 创建爬虫
        logger.info("\n🔍 初始化爬虫...")
        scraper = DataromaScraper()
        logger.info("✓ 爬虫就绪")
        
        # 执行同步
        logger.info("\n📥 开始同步数据...")
        inserted, updated, total = sync_superinvestors(supabase, scraper)
        
        # 输出结果
        logger.info("\n" + "=" * 60)
        logger.info("✅ 同步完成!")
        logger.info("-" * 60)
        logger.info(f"   📊 统计:")
        logger.info(f"      - 新增投资者: {inserted}")
        logger.info(f"      - 更新投资者: {updated}")
        logger.info(f"      - 总计处理:   {total}")
        logger.info("=" * 60)
        
        return 0
        
    except ImportError as e:
        logger.error(f"❌ 导入模块失败: {e}")
        logger.error("   请确保已安装所有依赖: pip install -r requirements.txt")
        return 1
        
    except Exception as e:
        logger.error(f"❌ 同步失败: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

