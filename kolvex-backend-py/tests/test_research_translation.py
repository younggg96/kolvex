import unittest
from types import SimpleNamespace

from app.services.research_translation import collect_texts, nest, split_chunks, translate_record, translate_texts


RECORD = {
    "id": "a1",
    "market_report": "Price is above EMA50.",
    "news_report": "  ",
    "full_signal": "FINAL TRANSACTION PROPOSAL: **BUY**",
    "investment_debate": {"bull_history": "Bull case.", "bear_history": "", "history": "ignored", "judge_decision": "Buy."},
    "risk_debate": None,
}


class ResearchTranslationTests(unittest.TestCase):
    def test_collect_texts_only_reader_facing_non_empty_fields(self):
        assert collect_texts(RECORD) == {
            "full_signal": "FINAL TRANSACTION PROPOSAL: **BUY**",
            "market_report": "Price is above EMA50.",
            "investment_debate.judge_decision": "Buy.",
            "investment_debate.bull_history": "Bull case.",
        }

    def test_nest_restores_record_shape(self):
        assert nest({"market_report": "m", "investment_debate.bull_history": "b"}) == {
            "market_report": "m",
            "investment_debate": {"bull_history": "b"},
        }

    def test_split_chunks_respects_limit_and_keeps_text(self):
        text = "\n\n".join(["a" * 40] * 10)
        chunks = split_chunks(text, limit=100)
        assert all(len(chunk) <= 100 for chunk in chunks)
        assert "\n\n".join(chunks) == text
        long_line = "b" * 250
        assert "".join(split_chunks(long_line, limit=100)) == long_line

    def test_translate_texts_joins_chunks_and_drops_failed_fields(self):
        def invoke(messages):
            text = messages[-1][1]
            if text == "boom":
                raise RuntimeError("provider error")
            return SimpleNamespace(content=f"ZH[{text}]")

        out = translate_texts(invoke, {"ok": "x" * 30 + "\n\n" + "y" * 30, "bad": "boom"}, "zh")
        assert "bad" not in out
        assert out["ok"].startswith("ZH[")

    def test_translate_record_returns_nested_translation(self):
        llm = SimpleNamespace(invoke=lambda messages: SimpleNamespace(content="中文"))
        out = translate_record(RECORD, "zh", llm)
        assert out["market_report"] == "中文"
        assert out["investment_debate"] == {"judge_decision": "中文", "bull_history": "中文"}
        assert "translated_at" in out


if __name__ == "__main__":
    unittest.main()
