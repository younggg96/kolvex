"""
超级投资者 API 路由
管理 Dataroma 超级投资者数据
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List, Optional
import logging

from app.core.supabase import get_supabase_service
from .schemas import (
    SuperInvestorResponse,
    SuperInvestorListResponse,
    SuperInvestorUpdate,
    SortField,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _format_investor(investor: Dict) -> Dict:
    """格式化投资者数据（完整版）"""
    return {
        "id": investor.get("id"),
        "name": investor.get("name"),
        "code": investor.get("code"),
        "description": investor.get("description"),
        "website": investor.get("website"),
        # 投资组合统计
        "portfolio_value": investor.get("portfolio_value"),
        "stock_count": investor.get("stock_count"),
        "portfolio_date": investor.get("portfolio_date"),
        "period": investor.get("period"),
        # 元数据
        "last_scraped_at": investor.get("last_scraped_at"),
        "is_active": investor.get("is_active", True),
        "created_at": investor.get("created_at"),
        "updated_at": investor.get("updated_at"),
    }


@router.get("/investors", response_model=Dict)
def get_investors(
    # 分页
    limit: int = Query(100, ge=1, le=500, description="返回数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    # 筛选
    is_active: Optional[bool] = Query(None, description="是否活跃"),
    search: Optional[str] = Query(None, description="搜索名称"),
    # 排序
    sort_by: SortField = Query(SortField.NAME, description="排序字段"),
    sort_desc: bool = Query(False, description="是否降序"),
):
    """
    📋 获取超级投资者列表
    
    返回所有被追踪的超级投资者信息。
    
    ### 筛选参数
    - `is_active`: 是否只返回活跃的投资者
    - `search`: 按名称搜索
    
    ### 返回数据
    - 投资者基础信息（名称、代码）
    - 元数据（上次抓取时间、是否活跃）
    """
    try:
        supabase = get_supabase_service()
        
        # 构建查询
        query = supabase.table("superinvestors").select("*", count="exact")
        
        # 筛选条件
        if is_active is not None:
            query = query.eq("is_active", is_active)
        
        if search:
            query = query.ilike("name", f"%{search}%")
        
        # 排序
        query = query.order(sort_by.value, desc=sort_desc)
        
        # 分页
        query = query.range(offset, offset + limit - 1)
        
        # 执行查询
        result = query.execute()
        investors = result.data or []
        total = result.count or 0
        
        return {
            "success": True,
            "data": [_format_investor(inv) for inv in investors],
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(investors) < total,
            },
        }
        
    except Exception as e:
        logger.error(f"获取投资者列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/investors/{code}", response_model=Dict)
def get_investor_by_code(code: str):
    """
    📄 获取单个投资者详情
    
    根据投资者代码获取详细信息。
    
    ### 路径参数
    - `code`: 投资者代码（如 BRK、PI）
    """
    try:
        supabase = get_supabase_service()
        
        result = (
            supabase.table("superinvestors")
            .select("*")
            .eq("code", code)
            .limit(1)
            .execute()
        )
        
        if not result.data:
            raise HTTPException(status_code=404, detail=f"投资者不存在: {code}")
        
        investor = result.data[0]
        
        # 获取持仓统计
        holdings_result = (
            supabase.table("institutional_holdings")
            .select("id", count="exact")
            .eq("investor_code", code)
            .execute()
        )
        holdings_count = holdings_result.count or 0
        
        # 获取最新季度
        latest_quarter_result = (
            supabase.table("institutional_holdings")
            .select("quarter, report_date")
            .eq("investor_code", code)
            .order("report_date", desc=True)
            .limit(1)
            .execute()
        )
        latest_quarter = latest_quarter_result.data[0] if latest_quarter_result.data else None
        
        return {
            "success": True,
            "data": {
                **_format_investor(investor),
                "holdings_count": holdings_count,
                "latest_quarter": latest_quarter.get("quarter") if latest_quarter else None,
                "latest_report_date": latest_quarter.get("report_date") if latest_quarter else None,
            },
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取投资者详情失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.patch("/investors/{code}", response_model=Dict)
def update_investor(code: str, update_data: SuperInvestorUpdate):
    """
    ✏️ 更新投资者信息
    
    更新投资者的描述、网站等信息。
    
    ### 路径参数
    - `code`: 投资者代码
    
    ### 请求体
    - `name`: 名称
    - `description`: 简介
    - `website`: 官网
    - `is_active`: 是否活跃
    """
    try:
        supabase = get_supabase_service()
        
        # 检查是否存在
        existing = (
            supabase.table("superinvestors")
            .select("id")
            .eq("code", code)
            .execute()
        )
        
        if not existing.data:
            raise HTTPException(status_code=404, detail=f"投资者不存在: {code}")
        
        # 构建更新数据（只更新非 None 字段）
        update_dict = {}
        if update_data.name is not None:
            update_dict["name"] = update_data.name
        if update_data.description is not None:
            update_dict["description"] = update_data.description
        if update_data.website is not None:
            update_dict["website"] = update_data.website
        if update_data.is_active is not None:
            update_dict["is_active"] = update_data.is_active
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="没有要更新的字段")
        
        # 执行更新
        result = (
            supabase.table("superinvestors")
            .update(update_dict)
            .eq("code", code)
            .execute()
        )
        
        return {
            "success": True,
            "message": "更新成功",
            "data": _format_investor(result.data[0]) if result.data else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新投资者失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


@router.get("/investors/{code}/summary", response_model=Dict)
def get_investor_summary(code: str):
    """
    📊 获取投资者投资组合摘要
    
    返回投资者的持仓摘要信息，包括：
    - 总持仓数
    - 总市值
    - 前 10 大持仓
    - 最近变动
    """
    try:
        supabase = get_supabase_service()
        
        # 检查投资者是否存在
        investor_result = (
            supabase.table("superinvestors")
            .select("*")
            .eq("code", code)
            .limit(1)
            .execute()
        )
        
        if not investor_result.data:
            raise HTTPException(status_code=404, detail=f"投资者不存在: {code}")
        
        investor = investor_result.data[0]
        
        # 获取最新季度的持仓
        holdings_result = (
            supabase.table("institutional_holdings")
            .select("*")
            .eq("investor_code", code)
            .order("report_date", desc=True)
            .order("portfolio_percent", desc=True)
            .limit(100)
            .execute()
        )
        
        holdings = holdings_result.data or []
        
        if not holdings:
            return {
                "success": True,
                "data": {
                    "investor": _format_investor(investor),
                    "summary": {
                        "total_positions": 0,
                        "total_market_value": 0,
                        "quarter": None,
                    },
                    "top_holdings": [],
                    "recent_changes": [],
                },
            }
        
        # 获取最新季度的持仓
        latest_quarter = holdings[0].get("quarter")
        latest_holdings = [h for h in holdings if h.get("quarter") == latest_quarter]
        
        # 计算统计
        total_value = sum(h.get("market_value", 0) or 0 for h in latest_holdings)
        
        # 前 10 大持仓
        top_holdings = [
            {
                "ticker": h.get("ticker"),
                "company_name": h.get("company_name"),
                "portfolio_percent": h.get("portfolio_percent"),
                "market_value": h.get("market_value"),
                "shares": h.get("shares"),
                "change_type": h.get("change_type"),
                "change_percent": h.get("change_percent"),
            }
            for h in latest_holdings[:10]
        ]
        
        # 最近变动（非 unchanged）
        recent_changes = [
            {
                "ticker": h.get("ticker"),
                "company_name": h.get("company_name"),
                "change_type": h.get("change_type"),
                "change_percent": h.get("change_percent"),
                "portfolio_percent": h.get("portfolio_percent"),
            }
            for h in latest_holdings
            if h.get("change_type") and h.get("change_type") != "unchanged"
        ][:10]
        
        return {
            "success": True,
            "data": {
                "investor": _format_investor(investor),
                "summary": {
                    "total_positions": len(latest_holdings),
                    "total_market_value": total_value,
                    "quarter": latest_quarter,
                    "report_date": latest_holdings[0].get("report_date") if latest_holdings else None,
                },
                "top_holdings": top_holdings,
                "recent_changes": recent_changes,
            },
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取投资者摘要失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")

