"""
User API Keys Service
Manage user-provided LLM API keys stored in Supabase
"""

import logging
from typing import Optional
from supabase import Client

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)

# Valid LLM providers that users can configure
VALID_PROVIDERS = {
    "openai",
    "anthropic",
    "deepseek",
    "qwen",
    "gemini",
    "kimi",
    "grok",
}

# Map provider -> settings attribute name for server-level keys
_SERVER_KEY_ATTRS = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "qwen": "QWEN_API_KEY",
    "gemini": "GOOGLE_API_KEY",
    "kimi": "KIMI_API_KEY",
    "grok": "GROK_API_KEY",
}


class UserApiKeysService:
    """CRUD service for user_api_keys table"""

    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.table = "user_api_keys"

    # ---------- Read ----------

    async def get_all_keys(self, user_id: str) -> list[dict]:
        """
        Get all API keys for a user (with masked values).

        Returns list of {id, provider, api_key_masked, created_at, updated_at}
        """
        try:
            response = (
                self.supabase.table(self.table)
                .select("id, provider, api_key, created_at, updated_at")
                .eq("user_id", user_id)
                .order("provider")
                .execute()
            )
        except Exception as e:
            logger.warning(f"Failed to query user_api_keys (table may not exist): {e}")
            return []

        results = []
        for row in response.data or []:
            results.append({
                "id": row["id"],
                "provider": row["provider"],
                "api_key_masked": _mask_key(row["api_key"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            })
        return results

    async def get_keys_dict(self, user_id: str) -> dict[str, str]:
        """
        Get all API keys for a user as a {provider: api_key} dict.
        Used internally for LLM creation — returns plain text keys.
        """
        try:
            response = (
                self.supabase.table(self.table)
                .select("provider, api_key")
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as e:
            logger.warning(f"Failed to query user_api_keys (table may not exist): {e}")
            return {}

        return {
            row["provider"]: row["api_key"]
            for row in (response.data or [])
        }

    # ---------- Create / Update (upsert) ----------

    async def upsert_key(
        self, user_id: str, provider: str, api_key: str
    ) -> Optional[dict]:
        """
        Create or update an API key for a provider.

        Returns the upserted row (masked).
        """
        provider = provider.lower().strip()
        if provider not in VALID_PROVIDERS:
            raise ValueError(
                f"Invalid provider '{provider}'. "
                f"Supported: {', '.join(sorted(VALID_PROVIDERS))}"
            )

        if not api_key or not api_key.strip():
            raise ValueError("API key cannot be empty")

        response = (
            self.supabase.table(self.table)
            .upsert(
                {
                    "user_id": user_id,
                    "provider": provider,
                    "api_key": api_key.strip(),
                },
                on_conflict="user_id,provider",
            )
            .execute()
        )

        if response.data:
            row = response.data[0]
            return {
                "id": row["id"],
                "provider": row["provider"],
                "api_key_masked": _mask_key(row["api_key"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        return None

    # ---------- Delete ----------

    async def delete_key(self, user_id: str, provider: str) -> bool:
        """Delete an API key for a provider. Returns True if deleted."""
        provider = provider.lower().strip()
        response = (
            self.supabase.table(self.table)
            .delete()
            .eq("user_id", user_id)
            .eq("provider", provider)
            .execute()
        )
        return bool(response.data)

    async def delete_all_keys(self, user_id: str) -> int:
        """Delete all API keys for a user. Returns count deleted."""
        response = (
            self.supabase.table(self.table)
            .delete()
            .eq("user_id", user_id)
            .execute()
        )
        return len(response.data or [])

    # ---------- Available Providers ----------

    async def get_available_providers(self, user_id: str) -> list[str]:
        """
        Get providers that have a usable API key (user-level OR server-level).

        Returns sorted list of provider names.
        """
        from app.core.config import settings

        available = set()

        # 1. Check server-level keys from .env
        for provider, attr in _SERVER_KEY_ATTRS.items():
            val = getattr(settings, attr, "")
            if val and val.strip():
                available.add(provider)

        # 2. Check user-level keys from DB
        try:
            user_keys = await self.get_keys_dict(user_id)
            for provider, key in user_keys.items():
                if key and key.strip():
                    available.add(provider)
        except Exception as e:
            logger.warning(f"Failed to load user API keys: {e}")

        return sorted(available)


# ---------- Helper ----------

def _mask_key(key: str) -> str:
    """Mask an API key, showing only last 4 characters."""
    if not key or len(key) <= 8:
        return "****"
    return f"{'*' * (len(key) - 4)}{key[-4:]}"


# ---------- Dependency ----------

def get_user_api_keys_service() -> UserApiKeysService:
    """FastAPI dependency for UserApiKeysService"""
    supabase = get_supabase_service()
    return UserApiKeysService(supabase)
