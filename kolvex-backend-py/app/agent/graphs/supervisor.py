"""
Supervisor Graph
总控 Agent - 路由用户请求到合适的子 Agent
支持动态模型切换和数据源过滤
"""

import logging
from typing import Dict, Any, Optional, AsyncGenerator, List

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

from app.agent.state import AgentState
from app.agent.llm import get_llm, get_fast_llm, resolve_model_id
from app.agent.config import SYSTEM_PROMPT, MAX_TOOL_ITERATIONS
from app.agent.tools import FINANCIAL_TOOLS, RESEARCH_TOOLS, ALERT_TOOLS, get_tools_for_sources, set_user_api_keys_for_tool

logger = logging.getLogger(__name__)

# =====================================================================
# Sub-Agent 系统提示词
# =====================================================================

from app.agent.graphs.financial import FINANCIAL_SYSTEM_PROMPT
from app.agent.graphs.research import RESEARCH_SYSTEM_PROMPT
from app.agent.graphs.alert import ALERT_SYSTEM_PROMPT

# =====================================================================
# Supervisor 路由逻辑
# =====================================================================

ROUTER_SYSTEM_PROMPT = """You are a routing agent. Based on the user's message, determine which specialist agent should handle it.

Choose ONE of:
- "financial": For general financial questions, stock lookups, price checks, portfolio queries, news inquiries, KOL analysis, or any stock-related question.
- "research": For in-depth research requests like "analyze NVDA", "give me a research report on TSLA", "deep dive into AAPL", "run trading analysis on MSFT", "should I buy/sell NVDA", "bull vs bear case for AAPL", or any request asking for comprehensive multi-factor analysis or trading decisions.
- "alert": For monitoring, alert, and notification related questions like "set alert for AAPL at $200", "notify me when...", "monitor this stock".

If unclear, default to "financial".

Respond with ONLY the agent name, nothing else."""

# 增强提示词 - 根据激活的 sources 添加优先级指引
SOURCE_FOCUS_PROMPTS = {
    "kol": "\n\nIMPORTANT: The user has selected KOL (Key Opinion Leader) as a data source. Prioritize using KOL-related tools (get_kol_latest_tweets, analyze_kol_sentiment) to provide KOL insights in your response.",
    "news": "\n\nIMPORTANT: The user has selected News as a data source. Prioritize using news-related tools (search_stock_news, get_trending_news) to provide the latest news in your response.",
    "web": "\n\nIMPORTANT: The user has selected Web as a data source. Prioritize using the web_search tool to find the latest information from the internet.",
    "portfolio": "\n\nIMPORTANT: The user has selected Portfolio as a data source. Prioritize using the get_user_portfolio tool to analyze the user's portfolio holdings.",
}


def _build_source_hint(sources: Optional[List[str]]) -> str:
    """根据激活的 sources 构建额外提示词"""
    if not sources:
        return ""
    hints = []
    for source in sources:
        if source in SOURCE_FOCUS_PROMPTS:
            hints.append(SOURCE_FOCUS_PROMPTS[source])
    return "".join(hints)


# =====================================================================
# 动态创建 Sub-Agent（per request）
# =====================================================================

def _create_agent_for_request(
    agent_type: str,
    provider: Optional[str] = None,
    model: Optional[str] = None,
    sources: Optional[List[str]] = None,
    user_id: Optional[str] = None,
    user_api_keys: Optional[Dict[str, str]] = None,
):
    """
    为每个请求创建合适的 Agent（支持动态 model 和 source 过滤）

    Args:
        agent_type: "financial" | "research" | "alert"
        provider: LLM provider (可选, None 表示使用默认)
        model: 模型名称 (可选, None 表示使用默认)
        sources: 激活的数据源
        user_id: 当前认证用户 ID（用于绑定 portfolio 等用户工具）
        user_api_keys: 用户自定义 API keys dict {provider: key}
    """
    # 创建 LLM（用户 key 优先）
    llm = get_llm(provider=provider, model=model, user_api_keys=user_api_keys)

    # 获取过滤后的工具（传入 user_id 以绑定 portfolio 工具）
    tools = get_tools_for_sources(sources, base_tools=agent_type, user_id=user_id)

    # 选择系统提示词 + source hints
    source_hint = _build_source_hint(sources)

    if agent_type == "research":
        prompt = RESEARCH_SYSTEM_PROMPT + source_hint
    elif agent_type == "alert":
        prompt = ALERT_SYSTEM_PROMPT + source_hint
    else:
        prompt = FINANCIAL_SYSTEM_PROMPT + source_hint

    return create_react_agent(
        model=llm,
        tools=tools,
        prompt=prompt,
    )


# =====================================================================
# 公共 API
# =====================================================================

