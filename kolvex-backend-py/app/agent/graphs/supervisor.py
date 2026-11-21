"""
Supervisor Graph
总控 Agent - 路由用户请求到合适的子 Agent
支持动态模型切换和数据源过滤
"""

import logging
import re
from typing import Any, AsyncGenerator, Dict, List, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.prebuilt import create_react_agent

from app.agent.config import MAX_TOOL_ITERATIONS
from app.agent.data_gaps import data_gap, merge_gaps
from app.agent.financial_evidence import extract_financial_evidence
from app.agent.llm import get_fast_llm, get_llm, resolve_model_id
from app.agent.quote_evidence import QuoteEvidence, extract_quote_evidence
from app.agent.revenue_evidence import (
    RevenueEvidence,
    extract_revenue_evidence,
    merge_revenue_evidence,
)
from app.agent.tools import get_tools_for_sources
from app.agent.unit_fix import figures_by_trust, fix_unit_slips
from app.services.free_llm_quota import (
    FREE_QUOTA_MESSAGES,
    FreeQuotaExceeded,
    FreeQuotaUnavailable,
)

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

from app.agent.graphs.buzz import BUZZ_SYSTEM_PROMPT  # noqa: E402
from app.agent.graphs.creators import CREATORS_SYSTEM_PROMPT  # noqa: E402
from app.agent.graphs.earnings import EARNINGS_SYSTEM_PROMPT  # noqa: E402
from app.agent.graphs.financial import FINANCIAL_SYSTEM_PROMPT  # noqa: E402
from app.agent.graphs.macro import MACRO_SYSTEM_PROMPT  # noqa: E402
from app.agent.graphs.paper_review import PAPER_REVIEW_SYSTEM_PROMPT  # noqa: E402
from app.agent.graphs.portfolio import PORTFOLIO_SYSTEM_PROMPT  # noqa: E402
from app.agent.graphs.research import RESEARCH_SYSTEM_PROMPT  # noqa: E402
from app.agent.graphs.smart_money import SMART_MONEY_SYSTEM_PROMPT  # noqa: E402
from app.agent.graphs.valuation import VALUATION_SYSTEM_PROMPT  # noqa: E402

# Specialists get only the tools their prompts use, plus quotes and news for "why did it move"
# (config.MOVE_REASON_RULES): fewer tool descriptions per call, fewer wrong picks. financial (the
# fallback) and research keep every tool. The user's data-source and skill switches still apply on top.
_NEWS_TOOLS = {"get_stock_quote", "search_news_flashes", "web_search"}
AGENT_TOOL_NAMES: Dict[str, set] = {
    "portfolio": _NEWS_TOOLS
    | {
        "get_user_portfolio",
        "get_user_watchlist",
        "get_market_events",
        "get_creator_opinions",
        "get_daily_brief",
    },
    "creators": _NEWS_TOOLS
    | {
        "get_creator_opinions",
        "get_creator_recent_opinions",
        "get_creator_record",
        "search_creator_opinions",
    },
    "earnings": _NEWS_TOOLS
    | {
        "get_market_events",
        "get_reported_revenue",
        "get_analyst_recommendations",
        "get_creator_opinions",
        "get_stock_financials",
        "get_company_info",
    },
    "macro": _NEWS_TOOLS
    | {"get_macro_indicators", "get_market_events", "get_daily_brief", "search_creator_opinions"},
    "smart_money": _NEWS_TOOLS
    | {
        "get_superinvestor_portfolio",
        "get_institutional_holders",
        "get_congress_trades",
        "get_options_activity",
        "get_company_info",
    },
    "valuation": _NEWS_TOOLS
    | {
        "get_valuation",
        "get_stock_financials",
        "get_analyst_recommendations",
        "get_reported_revenue",
        "get_stock_history",
    },
    "buzz": _NEWS_TOOLS
    | {
        "get_market_buzz",
        "get_creator_opinions",
        "get_daily_brief",
        "get_market_events",
        "get_technical_indicators",
    },
    "paper_review": {"get_paper_trading_account", "get_stock_quote"},
}


