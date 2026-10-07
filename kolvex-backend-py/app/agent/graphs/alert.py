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
You help users interpret current market conditions, stock prices and options chain data.
Scheduled alerts and notifications are unavailable. Do not claim to create alerts or send notifications.
Respond in the user's language.
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
