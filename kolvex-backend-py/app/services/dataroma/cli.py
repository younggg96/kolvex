"""
Dataroma 爬虫命令行工具
"""

import argparse
import logging
import sys
from datetime import datetime

from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

from app.core.supabase import get_supabase_service
from .scraper import DataromaScraper
from .sync import (
    sync_superinvestors,
    sync_holdings,
    sync_all_holdings,
    get_current_quarter,
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger(__name__)


def cmd_sync_investors(args):
    """同步超级投资者名单"""
    logger.info("=" * 50)
    logger.info("开始同步超级投资者名单")
    logger.info("=" * 50)
    
    try:
        supabase = get_supabase_service()
        scraper = DataromaScraper()
        
        inserted, updated, total = sync_superinvestors(supabase, scraper)
        
        logger.info("=" * 50)
        logger.info(f"✅ 同步完成!")
        logger.info(f"   - 新增: {inserted}")
        logger.info(f"   - 更新: {updated}")
        logger.info(f"   - 总计: {total}")
        logger.info("=" * 50)
        
    except Exception as e:
        logger.error(f"❌ 同步失败: {e}")
        sys.exit(1)


def cmd_sync_holdings(args):
    """同步持仓数据"""
    logger.info("=" * 50)
    logger.info("开始同步持仓数据")
    logger.info("=" * 50)
    
    # 确定报告日期和季度
    if args.quarter:
        # 解析季度参数，如 "2024-Q4"
        parts = args.quarter.split("-")
        year = int(parts[0])
        q = parts[1].upper()
        
        quarter = args.quarter
        if q == "Q1":
            report_date = f"{year}-03-31"
        elif q == "Q2":
            report_date = f"{year}-06-30"
        elif q == "Q3":
            report_date = f"{year}-09-30"
        else:  # Q4
            report_date = f"{year}-12-31"
    else:
        report_date, quarter = get_current_quarter()
    
    logger.info(f"报告日期: {report_date}")
    logger.info(f"季度: {quarter}")
    
    try:
        supabase = get_supabase_service()
        scraper = DataromaScraper()
        
        if args.code:
            # 同步单个投资者
            inserted, updated = sync_holdings(
                supabase, args.code, report_date, quarter, scraper
            )
            logger.info(f"✅ 同步完成: 新增 {inserted}, 更新 {updated}")
        else:
            # 同步所有投资者
            results = sync_all_holdings(
                supabase, report_date, quarter, None, scraper
            )
            total_inserted = sum(r[0] for r in results.values())
            total_updated = sum(r[1] for r in results.values())
            
            logger.info("=" * 50)
            logger.info(f"✅ 批量同步完成!")
            logger.info(f"   - 投资者数: {len(results)}")
            logger.info(f"   - 新增持仓: {total_inserted}")
            logger.info(f"   - 更新持仓: {total_updated}")
            logger.info("=" * 50)
            
    except Exception as e:
        logger.error(f"❌ 同步失败: {e}")
        sys.exit(1)


def cmd_list_investors(args):
    """列出所有投资者"""
    logger.info("抓取投资者列表...")
    
    scraper = DataromaScraper()
    investors = scraper.scrape_managers()
    
    print("\n" + "=" * 60)
    print(f"共找到 {len(investors)} 个超级投资者")
    print("=" * 60)
    print(f"{'Code':<10} {'Name'}")
    print("-" * 60)
    
    for inv in sorted(investors, key=lambda x: x.name):
        print(f"{inv.code:<10} {inv.name}")
    
    print("=" * 60)


def cmd_show_holdings(args):
    """显示某个投资者的持仓"""
    if not args.code:
        logger.error("请指定投资者代码 (--code)")
        sys.exit(1)
    
    logger.info(f"抓取 {args.code} 的持仓数据...")
    
    scraper = DataromaScraper()
    holdings = scraper.scrape_holdings(args.code)
    
    if not holdings:
        logger.warning("未找到持仓数据")
        return
    
    print("\n" + "=" * 80)
    print(f"持仓列表 ({args.code}) - 共 {len(holdings)} 条")
    print("=" * 80)
    print(f"{'Ticker':<8} {'Company':<30} {'%':<8} {'Value':<15} {'Change'}")
    print("-" * 80)
    
    for h in sorted(holdings, key=lambda x: -x.portfolio_percent):
        change_str = f"{h.change_type or 'n/a'}"
        if h.change_percent:
            change_str += f" ({h.change_percent:+.1f}%)"
        
        value_str = f"${h.market_value:,.0f}" if h.market_value else "n/a"
        
        print(f"{h.ticker:<8} {h.company_name[:28]:<30} {h.portfolio_percent:>6.2f}% {value_str:<15} {change_str}")
    
    print("=" * 80)


def main():
    """主入口"""
    parser = argparse.ArgumentParser(
        description="Dataroma 超级投资者数据爬虫",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 同步投资者名单到数据库
  python -m app.services.dataroma sync-investors
  
  # 同步所有投资者的持仓数据（当前季度）
  python -m app.services.dataroma sync-holdings
  
  # 同步特定季度的持仓数据
  python -m app.services.dataroma sync-holdings --quarter 2024-Q4
  
  # 同步单个投资者的持仓
  python -m app.services.dataroma sync-holdings --code WA
  
  # 仅查看投资者列表（不入库）
  python -m app.services.dataroma list
  
  # 查看某投资者的持仓（不入库）
  python -m app.services.dataroma show --code WA
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    # sync-investors 命令
    parser_sync = subparsers.add_parser(
        "sync-investors",
        help="同步超级投资者名单到数据库"
    )
    parser_sync.set_defaults(func=cmd_sync_investors)
    
    # sync-holdings 命令
    parser_holdings = subparsers.add_parser(
        "sync-holdings",
        help="同步持仓数据到数据库"
    )
    parser_holdings.add_argument(
        "--code",
        type=str,
        help="投资者代码（如 WA）。不指定则同步所有"
    )
    parser_holdings.add_argument(
        "--quarter",
        type=str,
        help="季度标识（如 2024-Q4）。不指定则使用当前季度"
    )
    parser_holdings.set_defaults(func=cmd_sync_holdings)
    
    # list 命令
    parser_list = subparsers.add_parser(
        "list",
        help="列出所有投资者（仅显示，不入库）"
    )
    parser_list.set_defaults(func=cmd_list_investors)
    
    # show 命令
    parser_show = subparsers.add_parser(
        "show",
        help="显示某投资者的持仓（仅显示，不入库）"
    )
    parser_show.add_argument(
        "--code",
        type=str,
        required=True,
        help="投资者代码（如 WA）"
    )
    parser_show.set_defaults(func=cmd_show_holdings)
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        sys.exit(0)
    
    args.func(args)


if __name__ == "__main__":
    main()

