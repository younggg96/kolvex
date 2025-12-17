"""
KOL 订阅 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
import math

from app.core.supabase import get_supabase_service
from app.api.dependencies.auth import get_current_user_id
from .schemas import (
    KOLSubscriptionCreate,
    KOLSubscriptionUpdate,
    KOLSubscriptionResponse,
    KOLSubscriptionsListResponse,
    KOLTrackedCheckResponse,
    MessageResponse,
    Platform,
)

router = APIRouter()


def calculate_influence_score(profile: dict) -> float:
    """计算 KOL 影响力分数"""
    followers_count = profile.get("followers_count") or 0
    posts_count = profile.get("posts_count") or 0
    
    follower_score = min(followers_count / 10000000, 1) * 50
    post_score = min(posts_count / 50000, 1) * 30
    verification_bonus = 20 if profile.get("is_verified") else 0
    
    return round((follower_score + post_score + verification_bonus) * 10) / 10


def enrich_subscription_with_profile(subscription: dict, profile: dict) -> KOLSubscriptionResponse:
    """将订阅数据与 KOL profile 数据合并"""
    influence_score = calculate_influence_score(profile) if profile else 0
    trending_score = round(25 + (influence_score / 100) * 50, 1)  # 基于影响力的趋势分数
    
    return KOLSubscriptionResponse(
        id=subscription["id"],
        user_id=subscription["user_id"],
        kol_id=subscription["kol_id"],
        platform=subscription["platform"],
        notify=subscription.get("notify", True),
        created_at=subscription["created_at"],
        updated_at=subscription.get("updated_at"),
        kol_name=profile.get("display_name") or profile.get("username") or subscription["kol_id"] if profile else subscription["kol_id"],
        kol_avatar_url=profile.get("avatar_url") if profile else None,
        kol_username=profile.get("username") or subscription["kol_id"] if profile else subscription["kol_id"],
        kol_verified=profile.get("is_verified", False) if profile else False,
        kol_bio=profile.get("bio") if profile else None,
        kol_followers_count=profile.get("followers_count", 0) if profile else 0,
        kol_category=None,  # 可以后续扩展
        kol_influence_score=influence_score,
        kol_trending_score=trending_score,
    )


async def get_kol_profiles_map(supabase, kol_ids: list[str]) -> dict:
    """批量获取 KOL profiles"""
    if not kol_ids:
        return {}
    
    profiles_map = {}
    batch_size = 100
    
    for i in range(0, len(kol_ids), batch_size):
        batch = kol_ids[i:i + batch_size]
        try:
            response = (
                supabase.table("kol_profiles")
                .select("username, display_name, avatar_url, bio, followers_count, posts_count, is_verified")
                .in_("username", batch)
                .execute()
            )
            for p in response.data:
                profiles_map[p["username"]] = p
        except Exception as e:
            # 继续处理，不影响主流程
            print(f"获取 KOL profiles 失败: {e}")
    
    return profiles_map


@router.get(
    "/tracked",
    response_model=KOLSubscriptionsListResponse,
    summary="获取用户追踪的 KOL 列表",
)
async def get_tracked_kols(
    platform: Optional[Platform] = Query(None, description="按平台过滤"),
    current_user_id: str = Depends(get_current_user_id),
):
    """
    获取当前用户追踪的所有 KOL（包含 KOL 详细信息）
    
    需要认证：Bearer token
    """
    try:
        supabase = get_supabase_service()
        
        query = (
            supabase.table("kol_subscriptions")
            .select("*")
            .eq("user_id", current_user_id)
            .order("created_at", desc=True)
        )
        
        if platform:
            query = query.eq("platform", platform)
        
        response = query.execute()
        subscriptions = response.data or []
        
        if not subscriptions:
            return KOLSubscriptionsListResponse(count=0, tracked_kols=[])
        
        # 获取所有 KOL 的 username
        kol_ids = [sub["kol_id"] for sub in subscriptions]
        
        # 批量获取 KOL profiles
        profiles_map = await get_kol_profiles_map(supabase, kol_ids)
        
        # 合并数据
        tracked_kols = []
        for sub in subscriptions:
            profile = profiles_map.get(sub["kol_id"], {})
            tracked_kols.append(enrich_subscription_with_profile(sub, profile))
        
        return KOLSubscriptionsListResponse(
            count=len(tracked_kols),
            tracked_kols=tracked_kols,
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取追踪 KOL 列表失败: {str(e)}",
        )


@router.post(
    "/tracked",
    response_model=KOLSubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="添加追踪 KOL",
)
async def create_tracked_kol(
    kol_data: KOLSubscriptionCreate,
    current_user_id: str = Depends(get_current_user_id),
):
    """
    添加新的追踪 KOL
    
    需要认证：Bearer token
    """
    try:
        supabase = get_supabase_service()
        
        # 检查是否已经追踪该 KOL
        existing = (
            supabase.table("kol_subscriptions")
            .select("id")
            .eq("user_id", current_user_id)
            .eq("platform", kol_data.platform)
            .eq("kol_id", kol_data.kol_id)
            .execute()
        )
        
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该 KOL 已在追踪列表中",
            )
        
        # 插入新记录
        insert_data = {
            "user_id": current_user_id,
            "kol_id": kol_data.kol_id,
            "platform": kol_data.platform,
            "notify": kol_data.notify,
        }
        
        response = supabase.table("kol_subscriptions").insert(insert_data).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="添加追踪 KOL 失败",
            )
        
        row = response.data[0]
        
        # 尝试获取 KOL profile
        profile = {}
        try:
            profile_response = (
                supabase.table("kol_profiles")
                .select("username, display_name, avatar_url, bio, followers_count, posts_count, is_verified")
                .eq("username", kol_data.kol_id)
                .single()
                .execute()
            )
            if profile_response.data:
                profile = profile_response.data
        except Exception:
            pass
        
        return enrich_subscription_with_profile(row, profile)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"添加追踪 KOL 失败: {str(e)}",
        )


@router.patch(
    "/tracked",
    response_model=KOLSubscriptionResponse,
    summary="更新追踪 KOL 设置",
)
async def update_tracked_kol(
    kol_id: str = Query(..., description="KOL ID"),
    platform: Platform = Query(..., description="平台类型"),
    kol_update: KOLSubscriptionUpdate = None,
    current_user_id: str = Depends(get_current_user_id),
):
    """
    更新追踪 KOL 设置（如通知开关）
    
    需要认证：Bearer token
    """
    try:
        supabase = get_supabase_service()
        
        # 验证所有权并获取记录
        existing = (
            supabase.table("kol_subscriptions")
            .select("*")
            .eq("user_id", current_user_id)
            .eq("platform", platform)
            .eq("kol_id", kol_id)
            .single()
            .execute()
        )
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="追踪 KOL 未找到",
            )
        
        # 更新记录
        update_data = {}
        if kol_update and kol_update.notify is not None:
            update_data["notify"] = kol_update.notify
        
        if update_data:
            response = (
                supabase.table("kol_subscriptions")
                .update(update_data)
                .eq("user_id", current_user_id)
                .eq("platform", platform)
                .eq("kol_id", kol_id)
                .execute()
            )
            row = response.data[0] if response.data else existing.data
        else:
            row = existing.data
        
        # 获取 KOL profile
        profile = {}
        try:
            profile_response = (
                supabase.table("kol_profiles")
                .select("username, display_name, avatar_url, bio, followers_count, posts_count, is_verified")
                .eq("username", kol_id)
                .single()
                .execute()
            )
            if profile_response.data:
                profile = profile_response.data
        except Exception:
            pass
        
        return enrich_subscription_with_profile(row, profile)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新追踪 KOL 失败: {str(e)}",
        )


@router.delete(
    "/tracked",
    response_model=MessageResponse,
    summary="取消追踪 KOL",
)
async def delete_tracked_kol(
    kol_id: str = Query(..., description="KOL ID"),
    platform: Platform = Query(..., description="平台类型"),
    current_user_id: str = Depends(get_current_user_id),
):
    """
    取消追踪 KOL
    
    需要认证：Bearer token
    """
    try:
        supabase = get_supabase_service()
        
        # 删除记录
        response = (
            supabase.table("kol_subscriptions")
            .delete()
            .eq("user_id", current_user_id)
            .eq("platform", platform)
            .eq("kol_id", kol_id)
            .execute()
        )
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="追踪 KOL 未找到",
            )
        
        return MessageResponse(message="已取消追踪 KOL", success=True)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"取消追踪 KOL 失败: {str(e)}",
        )


@router.get(
    "/tracked/check",
    response_model=KOLTrackedCheckResponse,
    summary="检查 KOL 是否已追踪",
)
async def check_kol_tracked(
    kol_id: str = Query(..., description="KOL ID"),
    platform: Platform = Query(..., description="平台类型"),
    current_user_id: str = Depends(get_current_user_id),
):
    """
    检查某个 KOL 是否已在追踪列表中
    
    需要认证：Bearer token
    """
    try:
        supabase = get_supabase_service()
        
        response = (
            supabase.table("kol_subscriptions")
            .select("id")
            .eq("user_id", current_user_id)
            .eq("platform", platform)
            .eq("kol_id", kol_id)
            .execute()
        )
        
        is_tracked = bool(response.data)
        subscription_id = response.data[0]["id"] if response.data else None
        
        return KOLTrackedCheckResponse(
            kol_id=kol_id,
            platform=platform,
            is_tracked=is_tracked,
            subscription_id=subscription_id,
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"检查追踪状态失败: {str(e)}",
        )

