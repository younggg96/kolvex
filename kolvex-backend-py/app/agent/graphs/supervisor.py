"""
Supervisor Graph
总控 Agent - 路由用户请求到合适的子 Agent
支持动态模型切换和数据源过滤
"""

import logging
from typing import Dict, Any, Optional, AsyncGenerator, List

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langgraph.prebuilt import create_react_agent

from app.agent.quote_evidence import QuoteEvidence, extract_quote_evidence
from app.agent.revenue_evidence import RevenueEvidence, extract_revenue_evidence, merge_revenue_evidence
from app.agent.state import AgentState
from app.agent.unit_fix import figures_by_trust, fix_unit_slips
from app.agent.llm import get_llm, get_fast_llm, resolve_model_id
from app.agent.config import SYSTEM_PROMPT, MAX_TOOL_ITERATIONS
from app.agent.tools import get_tools_for_sources

logger = logging.getLogger(__name__)


def _content_to_text(content: Any) -> str:
    """Normalize provider-specific message content into displayable text."""
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""

    parts: list[str] = []
    for item in content:
        if isinstance(item, str):
            parts.append(item)
        elif isinstance(item, dict) and item.get("type") in (None, "text"):
            text = item.get("text")
            if isinstance(text, str):
                parts.append(text)
    return "".join(parts)


def _message_has_tool_calls(message: Any) -> bool:
    """Return True when a model response is an internal tool-planning turn."""
    tool_calls = getattr(message, "tool_calls", None)
    if tool_calls:
        return True

    additional_kwargs = getattr(message, "additional_kwargs", None) or {}
    return bool(additional_kwargs.get("tool_calls"))

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
- "financial": For general financial questions, stock lookups, price checks, portfolio queries, or any stock-related question.
- "research": For in-depth research requests like "analyze NVDA", "give me a research report on TSLA", "deep dive into AAPL", "run trading analysis on MSFT", "should I buy/sell NVDA", "bull vs bear case for AAPL", or any request asking for comprehensive multi-factor analysis or trading decisions.
Scheduled alerts and notifications are unavailable. Route market condition questions to "financial".

If unclear, default to "financial".

