import os

DEFAULT_CONFIG = {
    "project_dir": os.path.abspath(os.path.dirname(__file__)),
    "data_cache_dir": os.path.join(
        os.path.abspath(os.path.dirname(__file__)),
        "dataflows",
        "data_cache",
    ),
    # LLM settings — provider names match Kolvex conventions directly:
    # openai, anthropic, gemini, deepseek, qwen, kimi, grok, ollama
    "llm_provider": "openai",
    "deep_think_llm": "gpt-4o",
    "quick_think_llm": "gpt-4o-mini",
    "backend_url": None,
    "api_key": None,
    # Provider-specific thinking configuration
    "google_thinking_level": None,
    "openai_reasoning_effort": None,
    # Debate and discussion settings
    "max_debate_rounds": 1,
    "max_risk_discuss_rounds": 1,
    "max_recur_limit": 100,
    # Data vendor configuration
    "data_vendors": {
        "core_stock_apis": "yfinance",
        "technical_indicators": "yfinance",
        "fundamental_data": "yfinance",
        "news_data": "yfinance",
    },
    "tool_vendors": {},
}
