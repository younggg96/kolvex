"""
KOL 统计 API 路由
"""

from fastapi import APIRouter, HTTPException

from app.core.supabase import get_supabase_service
from .schemas import StatsResponse

router = APIRouter()


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """
    获取统计信息

    返回总帖子数和总 KOL 数
    """
    try:
        supabase = get_supabase_service()

        # 总帖子数（数据库表名保持 kol_tweets）
        posts_result = (
            supabase.table("kol_tweets").select("id", count="exact").execute()
        )
        total_posts = posts_result.count or 0

        # 总 KOL 数
        try:
            kols_result = (
                supabase.table("kol_profiles").select("id", count="exact").execute()
            )
            total_kols = kols_result.count or 0
        except Exception:
            # 表可能不存在
            total_kols = 0

        return StatsResponse(
            total_posts=total_posts,
            total_kols=total_kols,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")
