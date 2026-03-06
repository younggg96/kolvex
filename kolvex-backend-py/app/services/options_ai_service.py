"""
Options AI Analysis Service
Handles LLM analysis, persistence, and history retrieval.
Uses user API keys (same as Chat) - supports OpenAI, Anthropic, DeepSeek, etc.
"""

import json
import re
import logging
import httpx
from typing import Any, Optional

from langchain_core.messages import SystemMessage, HumanMessage

from app.core.config import settings
from app.core.supabase import get_supabase_service
from app.services.options_ai_prompt import generate_trading_prompt, compute_input_summary
from app.agent.llm import get_llm, resolve_model_id

logger = logging.getLogger(__name__)

TABLE = "options_ai_analyses"


def _extract_json(text: str) -> str:
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        return fence.group(1).strip()
    brace = re.search(r"\{[\s\S]*\}", text)
    if brace:
        return brace.group(0)
    return text.strip()


def _validate_response(data: Any) -> bool:
    if not isinstance(data, dict):
        return False
    return (
        isinstance(data.get("market_context"), dict)
        and isinstance(data.get("recommendation"), dict)
    )


class OptionsAIService:

    def __init__(self):
        self._supabase = get_supabase_service()

    # ---- LLM Call ----

    async def run_analysis(
        self,
        options_data: list[dict[str, Any]],
        risk_profile: str,
        locale: str,
        model: Optional[str] = None,
        user_api_keys: Optional[dict[str, str]] = None,
    ) -> dict[str, Any]:
        """
        Run AI analysis using user's API keys (same providers as Chat).
        model: Frontend model ID (e.g. deepseek-chat, gpt-4o-mini).
        """
        system_prompt, user_prompt = generate_trading_prompt(
            options_data, risk_profile, locale
        )

        provider, api_model = resolve_model_id(model)
        if not provider or not api_model:
            raise ValueError(
                "Model is required. Please select a model in the UI. "
                "Add an API key in Settings if none are configured."
            )

        llm = get_llm(
            provider=provider,
            model=api_model,
            temperature=0.3,
            user_api_keys=user_api_keys,
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        response = await llm.ainvoke(messages)

        raw = response.content if hasattr(response, "content") else str(response)
        json_str = _extract_json(raw)
        parsed = json.loads(json_str)

        if not _validate_response(parsed):
            raise ValueError("AI response missing required fields")

        return {"ai_response": parsed, "model": model}

    def list_models(self) -> list[dict[str, Any]]:
        """Fetch available Ollama models from /api/tags."""
        ollama_url = settings.OLLAMA_BASE_URL or "http://localhost:11434"
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{ollama_url}/api/tags")
                resp.raise_for_status()
                data = resp.json()
                return data.get("models", [])
        except Exception as e:
            logger.warning(f"Failed to list Ollama models: {e}")
            return []

    # ---- Persistence ----

    def save_analysis(
        self,
        user_id: str,
        symbol: Optional[str],
        risk_profile: str,
        model: str,
        locale: str,
        input_summary: dict[str, Any],
        ai_response: dict[str, Any],
    ) -> dict[str, Any]:
        row = {
            "user_id": user_id,
            "symbol": symbol,
            "risk_profile": risk_profile,
            "model": model,
            "locale": locale,
            "input_summary": input_summary,
            "ai_response": ai_response,
        }
        result = self._supabase.table(TABLE).insert(row).execute()
        return result.data[0] if result.data else row

    # ---- History Queries ----

    def get_history(
        self,
        symbol: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Paginated history with user profile info via a second lookup."""
        query = (
            self._supabase.table(TABLE)
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )

        if symbol:
            query = query.eq("symbol", symbol)
        if user_id:
            query = query.eq("user_id", user_id)

        result = query.execute()
        items = result.data or []

        user_ids = list({item["user_id"] for item in items})
        user_map: dict[str, dict] = {}
        if user_ids:
            profiles = (
                self._supabase.table("user_profiles")
                .select("id, full_name, avatar_url")
                .in_("id", user_ids)
                .execute()
            )
            for p in profiles.data or []:
                user_map[p["id"]] = p

        for item in items:
            profile = user_map.get(item["user_id"], {})
            item["user_name"] = profile.get("full_name", "Anonymous")
            item["user_avatar"] = profile.get("avatar_url")

        count_query = self._supabase.table(TABLE).select("id", count="exact")
        if symbol:
            count_query = count_query.eq("symbol", symbol)
        if user_id:
            count_query = count_query.eq("user_id", user_id)
        count_result = count_query.execute()
        total = count_result.count if count_result.count is not None else len(items)

        return {"data": items, "total": total, "limit": limit, "offset": offset}

    def get_analysis_by_id(self, analysis_id: str) -> Optional[dict[str, Any]]:
        result = (
            self._supabase.table(TABLE)
            .select("*")
            .eq("id", analysis_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            return None

        item = result.data
        profile = (
            self._supabase.table("user_profiles")
            .select("id, full_name, avatar_url")
            .eq("id", item["user_id"])
            .maybe_single()
            .execute()
        )
        p = profile.data or {}
        item["user_name"] = p.get("full_name", "Anonymous")
        item["user_avatar"] = p.get("avatar_url")
        return item


_service: Optional[OptionsAIService] = None


def get_options_ai_service() -> OptionsAIService:
    global _service
    if _service is None:
        _service = OptionsAIService()
    return _service
