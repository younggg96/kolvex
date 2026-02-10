"""
Multi-Provider LLM Factory
支持 OpenAI, Anthropic, Ollama, DeepSeek, Qwen, Gemini, Kimi, Grok 多种 LLM provider
"""

import logging
from typing import Optional
from langchain_core.language_models.chat_models import BaseChatModel

from app.agent.config import (
    LLM_PROVIDER,
    LLM_MODEL,
    LLM_TEMPERATURE,
    LLM_FALLBACK_PROVIDER,
    LLM_FALLBACK_MODEL,
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY,
    QWEN_API_KEY,
    GOOGLE_API_KEY,
    KIMI_API_KEY,
    GROK_API_KEY,
    OLLAMA_BASE_URL,
)

logger = logging.getLogger(__name__)

# ==================== OpenAI-Compatible 提供商配置 ====================
# 这些提供商都兼容 OpenAI API 格式，可以通过 ChatOpenAI + base_url 使用

OPENAI_COMPATIBLE_PROVIDERS = {
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "get_api_key": lambda: DEEPSEEK_API_KEY,
        "default_model": "deepseek-chat",
        "fast_model": "deepseek-chat",
    },
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "get_api_key": lambda: QWEN_API_KEY,
        "default_model": "qwen-plus",
        "fast_model": "qwen-turbo",
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "get_api_key": lambda: GOOGLE_API_KEY,
        "default_model": "gemini-2.5-pro",
        "fast_model": "gemini-2.0-flash",
    },
    "kimi": {
        "base_url": "https://api.moonshot.cn/v1",
        "get_api_key": lambda: KIMI_API_KEY,
        "default_model": "moonshot-v1-8k",
        "fast_model": "moonshot-v1-8k",
    },
    "grok": {
        "base_url": "https://api.x.ai/v1",
        "get_api_key": lambda: GROK_API_KEY,
        "default_model": "grok-3",
        "fast_model": "grok-3-fast",
    },
}


def _resolve_api_key(
    provider: str,
    user_api_keys: Optional[dict[str, str]] = None,
) -> Optional[str]:
    """
    Resolve API key for a provider: user key takes priority over server default.

    Args:
        provider: LLM provider name (lowercase)
        user_api_keys: Optional dict {provider: api_key} from user settings

    Returns:
        API key string, or None if not available
    """
    # User-provided key has highest priority
    if user_api_keys and provider in user_api_keys:
        return user_api_keys[provider]

    # Fall back to server-level key
    server_keys = {
        "openai": OPENAI_API_KEY,
        "anthropic": ANTHROPIC_API_KEY,
        "deepseek": DEEPSEEK_API_KEY,
        "qwen": QWEN_API_KEY,
        "gemini": GOOGLE_API_KEY,
        "kimi": KIMI_API_KEY,
        "grok": GROK_API_KEY,
    }
    return server_keys.get(provider) or None


