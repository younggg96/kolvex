"""
数据管理 API 路由
提供推文和 KOL Profile 的删除和管理功能
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Optional
from datetime import datetime, timezone, timedelta

from app.services.scraper import get_supabase_client

router = APIRouter()


# ============================================================
# KOL Profile 管理端点
# ============================================================


@router.delete("/profiles/all", response_model=Dict)
def delete_all_profiles(confirm: bool = False):
    """
    ⚠️ 删除所有 KOL Profile 数据（危险操作！）

    参数：
    - confirm: 必须设为 true 才能执行删除

    示例：
    - DELETE /api/scraper/profiles/all?confirm=true
    """
    if not confirm:
        raise HTTPException(
            status_code=400, detail="请添加 ?confirm=true 参数确认删除所有 KOL Profile"
        )

    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    try:
        # 先统计总数
        count_result = (
            supabase.table("kol_profiles").select("id", count="exact").execute()
        )
        total_count = count_result.count or 0

        if total_count == 0:
            return {
                "success": True,
                "message": "kol_profiles 表中没有数据",
                "deleted_count": 0,
            }

        # 删除所有数据（使用 neq 条件删除所有记录）
        supabase.table("kol_profiles").delete().neq("id", -1).execute()

        return {
            "success": True,
            "message": f"⚠️ 已删除所有 {total_count} 个 KOL Profile",
            "deleted_count": total_count,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@router.delete("/profiles/{username}", response_model=Dict)
def delete_profile_by_username(username: str):
    """
    🗑️ 删除指定用户名的 KOL Profile

    参数：
    - username: 要删除的 KOL 用户名

    示例：
    - DELETE /api/scraper/profiles/elonmusk
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    try:
        # 检查是否存在
        check_result = (
            supabase.table("kol_profiles")
            .select("id, username")
            .eq("username", username)
            .execute()
        )

        if not check_result.data:
            raise HTTPException(
                status_code=404, detail=f"KOL Profile '{username}' 不存在"
            )

        # 删除
        supabase.table("kol_profiles").delete().eq("username", username).execute()

        return {
            "success": True,
            "message": f"✅ 已删除 KOL Profile: @{username}",
            "username": username,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


# ============================================================
# 推文管理端点
# ============================================================


@router.delete("/tweets/old", response_model=Dict)
def delete_old_tweets(days: int = 7, include_null_dates: bool = True):
    """
    🗑️ 删除指定天数之前的旧推文

    参数：
    - days: 保留最近 N 天的推文，删除更早的数据（默认: 7 天）
    - include_null_dates: 是否也删除没有日期的推文（默认: True）

    示例：
    - DELETE /api/scraper/tweets/old?days=7  → 删除 7 天前的推文
    - DELETE /api/scraper/tweets/old?days=30 → 删除 30 天前的推文
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    # 计算截止日期（使用简单的日期格式）
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime(
        "%Y-%m-%d"
    )

    try:
        deleted_old = 0
        deleted_null = 0

        # 1. 删除日期早于截止日期的推文
        count_old = (
            supabase.table("kol_tweets")
            .select("id", count="exact")
            .lt("created_at", cutoff_date)
            .execute()
        )
        deleted_old = count_old.count or 0

        if deleted_old > 0:
            supabase.table("kol_tweets").delete().lt(
                "created_at", cutoff_date
            ).execute()

        # 2. 删除 created_at 为 NULL 的推文
        if include_null_dates:
            count_null = (
                supabase.table("kol_tweets")
                .select("id", count="exact")
                .is_("created_at", "null")
                .execute()
            )
            deleted_null = count_null.count or 0

            if deleted_null > 0:
                supabase.table("kol_tweets").delete().is_(
                    "created_at", "null"
                ).execute()

        total_deleted = deleted_old + deleted_null

        if total_deleted == 0:
            return {
                "success": True,
                "message": f"没有找到需要删除的推文",
                "deleted_count": 0,
                "cutoff_date": cutoff_date,
            }

        return {
            "success": True,
            "message": f"✅ 已删除 {total_deleted} 条旧推文（{deleted_old} 条早于 {cutoff_date}，{deleted_null} 条无日期）",
            "deleted_count": total_deleted,
            "deleted_before_cutoff": deleted_old,
            "deleted_null_dates": deleted_null,
            "cutoff_date": cutoff_date,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@router.delete("/tweets/all", response_model=Dict)
def delete_all_tweets(confirm: bool = False):
    """
    ⚠️ 删除所有推文数据（危险操作！）

    参数：
    - confirm: 必须设为 true 才能执行删除
    """
    if not confirm:
        raise HTTPException(
            status_code=400, detail="请添加 ?confirm=true 参数确认删除所有推文"
        )

    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    try:
        # 先统计总数
        count_result = (
            supabase.table("kol_tweets").select("id", count="exact").execute()
        )
        total_count = count_result.count or 0

        if total_count == 0:
            return {
                "success": True,
                "message": "表中没有数据",
                "deleted_count": 0,
            }

        # 删除所有数据（使用 neq 条件删除所有记录）
        supabase.table("kol_tweets").delete().neq("id", -1).execute()

        return {
            "success": True,
            "message": f"⚠️ 已删除所有 {total_count} 条推文",
            "deleted_count": total_count,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

