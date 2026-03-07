import os
from typing import Any, Optional

from langchain_openai import ChatOpenAI

from .base_client import BaseLLMClient
from .validators import validate_model

PROVIDER_CONFIGS: dict[str, dict[str, Any]] = {
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "env_key": "DEEPSEEK_API_KEY",
    },
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "env_key": "QWEN_API_KEY",
    },
    "kimi": {
        "base_url": "https://api.moonshot.cn/v1",
        "env_key": "KIMI_API_KEY",
    },
    "xai": {
        "base_url": "https://api.x.ai/v1",
        "env_key": "XAI_API_KEY",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "env_key": "OPENROUTER_API_KEY",
    },
    "ollama": {
        "base_url": "http://localhost:11434/v1",
        "default_api_key": "ollama",
    },
}


class UnifiedChatOpenAI(ChatOpenAI):
    """ChatOpenAI subclass that strips incompatible params for reasoning models."""

    def __init__(self, **kwargs):
        model = kwargs.get("model", "")
        if self._is_reasoning_model(model):
            kwargs.pop("temperature", None)
            kwargs.pop("top_p", None)
        super().__init__(**kwargs)

    @staticmethod
    def _is_reasoning_model(model: str) -> bool:
        model_lower = model.lower()
        return (
            model_lower.startswith("o1")
            or model_lower.startswith("o3")
            or "gpt-5" in model_lower
        )


class OpenAIClient(BaseLLMClient):
    """Client for OpenAI and all OpenAI-compatible providers
    (deepseek, qwen, kimi, xai/grok, ollama, openrouter)."""

    def __init__(
        self,
        model: str,
        base_url: Optional[str] = None,
        provider: str = "openai",
        **kwargs,
    ):
        super().__init__(model, base_url, **kwargs)
        self.provider = provider.lower()

    def get_llm(self) -> Any:
        """Return configured ChatOpenAI instance."""
        llm_kwargs: dict[str, Any] = {"model": self.model}
        provider_cfg = PROVIDER_CONFIGS.get(self.provider, {})

        # base_url: explicit arg > provider default
        if self.base_url:
            llm_kwargs["base_url"] = self.base_url
        elif provider_cfg.get("base_url"):
            llm_kwargs["base_url"] = provider_cfg["base_url"]

        # api_key: explicit kwarg > provider env var > provider default
        if "api_key" in self.kwargs and self.kwargs["api_key"]:
            llm_kwargs["api_key"] = self.kwargs["api_key"]
        elif provider_cfg.get("default_api_key"):
            llm_kwargs["api_key"] = provider_cfg["default_api_key"]
        elif provider_cfg.get("env_key"):
            env_val = os.environ.get(provider_cfg["env_key"])
            if env_val:
                llm_kwargs["api_key"] = env_val

        for key in ("timeout", "max_retries", "reasoning_effort", "callbacks"):
            if key in self.kwargs:
                llm_kwargs[key] = self.kwargs[key]

        return UnifiedChatOpenAI(**llm_kwargs)

    def validate_model(self) -> bool:
        return validate_model(self.provider, self.model)