def _create_llm(
    provider: str,
    model: str,
    temperature: float = 0.7,
    user_api_keys: Optional[dict[str, str]] = None,
    **kwargs,
) -> BaseChatModel:
    """
    根据 provider 创建对应的 LLM 实例

    支持的 provider:
    - openai: OpenAI GPT 系列 (gpt-4o, gpt-4o-mini, etc.)
    - anthropic: Anthropic Claude 系列 (claude-3.5-sonnet, claude-3-haiku, etc.)
    - ollama: 本地 Ollama 模型 (llama3.1, gemma2, etc.)
    - deepseek: DeepSeek (deepseek-chat, deepseek-reasoner)
    - qwen: 阿里通义千问 (qwen-plus, qwen-turbo, qwen-max, etc.)
    - gemini: Google Gemini (gemini-2.5-pro, gemini-2.0-flash, etc.)
    - kimi: Moonshot Kimi (moonshot-v1-8k, moonshot-v1-32k, etc.)
    - grok: xAI Grok (grok-3, grok-3-fast, etc.)

    Args:
        provider: LLM provider 名称
        model: 模型名称
        temperature: 温度参数
        user_api_keys: 用户自定义 API keys dict {provider: key}，优先级高于服务端配置
        **kwargs: 额外参数

    Returns:
        BaseChatModel 实例
    """
    provider = provider.lower().strip()

    # ---- OpenAI 原生 ----
    if provider == "openai":
        from langchain_openai import ChatOpenAI

        api_key = _resolve_api_key("openai", user_api_keys) or OPENAI_API_KEY
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            api_key=api_key,
            **kwargs,
        )

    # ---- Anthropic 原生 ----
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        api_key = _resolve_api_key("anthropic", user_api_keys) or ANTHROPIC_API_KEY
        return ChatAnthropic(
            model=model,
            temperature=temperature,
            api_key=api_key,
            **kwargs,
        )

    # ---- Ollama 本地 ----
    elif provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=model,
            temperature=temperature,
            base_url=OLLAMA_BASE_URL,
            **kwargs,
        )

    # ---- OpenAI-Compatible 提供商 (DeepSeek, Qwen, Gemini, Kimi, Grok) ----
    elif provider in OPENAI_COMPATIBLE_PROVIDERS:
        from langchain_openai import ChatOpenAI

        config = OPENAI_COMPATIBLE_PROVIDERS[provider]
        api_key = _resolve_api_key(provider, user_api_keys) or config["get_api_key"]()

        if not api_key:
            raise ValueError(
                f"API key not configured for provider '{provider}'. "
                f"Please set the corresponding API key in Settings or .env"
            )

        return ChatOpenAI(
            model=model,
            temperature=temperature,
            api_key=api_key,
            base_url=config["base_url"],
            **kwargs,
        )

    else:
        supported = ["openai", "anthropic", "ollama"] + list(
            OPENAI_COMPATIBLE_PROVIDERS.keys()
        )
        raise ValueError(
            f"Unsupported LLM provider: '{provider}'. "
            f"Supported providers: {', '.join(supported)}"
        )


def get_llm(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    user_api_keys: Optional[dict[str, str]] = None,
    **kwargs,
) -> BaseChatModel:
    """
    获取 LLM 实例（带 fallback 支持）

    Args:
        provider: LLM provider，默认使用配置
        model: 模型名称，默认使用配置
        temperature: 温度，默认使用配置
        user_api_keys: 用户自定义 API keys dict {provider: key}
        **kwargs: 额外参数

    Returns:
        BaseChatModel 实例
    """
    _provider = provider or LLM_PROVIDER
    _model = model or LLM_MODEL
    _temperature = temperature if temperature is not None else LLM_TEMPERATURE

    try:
        llm = _create_llm(_provider, _model, _temperature, user_api_keys=user_api_keys, **kwargs)
        key_source = "user" if (user_api_keys and _provider in user_api_keys) else "server"
        logger.info(f"Created LLM: provider={_provider}, model={_model}, key_source={key_source}")
        return llm
    except Exception as e:
        logger.warning(f"Failed to create LLM ({_provider}/{_model}): {e}")

        # 尝试 fallback
        if LLM_FALLBACK_PROVIDER and LLM_FALLBACK_MODEL:
            logger.info(
                f"Trying fallback LLM: {LLM_FALLBACK_PROVIDER}/{LLM_FALLBACK_MODEL}"
            )
            try:
                fallback_llm = _create_llm(
                    LLM_FALLBACK_PROVIDER, LLM_FALLBACK_MODEL, _temperature,
                    user_api_keys=user_api_keys, **kwargs
                )
                logger.info("Fallback LLM created successfully")
                return fallback_llm
            except Exception as fallback_error:
                logger.error(f"Fallback LLM also failed: {fallback_error}")

        raise RuntimeError(
            f"Failed to create LLM. Primary: {_provider}/{_model}. "
            f"Fallback: {LLM_FALLBACK_PROVIDER}/{LLM_FALLBACK_MODEL}. "
            f"Error: {e}"
        )


