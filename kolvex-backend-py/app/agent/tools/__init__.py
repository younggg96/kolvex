"""
Agent Tools
将现有服务封装为 LangGraph 可调用的工具
"""

import logging

from app.agent.tools.brief_tools import get_daily_brief
from app.agent.tools.buzz_tools import get_market_buzz
from app.agent.tools.calendar_tools import get_market_events
from app.agent.tools.creator_tools import (
    get_creator_opinions,
    get_creator_recent_opinions,
    get_creator_record,
    search_creator_opinions,
)
from app.agent.tools.macro_tools import get_macro_indicators
from app.agent.tools.news_flash_tools import search_news_flashes
from app.agent.tools.options_tools import (
    get_options_chain_summary,
)
from app.agent.tools.paper_trading_tools import create_paper_trading_tool_for_user
from app.agent.tools.portfolio_tools import (
    create_portfolio_tool_for_user,
    get_user_portfolio,
)
from app.agent.tools.smart_money_tools import (
    get_congress_trades,
    get_institutional_holders,
    get_options_activity,
    get_superinvestor_portfolio,
)
from app.agent.tools.stock_tools import (
    get_analyst_recommendations,
    get_company_info,
    get_reported_revenue,
    get_stock_financials,
    get_stock_history,
    get_stock_quote,
)
from app.agent.tools.technical_tools import get_technical_indicators
from app.agent.tools.trading_analysis_tools import (
    create_trading_analysis_tool,
)
from app.agent.tools.valuation_tools import get_valuation
from app.agent.tools.watchlist_tools import create_watchlist_tool_for_user
from app.agent.tools.web_tools import (
    web_search,
)

logger = logging.getLogger(__name__)

# Every chat agent (see supervisor.AGENT_PROMPTS) shares one tool set; web and portfolio are added only when
# their data source is on, and skills narrow the set further.
AGENT_TOOLS = [
    get_stock_quote,
    get_stock_history,
    get_technical_indicators,
    get_stock_financials,
    get_reported_revenue,
    get_analyst_recommendations,
    get_company_info,
    get_options_chain_summary,
    get_creator_opinions,
    get_creator_record,
    get_creator_recent_opinions,
    search_creator_opinions,
    get_daily_brief,
    search_news_flashes,
    get_market_events,
    get_macro_indicators,
    get_institutional_holders,
    get_superinvestor_portfolio,
    get_congress_trades,
    get_options_activity,
    get_valuation,
    get_market_buzz,
]

_CHAT_TOOL_SKILLS = {
    "get_stock_quote": "market",
    "get_stock_history": "market",
    "get_technical_indicators": "market",
    "get_stock_financials": "fundamentals",
    "get_reported_revenue": "fundamentals",
    "get_analyst_recommendations": "fundamentals",
    "get_company_info": "fundamentals",
    "get_options_chain_summary": "options",
    "web_search": "news",
    "get_creator_opinions": "creators",
    "get_creator_record": "creators",
    "get_creator_recent_opinions": "creators",
    "search_creator_opinions": "creators",
    "get_market_events": "news",
    "get_macro_indicators": "news",
    "get_institutional_holders": "fundamentals",
    "get_superinvestor_portfolio": "fundamentals",
    "get_congress_trades": "fundamentals",
    "get_options_activity": "options",
    "get_valuation": "fundamentals",
    "get_market_buzz": "news",
    "get_paper_trading_account": "portfolio",
    "get_user_portfolio": "portfolio",
    "get_user_watchlist": "market",
    "get_daily_brief": "news",
    "search_news_flashes": "news",
}


def get_tools_for_sources(
    sources: list[str] | None,
    user_id: str | None = None,
    skills: list[str] | None = None,
) -> list:
    """
    根据前端激活的 sources 过滤工具集

    Args:
        sources: 激活的数据源 ["web", "portfolio"]
                 None 表示全部启用，空列表表示全部关闭
        user_id: 当前认证用户 ID，用于绑定 portfolio 工具
        skills: 启用的聊天技能，None 保留所有可用工具

    Returns:
        过滤后的工具列表
    """
    logger.info(
        f"get_tools_for_sources called: sources={sources}, user_id={'***' + user_id[-6:] if user_id and len(user_id) > 6 else user_id}"
    )

    # 基础工具（不受数据源开关影响）
    tools = list(AGENT_TOOLS)

    # 为当前用户创建绑定了 user_id 的 portfolio 工具
    portfolio_tool = (
        create_portfolio_tool_for_user(user_id)
        if user_id and user_id.strip()
        else get_user_portfolio
    )

    # 自选股和模拟交易账户是账户内数据，不依赖外部数据源开关；登录用户都可用
    if user_id and user_id.strip():
        tools.append(create_watchlist_tool_for_user(user_id))
        tools.append(create_paper_trading_tool_for_user(user_id))

    # source → 工具映射
    source_tool_map = {
        "web": [web_search],
        "portfolio": [portfolio_tool],
        "plaid": [portfolio_tool],
    }

    # 只有未指定 sources 才全部启用；用户关掉的数据源不能被重新打开
    if sources is None:
        active_sources = list(source_tool_map.keys())
    else:
        active_sources = [s for s in sources if s in source_tool_map]

    # 组装工具列表
    for source in active_sources:
        for t in source_tool_map[source]:
            if t not in tools:
                tools.append(t)

    if skills is None:
        return tools
    # Turning on the holdings data source is the user's explicit choice to share holdings, so
    # the skill filter must not take the holdings tool away again.
    holdings_on = sources is not None and any(s in ("portfolio", "plaid") for s in sources)
    return [
        tool
        for tool in tools
        if _CHAT_TOOL_SKILLS.get(tool.name) in skills or (holdings_on and tool is portfolio_tool)
    ]


__all__ = [
    "AGENT_TOOLS",
    "get_tools_for_sources",
    "create_portfolio_tool_for_user",
    "create_watchlist_tool_for_user",
    "create_paper_trading_tool_for_user",
    "create_trading_analysis_tool",
    "get_creator_opinions",
    "get_creator_record",
    "get_creator_recent_opinions",
    "search_creator_opinions",
    "get_market_events",
    "get_macro_indicators",
    "get_technical_indicators",
    "get_daily_brief",
    "search_news_flashes",
]
