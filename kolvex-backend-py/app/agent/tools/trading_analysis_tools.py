"""
Trading Analysis Tool for Chat Agent

Provides a simplified TradingAgents multi-agent analysis as a tool
within the existing chat agent system. Uses 1 debate round for speed.

All tradingagents imports are deferred so this module is safe to
import even when the package is not installed.
"""

import logging
from datetime import date
from typing import Optional

from langchain_core.tools import tool

logger = logging.getLogger(__name__)

_user_api_keys_store: dict[str, dict[str, str]] = {}


def set_user_api_keys_for_tool(user_id: str, keys: dict[str, str]):
    """Cache user API keys so the tool can access them during execution."""
    _user_api_keys_store[user_id] = keys


@tool
def run_trading_analysis(
    ticker: str,
    trade_date: Optional[str] = None,
    provider: str = "openai",
) -> str:
    """Run a multi-agent trading analysis on a stock ticker using TradingAgents.

    This tool deploys multiple AI agents (market analyst, social analyst, news analyst,
    fundamentals analyst, bull/bear researchers, trader, and risk managers) to collaboratively
    analyze a stock and produce a BUY/SELL/HOLD decision with supporting rationale.

    Args:
        ticker: Stock ticker symbol (e.g. "NVDA", "AAPL", "TSLA")
        trade_date: Analysis date in YYYY-MM-DD format. Defaults to today.
        provider: LLM provider to use (openai, anthropic, deepseek, etc.)

    Returns:
        A comprehensive analysis summary including the final BUY/SELL/HOLD decision
        and key findings from each analysis stage.
    """
    from app.services.trading_analysis_service import (
        TRADINGAGENTS_AVAILABLE,
        build_ta_config,
        create_trading_graph,
    )
    if not TRADINGAGENTS_AVAILABLE:
        return (
            "Trading Analysis is currently unavailable — the tradingagents package "
            "is not installed in this environment."
        )

    if not trade_date:
        trade_date = date.today().strftime("%Y-%m-%d")

    ticker = ticker.upper().strip()

    try:
        user_keys = None
        for uid, keys in _user_api_keys_store.items():
            user_keys = keys
            break

        config = build_ta_config(
            provider=provider,
            deep_think_model="gpt-4o-mini",
            quick_think_model="gpt-4o-mini",
            max_debate_rounds=1,
            max_risk_discuss_rounds=1,
            user_api_keys=user_keys,
        )

        graph = create_trading_graph(
            config=config,
            selected_analysts=["market", "news", "fundamentals"],
        )
        final_state, decision = graph.propagate(ticker, trade_date)

        sections = []
        sections.append(f"## Trading Analysis: {ticker} ({trade_date})")
        sections.append(f"### Final Decision: **{decision}**\n")

        if final_state.get("market_report"):
            sections.append(f"### Market Analysis\n{final_state['market_report'][:1000]}")

        if final_state.get("news_report"):
            sections.append(f"### News Analysis\n{final_state['news_report'][:1000]}")

        if final_state.get("fundamentals_report"):
            sections.append(f"### Fundamentals\n{final_state['fundamentals_report'][:1000]}")

        if final_state.get("investment_plan"):
            sections.append(f"### Investment Plan\n{final_state['investment_plan'][:1000]}")

        if final_state.get("final_trade_decision"):
            sections.append(f"### Full Signal\n{final_state['final_trade_decision'][:1500]}")

        return "\n\n".join(sections)

    except Exception as e:
        logger.error(f"Trading analysis tool failed for {ticker}: {e}", exc_info=True)
        return f"Trading analysis failed for {ticker}: {str(e)}"