def get_fast_llm(
    user_api_keys: Optional[dict[str, str]] = None,
    **kwargs,
) -> BaseChatModel:
    """
    获取快速/便宜的 LLM（用于意图分类等简单任务）
    根据当前 provider 自动选择对应的快速模型
    如果默认 provider 失败，自动 fallback 到其他可用 provider

    Args:
        user_api_keys: 用户自定义 API keys dict {provider: key}
        **kwargs: 额外参数
    """
    fast_models = {
        "openai": "gpt-4o-mini",
        "anthropic": "claude-haiku-4-5",
        "ollama": LLM_MODEL or "gemma2:2b",
    }

    # 加入 OpenAI-Compatible 提供商的快速模型
    for name, config in OPENAI_COMPATIBLE_PROVIDERS.items():
        fast_models[name] = config["fast_model"]

    provider = LLM_PROVIDER
    model = fast_models.get(provider, LLM_MODEL)

    try:
        return get_llm(provider=provider, model=model, temperature=0.3, user_api_keys=user_api_keys, **kwargs)
    except Exception as e:
        logger.warning(f"Fast LLM ({provider}/{model}) creation failed: {e}")
        # Fallback 顺序: deepseek → openai → gemini
        fallback_chain = [
            ("deepseek", "deepseek-chat", DEEPSEEK_API_KEY),
            ("openai", "gpt-4o-mini", OPENAI_API_KEY),
            ("gemini", "gemini-2.0-flash", GOOGLE_API_KEY),
        ]
        for fb_provider, fb_model, fb_key in fallback_chain:
            if fb_key and fb_provider != provider:
                try:
                    llm = _create_llm(fb_provider, fb_model, 0.3, user_api_keys=user_api_keys, **kwargs)
                    logger.info(f"Fast LLM fallback to {fb_provider}/{fb_model}")
                    return llm
                except Exception:
                    continue
        raise


# ==================== Model ID → Provider 解析 ====================
# 前端传来的 model ID（如 "gpt-4o-mini"）需要解析成 (provider, model) 对

MODEL_TO_PROVIDER: dict[str, str] = {
    # OpenAI
    "gpt-4o": "openai",
    "gpt-4o-mini": "openai",
    "gpt-4-turbo": "openai",
    "o1": "openai",
    "o1-mini": "openai",
    "o3-mini": "openai",
    # Anthropic (current Claude 4.x models)
    "claude-opus-4-6": "anthropic",
    "claude-sonnet-4-5": "anthropic",
    "claude-sonnet-4-5-20250929": "anthropic",
    "claude-haiku-4-5": "anthropic",
    "claude-haiku-4-5-20251001": "anthropic",
    # Anthropic (legacy aliases - 前端可能还在用)
    "claude-3.5-sonnet": "anthropic",
    "claude-3.5-haiku": "anthropic",
    # DeepSeek
    "deepseek-chat": "deepseek",
    "deepseek-reasoner": "deepseek",
    # Qwen
    "qwen-turbo": "qwen",
    "qwen-plus": "qwen",
    "qwen-max": "qwen",
    # Gemini
    "gemini-2.5-pro": "gemini",
    "gemini-2.0-flash": "gemini",
    "gemini-1.5-pro": "gemini",
    # Kimi (Moonshot)
    "moonshot-v1-8k": "kimi",
    "moonshot-v1-32k": "kimi",
    "moonshot-v1-128k": "kimi",
    # Grok (xAI)
    "grok-3": "grok",
    "grok-3-fast": "grok",
}

# Anthropic 的前端 model ID 需要映射为 API 实际模型名
# 旧名称 → 当前有效的 API 模型名
_ANTHROPIC_MODEL_MAP = {
    "claude-3.5-sonnet": "claude-sonnet-4-5",
    "claude-3.5-haiku": "claude-haiku-4-5",
    "claude-3-5-sonnet-20241022": "claude-sonnet-4-5",
    "claude-3-haiku-20240307": "claude-haiku-4-5",
}


def resolve_model_id(model_id: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """
    解析前端传来的 model ID，返回 (provider, api_model_name)

    Args:
        model_id: 前端 model ID（如 "gpt-4o-mini", "deepseek-chat"）

    Returns:
        (provider, model) 元组。若无法解析，返回 (None, None) 表示使用默认配置
    """
    if not model_id:
        return None, None

    provider = MODEL_TO_PROVIDER.get(model_id)
    if not provider:
        logger.warning(f"Unknown model_id: {model_id}, using server default")
        return None, None

    # Anthropic 前端名 → API 名映射
    api_model = _ANTHROPIC_MODEL_MAP.get(model_id, model_id)

    return provider, api_model