def tools_for_agent(agent_type: str, tools: list) -> list:
    """The agent's own tool set, out of the tools this request allows."""
    wanted = AGENT_TOOL_NAMES.get(agent_type)
    return list(tools) if wanted is None else [t for t in tools if t.name in wanted]


AGENT_PROMPTS = {
    "financial": FINANCIAL_SYSTEM_PROMPT,
    "research": RESEARCH_SYSTEM_PROMPT,
    "portfolio": PORTFOLIO_SYSTEM_PROMPT,
    "creators": CREATORS_SYSTEM_PROMPT,
    "earnings": EARNINGS_SYSTEM_PROMPT,
    "macro": MACRO_SYSTEM_PROMPT,
    "smart_money": SMART_MONEY_SYSTEM_PROMPT,
    "valuation": VALUATION_SYSTEM_PROMPT,
    "buzz": BUZZ_SYSTEM_PROMPT,
    "paper_review": PAPER_REVIEW_SYSTEM_PROMPT,
}

# =====================================================================
# Supervisor 路由逻辑
# =====================================================================

ROUTER_SYSTEM_PROMPT = """You are a routing agent. Based on the user's message, determine which specialist agent should handle it.

Choose ONE of:
- "financial": For general financial questions, stock lookups, price checks, or any stock-related question that fits no other agent.
- "research": For in-depth research requests like "analyze NVDA", "give me a research report on TSLA", "deep dive into AAPL", "run trading analysis on MSFT", "should I buy/sell NVDA", "bull vs bear case for AAPL", or any request asking for comprehensive multi-factor analysis or trading decisions.
- "portfolio": Questions about the user's own holdings or watchlist as a whole, like "what should I watch in my portfolio this week", "any news on my stocks".
- "creators": Questions about what YouTube creators / KOLs / bloggers said: one creator's recent calls, which creators are bullish on a stock, who mentioned a topic.
- "earnings": Questions about earnings reports: upcoming earnings dates, what to watch before a report, how a report came in.
- "macro": Questions about the economy, the Fed, interest rates, Treasury yields, inflation (CPI), jobs or GDP.
- "smart_money": Questions about superinvestors' 13F holdings (Buffett, 段永平, ARK ...), congress members' trades, or unusual options activity / options flow.
- "valuation": Whether a stock is expensive or cheap, its PE versus history, reference value ranges.
- "buzz": What is moving or trending today: top movers, volume spikes, Reddit or X attention.
- "paper_review": Reviewing the user's own paper-trading / simulated trades.
Scheduled alerts and notifications are unavailable. Route market condition questions to "financial".

If unclear, default to "financial".

Several agents: when the question is broad or needs several different kinds of data at once (for example
"NVDA 到底是怎么回事", "what's going on with TSLA", "PLTR 最近能不能关注", a stock's move together with its
valuation, earnings and what creators or big investors are doing), answer with 2 to 4 names separated by
commas, the most important first, e.g. "buzz, earnings, valuation". Prefer several specialists over
"research" unless the user asks for a written report or a buy / sell decision. A narrow question gets ONE
name.

Respond with ONLY the agent name or comma-separated names, nothing else."""

# 增强提示词 - 根据激活的 sources 添加优先级指引
SOURCE_FOCUS_PROMPTS = {
    "web": "\n\nIMPORTANT: The user has selected Web as a data source. Prioritize using the web_search tool to find the latest information from the internet.",
    "portfolio": "\n\nIMPORTANT: The user has selected Portfolio as a data source. Prioritize using the get_user_portfolio tool to analyze the user's portfolio holdings.",
}


