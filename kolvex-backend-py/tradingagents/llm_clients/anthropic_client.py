from typing import Any, Optional

from langchain_anthropic import ChatAnthropic

from .base_client import BaseLLMClient
from .validators import validate_model


class AnthropicClient(BaseLLMClient):
    """Client for Anthropic Claude models."""

    def __init__(self, model: str, base_url: Optional[str] = None, **kwargs):
        super().__init__(model, base_url, **kwargs)

    def get_llm(self) -> Any:
        """Return configured ChatAnthropic instance."""
        llm_kwargs: dict[str, Any] = {"model": self.model}

        llm_kwargs.setdefault("timeout", 120)
        llm_kwargs.setdefault("max_retries", 3)

        for key in ("timeout", "max_retries", "api_key", "max_tokens", "callbacks"):
            if key in self.kwargs:
                llm_kwargs[key] = self.kwargs[key]

        return ChatAnthropic(**llm_kwargs)

    def validate_model(self) -> bool:
        return validate_model("anthropic", self.model)
