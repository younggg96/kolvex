"""
Dataroma 数据同步服务
将抓取的数据同步到 Supabase 数据库（完整版）
"""

import logging
from datetime import datetime
from typing import List, Dict, Optional, Tuple

from supabase import Client

from .scraper import DataromaScraper, SuperInvestor, Holding, HoldingsResult, SectorAllocation

logger = logging.getLogger(__name__)


def sync_superinvestors(
    supabase: Client,
    scraper: Optional[DataromaScraper] = None
) -> Tuple[int, int, int]:
    """
    同步超级投资者名单到数据库
    """
    if scraper is None:
        scraper = DataromaScraper()
    
    logger.info("开始同步超级投资者名单...")
    
    investors = scraper.scrape_managers()
    
    if not investors:
        logger.warning("未抓取到任何投资者数据")
        return 0, 0, 0
    
    inserted = 0
    updated = 0
    now = datetime.utcnow().isoformat()
    
    for investor in investors:
        try:
            data = {
                "name": investor.name,
                "code": investor.code,
                "last_scraped_at": now,
                "is_active": True,
            }
            
            existing = supabase.table("superinvestors").select("id").eq("code", investor.code).execute()
            
            if existing.data:
                supabase.table("superinvestors").update({
                    "name": investor.name,
                    "last_scraped_at": now,
                }).eq("code", investor.code).execute()
                updated += 1
                logger.debug(f"更新投资者: {investor.name} ({investor.code})")
            else:
                supabase.table("superinvestors").insert(data).execute()
                inserted += 1
                logger.debug(f"新增投资者: {investor.name} ({investor.code})")
                
        except Exception as e:
            logger.error(f"同步投资者失败 [{investor.code}]: {e}")
            continue
    
    total = inserted + updated
    logger.info(f"同步完成: 新增 {inserted}, 更新 {updated}, 总计 {total}")
    
    return inserted, updated, total


def sync_holdings(
    supabase: Client,
    investor_code: str,
    report_date: str,
    quarter: str,
    scraper: Optional[DataromaScraper] = None
) -> Tuple[int, int]:
    """
    同步某个投资者的完整持仓数据
    """
    if scraper is None:
        scraper = DataromaScraper()
    
    logger.info(f"开始同步持仓数据: {investor_code} - {quarter}")
    
    # 抓取完整数据
    result = scraper.scrape_holdings(investor_code)
    
    if not result.holdings:
        logger.warning(f"未抓取到持仓数据: {investor_code}")
        return 0, 0
    
    # 更新投资者信息
    _update_investor_info(supabase, investor_code, result.investor)
    
    # 获取投资者 ID
    investor_result = supabase.table("superinvestors").select("id").eq("code", investor_code).execute()
    investor_id = investor_result.data[0]["id"] if investor_result.data else None
    
    if not investor_id:
        logger.error(f"未找到投资者: {investor_code}")
        return 0, 0
    
    inserted = 0
    updated = 0
    now = datetime.utcnow().isoformat()
    
    # 同步持仓数据
    for holding in result.holdings:
        try:
            data = {
                "investor_id": investor_id,
                "investor_code": investor_code,
                "ticker": holding.ticker,
                "company_name": holding.company_name,
                "sector": holding.sector,
                "shares": holding.shares,
                "market_value": holding.market_value,
                "portfolio_percent": holding.portfolio_percent,
                "change_percent": holding.change_percent,
                "change_type": holding.change_type,
                "reported_price": holding.reported_price,
                "current_price": holding.current_price,
                "price_change_percent": holding.price_change_percent,
                "week_52_low": holding.week_52_low,
                "week_52_high": holding.week_52_high,
                "report_date": report_date,
                "quarter": quarter,
                "scraped_at": now,
            }
            
            existing = (
                supabase.table("institutional_holdings")
                .select("id")
                .eq("investor_code", investor_code)
                .eq("ticker", holding.ticker)
                .eq("report_date", report_date)
                .execute()
            )
            
            if existing.data:
                supabase.table("institutional_holdings").update({
                    "shares": holding.shares,
                    "market_value": holding.market_value,
                    "portfolio_percent": holding.portfolio_percent,
                    "change_percent": holding.change_percent,
                    "change_type": holding.change_type,
                    "reported_price": holding.reported_price,
                    "current_price": holding.current_price,
                    "price_change_percent": holding.price_change_percent,
                    "week_52_low": holding.week_52_low,
                    "week_52_high": holding.week_52_high,
                    "scraped_at": now,
                }).eq("id", existing.data[0]["id"]).execute()
                updated += 1
            else:
                supabase.table("institutional_holdings").insert(data).execute()
                inserted += 1
                
        except Exception as e:
            logger.error(f"同步持仓失败 [{investor_code}/{holding.ticker}]: {e}")
            continue
    
    # 同步行业分配
    _sync_sector_allocations(
        supabase, investor_id, investor_code, 
        result.sector_allocations, report_date, quarter
    )
    
    logger.info(f"同步完成 [{investor_code}]: 新增 {inserted}, 更新 {updated}")
    
    return inserted, updated


