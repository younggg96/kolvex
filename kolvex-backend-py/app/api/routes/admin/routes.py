"""Administration for retained user, portfolio and research features."""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status, BackgroundTasks
from supabase import Client
from app.api.dependencies.auth import verify_admin
from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)
router = APIRouter()
BUSINESS_TABLES = (
    "user_profiles", "user_api_keys", "chat_conversations", "chat_messages",
    "trading_analyses", "youtube_stock_opinions", "portfolio_connections",
    "portfolio_accounts", "portfolio_positions", "portfolio_snapshots",
)

@router.get("/database/stats")
async def get_database_stats(admin_id: str = Depends(verify_admin), supabase: Client = Depends(get_supabase_service)):
    counts = {}
    for name in BUSINESS_TABLES:
        try:
            result = (
                supabase.table(name)
                .select("id", count="exact")
                .limit(0)
                .execute()
            )
            counts[name] = result.count or 0
        except Exception as exc:
            logger.exception("Failed to count table %s", name)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to count {name}: {exc}",
            ) from exc
    return {"tables": counts}

@router.get("/overview")
async def get_admin_overview(admin_id: str = Depends(verify_admin), supabase: Client = Depends(get_supabase_service)):
    return await get_database_stats(admin_id, supabase)


@router.post("/actions/portfolio-snapshot", response_model=Dict[str, Any])
async def trigger_portfolio_snapshot(
    sync_first: bool = Query(False, description="已弃用；券商同步由各自服务执行"),
    admin_id: str = Depends(verify_admin),
):
    """
    📸 为所有用户记录 Portfolio 快照

    此功能会立即为所有已连接券商账户的用户保存当前的投资组合快照。
    用于生成用户的盈利曲线。

    Args:
        sync_first: 是否先同步持仓数据（默认 True）

    Returns:
        操作结果摘要
    """
    import logging

    logger = logging.getLogger(__name__)

    from app.services.portfolio.service import PortfolioService
    from app.services.portfolio_snapshot_service import get_portfolio_snapshot_service

    try:
        supabase = get_supabase_service()
        portfolio_service = PortfolioService(supabase=supabase)
        snapshot_service = get_portfolio_snapshot_service()

        logger.info(f"📸 Starting portfolio snapshot (sync_first={sync_first})")

        # 获取所有已连接的用户
        result = (
            supabase.table("portfolio_connections")
            .select("user_id, is_connected")
            .eq("is_connected", True)
            .execute()
        )

        if not result.data:
            logger.warning("No connected users found in portfolio_connections")
            return {
                "success": True,
                "message": "No connected users found",
                "total_users": 0,
                "snapshot_success": 0,
                "snapshot_failed": 0,
            }

        total_users = len(result.data)
        logger.info(f"Found {total_users} connected users")

        success_count = 0
        failed_count = 0
        details = []

        for connection in result.data:
            user_id = connection["user_id"]

            try:
                # 获取持仓数据计算快照
                holdings = await portfolio_service.get_user_holdings(user_id)

                if not holdings or not holdings.get("accounts"):
                    logger.warning(f"No holdings data for user {user_id[:8]}")
                    details.append(
                        {
                            "user_id": user_id[:8] + "...",
                            "success": False,
                            "reason": "No holdings data",
                        }
                    )
                    failed_count += 1
                    continue

                total_value = 0.0
                total_cost_basis = 0.0
                total_pnl = 0.0
                positions_count = 0
                accounts_count = len(holdings["accounts"])

                for account in holdings["accounts"]:
                    positions = account.get("portfolio_positions", [])
                    for pos in positions:
                        price = pos.get("price", 0) or 0
                        units = pos.get("units", 0) or 0
                        avg_cost = pos.get("average_purchase_price", 0) or 0
                        position_type = pos.get("position_type", "equity")

                        multiplier = 100 if position_type == "option" else 1
                        position_value = price * units * multiplier
                        cost_basis = avg_cost * units

                        total_value += position_value
                        total_cost_basis += cost_basis
                        positions_count += 1

                        if position_type == "option":
                            pnl = position_value - cost_basis
                        else:
                            pnl = pos.get("open_pnl") or (position_value - cost_basis)
                        total_pnl += pnl

                # 记录快照
                logger.info(
                    f"Recording snapshot for user {user_id[:8]}: value=${total_value:.2f}, positions={positions_count}"
                )
                snapshot_result = await snapshot_service.record_snapshot(
                    user_id=user_id,
                    total_value=total_value,
                    total_cost_basis=total_cost_basis,
                    unrealized_pnl=total_pnl,
                    positions_count=positions_count,
                    accounts_count=accounts_count,
                )
                logger.info(
                    f"✅ Snapshot recorded for user {user_id[:8]}: {snapshot_result}"
                )

                success_count += 1
                details.append(
                    {
                        "user_id": user_id[:8] + "...",
                        "success": True,
                        "value": round(total_value, 2),
                        "pnl": round(total_pnl, 2),
                        "positions": positions_count,
                    }
                )

            except Exception as e:
                logger.error(
                    f"❌ Failed to record snapshot for user {user_id[:8]}: {e}"
                )
                failed_count += 1
                details.append(
                    {"user_id": user_id[:8] + "...", "success": False, "reason": str(e)}
                )

        # 生成更详细的消息
        message = f"Completed: {success_count}/{total_users} users"
        if failed_count > 0:
            message += f" ({failed_count} failed)"

        logger.info(f"📸 Portfolio snapshot complete: {message}")

        return {
            "success": success_count > 0,
            "message": message,
            "total_users": total_users,
            "snapshot_success": success_count,
            "snapshot_failed": failed_count,
            "details": details,
        }

    except Exception as e:
        logger.error(f"❌ Portfolio snapshot error: {e}")
        return {
            "success": False,
            "message": f"Error: {str(e)}",
        }

@router.get("/users", response_model=Dict[str, Any])
async def list_all_users(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（邮箱或用户名）"),
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    获取用户列表（管理员功能）
    """
    try:
        offset = (page - 1) * page_size

        query = supabase.table("user_profiles").select("*", count="exact")

        if search:
            query = query.or_(f"email.ilike.%{search}%,username.ilike.%{search}%")

        response = (
            query.order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        return {
            "users": response.data or [],
            "total": response.count or 0,
            "page": page,
            "page_size": page_size,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list users: {str(e)}",
        )

@router.patch("/users/{user_id}/admin", response_model=Dict[str, Any])
async def toggle_user_admin(
    user_id: str,
    is_admin: bool,
    admin_id: str = Depends(verify_admin),
    supabase: Client = Depends(get_supabase_service),
):
    """
    设置或取消用户的管理员权限
    """
    # 不能修改自己的权限
    if user_id == admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own admin status",
        )

    try:
        response = (
            supabase.table("user_profiles")
            .update({"is_admin": is_admin})
            .eq("id", user_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        return {
            "success": True,
            "user_id": user_id,
            "is_admin": is_admin,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user: {str(e)}",
        )
