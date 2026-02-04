"""
预警规则 CRUD API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional

from app.core.supabase import get_supabase_service
from app.api.dependencies.auth import get_current_user_id
from app.services.stock_alert import get_stock_alert_service
from .schemas import (
    AlertRuleCreate,
    AlertRuleUpdate,
    AlertRuleResponse,
    AlertRulesListResponse,
    MessageResponse,
)

router = APIRouter()


@router.get(
    "/rules",
    response_model=AlertRulesListResponse,
    summary="获取预警规则列表",
)
async def get_alert_rules(
    is_active: Optional[bool] = None,
    current_user_id: str = Depends(get_current_user_id),
):
    """获取当前用户的所有预警规则"""
    try:
        supabase = get_supabase_service()
        
        query = (
            supabase.table("stock_alert_rules")
            .select("*")
            .eq("user_id", current_user_id)
            .order("created_at", desc=True)
        )
        
        if is_active is not None:
            query = query.eq("is_active", is_active)
        
        response = query.execute()
        rules = response.data or []
        
        # 转换 channels 字段
        for rule in rules:
            if isinstance(rule.get("channels"), str):
                import json
                rule["channels"] = json.loads(rule["channels"])
        
        return AlertRulesListResponse(
            rules=[AlertRuleResponse(**rule) for rule in rules],
            total=len(rules)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取预警规则失败: {str(e)}"
        )


@router.get(
    "/rules/{rule_id}",
    response_model=AlertRuleResponse,
    summary="获取单个预警规则",
)
async def get_alert_rule(
    rule_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """获取指定的预警规则"""
    try:
        supabase = get_supabase_service()
        
        response = (
            supabase.table("stock_alert_rules")
            .select("*")
            .eq("id", rule_id)
            .eq("user_id", current_user_id)
            .single()
            .execute()
        )
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="预警规则不存在"
            )
        
        rule = response.data
        if isinstance(rule.get("channels"), str):
            import json
            rule["channels"] = json.loads(rule["channels"])
        
        return AlertRuleResponse(**rule)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取预警规则失败: {str(e)}"
        )


@router.post(
    "/rules",
    response_model=AlertRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建预警规则",
)
async def create_alert_rule(
    rule_data: AlertRuleCreate,
    current_user_id: str = Depends(get_current_user_id),
):
    """创建新的预警规则"""
    try:
        supabase = get_supabase_service()
        
        # 检查是否已存在相同股票的规则
        existing = (
            supabase.table("stock_alert_rules")
            .select("id")
            .eq("user_id", current_user_id)
            .eq("symbol", rule_data.symbol.upper())
            .execute()
        )
        
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"已存在 {rule_data.symbol} 的预警规则"
            )
        
        # 转换 channels 为 JSON 字符串
        import json
        channels_json = json.dumps([ch.value for ch in rule_data.channels])
        
        insert_data = {
            "user_id": current_user_id,
            "symbol": rule_data.symbol.upper(),
            "company_name": rule_data.company_name,
            "daily_change_threshold": rule_data.daily_change_threshold,
            "spike_change_threshold": rule_data.spike_change_threshold,
            "price_above": rule_data.price_above,
            "price_below": rule_data.price_below,
            "volume_surge_multiplier": rule_data.volume_surge_multiplier,
            "premarket_enabled": rule_data.premarket_enabled,
            "regular_hours_enabled": rule_data.regular_hours_enabled,
            "afterhours_enabled": rule_data.afterhours_enabled,
            "channels": channels_json,
            "ai_analysis_enabled": rule_data.ai_analysis_enabled,
            "cooldown_minutes": rule_data.cooldown_minutes,
        }
        
        response = (
            supabase.table("stock_alert_rules")
            .insert(insert_data)
            .execute()
        )
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="创建预警规则失败"
            )
        
        rule = response.data[0]
        rule["channels"] = [ch.value for ch in rule_data.channels]
        
        # 通知预警服务重新加载规则
        try:
            alert_service = get_stock_alert_service()
            await alert_service.reload_rules()
        except Exception:
            pass  # 服务可能未启动
        
        return AlertRuleResponse(**rule)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建预警规则失败: {str(e)}"
        )


@router.patch(
    "/rules/{rule_id}",
    response_model=AlertRuleResponse,
    summary="更新预警规则",
)
async def update_alert_rule(
    rule_id: str,
    rule_update: AlertRuleUpdate,
    current_user_id: str = Depends(get_current_user_id),
):
    """更新预警规则"""
    try:
        supabase = get_supabase_service()
        
        # 验证规则存在且属于当前用户
        existing = (
            supabase.table("stock_alert_rules")
            .select("*")
            .eq("id", rule_id)
            .eq("user_id", current_user_id)
            .single()
            .execute()
        )
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="预警规则不存在"
            )
        
        # 构建更新数据
        update_data = {}
        
        if rule_update.daily_change_threshold is not None:
            update_data["daily_change_threshold"] = rule_update.daily_change_threshold
        if rule_update.spike_change_threshold is not None:
            update_data["spike_change_threshold"] = rule_update.spike_change_threshold
        if rule_update.price_above is not None:
            update_data["price_above"] = rule_update.price_above
        if rule_update.price_below is not None:
            update_data["price_below"] = rule_update.price_below
        if rule_update.volume_surge_multiplier is not None:
            update_data["volume_surge_multiplier"] = rule_update.volume_surge_multiplier
        if rule_update.premarket_enabled is not None:
            update_data["premarket_enabled"] = rule_update.premarket_enabled
        if rule_update.regular_hours_enabled is not None:
            update_data["regular_hours_enabled"] = rule_update.regular_hours_enabled
        if rule_update.afterhours_enabled is not None:
            update_data["afterhours_enabled"] = rule_update.afterhours_enabled
        if rule_update.channels is not None:
            import json
            update_data["channels"] = json.dumps([ch.value for ch in rule_update.channels])
        if rule_update.ai_analysis_enabled is not None:
            update_data["ai_analysis_enabled"] = rule_update.ai_analysis_enabled
        if rule_update.cooldown_minutes is not None:
            update_data["cooldown_minutes"] = rule_update.cooldown_minutes
        if rule_update.is_active is not None:
            update_data["is_active"] = rule_update.is_active
        
        if not update_data:
            # 没有更新，直接返回现有数据
            rule = existing.data
            if isinstance(rule.get("channels"), str):
                import json
                rule["channels"] = json.loads(rule["channels"])
            return AlertRuleResponse(**rule)
        
        response = (
            supabase.table("stock_alert_rules")
            .update(update_data)
            .eq("id", rule_id)
            .execute()
        )
        
        rule = response.data[0] if response.data else existing.data
        if isinstance(rule.get("channels"), str):
            import json
            rule["channels"] = json.loads(rule["channels"])
        
        # 通知预警服务重新加载规则
        try:
            alert_service = get_stock_alert_service()
            await alert_service.reload_rules()
        except Exception:
            pass
        
        return AlertRuleResponse(**rule)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新预警规则失败: {str(e)}"
        )


@router.delete(
    "/rules/{rule_id}",
    response_model=MessageResponse,
    summary="删除预警规则",
)
async def delete_alert_rule(
    rule_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """删除预警规则"""
    try:
        supabase = get_supabase_service()
        
        # 验证规则存在且属于当前用户
        existing = (
            supabase.table("stock_alert_rules")
            .select("symbol")
            .eq("id", rule_id)
            .eq("user_id", current_user_id)
            .single()
            .execute()
        )
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="预警规则不存在"
            )
        
        symbol = existing.data.get("symbol")
        
        # 删除规则
        supabase.table("stock_alert_rules").delete().eq("id", rule_id).execute()
        
        # 通知预警服务重新加载规则
        try:
            alert_service = get_stock_alert_service()
            await alert_service.reload_rules()
        except Exception:
            pass
        
        return MessageResponse(
            success=True,
            message=f"已删除 {symbol} 的预警规则"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除预警规则失败: {str(e)}"
        )


@router.post(
    "/rules/{rule_id}/toggle",
    response_model=AlertRuleResponse,
    summary="启用/禁用预警规则",
)
async def toggle_alert_rule(
    rule_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """切换预警规则的启用状态"""
    try:
        supabase = get_supabase_service()
        
        # 获取当前状态
        existing = (
            supabase.table("stock_alert_rules")
            .select("*")
            .eq("id", rule_id)
            .eq("user_id", current_user_id)
            .single()
            .execute()
        )
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="预警规则不存在"
            )
        
        current_active = existing.data.get("is_active", True)
        
        # 切换状态
        response = (
            supabase.table("stock_alert_rules")
            .update({"is_active": not current_active})
            .eq("id", rule_id)
            .execute()
        )
        
        rule = response.data[0] if response.data else existing.data
        rule["is_active"] = not current_active
        
        if isinstance(rule.get("channels"), str):
            import json
            rule["channels"] = json.loads(rule["channels"])
        
        # 通知预警服务重新加载规则
        try:
            alert_service = get_stock_alert_service()
            await alert_service.reload_rules()
        except Exception:
            pass
        
        return AlertRuleResponse(**rule)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"切换预警规则状态失败: {str(e)}"
        )
