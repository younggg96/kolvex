"""
Agent Tools
将现有服务封装为 LangGraph 可调用的工具
"""

import logging

logger = logging.getLogger(__name__)

from app.agent.tools.stock_tools import (
    get_stock_quote,
    get_stock_financials,
    get_reported_revenue,
    get_analyst_recommendations,
    get_stock_history,
    get_company_info,
)
from app.agent.tools.brief_tools import get_daily_brief
from app.agent.tools.news_flash_tools import search_news_flashes
from app.agent.tools.watchlist_tools import create_watchlist_tool_for_user
from app.agent.tools.portfolio_tools import (
    get_user_portfolio,
    create_portfolio_tool_for_user,
)
from app.agent.tools.web_tools import (
    web_search,
)
from app.agent.tools.options_tools import (
    get_options_chain_summary,
)
from app.agent.tools.trading_analysis_tools import (
    create_trading_analysis_tool,
)
from app.agent.tools.creator_tools import (
    get_creator_opinions,
)

# 所有可用工具列表
ALL_TOOLS = [
    # Stock tools
    get_stock_quote,
    get_stock_financials,
    get_reported_revenue,
    get_analyst_recommendations,
    get_stock_history,
    get_company_info,
    # Portfolio tools
    get_user_portfolio,
    # Options flow tools
    get_options_chain_summary,
    # Web search
    web_search,
]

# 各子 Agent 的工具子集
FINANCIAL_TOOLS = [
    get_stock_quote,
    get_stock_financials,
    get_reported_revenue,
    get_analyst_recommendations,
    get_stock_history,
    get_company_info,
    get_user_portfolio,
    get_options_chain_summary,
    get_creator_opinions,
    get_daily_brief,
    search_news_flashes,
    web_search,
]

RESEARCH_TOOLS = [
    get_stock_quote,
    get_stock_financials,
    get_reported_revenue,
    get_analyst_recommendations,
    get_stock_history,
    get_company_info,
    get_options_chain_summary,
    get_creator_opinions,
    get_daily_brief,
    search_news_flashes,
    web_search,
]

ALERT_TOOLS = [
    get_stock_quote,
    web_search,
]

_BASE_TOOLS = {
    "financial": FINANCIAL_TOOLS,
    "research": RESEARCH_TOOLS,
    "alert": ALERT_TOOLS,
}

# Only available when the matching data source is active.
_SOURCE_GATED_TOOLS = (web_search, get_user_portfolio)


_CHAT_TOOL_SKILLS = {
    "get_stock_quote": "market",
    "get_stock_history": "market",
    "get_stock_financials": "fundamentals",
    "get_reported_revenue": "fundamentals",
    "get_analyst_recommendations": "fundamentals",
    "get_company_info": "fundamentals",
    "get_options_chain_summary": "options",
    "web_search": "news",
    "get_creator_opinions": "creators",
    "get_user_portfolio": "portfolio",
    "get_user_watchlist": "market",
    "get_daily_brief": "news",
    "search_news_flashes": "news",
}


def get_tools_for_sources(
    sources: list[str] | None,
    base_tools: str = "financial",
    user_id: str | None = None,
    skills: list[str] | None = None,
) -> list:
    """
    根据前端激活的 sources 过滤工具集

    Args:
        sources: 激活的数据源 ["web", "portfolio"]
                 None 表示全部启用，空列表表示全部关闭
        base_tools: 基础工具集 ("financial", "research", "alert")
        user_id: 当前认证用户 ID，用于绑定 portfolio 工具
        skills: 启用的聊天技能，None 保留所有可用工具

    Returns:
        过滤后的工具列表
    """
    logger.info(f"get_tools_for_sources called: sources={sources}, base_tools={base_tools}, user_id={'***' + user_id[-6:] if user_id and len(user_id) > 6 else user_id}")

    # 该子 Agent 的基础工具（不受数据源开关影响）
    base = _BASE_TOOLS.get(base_tools, FINANCIAL_TOOLS)
    tools = [t for t in base if t not in _SOURCE_GATED_TOOLS]

    # 为当前用户创建绑定了 user_id 的 portfolio 工具
    portfolio_tool = (
        create_portfolio_tool_for_user(user_id) if user_id and user_id.strip()
        else get_user_portfolio
    )

    # 自选股是账户内数据，不依赖外部数据源开关；登录用户的分析类 Agent 都可用
    if user_id and user_id.strip() and base_tools != "alert":
        tools.append(create_watchlist_tool_for_user(user_id))

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
    return [tool for tool in tools if _CHAT_TOOL_SKILLS.get(tool.name) in skills]


__all__ = [
    "ALL_TOOLS",
    "FINANCIAL_TOOLS",
    "RESEARCH_TOOLS",
    "ALERT_TOOLS",
    "get_tools_for_sources",
    "create_portfolio_tool_for_user",
    "create_watchlist_tool_for_user",
    "create_trading_analysis_tool",
    "get_creator_opinions",
    "get_daily_brief",
    "search_news_flashes",
]
