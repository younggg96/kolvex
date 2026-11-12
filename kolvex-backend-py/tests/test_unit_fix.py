import unittest

from app.agent.unit_fix import fix_unit_slips, scaled_figures

TOOL = ["TSMC reported revenue of NT$1,270.38 billion and net income of NT$3,809.05 billion; US$40.27 billion."]


class UnitFixTests(unittest.TestCase):
    def setUp(self):
        self.figures = scaled_figures(TOOL)

    def test_billion_copied_as_yi_is_rescaled(self):
        text, fixes = fix_unit_slips("合并营收：新台币 1,270.38 亿元，即 NT$1.27 万亿", self.figures)
        self.assertEqual(text, "合并营收：新台币 12,703.8 亿元，即 NT$1.27 万亿")
        self.assertEqual(fixes[0]["value"], 1_270_380_000_000)
        self.assertEqual(fix_unit_slips("全年 3,809.05亿新台币", self.figures)[0], "全年 38,090.5亿新台币")

    def test_correct_conversions_and_other_figures_are_untouched(self):
        for text in ("营收 12,703.8 亿元", "约 402.7 亿美元", "另有 1.2 亿用户", "营收 999.99 亿元"):
            self.assertEqual(fix_unit_slips(text, self.figures), (text, []))

    def test_web_figures_never_drive_a_rewrite(self):
        # The page says "$346 billion" for a $34.6B quarter; "346 亿" is the right figure.
        figures = {"trusted": {}, "web": scaled_figures(["revenue between $346 billion and $358 billion"])}
        self.assertEqual(fix_unit_slips("指引 346 亿至 358 亿美元", figures), ("指引 346 亿至 358 亿美元", []))

    def test_answer_contradicting_itself_is_repaired(self):
        text, fixes = fix_unit_slips("营收 1,046.09 亿新台币（NT$1,046.09 billion）", {})
        self.assertEqual(text, "营收 10,460.9 亿新台币（NT$1,046.09 billion）")
        self.assertEqual(len(fixes), 1)
        text, _ = fix_unit_slips("合并营收新台币 3.81 万亿（3,809.05 亿元），同比 +31.6%", {})
        self.assertEqual(text, "合并营收新台币 3.81 万亿（38,090.5 亿元），同比 +31.6%")
        # A consistent restatement is left alone.
        self.assertEqual(fix_unit_slips("新台币 3.81 万亿（38,090.5 亿元）", {})[1], [])

    def test_decimal_shift_against_evidence_is_repaired(self):
        text, fixes = fix_unit_slips("营收为 4,674.3 亿美元。", {}, [46_743_000_000])
        self.assertEqual(text, "营收为 467.43 亿美元。")
        self.assertEqual(fix_unit_slips("营收为 467.43 亿美元。", {}, [46_743_000_000]), ("营收为 467.43 亿美元。", []))
        # Too few digits to tell a shift from a different number.
        self.assertEqual(fix_unit_slips("约 467 亿美元", {}, [4_670_000_000_000])[1], [])

    def test_short_numbers_are_not_matched_by_chance(self):
        self.assertEqual(scaled_figures(["$1.2 billion"]), {})

    def test_stream_repairs_saved_text_and_done_event(self):
        import json
        from types import SimpleNamespace
        from unittest.mock import AsyncMock, patch
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from app.api.routes.chat import routes

        async def fake_stream(**_kwargs):
            yield {"type": "token", "content": "营收新台币 1,270.38 亿元。"}
            yield {"type": "done", "scaled_figures": self.figures}

        app = FastAPI()
        app.include_router(routes.router)
        app.dependency_overrides[routes.get_current_user_id] = lambda: "user-1"
        app.dependency_overrides[routes.get_user_api_keys_service] = lambda: SimpleNamespace(
            get_keys_dict=AsyncMock(return_value={}))
        save = AsyncMock(return_value={"id": "m1", "created_at": "now"})
        with patch("app.agent.memory.save_message", save), \
                patch("app.agent.memory.load_conversation_history", AsyncMock(return_value=[])), \
                patch.object(routes, "turn_context", AsyncMock(return_value=None)), \
                patch("app.agent.graphs.supervisor.stream_agent", fake_stream):
            response = TestClient(app).post("/conversations/c1/stream", json={"content": "hi"})
        done = [json.loads(l[6:]) for l in response.text.splitlines() if l.startswith("data: ")][-1]
        self.assertEqual(save.await_args_list[-1].kwargs["content"], "营收新台币 12,703.8 亿元。")
        self.assertEqual(done["content"], "营收新台币 12,703.8 亿元。")
        self.assertEqual(done["answer_check"]["unit_fixes"][0]["from"], "1,270.38 亿")


if __name__ == "__main__":
    unittest.main()
