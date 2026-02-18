"""
Options Flow Tools
Wrap the options flow service as LangGraph tools for unusual activity detection
"""

import json
import logging
from langchain_core.tools import tool

from app.services.options_flow.service import get_options_flow_service
from app.services.yfinance.client import get_yfinance_service

logger = logging.getLogger(__name__)


@tool
def scan_unusual_options(symbol: str) -> str:
    """Scan a stock's options chain for unusual activity such as high volume/OI ratio, large premium trades, and whale trades.

    Use this tool when the user asks about options flow, unusual options activity,
    smart money, institutional options trades, or options sentiment for a stock.

    Args:
        symbol: Stock ticker symbol (e.g. TSLA, NVDA, AAPL)

    Returns:
        JSON string with unusual options activity data including volume, open interest,
        vol/OI ratio, premium, implied volatility, and signal classification
    """
    try:
        service = get_options_flow_service()
        results = service.scan_symbol(symbol=symbol.upper(), max_expirations=4)

        if not results:
            return json.dumps({
                "symbol": symbol.upper(),
                "unusual_count": 0,
                "message": f"No unusual options activity detected for {symbol.upper()}",
            })

        # Summarize for the LLM
        call_count = sum(1 for r in results if r["option_type"] == "call")
        put_count = sum(1 for r in results if r["option_type"] == "put")
        total_premium = sum(r.get("premium", 0) for r in results)

        # Limit detail to top 10 by signal strength
        top_results = results[:10]
        simplified = []
        for r in top_results:
            simplified.append({
                "contract": r.get("contract_symbol", ""),
                "type": r["option_type"],
                "strike": r["strike"],
                "expiration": r["expiration"],
                "volume": r["volume"],
                "open_interest": r["open_interest"],
                "vol_oi_ratio": r["vol_oi_ratio"],
                "premium": r["premium"],
                "implied_volatility": round(r.get("implied_volatility", 0) * 100, 1),
                "signal_strength": r["signal_strength"],
                "signals": r["signal_types"],
            })

        return json.dumps({
            "symbol": symbol.upper(),
            "unusual_count": len(results),
            "calls": call_count,
            "puts": put_count,
            "total_premium": round(total_premium, 2),
            "call_put_ratio": round(call_count / put_count, 2) if put_count else call_count,
            "top_unusual": simplified,
        }, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error scanning unusual options for {symbol}: {e}")
        return json.dumps({"error": f"Failed to scan options for {symbol}: {str(e)}"})


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