# Quick questions get quick answers; the research agent keeps its long reports.
ANSWER_SHAPE = (
    "\n\nAnswer shape: put the direct answer in the first sentence. When the user asks for one or a few "
    "figures, keep the whole answer under about 150 words (about 300 Chinese characters): the figures, "
    "their period and source, and at most two sentences of context. Use a table only to compare three or "
    "more figures. Do not end by offering further help or listing what else you could look up."
)


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
    memory_note: Optional[str] = None,
):
    """
    为每个请求创建合适的 Agent（支持动态 model 和 source 过滤）

    Args:
        agent_type: a key of AGENT_PROMPTS ("financial" when unknown)
        provider: LLM provider (可选, None 表示使用默认)
        model: 模型名称 (可选, None 表示使用默认)
        sources: 激活的数据源
        user_id: 当前认证用户 ID（用于绑定 portfolio 等用户工具）
        user_api_keys: 用户自定义 API keys dict {provider: key}
    """
    # 创建 LLM（用户 key 优先）
    llm = get_llm(provider=provider, model=model, user_api_keys=user_api_keys)

    # 获取过滤后的工具（传入 user_id 以绑定 portfolio 工具），再收窄到这个子 Agent 的工具
    tools = tools_for_agent(
        agent_type, get_tools_for_sources(sources, user_id=user_id, skills=skills)
    )

    # 选择系统提示词 + source hints
    available_tools = {tool.name for tool in tools}
    source_hint = _build_source_hint(
        [
            source
            for source in sources or []
            if (source == "web" and "web_search" in available_tools)
            or (source == "portfolio" and "get_user_portfolio" in available_tools)
        ]
    )
    source_hint += (
        "\n\nFor a current quote, use the price and currency returned by get_stock_quote. "
        "Only describe a quote as current when its returned market_time supports that claim. "
        "State the quote time as the returned market_time_et; never show or convert the raw market_time number. "
        "If the quote tool is unavailable or returns no price, say you could not verify the quote. "
        "If market_time is missing, state that the quote time is unknown."
        "\n\nWhen a source states an amount in billions, millions or thousands, either keep that unit "
        '("NT$3,809.05 billion") or convert the number with it: 1 billion = 10亿, 1 trillion = 1万亿, '
        "1 million = 100万 (NT$3,809.05 billion = 新台币 3.81 万亿 = 38,090.5 亿). "
        'Never replace the unit word alone: "3,809.05 billion" is not "3,809.05 亿".'
    )
    if "get_reported_revenue" in available_tools:
        source_hint += (
            "\n\nUse get_reported_revenue for reported quarterly or annual revenue amounts. "
            'Match the period and currency in the returned evidence. With source "sec", identify the date as the SEC filing date; '
            'with source "yahoo", name Yahoo Finance as the source and give no filing date. '
            "Name a period by its returned fiscal_label (for example FY2027 Q2) together with its end date. "
            "Without a fiscal_label, identify it by its end date only: never infer fiscal-year labels or quarter numbers "
            "from calendar dates, and do not explain that you did not. "
            "The tool returns only directly reported figures. If the requested period is absent, state that limitation. "
            "For year-over-year revenue, set year_over_year=true and use year_over_year_pct. "
            "If that value is null, explain the reason in plain language and do not substitute the previous quarter. "
            "If the latest evidence has newer_derived_period_end, a newer period exists but its revenue is only "
            "derivable (for example annual minus nine months after a 10-K): say that the period ending on that date "
            "is not directly reported, and present the returned period as the latest directly reported one. "
            "When the evidence has usd_value, give the reporting-currency amount first and the dollar amount after it, "
            "saying it is converted at the fx_date exchange rate. "
            "Keep internal field names out of the answer."
        )
    if skills is not None:
        source_hint += (
            "\n\nThe user selected which research skills are available for this turn. "
            "Use only the tools provided. Skip any requested research steps that need unavailable "
            "tools and explain material gaps. If no tools are available, answer from the provided "
            "context and general knowledge, and do not claim to have checked live data."
        )

    prompt = AGENT_PROMPTS.get(agent_type, FINANCIAL_SYSTEM_PROMPT) + source_hint
    prompt += (
        "\n\nKolvex has a Research team in the research workspace. The app decides when to start "
        "a team run; you may point users to the workspace's Start research button when asked. "
        "Do not speculate about internal orchestration, integrations, or whether a job started."
    )
    if agent_type not in AGENT_PROMPTS or agent_type == "financial":
        prompt += ANSWER_SHAPE
    if memory_note:
        # Conversation summary and cross-conversation memory (app/agent/chat_memory.py).
        prompt += "\n\n" + memory_note

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
    financial_evidence: Optional[List[Dict[str, Any]]] = None,
    data_gaps: Optional[List[Dict[str, Any]]] = None,
    memory_note: Optional[str] = None,
    agent: Optional[str] = None,
    allowed_agents: Optional[List[str]] = None,
    turn_stats: Optional[Dict[str, Any]] = None,
) -> str:
    """
    运行 Agent 并返回最终回复

    turn_stats, when given, receives the routed agent, the tools called in order and the
    token use, for the per-turn log line (routes.log_turn).

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

    # 1. 固定的 Agent 直接用；否则分类意图
    if agent in AGENT_PROMPTS:
        agent_type = agent
    else:
        agent_type = await _classify_intent(
            messages, user_api_keys=user_api_keys, allowed=allowed_agents
        )
    if turn_stats is not None:
        turn_stats["agent"] = agent_type

    # 2. 创建对应 Agent (传入 user_id 以绑定用户数据工具)
    agent = _create_agent_for_request(
        agent_type,
        provider,
        model,
        sources,
        user_id=user_id,
        user_api_keys=user_api_keys,
        skills=skills,
        memory_note=memory_note,
    )

    # 3. 运行
    try:
        result = await agent.ainvoke(
            {"messages": messages},
            config={"recursion_limit": MAX_TOOL_ITERATIONS * 3},
        )

        # 提取最后一条 AI 消息
        final_messages = result.get("messages", [])
        if turn_stats is not None:
            made = [m for m in final_messages[len(messages) :] if isinstance(m, AIMessage)]
            spent = [m.usage_metadata or {} for m in made]
            turn_stats["tools"] = [c["name"] for m in made for c in (m.tool_calls or [])]
            turn_stats["usage"] = {
                "model_calls": len(made),
                "input_tokens": sum(s.get("input_tokens", 0) or 0 for s in spent),
                "output_tokens": sum(s.get("output_tokens", 0) or 0 for s in spent),
            }
        for msg in reversed(final_messages):
            if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
                if quote_evidence is not None:
                    quotes = {}
                    for item in final_messages[len(messages) :]:
                        if quote := extract_quote_evidence(item):
                            quotes[quote.symbol] = quote
                    quote_evidence.extend(quotes.values())
                if revenue_evidence is not None:
                    revenues = {}
                    for item in final_messages[len(messages) :]:
                        for revenue in extract_revenue_evidence(item):
                            merge_revenue_evidence(revenues, revenue)
                    revenue_evidence.extend(revenues.values())
                produced = final_messages[len(messages) :]
                if financial_evidence is not None:
                    found = {
                        i["label"]: i for item in produced for i in extract_financial_evidence(item)
                    }
                    financial_evidence.extend(found.values())
                if data_gaps is not None:
                    data_gaps.extend(merge_gaps([g for item in produced if (g := data_gap(item))]))
                tool_texts = [
                    (item.name or "", str(item.content))
                    for item in produced
                    if isinstance(item, ToolMessage)
                ]
                values = [
                    revenue.value
                    for item in final_messages[len(messages) :]
                    for revenue in extract_revenue_evidence(item)
                ]
                content, _ = fix_unit_slips(
                    _content_to_text(msg.content), figures_by_trust(tool_texts), values
                )
                return content

        return "I'm sorry, I wasn't able to generate a response. Please try again."

    except Exception as e:
        # Provider errors can carry internal hosts, keys' prefixes or request ids: log, never show.
        logger.error(f"Agent execution failed: {e}", exc_info=True)
        raise


async def stream_agent(
    messages: list,
    user_id: str = "",
    conversation_id: str = "",
    metadata: Optional[Dict[str, Any]] = None,
    model_id: Optional[str] = None,
    sources: Optional[List[str]] = None,
    user_api_keys: Optional[Dict[str, str]] = None,
    skills: Optional[List[str]] = None,
    memory_note: Optional[str] = None,
    agent: Optional[str] = None,
    allowed_agents: Optional[List[str]] = None,
    team_research: bool = False,
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
        agent: 固定使用的子 Agent（工作区面板）；为空时自动路由
        allowed_agents: 自动路由只在这些 Agent 里选（用户设置 + 技能）；为空表示全部

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

    # 1. 固定的 Agent 直接用；否则分类意图
    pinned = agent in AGENT_PROMPTS
    specialists: list[str] = []
    question = _question_text(last_user_text(messages))
    explicit_team = (
        team_research
        and not pinned
        and bool(_TEAM_REQUEST.search(question))
        and not _TEAM_HELP.search(question)
    )
    if explicit_team and _TEAM_COMMAND.fullmatch(question):
        question = next(
            (
                text
                for msg in reversed(messages)
                if isinstance(msg, HumanMessage)
                and (text := _question_text(str(msg.content)))
                and not _TEAM_REQUEST.search(text)
            ),
            "",
        )
    agent_type = (
        agent
        if pinned
        else "financial"
        if explicit_team
        else await _classify_intent(
            messages,
            user_api_keys=user_api_keys,
            specialists=specialists,
            allowed=allowed_agents,
        )
    )
    yield {"type": "agent", "agent": agent_type, "pinned": pinned}
    # Several specialists: the router model's pick for a broad question, else the keyword groups.
    if not pinned:
        suggested = specialists or suggest_agents(question)
        if explicit_team and len(suggested) < 2:
            preferred = [name for name, words in _KEYWORD_AGENTS if words.search(question)]
            suggested = list(
                dict.fromkeys(
                    [*preferred, "financial", "earnings", "valuation", "buzz", "creators", "macro"]
                )
            )
        if allowed_agents:
            suggested = [name for name in suggested if name in allowed_agents]
        if len(suggested) >= 2:
            suggestion = {"type": "agent_suggestion", "agents": suggested[:MAX_SUGGESTED_AGENTS]}
            if team_research:
                suggestion["question"] = question
                suggestion["explicit"] = explicit_team
            yield suggestion

    # 2. 创建对应 Agent (传入 user_id 以绑定用户数据工具)
    agent = _create_agent_for_request(
        agent_type,
        provider,
        model,
        sources,
        user_id=user_id,
        user_api_keys=user_api_keys,
        skills=skills,
        memory_note=memory_note,
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
        gaps: list[dict] = []
        financials: dict[str, dict] = {}
        usage = {"model_calls": 0, "input_tokens": 0, "output_tokens": 0}
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

            if kind == "on_chat_model_end":
                # Token use for the per-turn log line (app/api/routes/chat/routes.py).
                spent = getattr(event.get("data", {}).get("output"), "usage_metadata", None) or {}
                usage["model_calls"] += 1
                usage["input_tokens"] += spent.get("input_tokens", 0) or 0
                usage["output_tokens"] += spent.get("output_tokens", 0) or 0

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
                if gap := data_gap(output):
                    gaps.append(gap)
                for item in extract_financial_evidence(output):
                    financials[item["label"]] = item  # the latest call per metric wins
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

        done: Dict[str, Any] = {"type": "done", "content": "", "usage": usage}
        # The caller repairs "1,270.38 billion" copied as "1,270.38 亿" against these.
        if gaps:
            done["data_gaps"] = merge_gaps(gaps)
        if financials:
            # Not shown as cards; the server checks the answer's ratios and margins against them.
            done["financial_evidence"] = list(financials.values())
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

    except (FreeQuotaExceeded, FreeQuotaUnavailable) as e:
        yield {"type": "error", "code": e.code, "content": FREE_QUOTA_MESSAGES[e.code]}
    except Exception as e:
        logger.error(f"Agent streaming failed: {e}", exc_info=True)
        yield {
            "type": "error",
            # The exception text stays in the log; it is not the user's to read.
            "content": "The agent could not complete the response. Please try again.",
        }


# =====================================================================
# 内部辅助函数
# =====================================================================

# Asking for a report, a recommendation or a bull/bear case means the research agent.
_TEAM_REQUEST = re.compile(
    r"多\s*(?:个\s*)?agents?(?![a-z])|多智能体|研究团队|multi[\s-]*agents?\b|"
    r"multiple\s+agents?\b|research\s+team\b",
    re.IGNORECASE,
)
_TEAM_HELP = re.compile(
    r"什么是|怎么用|怎么使用|如何使用|how (?:do i|to) use|what is", re.IGNORECASE
)
_TEAM_COMMAND = re.compile(
    r"(?:我(?:想要?|要)?|请|帮我|可以|能不能|你能|启动|使用|用|试试|打开|开启|让|一下|"
    r"的|功能|来|分析|研究|协作|吗|吧|这(?:个问题)?|[\s。！？!?.,，、]|"
    r"(?:" + _TEAM_REQUEST.pattern + r")|"
    r"\b(?:i|want|to|can|you|we|please|start|use|run|enable|the|a|feature)\b)+",
    re.IGNORECASE,
)

_RESEARCH_WORDS = re.compile(
    r"深度|研究报告|研报|deep[- ]?dive|research report|bull(?:ish)? (?:and|vs\.?|or) bear|bear case|bull case|"
    r"多空|该不该买|值不值得|要不要买|能不能买|should i (?:buy|sell|hold)|worth (?:buying|holding)|"
    r"trading analysis|交易分析|投资建议|全面分析|综合分析|comprehensive analysis",
    re.IGNORECASE,
)
# A lookup: one figure or a follow-up. Anything longer or vaguer goes to the model router.
_LOOKUP_WORDS = re.compile(
    r"多少|是多少|几|股价|价格|报价|营收|收入|市盈率|市值|毛利率|净利率|利润率|同比|EPS|每股收益|期权|"
    r"price|quote|trading at|revenue|sales|P/?E\b|market cap|margin|EPS|how much|what(?:'s| is| was)|"
    r"^\s*(?:那|换成|and|what about|how about)\b",
    re.IGNORECASE,
)


# The user's own holdings as a whole. A research ask ("我的持仓该不该卖") still goes to research.
_PORTFOLIO_WORDS = re.compile(
    r"我的(?:持仓|仓位|组合|投资组合|自选|股票)|我持有的|我手上的|我买的(?:股票)?|"
    r"\bmy (?:portfolio|holdings|positions|watchlist|stocks)\b",
    re.IGNORECASE,
)
_EARNINGS_WORDS = re.compile(
    r"财报|业绩会|业绩发布|财季|earnings|quarterly results|earnings call|\bguidance\b",
    re.IGNORECASE,
)
_CREATOR_WORDS = re.compile(
    r"博主|创作者|油管|频道|大V|\bKOLs?\b|youtubers?|creators?|influencers?|bloggers?|"
    r"谁(?:说过|提到|提过|聊过|讲过)|"
    # Asking how someone's calls turned out ("他之前的推荐准不准"): the creators agent answers with
    # price facts from get_creator_record and no verdict.
    r"准不准|说对了?(?:几次|吗|没)|看对了?(?:几次|吗|没)|说错|胜率|准确率|命中率|靠不靠谱|靠谱吗|"
    r"\b(?:track record|hit rate|win rate)\b",
    re.IGNORECASE,
)
_MACRO_WORDS = re.compile(
    r"宏观|美联储|联储|议息|降息|加息|(?<![净毛])利率|美债|国债|收益率曲线|通胀|CPI|PCE|非农|失业率|就业数据|GDP|"
    r"\b(?:FOMC|the Fed|Fed (?:meeting|rate|decision)|rate (?:cut|hike)s?|interest rates?|inflation|"
    r"treasury yields?|payrolls|unemployment|recession|macro)\b",
    re.IGNORECASE,
)


_PAPER_WORDS = re.compile(r"模拟交易|模拟盘|模拟账户|虚拟交易|\bpaper[- ]?trad", re.IGNORECASE)
_SMART_MONEY_WORDS = re.compile(
    r"13F|超级投资者|大佬|机构持仓|机构.{0,4}(?:买|卖|持有)|巴菲特|伯克希尔|段永平|李录|高瓴|桥水|木头姐|"
    r"国会|议员|佩洛西|期权异动|期权流|异常期权|"
    r"\b(?:superinvestors?|hedge funds?|institutional holders?|congress(?:ional)?|senators?|pelosi|"
    r"options? (?:flow|activity)|unusual options|smart money|buffett|berkshire)\b",
    re.IGNORECASE,
)
_VALUATION_WORDS = re.compile(
    r"估值|贵不贵|便宜吗|贵吗|高估|低估|合理价|历史市盈率|PE\s*(?:区间|分位)|偏贵|偏便宜|"
    # A multiple judged against its own history ("市盈率在历史上算高吗"), not just looked up.
    r"(?:市盈率|市净率|市销率|(?<![A-Za-z])P/?[ES](?![A-Za-z])).{0,12}(?:历史|过去|五年|5\s*年).{0,8}(?:高|低|贵|便宜)|"
    r"\b(?:valuation|overvalued|undervalued|expensive|cheap|fair value)\b|"
    r"\bP/?E\b.{0,30}\bhistor(?:y|ic|ical|ically)\b",
    re.IGNORECASE,
)
_BUZZ_WORDS = re.compile(
    r"异动|放量|热门股|热股|热议|热度|在炒|涨幅榜|跌幅榜|reddit|wsb|"
    r"\b(?:trending|top (?:movers|gainers|losers)|biggest movers|most active|what'?s (?:hot|moving)|buzz)\b",
    re.IGNORECASE,
)


# Specific agents in routing order. An explicit research ask comes before all of them and a short
# figure lookup after them; neither is a specialist, so neither is suggested.
_KEYWORD_AGENTS = (
    ("paper_review", _PAPER_WORDS),
    ("portfolio", _PORTFOLIO_WORDS),
    ("smart_money", _SMART_MONEY_WORDS),
    ("earnings", _EARNINGS_WORDS),
    ("creators", _CREATOR_WORDS),
    ("macro", _MACRO_WORDS),
    ("valuation", _VALUATION_WORDS),
    ("buzz", _BUZZ_WORDS),
)
MAX_SUGGESTED_AGENTS = 4


def _question_text(message: str) -> str:
    return message.split("\n\nKolvex page evidence", 1)[0].strip()


def route_by_keywords(message: str) -> Optional[str]:
    """An agent name when the wording leaves no doubt, else None (ask the model).

    Order matters: an explicit research ask first, then paper trading, the user's own holdings,
    disclosed money (13F, congress, options flow), earnings (which also reads creator opinions),
    creators, macro, valuation, market buzz, and short figure lookups.
    """
    text = _question_text(message)
    if _RESEARCH_WORDS.search(text):
        return "research"
    for name, words in _KEYWORD_AGENTS:
        if words.search(text):
            return name
    if len(text) <= 80 and _LOOKUP_WORDS.search(text):
        return "financial"
    return None


def suggest_agents(message: str) -> list[str]:
    """Specialists a question spans when it spans two or more, else [].

    Free (no model call): the same keyword groups as routing. The chat answers with the first one;
    the UI offers to give each its own panel in a workspace. A research ask already combines angles,
    and the earnings agent already reads creator opinions, so neither adds a suggestion.
    """
    text = _question_text(message)
    if _RESEARCH_WORDS.search(text):
        return []
    found = [name for name, words in _KEYWORD_AGENTS if words.search(text)]
    if "earnings" in found and "creators" in found:
        found.remove("creators")
    return found[:MAX_SUGGESTED_AGENTS] if len(found) >= 2 else []


def last_user_text(messages: list) -> str:
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            return msg.content if isinstance(msg.content, str) else str(msg.content)
    return ""


_AGENT_NAME = re.compile(r"\b(" + "|".join(sorted(AGENT_PROMPTS, key=len, reverse=True)) + r")\b")


def parse_router_answer(text: str) -> list[str]:
    """Agent names in the router's answer, in the order given, without repeats."""
    names: list[str] = []
    for match in _AGENT_NAME.finditer(text.lower()):
        if match.group(1) not in names:
            names.append(match.group(1))
    return names


