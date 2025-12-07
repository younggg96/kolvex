"""
用户追踪股票 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from supabase import Client

from app.core.supabase import get_supabase_service
from app.api.dependencies.auth import get_current_user_id

router = APIRouter(prefix="/tracked-stocks", tags=["Tracked Stocks"])


# ============================================================
# Pydantic 模型
# ============================================================


class TrackedStockCreate(BaseModel):
    """创建追踪股票请求"""
    symbol: str
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
    notify: bool = True


class TrackedStockUpdate(BaseModel):
    """更新追踪股票请求"""
    notify: Optional[bool] = None


class TrackedStockResponse(BaseModel):
    """追踪股票响应"""
    id: str
    user_id: str
    symbol: str
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
    notify: bool = True
    created_at: datetime


class TrackedStocksListResponse(BaseModel):
    """追踪股票列表响应"""
    stocks: List[TrackedStockResponse]
    total: int


class MessageResponse(BaseModel):
    """消息响应"""
    message: str
    success: bool = True


# ============================================================
# API 路由
# ============================================================


@router.get("", response_model=TrackedStocksListResponse, summary="获取用户追踪的股票列表")
async def get_tracked_stocks(
    current_user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service),
):
    """
    获取当前用户追踪的所有股票
    
    需要认证：Bearer token
    """
    try:
        response = supabase.table("stock_tracking").select("*").eq(
            "user_id", current_user_id
        ).order("created_at", desc=True).execute()
        
        stocks = []
        for row in response.data or []:
            stocks.append(TrackedStockResponse(
                id=row["id"],
                user_id=row["user_id"],
                symbol=row["symbol"],
                company_name=row.get("company_name"),
                logo_url=row.get("logo_url"),
                notify=row.get("notify", True),
                created_at=row["created_at"],
            ))
        
        return TrackedStocksListResponse(
            stocks=stocks,
            total=len(stocks)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取追踪股票失败: {str(e)}"
        )


@router.post("", response_model=TrackedStockResponse, status_code=status.HTTP_201_CREATED, summary="添加追踪股票")
async def create_tracked_stock(
    stock_data: TrackedStockCreate,
    current_user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service),
):
    """
    添加新的追踪股票
    
    需要认证：Bearer token
    """
    try:
        # 检查是否已经追踪该股票
        existing = supabase.table("stock_tracking").select("id").eq(
            "user_id", current_user_id
        ).eq("symbol", stock_data.symbol.upper()).execute()
        
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该股票已在追踪列表中"
            )
        
        # 插入新记录
        insert_data = {
            "user_id": current_user_id,
            "symbol": stock_data.symbol.upper(),
            "company_name": stock_data.company_name,
            "logo_url": stock_data.logo_url,
            "notify": stock_data.notify,
        }
        
        response = supabase.table("stock_tracking").insert(insert_data).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="添加追踪股票失败"
            )
        
        row = response.data[0]
        return TrackedStockResponse(
            id=row["id"],
            user_id=row["user_id"],
            symbol=row["symbol"],
            company_name=row.get("company_name"),
            logo_url=row.get("logo_url"),
            notify=row.get("notify", True),
            created_at=row["created_at"],
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"添加追踪股票失败: {str(e)}"
        )


@router.patch("/{stock_id}", response_model=TrackedStockResponse, summary="更新追踪股票设置")
async def update_tracked_stock(
    stock_id: str,
    stock_update: TrackedStockUpdate,
    current_user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service),
):
    """
    更新追踪股票设置（如通知开关）
    
    需要认证：Bearer token
    """
    try:
        # 验证所有权
        existing = supabase.table("stock_tracking").select("*").eq(
            "id", stock_id
        ).eq("user_id", current_user_id).single().execute()
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="追踪股票未找到"
            )
        
        # 更新记录
        update_data = {}
        if stock_update.notify is not None:
            update_data["notify"] = stock_update.notify
        
        if update_data:
            response = supabase.table("stock_tracking").update(update_data).eq(
                "id", stock_id
            ).execute()
            row = response.data[0] if response.data else existing.data
        else:
            row = existing.data
        
        return TrackedStockResponse(
            id=row["id"],
            user_id=row["user_id"],
            symbol=row["symbol"],
            company_name=row.get("company_name"),
            logo_url=row.get("logo_url"),
            notify=row.get("notify", True),
            created_at=row["created_at"],
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新追踪股票失败: {str(e)}"
        )


@router.delete("/{stock_id}", response_model=MessageResponse, summary="删除追踪股票")
async def delete_tracked_stock(
    stock_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service),
):
    """
    删除追踪股票
    
    需要认证：Bearer token
    """
    try:
        # 验证所有权并删除
        response = supabase.table("stock_tracking").delete().eq(
            "id", stock_id
        ).eq("user_id", current_user_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="追踪股票未找到"
            )
        
        return MessageResponse(message="追踪股票已删除", success=True)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除追踪股票失败: {str(e)}"
        )


@router.get("/check/{symbol}", summary="检查股票是否已追踪")
async def check_stock_tracked(
    symbol: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service),
):
    """
    检查某个股票是否已在追踪列表中
    
    需要认证：Bearer token
    """
    try:
        response = supabase.table("stock_tracking").select("id").eq(
            "user_id", current_user_id
        ).eq("symbol", symbol.upper()).execute()
        
        is_tracked = bool(response.data)
        stock_id = response.data[0]["id"] if response.data else None
        
        return {
            "symbol": symbol.upper(),
            "is_tracked": is_tracked,
            "stock_id": stock_id
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"检查追踪状态失败: {str(e)}"
        )

