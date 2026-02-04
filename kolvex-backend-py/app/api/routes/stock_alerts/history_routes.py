"""
预警历史记录 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from datetime import datetime, timedelta

from app.core.supabase import get_supabase_service
from app.api.dependencies.auth import get_current_user_id
from .schemas import (
    AlertHistoryResponse,
    AlertHistoryListResponse,
    MessageResponse,
)

router = APIRouter()


@router.get(
    "/history",
    response_model=AlertHistoryListResponse,
    summary="获取预警历史记录",
)
async def get_alert_history(
    symbol: Optional[str] = Query(None, description="按股票代码筛选"),
    alert_type: Optional[str] = Query(None, description="按预警类型筛选"),
    risk_level: Optional[str] = Query(None, description="按风险等级筛选"),
    days: int = Query(7, ge=1, le=90, description="获取最近几天的记录"),
    limit: int = Query(50, ge=1, le=200, description="返回记录数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    current_user_id: str = Depends(get_current_user_id),
):
    """获取当前用户的预警历史记录"""
    try:
        supabase = get_supabase_service()
        
        # 计算时间范围
        since = datetime.utcnow() - timedelta(days=days)
        
        query = (
            supabase.table("stock_alert_history")
            .select("*")
            .eq("user_id", current_user_id)
            .gte("triggered_at", since.isoformat())
            .order("triggered_at", desc=True)
        )
        
        if symbol:
            query = query.eq("symbol", symbol.upper())
        
        if alert_type:
            query = query.eq("alert_type", alert_type)
        
        if risk_level:
            query = query.eq("risk_level", risk_level)
        
        # 获取总数
        count_response = query.execute()
        total = len(count_response.data) if count_response.data else 0
        
        # 分页
        query = query.range(offset, offset + limit - 1)
        response = query.execute()
        
        history = response.data or []
        
        # 处理 JSON 字段
        for record in history:
            if isinstance(record.get("channels_sent"), str):
                import json
                record["channels_sent"] = json.loads(record["channels_sent"])
            if isinstance(record.get("channels_failed"), str):
                import json
                record["channels_failed"] = json.loads(record["channels_failed"])
        
        return AlertHistoryListResponse(
            history=[AlertHistoryResponse(**h) for h in history],
            total=total
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取预警历史失败: {str(e)}"
        )


@router.get(
    "/history/{history_id}",
    response_model=AlertHistoryResponse,
    summary="获取单条预警历史",
)
async def get_alert_history_detail(
    history_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """获取指定的预警历史记录详情"""
    try:
        supabase = get_supabase_service()
        
        response = (
            supabase.table("stock_alert_history")
            .select("*")
            .eq("id", history_id)
            .eq("user_id", current_user_id)
            .single()
            .execute()
        )
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="预警历史记录不存在"
            )
        
        record = response.data
        
        if isinstance(record.get("channels_sent"), str):
            import json
            record["channels_sent"] = json.loads(record["channels_sent"])
        if isinstance(record.get("channels_failed"), str):
            import json
            record["channels_failed"] = json.loads(record["channels_failed"])
        
        return AlertHistoryResponse(**record)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取预警历史详情失败: {str(e)}"
        )


@router.delete(
    "/history",
    response_model=MessageResponse,
    summary="清除预警历史",
)
async def clear_alert_history(
    days_old: int = Query(30, ge=7, le=365, description="清除多少天前的记录"),
    current_user_id: str = Depends(get_current_user_id),
):
    """清除指定天数前的预警历史记录"""
    try:
        supabase = get_supabase_service()
        
        # 计算时间
        before = datetime.utcnow() - timedelta(days=days_old)
        
        # 删除旧记录
        response = (
            supabase.table("stock_alert_history")
            .delete()
            .eq("user_id", current_user_id)
            .lt("triggered_at", before.isoformat())
            .execute()
        )
        
        deleted_count = len(response.data) if response.data else 0
        
        return MessageResponse(
            success=True,
            message=f"已清除 {deleted_count} 条 {days_old} 天前的预警记录"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"清除预警历史失败: {str(e)}"
        )


@router.get(
    "/stats",
    summary="获取预警统计",
)
async def get_alert_stats(
    days: int = Query(30, ge=1, le=365, description="统计最近几天"),
    current_user_id: str = Depends(get_current_user_id),
):
    """获取预警统计数据"""
    try:
        supabase = get_supabase_service()
        
        since = datetime.utcnow() - timedelta(days=days)
        
        # 获取历史记录
        response = (
            supabase.table("stock_alert_history")
            .select("symbol, alert_type, risk_level, triggered_at")
            .eq("user_id", current_user_id)
            .gte("triggered_at", since.isoformat())
            .execute()
        )
        
        history = response.data or []
        
        # 统计
        total_alerts = len(history)
        
        # 按股票统计
        by_symbol = {}
        for h in history:
            symbol = h.get("symbol", "N/A")
            by_symbol[symbol] = by_symbol.get(symbol, 0) + 1
        
        # 按类型统计
        by_type = {}
        for h in history:
            alert_type = h.get("alert_type", "N/A")
            by_type[alert_type] = by_type.get(alert_type, 0) + 1
        
        # 按风险等级统计
        by_risk = {}
        for h in history:
            risk = h.get("risk_level", "未知")
            by_risk[risk] = by_risk.get(risk, 0) + 1
        
        # 获取活跃规则数
        rules_response = (
            supabase.table("stock_alert_rules")
            .select("id")
            .eq("user_id", current_user_id)
            .eq("is_active", True)
            .execute()
        )
        active_rules = len(rules_response.data) if rules_response.data else 0
        
        # 最常触发的股票
        top_symbols = sorted(by_symbol.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return {
            "period_days": days,
            "total_alerts": total_alerts,
            "active_rules": active_rules,
            "by_symbol": by_symbol,
            "by_type": by_type,
            "by_risk_level": by_risk,
            "top_symbols": [{"symbol": s, "count": c} for s, c in top_symbols],
            "avg_alerts_per_day": round(total_alerts / days, 2) if days > 0 else 0,
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取预警统计失败: {str(e)}"
        )
