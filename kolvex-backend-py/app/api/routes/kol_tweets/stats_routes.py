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

    返回总推文数和总 KOL 数
    """
    try:
        supabase = get_supabase_service()

        # 总推文数
        tweets_result = (
            supabase.table("kol_tweets").select("id", count="exact").execute()
        )
        total_tweets = tweets_result.count or 0

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
            total_tweets=total_tweets,
            total_kols=total_kols,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")