def _available_note(pool: List[str]) -> str:
    if len(pool) == len(AGENT_PROMPTS):
        return ""
    return (
        "\n\nOnly these agents are available for this user: "
        + ", ".join(f'"{name}"' for name in pool)
        + ". Never answer with any other name."
    )


async def _classify_intent(
    messages: list,
    user_api_keys: Optional[Dict[str, str]] = None,
    specialists: Optional[List[str]] = None,
    allowed: Optional[List[str]] = None,
) -> str:
    """
    分类用户意图，决定路由到哪个子 Agent

    When the router model names several agents for a broad question, they go into `specialists`
    (2 to MAX_SUGGESTED_AGENTS, research excluded) and the first one answers in the chat.
    `allowed` limits the choice (the user's settings and the chat's skills); empty means all.
    """
    pool = [name for name in AGENT_PROMPTS if not allowed or name in allowed] or list(AGENT_PROMPTS)
    fallback = "financial" if "financial" in pool else pool[0]
    # 获取最后一条用户消息
    last_user_msg = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            last_user_msg = msg.content
            break

    if not last_user_msg:
        return fallback

    # Clear cases skip the ~1s router call: it was a quarter of a quick answer's latency.
    quick = route_by_keywords(
        last_user_msg if isinstance(last_user_msg, str) else str(last_user_msg)
    )
    if quick in pool:
        logger.info(f"Intent by keywords: '{str(last_user_msg)[:50]}...' -> {quick}")
        return quick

    # 使用快速模型进行意图分类
    try:
        fast_llm = get_fast_llm(user_api_keys=user_api_keys)
        response = await fast_llm.ainvoke(
            [
                SystemMessage(content=ROUTER_SYSTEM_PROMPT + _available_note(pool)),
                HumanMessage(content=last_user_msg),
            ]
        )

        names = [n for n in parse_router_answer(_content_to_text(response.content)) if n in pool]
        # 规范化：模型答案里的第一个可用名字；都没有就回到 financial（或第一个可用的）
        agent_type = names[0] if names else fallback
        several = [name for name in names if name != "research"][:MAX_SUGGESTED_AGENTS]
        if specialists is not None and len(several) >= 2:
            specialists.extend(several)
            agent_type = several[0]

        logger.info(f"Intent classified: '{last_user_msg[:50]}...' -> {agent_type}")
        return agent_type

    except Exception as e:
        logger.warning(f"Intent classification failed: {e}, defaulting to {fallback}")
        return fallback
