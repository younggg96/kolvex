"""
Agent Tools
将现有服务封装为 LangGraph 可调用的工具
"""

import logging

logger = logging.getLogger(__name__)

from app.agent.tools.stock_tools import (
    get_stock_quote,
    get_stock_financials,
    get_analyst_recommendations,
    get_stock_history,
    get_company_info,
)
from app.agent.tools.news_tools import (
    search_stock_news,
    get_trending_news,
)
from app.agent.tools.kol_tools import (
    get_kol_latest_tweets,
    analyze_kol_sentiment,
)
from app.agent.tools.portfolio_tools import (
    get_user_portfolio,
    create_portfolio_tool_for_user,
)
from app.agent.tools.search_tools import (
    search_knowledge_base,
    get_superinvestor_holdings,
)
from app.agent.tools.web_tools import (
    web_search,
)

# 所有可用工具列表
ALL_TOOLS = [
    # Stock tools
    get_stock_quote,
    get_stock_financials,
    get_analyst_recommendations,
    get_stock_history,
    get_company_info,
    # News tools
    search_stock_news,
    get_trending_news,
    # KOL tools
    get_kol_latest_tweets,
    analyze_kol_sentiment,
    # Portfolio tools
    get_user_portfolio,
    # Search tools
    search_knowledge_base,
    get_superinvestor_holdings,
    # Web search
    web_search,
]

# 各子 Agent 的工具子集
FINANCIAL_TOOLS = [
    get_stock_quote,
    get_stock_financials,
    get_analyst_recommendations,
    get_company_info,
    search_stock_news,
    get_trending_news,
    get_kol_latest_tweets,
    analyze_kol_sentiment,
    get_user_portfolio,
    search_knowledge_base,
    get_superinvestor_holdings,
    web_search,
]

RESEARCH_TOOLS = [
    get_stock_quote,
    get_stock_financials,
    get_analyst_recommendations,
    get_stock_history,
    get_company_info,
    search_stock_news,
    get_kol_latest_tweets,
    analyze_kol_sentiment,
    search_knowledge_base,
    get_superinvestor_holdings,
    web_search,
]

ALERT_TOOLS = [
    get_stock_quote,
    search_stock_news,
    get_kol_latest_tweets,
    web_search,
]

def get_tools_for_sources(
    sources: list[str] | None,
    base_tools: str = "financial",
    user_id: str | None = None,
) -> list:
    """
    根据前端激活的 sources 过滤工具集

    Args:
        sources: 激活的数据源 ["kol", "news", "web", "portfolio"]
                 None 表示全部启用
        base_tools: 基础工具集 ("financial", "research", "alert")
        user_id: 当前认证用户 ID，用于绑定 portfolio 工具

    Returns:
        过滤后的工具列表
    """
    logger.info(f"get_tools_for_sources called: sources={sources}, base_tools={base_tools}, user_id={'***' + user_id[-6:] if user_id and len(user_id) > 6 else user_id}")

    # 核心工具（始终可用）
    core_tools = [
        get_stock_quote,
        get_stock_financials,
        get_analyst_recommendations,
        get_company_info,
        get_stock_history,
        search_knowledge_base,
        get_superinvestor_holdings,
    ]

    # 为当前用户创建绑定了 user_id 的 portfolio 工具
    portfolio_tool = (
        create_portfolio_tool_for_user(user_id) if user_id and user_id.strip()
        else get_user_portfolio
    )

    # source → 工具映射
    source_tool_map = {
        "kol": [get_kol_latest_tweets, analyze_kol_sentiment],
        "news": [search_stock_news, get_trending_news],
        "web": [web_search],
        "portfolio": [portfolio_tool],
    }

    # 如果 sources 为 None，启用全部
    if sources is None:
        active_sources = list(source_tool_map.keys())
    else:
        active_sources = [s for s in sources if s in source_tool_map]
        # 至少保留核心功能
        if not active_sources:
            active_sources = list(source_tool_map.keys())

    # 组装工具列表
    tools = list(core_tools)
    for source in active_sources:
        for t in source_tool_map[source]:
            if t not in tools:
                tools.append(t)

    return tools


__all__ = [
    "ALL_TOOLS",
    "FINANCIAL_TOOLS",
    "RESEARCH_TOOLS",
    "ALERT_TOOLS",
    "get_tools_for_sources",
    "create_portfolio_tool_for_user",
]
