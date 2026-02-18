"""
Agent 配置模块
集中管理 Agent 系统的所有配置参数
"""

from app.core.config import settings


# LLM 配置
LLM_PROVIDER = settings.LLM_PROVIDER
LLM_MODEL = settings.LLM_MODEL
LLM_TEMPERATURE = settings.LLM_TEMPERATURE
LLM_FALLBACK_PROVIDER = settings.LLM_FALLBACK_PROVIDER
LLM_FALLBACK_MODEL = settings.LLM_FALLBACK_MODEL

# API Keys
OPENAI_API_KEY = settings.OPENAI_API_KEY
ANTHROPIC_API_KEY = settings.ANTHROPIC_API_KEY
DEEPSEEK_API_KEY = settings.DEEPSEEK_API_KEY
QWEN_API_KEY = settings.QWEN_API_KEY
GOOGLE_API_KEY = settings.GOOGLE_API_KEY
KIMI_API_KEY = settings.KIMI_API_KEY
GROK_API_KEY = settings.GROK_API_KEY
OLLAMA_BASE_URL = settings.OLLAMA_BASE_URL

# Tavily 搜索
TAVILY_API_KEY = settings.TAVILY_API_KEY

# Agent 系统参数
MAX_CONTEXT_MESSAGES = 20  # 最多保留的历史消息数
MAX_TOOL_ITERATIONS = 10   # Agent 最多工具调用轮数
AGENT_TIMEOUT = 120.0      # Agent 超时时间（秒）

# 系统提示词
SYSTEM_PROMPT = """You are Kolvex AI, an intelligent financial assistant powered by real-time data.

You have access to tools that can:
- Get real-time stock quotes, financials, analyst recommendations, and technical indicators
- Search and analyze financial news from multiple sources
- Analyze KOL (Key Opinion Leader) tweets and sentiment
- Check user portfolio holdings and analyze portfolios
- Search knowledge bases for financial insights
- Look up super investor (hedge fund) holdings from Dataroma
- Scan unusual options activity (high volume/OI, large premium, whale trades) and view options chains
- Search the web for the latest information on any topic

When answering questions:
1. Use tools to get the latest data rather than relying on training knowledge
2. Be specific with numbers, dates, and sources
3. Provide balanced analysis with both bullish and bearish perspectives
4. Clearly state when information is from real-time data vs. general knowledge
5. For stock analysis, consider fundamentals, technicals, sentiment, and news together
6. When discussing options, use the unusual options scanner to detect smart money activity
7. Use web search when other tools cannot provide the needed information

Respond in the same language as the user's message (Chinese or English).
"""
