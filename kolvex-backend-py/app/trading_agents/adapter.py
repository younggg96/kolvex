"""
Adapter that bridges Kolvex's user_api_keys system with TradingAgents' LLM client system.

TradingAgents' LLM clients read API keys from environment variables.
This adapter temporarily sets env vars from kolvex's user_api_keys dict
before creating the TradingAgentsGraph, ensuring user keys take priority.

All `tradingagents` imports are deferred to function bodies so that
this module can be imported even when the package is absent.
"""

import os
import logging
from typing import Any, Optional
from contextlib import contextmanager

from app.agent.config import (
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY,
    QWEN_API_KEY,
    GOOGLE_API_KEY,
    KIMI_API_KEY,
    GROK_API_KEY,
)

logger = logging.getLogger(__name__)

KOLVEX_TO_TA_PROVIDER = {
    "openai": "openai",
    "anthropic": "anthropic",
    "gemini": "google",
    "deepseek": "openai",
    "qwen": "openai",
    "kimi": "openai",
    "grok": "xai",
}

KOLVEX_PROVIDER_URLS = {
    "deepseek": "https://api.deepseek.com/v1",
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "kimi": "https://api.moonshot.cn/v1",
}

KOLVEX_TO_ENV_KEY = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "gemini": "GOOGLE_API_KEY",
    "google": "GOOGLE_API_KEY",
    "deepseek": "OPENAI_API_KEY",
    "qwen": "OPENAI_API_KEY",
    "kimi": "OPENAI_API_KEY",
    "grok": "XAI_API_KEY",
    "xai": "XAI_API_KEY",
}

SERVER_KEY_FALLBACKS = {
    "openai": OPENAI_API_KEY,
    "anthropic": ANTHROPIC_API_KEY,
    "gemini": GOOGLE_API_KEY,
    "deepseek": DEEPSEEK_API_KEY,
    "qwen": QWEN_API_KEY,
    "kimi": KIMI_API_KEY,
    "grok": GROK_API_KEY,
}


def _resolve_api_key(
    provider: str,
    user_api_keys: Optional[dict[str, str]] = None,
) -> Optional[str]:
    if user_api_keys and provider in user_api_keys:
        return user_api_keys[provider]
    return SERVER_KEY_FALLBACKS.get(provider)


@contextmanager
def _inject_env_keys(provider: str, user_api_keys: Optional[dict[str, str]] = None):
    """Temporarily set env vars for the TradingAgents LLM client to pick up."""
    api_key = _resolve_api_key(provider, user_api_keys)
    env_var = KOLVEX_TO_ENV_KEY.get(provider)

    logger.info(
        f"_inject_env_keys: provider={provider}, env_var={env_var}, "
        f"key_source={'user' if user_api_keys and provider in user_api_keys else 'server'}, "
        f"key_tail=****{api_key[-4:] if api_key else 'None'}"
    )

    old_val = None
    if api_key and env_var:
        old_val = os.environ.get(env_var)
        os.environ[env_var] = api_key

    try:
        yield
    finally:
        if env_var:
            if old_val is not None:
                os.environ[env_var] = old_val
            elif api_key:
                os.environ.pop(env_var, None)


def _get_default_config() -> dict[str, Any]:
    from tradingagents.default_config import DEFAULT_CONFIG
    return DEFAULT_CONFIG


def build_ta_config(
    provider: str = "openai",
    deep_think_model: str = "gpt-4o",
    quick_think_model: str = "gpt-4o-mini",
    max_debate_rounds: int = 1,
    max_risk_discuss_rounds: int = 1,
    selected_analysts: Optional[list[str]] = None,
    user_api_keys: Optional[dict[str, str]] = None,
) -> dict[str, Any]:
    """
    Build a TradingAgents config dict from Kolvex parameters.

    Translates kolvex provider names to TradingAgents-compatible values
    and resolves the backend_url for OpenAI-compatible providers.
    """
    ta_provider = KOLVEX_TO_TA_PROVIDER.get(provider, "openai")
    backend_url = KOLVEX_PROVIDER_URLS.get(provider, "https://api.openai.com/v1")

    config = _get_default_config().copy()
    config.update({
        "llm_provider": ta_provider,
        "deep_think_llm": deep_think_model,
        "quick_think_llm": quick_think_model,
        "backend_url": backend_url,
        "max_debate_rounds": max_debate_rounds,
        "max_risk_discuss_rounds": max_risk_discuss_rounds,
        "data_vendors": {
            "core_stock_apis": "yfinance",
            "technical_indicators": "yfinance",
            "fundamental_data": "yfinance",
            "news_data": "yfinance",
        },
    })

    return config


def create_trading_graph(
    config: dict[str, Any],
    selected_analysts: Optional[list[str]] = None,
    callbacks: Optional[list] = None,
):
    """
    Create a TradingAgentsGraph.

    IMPORTANT: The caller must wrap this call inside ``_inject_env_keys``
    so the correct API key is present in ``os.environ`` when the graph's
    LLM clients are constructed.
    """
    from tradingagents.graph.trading_graph import TradingAgentsGraph

    analysts = selected_analysts or ["market", "social", "news", "fundamentals"]

    graph = TradingAgentsGraph(
        selected_analysts=analysts,
        debug=False,
        config=config,
        callbacks=callbacks,
    )

    return graph
