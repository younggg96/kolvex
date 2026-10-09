"""Chart analysis must never borrow server keys, models, or cached user results."""
import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.agent import llm as factory
from app.services import technical_analysis as ta
from test_technical_analysis import make_bars


class UserModelTests(unittest.TestCase):
    def setUp(self):
        ta._cache.clear()
        self.llm = MagicMock()
        self.structured = MagicMock()
        self.structured.ainvoke = AsyncMock(return_value=ta.AiAnalysis(
            trend="sideways", bias="neutral", summary="User model analysis",
        ))
        self.llm.with_structured_output.return_value = self.structured

    def analyze(self, **changes):
        args = dict(model_id="deepseek-flash", user_api_keys={"deepseek": "user-key"}, user_id="user-a")
        args.update(changes)
        return asyncio.run(ta.analyze_chart("NVDA", "1d", make_bars(), None, None, **args))

    def test_missing_selection_or_key_never_creates_model_even_with_cached_result(self):
        with patch.object(ta, "get_user_llm", return_value=self.llm) as create:
            self.analyze()
            create.reset_mock()
            for options in [dict(model_id=None), dict(model_id="unknown"), dict(user_api_keys=None),
                            dict(user_api_keys={}), dict(user_api_keys={"deepseek": "  "}),
                            dict(model_id="gpt-6.1-sol", user_api_keys={"deepseek": "user-key"})]:
                with self.subTest(options=options), self.assertRaises(ta.AiNotConfigured):
                    self.analyze(**options)
            create.assert_not_called()

    def test_user_selection_and_provenance_for_both_operations(self):
        with patch.object(ta, "get_user_llm", return_value=self.llm) as create:
            for operation in ["analysis", "drawings"]:
                result = self.analyze(model_id="claude-sonnet-5-5", user_api_keys={"anthropic": "my-key"}, operation=operation)
                self.assertEqual((result["provider"], result["model"]), ("anthropic", "claude-sonnet-5-5"))
                create.assert_called_with(provider="anthropic", model="claude-sonnet-5-5", temperature=0.2, user_api_keys={"anthropic": "my-key"})

    def test_cache_separates_users_models_and_key_rotation(self):
        with patch.object(ta, "get_user_llm", return_value=self.llm):
            first = self.analyze()
            self.assertEqual(first, self.analyze())
            self.analyze(user_id="user-b")
            other = self.analyze(model_id="deepseek-v4-pro")
            self.analyze(user_api_keys={"deepseek": "rotated-key"})
        self.assertEqual(self.structured.ainvoke.call_count, 4)
        self.assertEqual(other["model"], "deepseek-v4-pro")
        self.assertNotIn("rotated-key", repr(ta._cache))

    def test_factory_requires_user_key_before_consulting_any_server_setting(self):
        with patch.object(factory, "_create_llm") as create:
            for keys in [None, {}, {"openai": ""}, {"openai": "  "}, {"deepseek": "key"}]:
                with self.assertRaises(ValueError):
                    factory.get_user_llm("openai", "gpt-6.1-sol", keys)
            create.assert_not_called()

    def test_factory_passes_only_selected_user_key_and_never_falls_back(self):
        with patch.object(factory, "_create_llm", side_effect=RuntimeError("provider unavailable")) as create:
            with self.assertRaises(RuntimeError):
                factory.get_user_llm("openai", "gpt-6.1-sol", {"openai": " user-key ", "deepseek": "other-key"})
            create.assert_called_once_with("openai", "gpt-6.1-sol", 0.2, user_api_keys={"openai": "user-key"})

    def test_openai_constructor_uses_user_key_instead_of_server_key(self):
        with patch("langchain_openai.ChatOpenAI") as constructor, patch.object(factory, "OPENAI_API_KEY", "server-key"):
            factory.get_user_llm("openai", "gpt-6.1-sol", {"openai": "user-key"})
            self.assertEqual(constructor.call_args.kwargs["api_key"], "user-key")
            self.assertEqual(constructor.call_args.kwargs["model"], "gpt-6.1-sol")


if __name__ == "__main__":
    unittest.main()
