"""
Options Market Tools
Read options chain market data.
"""

import json
import logging
from langchain_core.tools import tool

from app.services.yfinance.client import get_yfinance_service

logger = logging.getLogger(__name__)




@tool
def get_options_chain_summary(symbol: str) -> str:
    """Get a summary of the options chain for a stock, including available expiration dates and key metrics for the nearest expiration.

    Use this tool when the user asks about a stock's options chain, available options,
    or wants to see calls and puts data.

    Args:
        symbol: Stock ticker symbol (e.g. TSLA, NVDA, AAPL)

    Returns:
        JSON string with expiration dates and a summary of the nearest options chain
    """
    try:
        yf_service = get_yfinance_service()
        data = yf_service.get_options(symbol)

        if data.get("error") or not data.get("options_chain"):
            return json.dumps({
                "symbol": symbol.upper(),
                "error": data.get("error", "No options data available"),
            })

        chain = data["options_chain"]
        calls = chain.get("calls", [])
        puts = chain.get("puts", [])

        # Compute summary stats
        call_vol = sum(c.get("volume", 0) for c in calls)
        put_vol = sum(p.get("volume", 0) for p in puts)
        call_oi = sum(c.get("open_interest", 0) for c in calls)
        put_oi = sum(p.get("open_interest", 0) for p in puts)

        # Top volume calls and puts
        top_calls = sorted(calls, key=lambda x: x.get("volume", 0), reverse=True)[:5]
        top_puts = sorted(puts, key=lambda x: x.get("volume", 0), reverse=True)[:5]

        def simplify_contract(c):
            return {
                "strike": c.get("strike"),
                "last_price": c.get("last_price"),
                "volume": c.get("volume"),
                "open_interest": c.get("open_interest"),
                "implied_volatility": round((c.get("implied_volatility") or 0) * 100, 1),
                "in_the_money": c.get("in_the_money"),
            }

        return json.dumps({
            "symbol": symbol.upper(),
            "expirations": data.get("expirations", [])[:8],
            "nearest_expiration": chain.get("expiration"),
            "total_calls": len(calls),
            "total_puts": len(puts),
            "call_volume": call_vol,
            "put_volume": put_vol,
            "call_open_interest": call_oi,
            "put_open_interest": put_oi,
            "put_call_volume_ratio": round(put_vol / call_vol, 2) if call_vol else 0,
            "top_volume_calls": [simplify_contract(c) for c in top_calls],
            "top_volume_puts": [simplify_contract(p) for p in top_puts],
        }, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error getting options chain for {symbol}: {e}")
        return json.dumps({"error": f"Failed to get options chain for {symbol}: {str(e)}"})
