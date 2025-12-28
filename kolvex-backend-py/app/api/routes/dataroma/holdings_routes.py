"""
机构持仓 API 路由
查询超级投资者的持仓数据
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List, Optional
import logging

from app.core.supabase import get_supabase_service
from .schemas import HoldingSortField, ChangeType

router = APIRouter()
logger = logging.getLogger(__name__)


def _format_holding(holding: Dict, investor_name: Optional[str] = None) -> Dict:
    """格式化持仓数据（完整版）"""
    return {
        "id": holding.get("id"),
        "investor_id": holding.get("investor_id"),
        "investor_code": holding.get("investor_code"),
        "investor_name": investor_name,
        # 股票信息
        "ticker": holding.get("ticker"),
        "company_name": holding.get("company_name"),
        "sector": holding.get("sector"),
        # 持仓数据
        "shares": holding.get("shares", 0),
        "market_value": holding.get("market_value"),
        "portfolio_percent": holding.get("portfolio_percent"),
        # 变动信息
        "change_percent": holding.get("change_percent"),
        "change_type": holding.get("change_type"),
        # 价格信息
        "reported_price": holding.get("reported_price"),
        "current_price": holding.get("current_price"),
        "price_change_percent": holding.get("price_change_percent"),
        "week_52_low": holding.get("week_52_low"),
        "week_52_high": holding.get("week_52_high"),
        # 报告信息
        "report_date": holding.get("report_date"),
        "filing_date": holding.get("filing_date"),
        "quarter": holding.get("quarter"),
        # AI 分析
        "ai_analysis": holding.get("ai_analysis"),
        "ai_analysis_at": holding.get("ai_analysis_at"),
        # 元数据
        "scraped_at": holding.get("scraped_at"),
        "created_at": holding.get("created_at"),
        "updated_at": holding.get("updated_at"),
    }


@router.get("/holdings", response_model=Dict)
def get_holdings(
    # 分页
    limit: int = Query(50, ge=1, le=500, description="返回数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    # 筛选
    investor_code: Optional[str] = Query(None, description="投资者代码"),
    ticker: Optional[str] = Query(None, description="股票代码"),
    quarter: Optional[str] = Query(None, description="季度（如 2024-Q4）"),
    change_type: Optional[ChangeType] = Query(None, description="变动类型"),
    min_percent: Optional[float] = Query(None, ge=0, le=100, description="最小持仓百分比"),
    # 排序
    sort_by: HoldingSortField = Query(
        HoldingSortField.PORTFOLIO_PERCENT, description="排序字段"
    ),
    sort_desc: bool = Query(True, description="是否降序"),
):
    """
    📋 获取持仓列表
    
    返回机构投资者的持仓数据。
    
    ### 筛选参数
    - `investor_code`: 按投资者代码筛选
    - `ticker`: 按股票代码筛选
    - `quarter`: 按季度筛选
    - `change_type`: 按变动类型筛选（new/add/reduce/sold/unchanged）
    - `min_percent`: 最小持仓百分比
    
    ### 返回数据
    - 持仓详情（股票代码、公司名称、股数、市值、占比）
    - 变动信息（变动类型、变动百分比）
    - 报告信息（报告日期、季度）
    """
    try:
        supabase = get_supabase_service()
        
        # 构建查询
        query = supabase.table("institutional_holdings").select("*", count="exact")
        
        # 筛选条件
        if investor_code:
            query = query.eq("investor_code", investor_code)
        
        if ticker:
            query = query.eq("ticker", ticker.upper())
        
        if quarter:
            query = query.eq("quarter", quarter)
        
        if change_type:
            query = query.eq("change_type", change_type.value)
        
        if min_percent is not None:
            query = query.gte("portfolio_percent", min_percent)
        
        # 排序
        query = query.order(sort_by.value, desc=sort_desc)
        
        # 分页
        query = query.range(offset, offset + limit - 1)
        
        # 执行查询
        result = query.execute()
        holdings = result.data or []
        total = result.count or 0
        
        # 获取投资者名称映射
        investor_codes = list(set(h.get("investor_code") for h in holdings if h.get("investor_code")))
        investor_names = {}
        
        if investor_codes:
            investors_result = (
                supabase.table("superinvestors")
                .select("code, name")
                .in_("code", investor_codes)
                .execute()
            )
            investor_names = {
                inv["code"]: inv["name"] 
                for inv in (investors_result.data or [])
            }
        
        return {
            "success": True,
            "data": [
                _format_holding(h, investor_names.get(h.get("investor_code")))
                for h in holdings
            ],
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(holdings) < total,
            },
        }
        
    except Exception as e:
        logger.error(f"获取持仓列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/holdings/by-investor/{code}", response_model=Dict)
def get_holdings_by_investor(
    code: str,
    quarter: Optional[str] = Query(None, description="季度（不指定则返回最新）"),
    limit: int = Query(100, ge=1, le=500, description="返回数量"),
):
    """
    📊 获取某投资者的持仓
    
    返回指定投资者的持仓列表，按持仓百分比降序排列。
    
    ### 路径参数
    - `code`: 投资者代码（如 BRK）
    
    ### 查询参数
    - `quarter`: 指定季度，不指定则返回最新季度
    """
    try:
        supabase = get_supabase_service()
        
        # 如果没有指定季度，获取最新季度
        if not quarter:
            latest = (
                supabase.table("institutional_holdings")
                .select("quarter")
                .eq("investor_code", code)
                .order("report_date", desc=True)
                .limit(1)
                .execute()
            )
            if latest.data:
                quarter = latest.data[0]["quarter"]
        
        # 构建查询
        query = (
            supabase.table("institutional_holdings")
            .select("*")
            .eq("investor_code", code)
        )
        
        if quarter:
            query = query.eq("quarter", quarter)
        
        query = query.order("portfolio_percent", desc=True).limit(limit)
        
        result = query.execute()
        holdings = result.data or []
        
        # 获取投资者信息
        investor_result = (
            supabase.table("superinvestors")
            .select("*")
            .eq("code", code)
            .limit(1)
            .execute()
        )
        investor = investor_result.data[0] if investor_result.data else None
        investor_name = investor.get("name") if investor else None
        
        # 计算统计
        total_value = sum(h.get("market_value", 0) or 0 for h in holdings)
        
        return {
            "success": True,
            "data": {
                "investor": {
                    "code": code,
                    "name": investor_name,
                },
                "quarter": quarter,
                "summary": {
                    "total_positions": len(holdings),
                    "total_market_value": total_value,
                },
                "holdings": [
                    _format_holding(h, investor_name) for h in holdings
                ],
            },
        }
        
    except Exception as e:
        logger.error(f"获取投资者持仓失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/holdings/by-stock/{ticker}", response_model=Dict)
def get_holdings_by_stock(
    ticker: str,
    quarter: Optional[str] = Query(None, description="季度（不指定则返回最新）"),
):
    """
    📈 获取某股票的持有者
    
    查看哪些超级投资者持有某只股票。
    
    ### 路径参数
    - `ticker`: 股票代码（如 AAPL）
    
    ### 查询参数
    - `quarter`: 指定季度，不指定则返回最新季度
    """
    try:
        supabase = get_supabase_service()
        
        # 如果没有指定季度，获取最新季度
        if not quarter:
            latest = (
                supabase.table("institutional_holdings")
                .select("quarter")
                .eq("ticker", ticker.upper())
                .order("report_date", desc=True)
                .limit(1)
                .execute()
            )
            if latest.data:
                quarter = latest.data[0]["quarter"]
        
        # 获取持仓数据
        query = (
            supabase.table("institutional_holdings")
            .select("*")
            .eq("ticker", ticker.upper())
        )
        
        if quarter:
            query = query.eq("quarter", quarter)
        
        query = query.order("market_value", desc=True)
        
        result = query.execute()
        holdings = result.data or []
        
        if not holdings:
            return {
                "success": True,
                "data": {
                    "ticker": ticker.upper(),
                    "company_name": None,
                    "quarter": quarter,
                    "holder_count": 0,
                    "total_shares": 0,
                    "total_market_value": 0,
                    "holders": [],
                },
            }
        
        # 获取投资者名称
        investor_codes = list(set(h.get("investor_code") for h in holdings))
        investors_result = (
            supabase.table("superinvestors")
            .select("code, name")
            .in_("code", investor_codes)
            .execute()
        )
        investor_names = {
            inv["code"]: inv["name"] 
            for inv in (investors_result.data or [])
        }
        
        # 统计
        total_shares = sum(h.get("shares", 0) or 0 for h in holdings)
        total_value = sum(h.get("market_value", 0) or 0 for h in holdings)
        company_name = holdings[0].get("company_name") if holdings else None
        
        return {
            "success": True,
            "data": {
                "ticker": ticker.upper(),
                "company_name": company_name,
                "quarter": quarter,
                "holder_count": len(holdings),
                "total_shares": total_shares,
                "total_market_value": total_value,
                "holders": [
                    {
                        "investor_code": h.get("investor_code"),
                        "investor_name": investor_names.get(h.get("investor_code")),
                        "shares": h.get("shares"),
                        "market_value": h.get("market_value"),
                        "portfolio_percent": h.get("portfolio_percent"),
                        "change_type": h.get("change_type"),
                        "change_percent": h.get("change_percent"),
                    }
                    for h in holdings
                ],
            },
        }
        
    except Exception as e:
        logger.error(f"获取股票持有者失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/holdings/popular", response_model=Dict)
def get_popular_stocks(
    quarter: Optional[str] = Query(None, description="季度"),
    min_holders: int = Query(3, ge=1, description="最少持有者数量"),
    limit: int = Query(50, ge=1, le=200, description="返回数量"),
):
    """
    🔥 获取热门股票
    
    返回被最多超级投资者持有的股票。
    
    ### 查询参数
    - `quarter`: 指定季度，不指定则使用最新数据
    - `min_holders`: 最少持有者数量（默认 3）
    """
    try:
        supabase = get_supabase_service()
        
        # 获取持仓数据
        query = supabase.table("institutional_holdings").select("*")
        
        if quarter:
            query = query.eq("quarter", quarter)
        
        result = query.execute()
        holdings = result.data or []
        
        if not holdings:
            return {
                "success": True,
                "data": [],
                "quarter": quarter,
            }
        
        # 如果没有指定季度，只保留每个投资者最新的记录
        if not quarter:
            # 按投资者和股票分组，保留最新的
            latest_holdings = {}
            for h in holdings:
                key = (h.get("investor_code"), h.get("ticker"))
                if key not in latest_holdings or h.get("report_date", "") > latest_holdings[key].get("report_date", ""):
                    latest_holdings[key] = h
            holdings = list(latest_holdings.values())
        
        # 按股票代码聚合
        stock_data = {}
        for h in holdings:
            ticker = h.get("ticker")
            if not ticker:
                continue
            
            if ticker not in stock_data:
                stock_data[ticker] = {
                    "ticker": ticker,
                    "company_name": h.get("company_name"),
                    "holders": [],
                    "total_market_value": 0,
                }
            
            stock_data[ticker]["holders"].append({
                "investor_code": h.get("investor_code"),
                "shares": h.get("shares"),
                "market_value": h.get("market_value"),
                "portfolio_percent": h.get("portfolio_percent"),
                "change_type": h.get("change_type"),
            })
            stock_data[ticker]["total_market_value"] += h.get("market_value", 0) or 0
        
        # 过滤和排序
        popular_stocks = [
            {
                **data,
                "holder_count": len(data["holders"]),
            }
            for data in stock_data.values()
            if len(data["holders"]) >= min_holders
        ]
        
        popular_stocks.sort(key=lambda x: (-x["holder_count"], -x["total_market_value"]))
        
        # 获取投资者名称
        all_codes = set()
        for stock in popular_stocks[:limit]:
            for holder in stock["holders"]:
                all_codes.add(holder["investor_code"])
        
        if all_codes:
            investors_result = (
                supabase.table("superinvestors")
                .select("code, name")
                .in_("code", list(all_codes))
                .execute()
            )
            investor_names = {
                inv["code"]: inv["name"] 
                for inv in (investors_result.data or [])
            }
            
            # 添加投资者名称
            for stock in popular_stocks[:limit]:
                for holder in stock["holders"]:
                    holder["investor_name"] = investor_names.get(holder["investor_code"])
        
        return {
            "success": True,
            "data": popular_stocks[:limit],
            "quarter": quarter,
        }
        
    except Exception as e:
        logger.error(f"获取热门股票失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/holdings/changes", response_model=Dict)
def get_recent_changes(
    quarter: Optional[str] = Query(None, description="季度"),
    change_type: Optional[ChangeType] = Query(None, description="变动类型"),
    limit: int = Query(50, ge=1, le=200, description="返回数量"),
):
    """
    📊 获取最近持仓变动
    
    返回超级投资者的最近持仓变动，包括新建仓、加仓、减仓、清仓。
    
    ### 查询参数
    - `quarter`: 指定季度
    - `change_type`: 筛选变动类型
    """
    try:
        supabase = get_supabase_service()
        
        # 构建查询
        query = (
            supabase.table("institutional_holdings")
            .select("*")
            .neq("change_type", "unchanged")
        )
        
        if quarter:
            query = query.eq("quarter", quarter)
        
        if change_type:
            query = query.eq("change_type", change_type.value)
        
        # 按变动幅度排序（绝对值）
        query = query.order("report_date", desc=True).limit(limit)
        
        result = query.execute()
        changes = result.data or []
        
        # 获取投资者名称
        investor_codes = list(set(h.get("investor_code") for h in changes if h.get("investor_code")))
        investor_names = {}
        
        if investor_codes:
            investors_result = (
                supabase.table("superinvestors")
                .select("code, name")
                .in_("code", investor_codes)
                .execute()
            )
            investor_names = {
                inv["code"]: inv["name"] 
                for inv in (investors_result.data or [])
            }
        
        # 格式化结果
        formatted_changes = []
        for h in changes:
            formatted_changes.append({
                "investor_code": h.get("investor_code"),
                "investor_name": investor_names.get(h.get("investor_code")),
                "ticker": h.get("ticker"),
                "company_name": h.get("company_name"),
                "change_type": h.get("change_type"),
                "change_percent": h.get("change_percent"),
                "shares": h.get("shares"),
                "market_value": h.get("market_value"),
                "portfolio_percent": h.get("portfolio_percent"),
                "quarter": h.get("quarter"),
                "report_date": h.get("report_date"),
            })
        
        return {
            "success": True,
            "data": formatted_changes,
            "quarter": quarter,
        }
        
    except Exception as e:
        logger.error(f"获取持仓变动失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/holdings/quarters", response_model=Dict)
def get_available_quarters():
    """
    📅 获取可用季度列表
    
    返回数据库中所有可用的季度。
    """
    try:
        supabase = get_supabase_service()
        
        result = (
            supabase.table("institutional_holdings")
            .select("quarter, report_date")
            .order("report_date", desc=True)
            .execute()
        )
        
        # 去重
        quarters = []
        seen = set()
        for h in (result.data or []):
            quarter = h.get("quarter")
            if quarter and quarter not in seen:
                seen.add(quarter)
                quarters.append({
                    "quarter": quarter,
                    "report_date": h.get("report_date"),
                })
        
        return {
            "success": True,
            "data": quarters,
        }
        
    except Exception as e:
        logger.error(f"获取季度列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/holdings/sectors/{code}", response_model=Dict)
def get_investor_sectors(
    code: str,
    quarter: Optional[str] = Query(None, description="季度"),
):
    """
    📊 获取投资者的行业分配
    
    返回指定投资者的投资组合行业分配情况。
    
    ### 路径参数
    - `code`: 投资者代码
    """
    try:
        supabase = get_supabase_service()
        
        query = (
            supabase.table("investor_sector_allocation")
            .select("*")
            .eq("investor_code", code)
        )
        
        if quarter:
            query = query.eq("quarter", quarter)
        
        query = query.order("allocation_percent", desc=True)
        
        result = query.execute()
        allocations = result.data or []
        
        return {
            "success": True,
            "data": {
                "investor_code": code,
                "quarter": quarter,
                "sectors": [
                    {
                        "sector_name": a.get("sector_name"),
                        "allocation_percent": a.get("allocation_percent"),
                    }
                    for a in allocations
                ],
            },
        }
        
    except Exception as e:
        logger.error(f"获取行业分配失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")

