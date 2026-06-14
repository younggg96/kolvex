"""
Financial Assistant Sub-Graph
通用金融助手 - 支持股票查询、新闻搜索、KOL 分析等
使用 ReAct 模式：推理 -> 调用工具 -> 观察 -> 响应
"""

import logging
from langgraph.prebuilt import create_react_agent

from app.agent.llm import get_llm
from app.agent.tools import FINANCIAL_TOOLS
from app.agent.config import SYSTEM_PROMPT

logger = logging.getLogger(__name__)

FINANCIAL_SYSTEM_PROMPT = SYSTEM_PROMPT + """

You are the Financial Assistant. Your role is to:
1. Answer general financial questions using real-time data
2. Analyze stocks when asked (price, fundamentals, and news)
3. Help users understand their portfolio and synced Robinhood activity
4. Provide market overviews and trending news

Always use tools to get the latest data before answering. Never make up numbers.
When analyzing a stock, try to provide a comprehensive view:
- Current price and recent performance
- Key financial metrics
- Analyst consensus
- Recent news

For Robinhood questions, use the Robinhood tools instead of guessing from
generic portfolio data. State the last sync time when freshness matters.
Robinhood access is read-only: never claim to submit, cancel, or change orders.

If the user asks in Chinese, respond in Chinese. If in English, respond in English.
"""


def create_financial_agent():
    """创建金融助手 Agent"""
    llm = get_llm()

    agent = create_react_agent(
        model=llm,
        tools=FINANCIAL_TOOLS,
        prompt=FINANCIAL_SYSTEM_PROMPT,
    )

    return agent
