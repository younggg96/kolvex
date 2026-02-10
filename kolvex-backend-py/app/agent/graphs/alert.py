"""
Alert Agent Sub-Graph
监控 Agent - 处理股票预警和通知设置相关请求
"""

import logging
from langgraph.prebuilt import create_react_agent

from app.agent.llm import get_llm
from app.agent.tools import ALERT_TOOLS
from app.agent.config import SYSTEM_PROMPT

logger = logging.getLogger(__name__)

ALERT_SYSTEM_PROMPT = SYSTEM_PROMPT + """

You are the Alert Agent. Your role is to help users with stock monitoring and alerts.

You can:
1. Check current stock prices and determine if a price is at an interesting level
2. Analyze recent news that might trigger alerts
3. Look at KOL activity for sentiment shifts

When users ask about setting alerts, explain:
- The Kolvex platform supports stock price alerts via the Stock Alerts feature
- Users can set rules for price thresholds, percentage changes
- Notifications can be sent via email, Discord, Telegram, WeChat, and WhatsApp
- To actually create an alert rule, they should use the Stock Alerts section in the app

For now, you can help by:
- Checking if a stock is near key price levels
- Analyzing whether current conditions warrant an alert
- Recommending alert thresholds based on technical analysis

If the user asks in Chinese, respond in Chinese. If in English, respond in English.
"""


def create_alert_agent():
    """创建预警 Agent"""
    llm = get_llm()

    agent = create_react_agent(
        model=llm,
        tools=ALERT_TOOLS,
        prompt=ALERT_SYSTEM_PROMPT,
    )

    return agent
