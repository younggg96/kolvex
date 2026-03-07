"""Model name validators for each provider.

Only validates model names — does NOT enforce limits.
For providers with open model registries, any model name is accepted.
"""

VALID_MODELS: dict[str, list[str]] = {
    "openai": [
        "gpt-5.2", "gpt-5.1", "gpt-5", "gpt-5-mini", "gpt-5-nano",
        "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
        "o4-mini", "o3", "o3-mini", "o1", "o1-preview",
        "gpt-4o", "gpt-4o-mini",
    ],
    "anthropic": [
        "claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5",
        "claude-opus-4-1-20250805", "claude-sonnet-4-20250514",
        "claude-3-7-sonnet-20250219",
        "claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022",
    ],
    "google": [
        "gemini-3-pro-preview", "gemini-3-flash-preview",
        "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite",
        "gemini-2.0-flash", "gemini-2.0-flash-lite",
    ],
    "xai": [
        "grok-4-1-fast", "grok-4-1-fast-reasoning", "grok-4-1-fast-non-reasoning",
        "grok-4", "grok-4-0709", "grok-4-fast-reasoning", "grok-4-fast-non-reasoning",
    ],
}

# Providers that accept arbitrary model names (no allow-list)
_OPEN_REGISTRY_PROVIDERS = frozenset({
    "ollama", "openrouter", "deepseek", "qwen", "kimi",
})


def validate_model(provider: str, model: str) -> bool:
    """Check if *model* is valid for *provider*.

    Returns True for open-registry providers and unknown providers.
    """
    p = provider.lower()
    if p in _OPEN_REGISTRY_PROVIDERS:
        return True
    models = VALID_MODELS.get(p)
    if models is None:
        return True
    return model in models