async def run_agent(
    messages: list,
    user_id: str = "",
    conversation_id: str = "",
    metadata: Optional[Dict[str, Any]] = None,
    model_id: Optional[str] = None,
    sources: Optional[List[str]] = None,
    user_api_keys: Optional[Dict[str, str]] = None,
) -> str:
    """
    运行 Agent 并返回最终回复

    Args:
        messages: 消息历史（langchain Message 对象列表）
        user_id: 用户 ID
        conversation_id: 对话 ID
        metadata: 额外元数据
        model_id: 前端传来的模型 ID（如 "gpt-4o-mini"）
        sources: 激活的数据源 ["kol", "news", "web", "portfolio"]
        user_api_keys: 用户自定义 API keys dict {provider: key}

    Returns:
        Agent 的文本回复
    """
    # 解析模型
    provider, model = resolve_model_id(model_id)

    # Cache user API keys for trading analysis tool
    if user_id and user_api_keys:
        set_user_api_keys_for_tool(user_id, user_api_keys)

    # 1. 先分类意图
    agent_type = await _classify_intent(messages, user_api_keys=user_api_keys)

    # 2. 创建对应 Agent (传入 user_id 以绑定用户数据工具)
    agent = _create_agent_for_request(
        agent_type, provider, model, sources, user_id=user_id, user_api_keys=user_api_keys
    )

    # 3. 运行
    try:
        result = await agent.ainvoke(
            {"messages": messages},
            config={"recursion_limit": MAX_TOOL_ITERATIONS * 3},
        )

        # 提取最后一条 AI 消息
        final_messages = result.get("messages", [])
        for msg in reversed(final_messages):
            if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
                return msg.content

        return "I'm sorry, I wasn't able to generate a response. Please try again."

    except Exception as e:
        logger.error(f"Agent execution failed: {e}", exc_info=True)
        return f"An error occurred while processing your request: {str(e)}"


async def stream_agent(
    messages: list,
    user_id: str = "",
    conversation_id: str = "",
    metadata: Optional[Dict[str, Any]] = None,
    model_id: Optional[str] = None,
    sources: Optional[List[str]] = None,
    user_api_keys: Optional[Dict[str, str]] = None,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    流式运行 Agent，逐步返回事件

    Args:
        messages: 消息历史
        user_id: 用户 ID
        conversation_id: 对话 ID
        metadata: 额外元数据
        model_id: 前端传来的模型 ID
        sources: 激活的数据源
        user_api_keys: 用户自定义 API keys dict {provider: key}

    Yields:
        事件字典，包含 type 和 content
    """
    # 解析模型
    provider, model = resolve_model_id(model_id)

    # Cache user API keys for trading analysis tool
    if user_id and user_api_keys:
        set_user_api_keys_for_tool(user_id, user_api_keys)

    # 1. 先分类意图
    agent_type = await _classify_intent(messages, user_api_keys=user_api_keys)

    # 2. 创建对应 Agent (传入 user_id 以绑定用户数据工具)
    agent = _create_agent_for_request(
        agent_type, provider, model, sources, user_id=user_id, user_api_keys=user_api_keys
    )

    # 3. 流式运行
    try:
        async for event in agent.astream_events(
            {"messages": messages},
            config={"recursion_limit": MAX_TOOL_ITERATIONS * 3},
            version="v2",
        ):
            kind = event.get("event", "")

            if kind == "on_chat_model_stream":
                # LLM token 流
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    yield {
                        "type": "token",
                        "content": chunk.content,
                    }

            elif kind == "on_tool_start":
                # 工具调用开始
                tool_name = event.get("name", "")
                tool_input = event.get("data", {}).get("input", {})
                yield {
                    "type": "tool_start",
                    "tool": tool_name,
                    "input": tool_input,
                }

            elif kind == "on_tool_end":
                # 工具调用结束
                tool_name = event.get("name", "")
                yield {
                    "type": "tool_end",
                    "tool": tool_name,
                }

        yield {"type": "done", "content": ""}

    except Exception as e:
        logger.error(f"Agent streaming failed: {e}", exc_info=True)
        yield {
            "type": "error",
            "content": f"An error occurred: {str(e)}",
        }


# =====================================================================
# 内部辅助函数
# =====================================================================

async def _classify_intent(
    messages: list,
    user_api_keys: Optional[Dict[str, str]] = None,
) -> str:
    """
    分类用户意图，决定路由到哪个子 Agent
    """
    # 获取最后一条用户消息
    last_user_msg = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            last_user_msg = msg.content
            break

    if not last_user_msg:
        return "financial"

    # 使用快速模型进行意图分类
    try:
        fast_llm = get_fast_llm(user_api_keys=user_api_keys)
        response = await fast_llm.ainvoke([
            SystemMessage(content=ROUTER_SYSTEM_PROMPT),
            HumanMessage(content=last_user_msg),
        ])

        intent = response.content.strip().lower()

        # 规范化
        if "research" in intent:
            agent_type = "research"
        elif "alert" in intent:
            agent_type = "alert"
        else:
            agent_type = "financial"

        logger.info(f"Intent classified: '{last_user_msg[:50]}...' -> {agent_type}")
        return agent_type

    except Exception as e:
        logger.warning(f"Intent classification failed: {e}, defaulting to financial")
        return "financial"
