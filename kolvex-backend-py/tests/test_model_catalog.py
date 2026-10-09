"""Catalog parity and protocol compatibility for currently selectable models."""

import json
from pathlib import Path
import unittest

from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage

from app.agent.llm import MODEL_TO_PROVIDER, get_user_llm, resolve_model_id
from app.agent.thinking_chat import ThinkingChatOpenAI


class ModelCatalogTests(unittest.TestCase):
    def test_frontend_catalog_matches_backend_and_rejects_retired_models(self):
        root = Path(__file__).resolve().parents[2]
        text = (root / "kolvex-frontend-web-nextjs/lib/aiModels.ts").read_text()
        start = text.index("= [") + 2
        models = json.loads(text[start:text.index(";", start)])
        providers = {"DeepSeek": "deepseek", "OpenAI": "openai", "Anthropic": "anthropic",
                     "Google": "gemini", "Qwen": "qwen", "Kimi": "kimi", "xAI": "grok"}
        self.assertEqual({m["id"]: providers[m["provider"]] for m in models}, MODEL_TO_PROVIDER)
        for retired in ["gpt-4o", "gpt-4o-mini", "deepseek-chat", "deepseek-reasoner",
                        "claude-sonnet-4-5", "gemini-2.0-flash", "moonshot-v1-8k", "grok-3"]:
            self.assertEqual(resolve_model_id(retired), (None, None))

    def test_every_model_constructs_with_user_key_and_supported_sampling(self):
        for model, provider in MODEL_TO_PROVIDER.items():
            with self.subTest(model=model):
                llm = get_user_llm(provider, model, {provider: "user-test-key"})
                self.assertEqual(llm.model_name if hasattr(llm, "model_name") else llm.model, model)
                if provider in {"openai", "anthropic", "kimi", "gemini", "grok"}:
                    self.assertIsNone(llm.temperature)
                if provider in {"deepseek", "kimi"}:
                    self.assertIsInstance(llm, ThinkingChatOpenAI)

    def test_reasoning_is_preserved_in_tool_followup(self):
        llm = ThinkingChatOpenAI(model="kimi-k3", api_key="test", temperature=None)
        response = {"choices": [{"message": {"role": "assistant", "content": None,
            "reasoning_content": "Private reasoning state", "tool_calls": [{"id": "call-1",
            "type": "function", "function": {"name": "quote", "arguments": "{}"}}]},
            "finish_reason": "tool_calls"}], "model": "kimi-k3"}
        message = llm._create_chat_result(response).generations[0].message
        payload = llm._get_request_payload([HumanMessage(content="Quote NVDA"), message,
                                           ToolMessage(content="100", tool_call_id="call-1")])
        self.assertEqual(payload["messages"][1]["reasoning_content"], "Private reasoning state")
        self.assertNotIn("temperature", payload)

    def test_streamed_reasoning_survives_chunk_merge(self):
        llm = ThinkingChatOpenAI(model="deepseek-v4-pro", api_key="test")
        chunks = [llm._convert_chunk_to_generation_chunk(
            {"choices": [{"delta": {"role": "assistant", "content": "",
                                     "reasoning_content": reasoning}}]}, AIMessageChunk, None
        ).message for reasoning in ["First ", "second"]]
        merged = chunks[0] + chunks[1]
        assistant = AIMessage(content="Answer", additional_kwargs=merged.additional_kwargs)
        payload = llm._get_request_payload([assistant])
        self.assertEqual(payload["messages"][0]["reasoning_content"], "First second")


if __name__ == "__main__":
    unittest.main()
