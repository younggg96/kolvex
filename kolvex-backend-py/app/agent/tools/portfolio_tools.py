"""
Portfolio Tools
封装投资组合服务为 LangGraph 工具
支持自动注入当前认证用户的 user_id
"""

import json
import logging
from langchain_core.tools import tool

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)


def _fetch_portfolio(user_id: str) -> str:
    """
    内部函数: 从数据库获取用户持仓数据

    数据模型关系链:
        snaptrade_connections (user_id)
            → snaptrade_accounts (connection_id)
                → snaptrade_positions (account_id)
    """
    if not user_id or not user_id.strip():
        logger.error("_fetch_portfolio called with empty user_id")
        return json.dumps({
            "status": "error",
            "error_type": "missing_user_id",
            "message": "Unable to retrieve portfolio: user authentication context is missing. "
                       "This is an internal system error, not the user's fault. "
                       "Please apologize and ask the user to try refreshing the page or logging in again.",
        })

    logger.info(f"Fetching portfolio for user_id={user_id}")

    try:
        supabase = get_supabase_service()

        # 1. 获取用户的 SnapTrade 连接
        conn_result = (
            supabase.table("snaptrade_connections")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )

        if not conn_result.data:
            logger.info(f"No SnapTrade connection found for user_id={user_id}")
            return json.dumps({
                "status": "empty",
                "user_id": user_id,
                "message": "The user has not connected a brokerage account yet, so there is no portfolio data available. "
                           "Suggest the user to connect their brokerage account via SnapTrade in the Settings page to enable portfolio tracking.",
                "positions": [],
            })

        connection_id = conn_result.data[0]["id"]

        # 2. 通过连接 → 账户 → 持仓关系链查询
        accounts_result = (
            supabase.table("snaptrade_accounts")
            .select("id, snaptrade_positions(*)")
            .eq("connection_id", connection_id)
            .execute()
        )

        # 3. 汇总所有账户的持仓
        all_positions = []
        for account in (accounts_result.data or []):
            for pos in account.get("snaptrade_positions", []):
                # 跳过隐藏的持仓
                if pos.get("is_hidden", False):
                    continue
                all_positions.append(pos)

        logger.info(f"Portfolio query returned {len(all_positions)} visible positions for user_id={user_id}")

        if not all_positions:
            return json.dumps({
                "status": "empty",
                "user_id": user_id,
                "message": "The user's brokerage account is connected but has no positions yet. "
                           "Suggest the user to sync their portfolio in the Settings page, or check if they have holdings in their brokerage account.",
                "positions": [],
            })

        # 4. 格式化持仓数据
        holdings = []
        total_value = 0.0

        for pos in all_positions:
            price = float(pos.get("price") or 0)
            units = float(pos.get("units") or 0)
            position_type = pos.get("position_type", "equity")
            multiplier = 100 if position_type == "option" else 1
            market_value = price * units * multiplier
            total_value += market_value

            avg_cost = pos.get("average_purchase_price")
            open_pnl = float(pos.get("open_pnl") or 0)

            # 计算盈亏百分比
            gain_loss_percent = None
            if avg_cost and float(avg_cost) > 0:
                cost_basis = float(avg_cost) * units * multiplier
                if cost_basis > 0:
                    gain_loss_percent = round(open_pnl / cost_basis * 100, 2)

            holdings.append({
                "symbol": pos.get("symbol"),
                "name": pos.get("security_name"),
                "quantity": units,
                "avg_cost": avg_cost,
                "current_price": price,
                "market_value": round(market_value, 2),
                "gain_loss": round(open_pnl, 2),
                "gain_loss_percent": gain_loss_percent,
                "position_type": position_type,
                "currency": pos.get("currency"),
            })

        # 5. 计算权重
        for h in holdings:
            mv = float(h.get("market_value") or 0)
            h["weight_percent"] = round(mv / max(total_value, 1) * 100, 2)

        # 6. 按市值排序
        holdings.sort(key=lambda x: float(x.get("market_value") or 0), reverse=True)

        return json.dumps(
            {
                "status": "success",
                "user_id": user_id,
                "total_value": round(total_value, 2),
                "position_count": len(holdings),
                "holdings": holdings[:20],  # 限制数量
            },
            indent=2,
            default=str,
        )
    except Exception as e:
        logger.error(f"Error getting portfolio for user {user_id}: {e}", exc_info=True)
        return json.dumps({
            "status": "error",
            "error_type": "database_error",
            "message": f"A technical error occurred while fetching portfolio data: {str(e)}. "
                       "This is a temporary system issue, not related to the user's identity. "
                       "Please apologize and suggest the user try again later.",
        })


@tool
def get_user_portfolio() -> str:
    """Get the current authenticated user's portfolio holdings including stocks, quantities, average cost, current price, gains/losses, and total value.
    
    This tool automatically uses the current user's identity — no user_id argument needed.
    Call this tool whenever the user asks about their portfolio, holdings, positions, P&L, or invested stocks.
    
    Returns:
        JSON string with portfolio holdings data including symbol, quantity, avg_cost, current_price, market_value, gain_loss, gain_loss_percent, weight_percent
    """
    # 这个默认实现会被 create_portfolio_tool_for_user() 替换
    logger.warning("Default get_user_portfolio called — user_id was not bound. Check tool creation flow.")
    return json.dumps({
        "status": "error",
        "error_type": "tool_not_configured",
        "message": "A temporary system issue prevented loading portfolio data. "
                   "This is NOT the user's fault. Please apologize for the inconvenience "
                   "and suggest the user try again. If the issue persists, they can try refreshing the page or logging in again.",
    })


def create_portfolio_tool_for_user(user_id: str):
    """
    为指定用户创建一个绑定了 user_id 的 portfolio 工具
    Agent 调用此工具时无需传入 user_id，自动使用当前认证用户
    """
    logger.info(f"Creating portfolio tool bound to user_id={user_id}")

    @tool
    def get_user_portfolio() -> str:
        """Get the current authenticated user's portfolio holdings including stocks, quantities, average cost, current price, gains/losses, and total value.
        
        This tool automatically uses the current user's identity — no user_id argument needed.
        Call this tool whenever the user asks about their portfolio, holdings, positions, P&L, or invested stocks.
        
        Returns:
            JSON string with portfolio holdings data including symbol, quantity, avg_cost, current_price, market_value, gain_loss, gain_loss_percent, weight_percent
        """
        return _fetch_portfolio(user_id)

    return get_user_portfolio
