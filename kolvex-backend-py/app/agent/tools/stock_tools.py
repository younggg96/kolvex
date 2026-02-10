"""
Stock Data Tools
封装 YFinance 和 Finnhub 服务为 LangGraph 工具
"""

import json
import asyncio
import logging
from typing import Optional
from langchain_core.tools import tool

from app.services.yfinance.client import get_yfinance_service
from app.services.finnhub.client import get_finnhub_client

logger = logging.getLogger(__name__)


@tool
def get_stock_quote(symbol: str) -> str:
    """Get real-time stock quote including current price, change, volume, and market cap.

    Args:
        symbol: Stock ticker symbol (e.g. AAPL, TSLA, NVDA)

    Returns:
        JSON string with stock quote data
    """
    try:
        yf_service = get_yfinance_service()
        quote = yf_service.get_quote(symbol)

        # 清理 None 值并格式化
        result = {k: v for k, v in quote.items() if v is not None}
        return json.dumps(result, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error getting stock quote for {symbol}: {e}")
        return json.dumps({"error": f"Failed to get quote for {symbol}: {str(e)}"})


@tool
def get_stock_financials(symbol: str) -> str:
    """Get stock financial data including PE ratio, profit margins, revenue, earnings, debt ratios, and cash flow metrics.

    Args:
        symbol: Stock ticker symbol (e.g. AAPL, TSLA, NVDA)

    Returns:
        JSON string with financial data
    """
    try:
        yf_service = get_yfinance_service()
        financials = yf_service.get_financials(symbol)

        result = {k: v for k, v in financials.items() if v is not None}
        return json.dumps(result, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error getting financials for {symbol}: {e}")
        return json.dumps({"error": f"Failed to get financials for {symbol}: {str(e)}"})


@tool
def get_analyst_recommendations(symbol: str) -> str:
    """Get analyst ratings, target prices, and recommendation history for a stock.

    Args:
        symbol: Stock ticker symbol (e.g. AAPL, TSLA, NVDA)

    Returns:
        JSON string with analyst recommendation data
    """
    try:
        yf_service = get_yfinance_service()
        recs = yf_service.get_analyst_recommendations(symbol)

        result = {k: v for k, v in recs.items() if v is not None}
        # 限制推荐历史数量避免太长
        if "recommendations" in result:
            result["recommendations"] = result["recommendations"][:10]
        return json.dumps(result, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error getting analyst recommendations for {symbol}: {e}")
        return json.dumps({"error": f"Failed to get recommendations for {symbol}: {str(e)}"})


@tool
def get_stock_history(symbol: str, period: str = "1mo", interval: str = "1d") -> str:
    """Get historical stock price data for charting and analysis.

    Args:
        symbol: Stock ticker symbol (e.g. AAPL, TSLA, NVDA)
        period: Time period - one of: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, ytd, max
        interval: Data interval - one of: 1d, 5d, 1wk, 1mo

    Returns:
        JSON string with historical price data (date, open, high, low, close, volume)
    """
    try:
        yf_service = get_yfinance_service()
        history = yf_service.get_history(symbol, period=period, interval=interval)

        # 限制数据量
        if len(history) > 60:
            history = history[-60:]

        return json.dumps(
            {"symbol": symbol.upper(), "period": period, "interval": interval, "data": history},
            indent=2,
            default=str,
        )
    except Exception as e:
        logger.error(f"Error getting stock history for {symbol}: {e}")
        return json.dumps({"error": f"Failed to get history for {symbol}: {str(e)}"})


@tool
def get_company_info(symbol: str) -> str:
    """Get company profile including sector, industry, business summary, and employee count.

    Args:
        symbol: Stock ticker symbol (e.g. AAPL, TSLA, NVDA)

    Returns:
        JSON string with company information
    """
    try:
        yf_service = get_yfinance_service()
        info = yf_service.get_company_info(symbol)

        result = {k: v for k, v in info.items() if v is not None}
        return json.dumps(result, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error getting company info for {symbol}: {e}")
        return json.dumps({"error": f"Failed to get company info for {symbol}: {str(e)}"})
