"""
股票代码列表 API 路由
"""

from fastapi import APIRouter, HTTPException

from app.core.supabase import get_supabase_service
from .schemas import TickersResponse
from .utils import parse_tickers_from_raw

router = APIRouter()


@router.get("/tickers", response_model=TickersResponse, summary="获取所有股票代码")
async def get_all_tickers():
    """
    获取数据库中所有提及的股票代码列表
    """
    try:
        supabase = get_supabase_service()

        response = (
            supabase.table("kol_tweets")
            .select("ai_tickers")
            .not_.is_("ai_tickers", "null")
            .execute()
        )

        all_tickers = set()

        for row in response.data or []:
            tickers_raw = row.get("ai_tickers")
            if not tickers_raw:
                continue

            tickers = parse_tickers_from_raw(tickers_raw)

            for ticker in tickers:
                ticker = ticker.strip().upper()
                # 移除 $ 前缀 (如 $NVDA -> NVDA)
                if ticker.startswith("$"):
                    ticker = ticker[1:]
                if ticker and ticker != "[]":
                    all_tickers.add(ticker)

        return TickersResponse(
            tickers=sorted(list(all_tickers)), count=len(all_tickers)
        )

    except Exception as e:
        print(f"Error fetching tickers: {e}")
        raise HTTPException(status_code=500, detail=f"获取股票代码失败: {str(e)}")