Respond with ONLY the agent name, nothing else."""

# 增强提示词 - 根据激活的 sources 添加优先级指引
SOURCE_FOCUS_PROMPTS = {
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
    skills: Optional[List[str]] = None,
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
    tools = get_tools_for_sources(sources, base_tools=agent_type, user_id=user_id, skills=skills)

    # 选择系统提示词 + source hints
    available_tools = {tool.name for tool in tools}
    source_hint = _build_source_hint([
        source for source in sources or []
        if (source == "web" and "web_search" in available_tools)
        or (source == "portfolio" and "get_user_portfolio" in available_tools)
    ])
    source_hint += (
        "\n\nFor a current quote, use the price and currency returned by get_stock_quote. "
        "Only describe a quote as current when its returned market_time supports that claim. "
        "If the quote tool is unavailable or returns no price, say you could not verify the quote. "
        "If market_time is missing, state that the quote time is unknown."
        "\n\nWhen a source states an amount in billions, millions or thousands, either keep that unit "
        "(\"NT$3,809.05 billion\") or convert the number with it: 1 billion = 10亿, 1 trillion = 1万亿, "
        "1 million = 100万 (NT$3,809.05 billion = 新台币 3.81 万亿 = 38,090.5 亿). "
        "Never replace the unit word alone: \"3,809.05 billion\" is not \"3,809.05 亿\"."
    )
    if "get_reported_revenue" in available_tools:
        source_hint += (
            "\n\nUse get_reported_revenue for reported quarterly or annual revenue amounts. "
            "Match the period and currency in the returned evidence. With source \"sec\", identify the date as the SEC filing date; "
            "with source \"yahoo\", name Yahoo Finance as the source and give no filing date. "
            "Identify periods by their reported end dates. Do not infer fiscal-year labels or quarter numbers from calendar dates. "
            "The tool returns only directly reported figures. If the requested period is absent, state that limitation. "
            "For year-over-year revenue, set year_over_year=true and use year_over_year_pct. "
            "If that value is null, explain the reason in plain language and do not substitute the previous quarter. "
            "Keep internal field names out of the answer."
        )
    if skills is not None:
        source_hint += (
            "\n\nThe user selected which research skills are available for this turn. "
            "Use only the tools provided. Skip any requested research steps that need unavailable "
            "tools and explain material gaps. If no tools are available, answer from the provided "
            "context and general knowledge, and do not claim to have checked live data."
        )

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
    skills: Optional[List[str]] = None,
    quote_evidence: Optional[List[QuoteEvidence]] = None,
    revenue_evidence: Optional[List[RevenueEvidence]] = None,
) -> str:
    """
    运行 Agent 并返回最终回复

    Args:
        messages: 消息历史（langchain Message 对象列表）
        user_id: 用户 ID
        conversation_id: 对话 ID
        metadata: 额外元数据
        model_id: 前端传来的模型 ID（如 "gpt-4o-mini"）
        sources: 激活的数据源 ["web", "portfolio", "plaid"]
        user_api_keys: 用户自定义 API keys dict {provider: key}

    Returns:
        Agent 的文本回复
    """
    # 解析模型
    provider, model = resolve_model_id(model_id)

    # 1. 先分类意图
    agent_type = await _classify_intent(messages, user_api_keys=user_api_keys)

    # 2. 创建对应 Agent (传入 user_id 以绑定用户数据工具)
    agent = _create_agent_for_request(
        agent_type, provider, model, sources, user_id=user_id, user_api_keys=user_api_keys, skills=skills
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
                if quote_evidence is not None:
                    quotes = {}
                    for item in final_messages[len(messages):]:
                        if quote := extract_quote_evidence(item):
                            quotes[quote.symbol] = quote
                    quote_evidence.extend(quotes.values())
                if revenue_evidence is not None:
                    revenues = {}
                    for item in final_messages[len(messages):]:
                        for revenue in extract_revenue_evidence(item):
                            merge_revenue_evidence(revenues, revenue)
                    revenue_evidence.extend(revenues.values())
                tool_texts = [(item.name or "", str(item.content)) for item in final_messages[len(messages):]
                              if isinstance(item, ToolMessage)]
                values = [revenue.value for item in final_messages[len(messages):]
                          for revenue in extract_revenue_evidence(item)]
                content, _ = fix_unit_slips(_content_to_text(msg.content), figures_by_trust(tool_texts), values)
                return content

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
    skills: Optional[List[str]] = None,
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

    yield {
        "type": "status",
        "stage": "routing",
        "content": "Understanding your request",
    }

    # 1. 先分类意图
    agent_type = await _classify_intent(messages, user_api_keys=user_api_keys)

    # 2. 创建对应 Agent (传入 user_id 以绑定用户数据工具)
    agent = _create_agent_for_request(
        agent_type, provider, model, sources, user_id=user_id, user_api_keys=user_api_keys, skills=skills
    )

    yield {
        "type": "status",
        "stage": "planning",
        "content": "Planning the analysis",
    }

    # 3. 流式运行
    try:
        # A model turn can write text and only then decide to call a tool, so
        # tokens go out as they arrive and token_reset retracts a turn that
        # turns out to be tool planning.
        model_turns: Dict[str, Dict[str, bool]] = {}
        final_response_emitted = False
        quotes: dict[str, QuoteEvidence] = {}
        revenues: dict[tuple, RevenueEvidence] = {}
        tool_texts: list[tuple[str, str]] = []
        writing = {"type": "status", "stage": "writing", "content": "Writing the response"}

        async for event in agent.astream_events(
            {"messages": messages},
            config={"recursion_limit": MAX_TOOL_ITERATIONS * 3},
            version="v2",
        ):
            kind = event.get("event", "")

            if kind in ("on_chat_model_stream", "on_chat_model_end"):
                # A model called from inside a tool is not the assistant speaking.
                node = (event.get("metadata") or {}).get("langgraph_node")
                if node not in (None, "agent"):
                    continue

            if kind == "on_chat_model_stream":
                if final_response_emitted:
                    continue
                chunk = event.get("data", {}).get("chunk")
                run_id = str(event.get("run_id", "default"))
                turn = model_turns.setdefault(run_id, {"emitted": False, "tools": False})

                if getattr(chunk, "tool_call_chunks", None) or _message_has_tool_calls(chunk):
                    turn["tools"] = True
                    if turn["emitted"]:
                        turn["emitted"] = False
                        yield {"type": "token_reset"}
                    continue

                text = _content_to_text(getattr(chunk, "content", ""))
                if text and not turn["tools"]:
                    if not turn["emitted"]:
                        turn["emitted"] = True
                        yield writing
                    yield {"type": "token", "content": text}

            elif kind == "on_chat_model_end":
                run_id = str(event.get("run_id", "default"))
                turn = model_turns.pop(run_id, {"emitted": False, "tools": False})
                output = event.get("data", {}).get("output")

                if _message_has_tool_calls(output):
                    if turn["emitted"]:
                        yield {"type": "token_reset"}
                elif not final_response_emitted:
                    if turn["emitted"]:
                        final_response_emitted = True
                    else:
                        # Providers that do not stream only report the full message here.
                        final_text = _content_to_text(getattr(output, "content", ""))
                        if final_text:
                            final_response_emitted = True
                            yield writing
                            yield {"type": "token", "content": final_text}

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
                output = event.get("data", {}).get("output")
                if isinstance(output, ToolMessage) and isinstance(output.content, str):
                    tool_texts.append((event.get("name", ""), output.content))
                if quote := extract_quote_evidence(event.get("data", {}).get("output")):
                    quotes[quote.symbol] = quote
                for revenue in extract_revenue_evidence(event.get("data", {}).get("output")):
                    merge_revenue_evidence(revenues, revenue)
                # 工具调用结束
                tool_name = event.get("name", "")
                yield {
                    "type": "tool_end",
                    "tool": tool_name,
                }

        if not final_response_emitted:
            yield {
                "type": "error",
                "content": "The agent completed without a final response.",
            }
            return

        done: Dict[str, Any] = {"type": "done", "content": ""}
        # The caller repairs "1,270.38 billion" copied as "1,270.38 亿" against these.
        figures = figures_by_trust(tool_texts)
        if figures["trusted"] or figures["web"]:
            done["scaled_figures"] = figures
        if quotes:
            done["quote_evidence"] = [quote.model_dump(mode="json") for quote in quotes.values()]
        if revenues:
            done["revenue_evidence"] = [
                revenue.model_dump(mode="json", exclude_none=True) for revenue in revenues.values()
            ]
        yield done

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