def _update_investor_info(supabase: Client, code: str, investor: SuperInvestor):
    """更新投资者统计信息"""
    try:
        update_data = {}
        
        if investor.portfolio_value:
            update_data["portfolio_value"] = investor.portfolio_value
        if investor.stock_count:
            update_data["stock_count"] = investor.stock_count
        if investor.portfolio_date:
            update_data["portfolio_date"] = investor.portfolio_date
        if investor.period:
            update_data["period"] = investor.period
        if investor.name:
            update_data["name"] = investor.name
        
        if update_data:
            supabase.table("superinvestors").update(update_data).eq("code", code).execute()
            logger.debug(f"更新投资者信息: {code}")
            
    except Exception as e:
        logger.warning(f"更新投资者信息失败 [{code}]: {e}")


def _sync_sector_allocations(
    supabase: Client,
    investor_id: str,
    investor_code: str,
    allocations: List[SectorAllocation],
    report_date: str,
    quarter: str
):
    """同步行业分配数据"""
    if not allocations:
        return
    
    now = datetime.utcnow().isoformat()
    
    for alloc in allocations:
        try:
            data = {
                "investor_id": investor_id,
                "investor_code": investor_code,
                "sector_name": alloc.sector_name,
                "allocation_percent": alloc.allocation_percent,
                "report_date": report_date,
                "quarter": quarter,
                "scraped_at": now,
            }
            
            # Upsert
            existing = (
                supabase.table("investor_sector_allocation")
                .select("id")
                .eq("investor_code", investor_code)
                .eq("sector_name", alloc.sector_name)
                .eq("report_date", report_date)
                .execute()
            )
            
            if existing.data:
                supabase.table("investor_sector_allocation").update({
                    "allocation_percent": alloc.allocation_percent,
                    "scraped_at": now,
                }).eq("id", existing.data[0]["id"]).execute()
            else:
                supabase.table("investor_sector_allocation").insert(data).execute()
                
        except Exception as e:
            logger.warning(f"同步行业分配失败 [{investor_code}/{alloc.sector_name}]: {e}")


def sync_all_holdings(
    supabase: Client,
    report_date: str,
    quarter: str,
    investor_codes: Optional[List[str]] = None,
    scraper: Optional[DataromaScraper] = None
) -> Dict[str, Tuple[int, int]]:
    """
    批量同步所有投资者的持仓数据
    """
    if scraper is None:
        scraper = DataromaScraper()
    
    if investor_codes is None:
        result = supabase.table("superinvestors").select("code").eq("is_active", True).execute()
        investor_codes = [r["code"] for r in result.data]
    
    logger.info(f"开始批量同步持仓，共 {len(investor_codes)} 个投资者")
    
    results = {}
    for code in investor_codes:
        try:
            inserted, updated = sync_holdings(
                supabase, code, report_date, quarter, scraper
            )
            results[code] = (inserted, updated)
        except Exception as e:
            logger.error(f"同步持仓失败 [{code}]: {e}")
            results[code] = (0, 0)
    
    total_inserted = sum(r[0] for r in results.values())
    total_updated = sum(r[1] for r in results.values())
    logger.info(f"批量同步完成: 总新增 {total_inserted}, 总更新 {total_updated}")
    
    return results


def get_current_quarter() -> Tuple[str, str]:
    """获取当前季度信息"""
    now = datetime.utcnow()
    year = now.year
    month = now.month
    
    if month >= 11:
        quarter = f"{year}-Q3"
        report_date = f"{year}-09-30"
    elif month >= 8:
        quarter = f"{year}-Q2"
        report_date = f"{year}-06-30"
    elif month >= 5:
        quarter = f"{year}-Q1"
        report_date = f"{year}-03-31"
    elif month >= 2:
        quarter = f"{year-1}-Q4"
        report_date = f"{year-1}-12-31"
    else:
        quarter = f"{year-1}-Q3"
        report_date = f"{year-1}-09-30"
    
    return report_date, quarter
