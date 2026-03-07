from typing import Optional

from .base_client import BaseLLMClient
from .openai_client import OpenAIClient
from .anthropic_client import AnthropicClient
from .google_client import GoogleClient

_OPENAI_COMPATIBLE = frozenset({
    "openai", "deepseek", "qwen", "kimi",
    "xai", "grok", "ollama", "openrouter",
})


def create_llm_client(
    provider: str,
    model: str,
    base_url: Optional[str] = None,
    **kwargs,
) -> BaseLLMClient:
    """Create an LLM client for the specified provider.

    Supports all Kolvex provider names directly — no external mapping needed.
    """
    p = provider.lower()

    if p in _OPENAI_COMPATIBLE:
        effective = "xai" if p == "grok" else p
        return OpenAIClient(model, base_url, provider=effective, **kwargs)

    if p == "anthropic":
        return AnthropicClient(model, base_url, **kwargs)

    if p in ("google", "gemini"):
        return GoogleClient(model, base_url, **kwargs)

    raise ValueError(f"Unsupported LLM provider: {provider}")
