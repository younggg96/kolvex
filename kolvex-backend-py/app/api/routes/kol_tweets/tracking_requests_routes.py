"""
KOL Tracking Requests API 路由
允许用户提交 KOL 追踪请求，管理员审核后自动加入爬虫列表
"""

from fastapi import APIRouter, HTTPException, Query, Header, Depends
from typing import Optional
from datetime import datetime, timezone

from app.core.supabase import get_supabase_service
from app.api.dependencies.auth import verify_admin
from .schemas import (
    KOLTrackingRequestCreate,
    KOLTrackingRequest,
    KOLTrackingRequestsResponse,
    KOLTrackingRequestReview,
    KOLTrackingRequestResponse,
    TrackingRequestStatus,
)

router = APIRouter()


def _convert_row_to_request(row: dict) -> KOLTrackingRequest:
    """将数据库行转换为 KOLTrackingRequest 对象"""
    return KOLTrackingRequest(
        id=row["id"],
        user_id=row["user_id"],
        platform=row.get("platform", "twitter"),
        platform_user_id=row["platform_user_id"],
        status=TrackingRequestStatus(row["status"]),
        user_notes=row.get("user_notes"),
        admin_notes=row.get("admin_notes"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        reviewed_at=row.get("reviewed_at"),
        reviewed_by=row.get("reviewed_by"),
    )


def _convert_row_to_request_with_user(row: dict) -> KOLTrackingRequest:
    """将数据库行转换为 KOLTrackingRequest 对象（包含用户信息）"""
    user_info = row.get("user_profiles") or {}
    return KOLTrackingRequest(
        id=row["id"],
        user_id=row["user_id"],
        platform=row.get("platform", "twitter"),
        platform_user_id=row["platform_user_id"],
        status=TrackingRequestStatus(row["status"]),
        user_notes=row.get("user_notes"),
        admin_notes=row.get("admin_notes"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        reviewed_at=row.get("reviewed_at"),
        reviewed_by=row.get("reviewed_by"),
        user_email=user_info.get("email"),
        user_username=user_info.get("username"),
        user_avatar_url=user_info.get("avatar_url"),
    )


@router.post("/tracking-requests", response_model=KOLTrackingRequestResponse)
async def create_tracking_request(
    request_data: KOLTrackingRequestCreate,
    authorization: Optional[str] = Header(None),
):
    """
    创建 KOL 追踪请求

    - **platform**: 平台 (目前只支持 twitter)
    - **platform_user_id**: KOL 的平台用户名（如 @elonmusk 填写 elonmusk）
    - **user_notes**: 用户备注（可选）
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    try:
        # 提取 token
        token = authorization.replace("Bearer ", "")

        # 使用 service client 验证用户
        from app.core.supabase import get_supabase_client

        supabase_user = get_supabase_client()
        user_response = supabase_user.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = user_response.user.id

        # 使用 service role 进行数据库操作
        supabase = get_supabase_service()

        # 清理用户名（移除 @ 符号）
        platform_user_id = request_data.platform_user_id.lstrip("@").strip()
        if not platform_user_id:
            raise HTTPException(
                status_code=400, detail="Platform user ID cannot be empty"
            )

        # 检查是否已有相同的 pending 请求
        existing = (
            supabase.table("kol_tracking_requests")
            .select("id")
            .eq("user_id", user_id)
            .eq("platform", request_data.platform)
            .eq("platform_user_id", platform_user_id)
            .eq("status", "pending")
            .execute()
        )

        if existing.data:
            raise HTTPException(
                status_code=400,
                detail=f"You already have a pending request for @{platform_user_id}",
            )

        # 检查 KOL 是否已经在追踪列表中
        existing_kol = (
            supabase.table("kol_profiles")
            .select("id")
            .eq("platform", request_data.platform)
            .eq("username", platform_user_id)
            .execute()
        )

        if existing_kol.data:
            raise HTTPException(
                status_code=400,
                detail=f"@{platform_user_id} is already being tracked",
            )

        # 创建请求
        data = {
            "user_id": user_id,
            "platform": request_data.platform,
            "platform_user_id": platform_user_id,
            "user_notes": request_data.user_notes,
            "status": "pending",
        }

        result = supabase.table("kol_tracking_requests").insert(data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create request")

        return KOLTrackingRequestResponse(
            success=True,
            message=f"Request to track @{platform_user_id} submitted successfully",
            request=_convert_row_to_request(result.data[0]),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create request: {str(e)}")


@router.get("/tracking-requests", response_model=KOLTrackingRequestsResponse)
async def get_my_tracking_requests(
    status: Optional[str] = Query(None, description="Filter by status: pending, approved, rejected"),
    authorization: Optional[str] = Header(None),
):
    """
    获取当前用户的 KOL 追踪请求列表
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    try:
        # 提取 token
        token = authorization.replace("Bearer ", "")

        # 验证用户
        from app.core.supabase import get_supabase_client

        supabase_user = get_supabase_client()
        user_response = supabase_user.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = user_response.user.id

        # 查询请求
        supabase = get_supabase_service()
        query = (
            supabase.table("kol_tracking_requests")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )

        if status:
            query = query.eq("status", status)

        result = query.execute()

        requests = [_convert_row_to_request(row) for row in result.data]

        return KOLTrackingRequestsResponse(
            requests=requests, total=result.count or len(requests)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get requests: {str(e)}"
        )


@router.get("/tracking-requests/admin", response_model=KOLTrackingRequestsResponse)
async def get_all_tracking_requests(
    status: Optional[str] = Query(None, description="Filter by status: pending, approved, rejected"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin_id: str = Depends(verify_admin),
):
    """
    [管理员] 获取所有 KOL 追踪请求

    - **status**: 按状态筛选
    - **platform**: 按平台筛选
    - **limit**: 每页数量
    - **offset**: 偏移量
    """
    try:
        # 查询所有请求
        supabase = get_supabase_service()
        query = (
            supabase.table("kol_tracking_requests")
            .select("*", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )

        if status:
            query = query.eq("status", status)
        if platform:
            query = query.eq("platform", platform)

        result = query.execute()

        # 获取所有用户 ID 并批量查询用户信息
        user_ids = list(set(row["user_id"] for row in result.data if row.get("user_id")))
        user_info_map = {}
        
        if user_ids:
            user_profiles_result = (
                supabase.table("user_profiles")
                .select("id, email, username, avatar_url")
                .in_("id", user_ids)
                .execute()
            )
            user_info_map = {profile["id"]: profile for profile in user_profiles_result.data}

        # 合并用户信息到请求数据
        requests = []
        for row in result.data:
            user_info = user_info_map.get(row.get("user_id"), {})
            row["user_profiles"] = user_info
            requests.append(_convert_row_to_request_with_user(row))

        return KOLTrackingRequestsResponse(
            requests=requests, total=result.count or len(requests)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get requests: {str(e)}"
        )


@router.patch("/tracking-requests/{request_id}/review", response_model=KOLTrackingRequestResponse)
async def review_tracking_request(
    request_id: str,
    review_data: KOLTrackingRequestReview,
    admin_id: str = Depends(verify_admin),
):
    """
    [管理员] 审核 KOL 追踪请求

    - **request_id**: 请求 ID
    - **status**: approved 或 rejected
    - **admin_notes**: 管理员备注（可选）
    """
    try:
        reviewer_id = admin_id

        supabase = get_supabase_service()

        # 获取现有请求
        existing = (
            supabase.table("kol_tracking_requests")
            .select("*")
            .eq("id", request_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(status_code=404, detail="Request not found")

        if existing.data["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Request has already been {existing.data['status']}",
            )

        # 更新请求
        update_data = {
            "status": review_data.status,
            "admin_notes": review_data.admin_notes,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": reviewer_id,
        }

        result = (
            supabase.table("kol_tracking_requests")
            .update(update_data)
            .eq("id", request_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update request")

        # 如果批准，将 KOL 添加到追踪列表（创建空的 profile 记录）
        if review_data.status == "approved":
            platform = existing.data["platform"]
            platform_user_id = existing.data["platform_user_id"]

            # 检查是否已存在
            existing_profile = (
                supabase.table("kol_profiles")
                .select("id")
                .eq("platform", platform)
                .eq("username", platform_user_id)
                .execute()
            )

            if not existing_profile.data:
                # 创建新的 KOL profile（爬虫会自动填充详细信息）
                profile_data = {
                    "platform": platform,
                    "platform_user_id": platform_user_id,
                    "username": platform_user_id,
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }

                supabase.table("kol_profiles").insert(profile_data).execute()

        return KOLTrackingRequestResponse(
            success=True,
            message=f"Request {review_data.status} successfully",
            request=_convert_row_to_request(result.data[0]),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to review request: {str(e)}"
        )


@router.delete("/tracking-requests/{request_id}", response_model=KOLTrackingRequestResponse)
async def cancel_tracking_request(
    request_id: str,
    authorization: Optional[str] = Header(None),
):
    """
    取消（删除）自己的待审核请求
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    try:
        # 提取 token
        token = authorization.replace("Bearer ", "")

        # 验证用户
        from app.core.supabase import get_supabase_client

        supabase_user = get_supabase_client()
        user_response = supabase_user.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = user_response.user.id

        supabase = get_supabase_service()

        # 获取请求并验证所有权
        existing = (
            supabase.table("kol_tracking_requests")
            .select("*")
            .eq("id", request_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=404, detail="Request not found or you don't have permission"
            )

        if existing.data["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail="Only pending requests can be cancelled",
            )

        # 删除请求
        supabase.table("kol_tracking_requests").delete().eq("id", request_id).execute()

        return KOLTrackingRequestResponse(
            success=True,
            message="Request cancelled successfully",
            request=_convert_row_to_request(existing.data),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to cancel request: {str(e)}"
        )
