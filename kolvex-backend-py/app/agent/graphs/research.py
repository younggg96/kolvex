"""
Research Agent Sub-Graph
深度研究 Agent - 自动执行多步骤研究流程
收集市场数据 -> 分析基本面 -> 编写报告
"""

import logging
from langgraph.prebuilt import create_react_agent

from app.agent.llm import get_llm
from app.agent.tools import RESEARCH_TOOLS
from app.agent.config import SYSTEM_PROMPT

logger = logging.getLogger(__name__)

RESEARCH_SYSTEM_PROMPT = SYSTEM_PROMPT + """

You are the Research Agent. Your role is to conduct deep, multi-step research on stocks or financial topics.

When asked to research a stock, follow this systematic process:

**Step 1: Gather Basic Data**
- Get the current stock quote (price, change, volume)
- Get company info (sector, industry, business summary)
- Get key financial metrics (PE, revenue growth, margins)

**Step 2: Analyst Consensus**
- Get analyst recommendations and target prices
- Note the consensus rating and price targets

**Step 3: Compile Research Report**
Use market data, fundamentals, analyst consensus, options chain data and web research.
Include an executive summary, valuation, risk factors, and a supported bull/bear case.

**Step 7 (Optional): TradingAgents Multi-Agent Analysis**
- If the user specifically asks for a trading decision, buy/sell recommendation, or multi-agent analysis,
  use the `run_trading_analysis` tool to run a full multi-agent analysis (market analyst, social analyst,
  news analyst, fundamentals analyst, bull/bear researchers, trader, and risk managers).
- This tool takes a few minutes to run as it orchestrates multiple AI agents.

Be thorough and use ALL available tools. A good research report should call 5-8 tools minimum.
If the user asks in Chinese, write the report in Chinese. If in English, write in English.
"""


def create_research_agent():
    """创建研究 Agent"""
    llm = get_llm()

    agent = create_react_agent(
        model=llm,
        tools=RESEARCH_TOOLS,
        prompt=RESEARCH_SYSTEM_PROMPT,
    )

    return agent
