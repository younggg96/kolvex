"""Chat memory: long-conversation summaries and cross-conversation preferences."""

import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agent import chat_memory as cm
from app.agent import memory


class Query:
    def __init__(self, db, table):
        self.db, self.table, self.filters = db, table, []
        self.op, self.payload, self._limit, self._order = "select", None, None, None
        self._single = False

    def select(self, *_a, **_k):
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    def upsert(self, payload):
        self.op, self.payload = "upsert", payload
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, k, v):
        self.filters.append(lambda r: r.get(k) == v)
        return self

    def gt(self, k, v):
        self.db.calls.append(("gt", k, v))
        self.filters.append(lambda r: str(r.get(k)) > str(v))
        return self

    def order(self, k, desc=False):
        self._order = (k, desc)
        return self

    def limit(self, n):
        self.db.calls.append(("limit", self.table, n))
        self._limit = n
        return self

    def single(self):
        self._single = True
        return self

    def execute(self):
        if self.table in self.db.broken:
            raise RuntimeError('column "summary_until" does not exist')
        rows = self.db.rows.setdefault(self.table, [])
        if self.op == "upsert":
            rows[:] = [r for r in rows if r.get("user_id") != self.payload["user_id"]]
            rows.append(dict(self.payload))
            return SimpleNamespace(data=[self.payload])
        matched = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "update":
            for r in matched:
                r.update(self.payload)
            return SimpleNamespace(data=matched)
        if self.op == "delete":
            self.db.rows[self.table] = [r for r in rows if r not in matched]
            return SimpleNamespace(data=matched)
        if self._order:
            k, desc = self._order
            matched = sorted(matched, key=lambda r: str(r.get(k)), reverse=desc)
        if self._single:
            return SimpleNamespace(data=matched[0] if matched else None)
        return SimpleNamespace(data=matched[: self._limit] if self._limit else matched)


class FakeDB:
    def __init__(self, rows=None, broken=()):
        self.rows, self.broken, self.calls = rows or {}, set(broken), []

    def table(self, name):
        return Query(self, name)


def conversation(n, summary=None, until=None, user="u1"):
    messages = [
        {
            "conversation_id": "c1",
            "role": "user" if i % 2 == 0 else "assistant",
            "content": f"message {i}",
            "created_at": f"2026-11-15T10:{i // 60:02d}:{i % 60:02d}+00:00",
        }
        for i in range(n)
    ]
    convo = {"id": "c1", "user_id": user, "summary": summary, "summary_until": until}
    return FakeDB({"chat_conversations": [convo], "chat_messages": messages})


class PureHelperTests(unittest.TestCase):
    def test_language(self):
        self.assertEqual(cm.detect_language("英伟达最近怎么样"), "zh")
        self.assertEqual(cm.detect_language("NVDA 毛利率呢"), "zh")
        self.assertEqual(cm.detect_language("How did Nvidia do last quarter?"), "en")
        self.assertIsNone(cm.detect_language("NVDA?"))
        self.assertIsNone(cm.detect_language(""))

    def test_tickers_from_tool_inputs(self):
        inputs = [
            {"symbol": "nvda"},
            {"ticker": "TSLA", "days": 90},
            {"symbols": ["AAPL", "NVDA"]},
            {"query": "Nvidia earnings"},
            {"symbol": "BRK.B"},
            {"tickers": "msft, goog"},
            {"symbol": "not a ticker"},
            None,
            "NVDA",
        ]
        self.assertEqual(
            cm.tickers_from_tool_inputs(inputs), ["NVDA", "TSLA", "AAPL", "BRK.B", "MSFT", "GOOG"]
        )

    def test_merge_counts_and_caps(self):
        merged = cm.merge_tickers(
            {"NVDA": {"count": 2, "last": "2026-11-01"}}, ["NVDA", "TSLA"], "2026-11-15"
        )
        self.assertEqual(merged["NVDA"], {"count": 3, "last": "2026-11-15"})
        self.assertEqual(merged["TSLA"], {"count": 1, "last": "2026-11-15"})
        many = {f"T{i}": {"count": i, "last": "2026-11-01"} for i in range(60)}
        capped = cm.merge_tickers(many, ["NEW"], "2026-11-15")
        self.assertEqual(len(capped), cm.MAX_TICKERS)
        self.assertIn("T59", capped)
        self.assertNotIn("T0", capped)

    def test_usual_tickers_most_used_then_most_recent(self):
        tickers = {
            "AAPL": {"count": 1, "last": "2026-11-14"},
            "NVDA": {"count": 5, "last": "2026-11-01"},
            "TSLA": {"count": 1, "last": "2026-11-15"},
        }
        self.assertEqual(cm.usual_tickers(tickers), ["NVDA", "TSLA", "AAPL"])

    def test_memory_note(self):
        self.assertIsNone(cm.memory_note(None, None))
        self.assertIsNone(cm.memory_note("  ", {"language": None, "tickers": {}}))
        note = cm.memory_note(
            "The user is comparing NVDA and AMD.",
            {"language": "zh", "tickers": {"NVDA": {"count": 2, "last": "2026-11-15"}}},
        )
        self.assertIn("The user is comparing NVDA and AMD.", note)
        self.assertIn("fetch any number you need with tools", note)
        self.assertIn("Chinese", note)
        self.assertIn("answer in the language of the current message", note)
        self.assertIn("NVDA", note)
        self.assertIn("not their watchlist", note)

    def test_summary_input_cuts_long_messages(self):
        text = cm.summary_input(None, [{"role": "user", "content": "x" * 5000}])
        self.assertIn("(none)", text)
        self.assertIn("x" * cm.SUMMARY_MESSAGE_CHARS + "…", text)
        self.assertNotIn("x" * (cm.SUMMARY_MESSAGE_CHARS + 1), text)

    def test_summary_prompt_leaves_figures_out(self):
        self.assertIn("Leave out every figure", cm.SUMMARY_PROMPT)


class FastModel:
    def __init__(self, text="Summary text."):
        self.text, self.calls = text, []

    async def ainvoke(self, messages):
        self.calls.append(messages)
        return SimpleNamespace(content=self.text)


class SummaryTests(unittest.IsolatedAsyncioTestCase):
    async def refresh(self, db, model):
        with (
            patch.object(cm, "_db", lambda: db),
            patch("app.agent.llm.get_fast_llm", return_value=model),
        ):
            return await cm.refresh_summary("u1", "c1")

    async def test_short_conversation_is_not_summarised(self):
        db, model = conversation(cm.SUMMARY_TRIGGER - 1), FastModel()
        self.assertFalse(await self.refresh(db, model))
        self.assertEqual(model.calls, [])
        self.assertIsNone(db.rows["chat_conversations"][0]["summary"])

    async def test_folds_all_but_the_newest_messages(self):
        db, model = conversation(cm.SUMMARY_TRIGGER), FastModel()
        self.assertTrue(await self.refresh(db, model))
        folded = cm.SUMMARY_TRIGGER - cm.MAX_CONTEXT_MESSAGES
        prompt = model.calls[0][1].content
        self.assertIn(f"message {folded - 1}", prompt)
        self.assertNotIn(f"message {folded}", prompt)
        convo = db.rows["chat_conversations"][0]
        self.assertEqual(convo["summary"], "Summary text.")
        self.assertEqual(convo["summary_until"], db.rows["chat_messages"][folded - 1]["created_at"])

    async def test_next_summary_builds_on_the_previous_one(self):
        until = "2026-11-15T10:00:09+00:00"  # messages 0-9 already folded
        db, model = (
            conversation(10 + cm.SUMMARY_TRIGGER, summary="Earlier: NVDA.", until=until),
            FastModel(),
        )
        self.assertTrue(await self.refresh(db, model))
        prompt = model.calls[0][1].content
        self.assertIn("Earlier: NVDA.", prompt)
        self.assertNotIn("message 9\n", prompt + "\n")
        self.assertIn("message 10", prompt)
        self.assertIn(("gt", "created_at", until), db.calls)

    async def test_model_failure_keeps_the_old_summary(self):
        class Broken:
            async def ainvoke(self, _messages):
                raise RuntimeError("provider down")

        db = conversation(cm.SUMMARY_TRIGGER, summary="Old.", until=None)
        self.assertFalse(await self.refresh(db, Broken()))
        self.assertEqual(db.rows["chat_conversations"][0]["summary"], "Old.")

    async def test_other_users_conversation_is_not_touched(self):
        db, model = conversation(cm.SUMMARY_TRIGGER, user="someone-else"), FastModel()
        self.assertFalse(await self.refresh(db, model))
        self.assertEqual(model.calls, [])

    async def test_missing_migration_is_not_an_error(self):
        db = FakeDB(broken={"chat_conversations", "chat_messages"})
        self.assertFalse(await self.refresh(db, FastModel()))


class HistoryWindowTests(unittest.IsolatedAsyncioTestCase):
    async def load(self, db):
        with patch.object(memory, "get_supabase_service", return_value=db):
            return await memory.load_conversation_history("u1", "c1")

    async def test_sends_every_message_after_the_summary(self):
        until = "2026-11-15T10:00:09+00:00"
        db = conversation(35, summary="S", until=until)
        history = await self.load(db)
        self.assertEqual([m.content for m in history], [f"message {i}" for i in range(10, 35)])
        self.assertIn(("limit", "chat_messages", cm.SUMMARY_TRIGGER), db.calls)

    async def test_without_summary_columns_falls_back_to_recent_messages(self):
        class Fallback(FakeDB):
            def table(self, name):
                query = Query(self, name)
                if name == "chat_conversations":
                    original = query.select

                    def select(columns="*", *_a, **_k):
                        if "summary_until" in columns:
                            self.broken.add(name)
                        else:
                            self.broken.discard(name)
                        return original()

                    query.select = select
                return query

        db = conversation(40)
        db.__class__ = Fallback
        history = await self.load(db)
        self.assertEqual(len(history), cm.MAX_CONTEXT_MESSAGES)
        self.assertEqual(history[-1].content, "message 39")

    async def test_other_users_conversation_loads_nothing(self):
        self.assertEqual(await self.load(conversation(5, user="someone-else")), [])


class UserMemoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_remember_merges_language_and_tickers(self):
        db = FakeDB(
            {
                "chat_user_memory": [
                    {
                        "user_id": "u1",
                        "language": "en",
                        "tickers": {"NVDA": {"count": 1, "last": "2026-11-01"}},
                    }
                ]
            }
        )
        with patch.object(cm, "_db", lambda: db):
            await cm.remember_user("u1", "英伟达的毛利率呢", ["NVDA", "AMD"])
            row = await cm.load_user_memory("u1")
        self.assertEqual(row["language"], "zh")
        self.assertEqual(row["tickers"]["NVDA"]["count"], 2)
        self.assertEqual(row["tickers"]["AMD"]["count"], 1)

    async def test_unclear_language_keeps_the_previous_one(self):
        db = FakeDB({"chat_user_memory": [{"user_id": "u1", "language": "zh", "tickers": {}}]})
        with patch.object(cm, "_db", lambda: db):
            await cm.remember_user("u1", "NVDA?", ["NVDA"])
            row = await cm.load_user_memory("u1")
        self.assertEqual(row["language"], "zh")

    async def test_nothing_to_remember_writes_nothing(self):
        db = FakeDB()
        with patch.object(cm, "_db", lambda: db):
            await cm.remember_user("u1", "ok", [])
        self.assertEqual(db.rows.get("chat_user_memory", []), [])

    async def test_note_combines_summary_and_preferences(self):
        db = conversation(3, summary="Comparing chip stocks.", until=None)
        db.rows["chat_user_memory"] = [
            {
                "user_id": "u1",
                "language": "en",
                "tickers": {"AMD": {"count": 1, "last": "2026-11-15"}},
            }
        ]
        with patch.object(cm, "_db", lambda: db):
            note = await cm.load_memory_note("u1", "c1")
        self.assertIn("Comparing chip stocks.", note)
        self.assertIn("AMD", note)

    async def test_note_is_none_without_database(self):
        self.assertIsNone(await cm.load_memory_note("u1", "c1"))  # conftest makes _db fail


class PromptTests(unittest.TestCase):
    def test_memory_note_reaches_both_agents(self):
        from app.agent.graphs import supervisor

        with (
            patch.object(supervisor, "get_llm", return_value=object()),
            patch.object(supervisor, "create_react_agent", side_effect=lambda **kw: kw["prompt"]),
        ):
            for kind in ("financial", "research"):
                prompt = supervisor._create_agent_for_request(
                    kind, sources=[], skills=[], memory_note="NOTE-123"
                )
                self.assertTrue(prompt.endswith("NOTE-123"))
                plain = supervisor._create_agent_for_request(kind, sources=[], skills=[])
                self.assertNotIn("NOTE-123", plain)


class RouteTests(unittest.TestCase):
    def app(self):
        from app.api.routes.chat import routes

        app = FastAPI()
        app.include_router(routes.router)
        app.dependency_overrides[routes.get_current_user_id] = lambda: "user-1"
        app.dependency_overrides[routes.get_user_api_keys_service] = lambda: SimpleNamespace(
            get_keys_dict=AsyncMock(return_value={})
        )
        return app, routes

    def test_stream_passes_the_note_and_remembers_looked_up_tickers(self):
        app, routes = self.app()
        seen = {}

        async def fake_stream(**kwargs):
            seen.update(kwargs)
            yield {"type": "tool_start", "tool": "get_stock_quote", "input": {"symbol": "nvda"}}
            yield {"type": "tool_start", "tool": "web_search", "input": {"query": "Nvidia"}}
            yield {"type": "token", "content": "Answer"}
            yield {"type": "done"}

        user = {"id": "q", "role": "user", "content": "英伟达怎么样", "created_at": "now"}
        remember = []
        with (
            patch("app.agent.memory.save_user_message_once", AsyncMock(return_value=user)),
            patch(
                "app.agent.memory.save_message",
                AsyncMock(return_value={"id": "a", "created_at": "now"}),
            ),
            patch("app.agent.memory.load_conversation_history", AsyncMock(return_value=[])),
            patch("app.agent.chat_memory.load_memory_note", AsyncMock(return_value="NOTE")),
            patch("app.agent.chat_memory.remember_turn_later", lambda *a, **k: remember.append(a)),
            patch.object(routes, "turn_context", AsyncMock(return_value=None)),
            patch("app.agent.graphs.supervisor.stream_agent", fake_stream),
        ):
            TestClient(app).post("/conversations/c1/stream", json={"content": "英伟达怎么样"})
        self.assertEqual(seen["memory_note"], "NOTE")
        self.assertEqual(remember, [("user-1", "c1", "英伟达怎么样", ["NVDA"], None)])

    def test_both_chat_endpoints_log_one_line_per_answered_turn(self):
        app, routes = self.app()

        async def fake_run(**kwargs):
            kwargs["turn_stats"].update(
                agent="valuation",
                tools=["get_valuation"],
                usage={"model_calls": 2, "input_tokens": 7000, "output_tokens": 300},
            )
            return "估值参考"

        async def fake_stream(**_kwargs):
            yield {"type": "agent", "agent": "buzz"}
            yield {"type": "tool_start", "tool": "get_market_buzz", "input": {}}
            yield {"type": "token", "content": "Answer"}
            yield {
                "type": "done",
                "usage": {"model_calls": 1, "input_tokens": 5000, "output_tokens": 90},
            }

        when = "2026-11-20T12:00:00+00:00"
        user = {
            "id": "q",
            "conversation_id": "c1",
            "role": "user",
            "content": "hi",
            "created_at": when,
        }
        saved = {
            "id": "a",
            "conversation_id": "c1",
            "role": "assistant",
            "content": "x",
            "created_at": when,
        }
        logged = []
        app.dependency_overrides[routes.get_chat_service] = lambda: SimpleNamespace()
        with (
            patch("app.agent.memory.save_user_message_once", AsyncMock(return_value=user)),
            patch("app.agent.memory.save_message", AsyncMock(return_value=saved)),
            patch("app.agent.memory.load_conversation_history", AsyncMock(return_value=[])),
            patch("app.agent.chat_memory.load_memory_note", AsyncMock(return_value=None)),
            patch("app.agent.chat_memory.remember_turn_later", lambda *a, **k: None),
            patch.object(routes, "turn_context", AsyncMock(return_value=None)),
            patch.object(routes, "log_turn", lambda **k: logged.append(k)),
            patch("app.agent.graphs.supervisor.run_agent", fake_run),
            patch("app.agent.graphs.supervisor.stream_agent", fake_stream),
        ):
            client = TestClient(app)
            client.post("/conversations/c1/send", json={"content": "AAPL 贵吗"})
            client.post("/conversations/c1/stream", json={"content": "今天异动"})
        self.assertEqual([(line["agent"], line["tools"]) for line in logged],
                         [("valuation", ["get_valuation"]), ("buzz", ["get_market_buzz"])])  # fmt: skip
        self.assertEqual([line["usage"]["input_tokens"] for line in logged], [7000, 5000])

    def test_failed_reply_is_not_remembered(self):
        app, routes = self.app()

        async def fake_stream(**_kwargs):
            yield {"type": "error", "content": "boom"}

        remember = []
        with (
            patch("app.agent.memory.save_user_message_once", AsyncMock(return_value={"id": "q"})),
            patch("app.agent.memory.load_conversation_history", AsyncMock(return_value=[])),
            patch("app.agent.chat_memory.load_memory_note", AsyncMock(return_value=None)),
            patch("app.agent.chat_memory.remember_turn_later", lambda *a, **k: remember.append(a)),
            patch.object(routes, "turn_context", AsyncMock(return_value=None)),
            patch("app.agent.graphs.supervisor.stream_agent", fake_stream),
        ):
            TestClient(app).post("/conversations/c1/stream", json={"content": "hi"})
        self.assertEqual(remember, [])

    def test_memory_endpoints(self):
        app, _ = self.app()
        db = FakeDB({"chat_user_memory": [{
            "user_id": "user-1", "language": "zh", "updated_at": "2026-11-15",
            "tickers": {"NVDA": {"count": 3, "last": "2026-11-15"}, "AMD": {"count": 1, "last": "2026-11-15"}},
        }]})  # fmt: skip
        client = TestClient(app)
        with patch.object(cm, "_db", lambda: db):
            got = client.get("/memory").json()
            self.assertEqual(
                got, {"language": "zh", "tickers": ["NVDA", "AMD"], "updated_at": "2026-11-15"}
            )
            self.assertEqual(client.delete("/memory").status_code, 200)
            self.assertEqual(client.get("/memory").json()["tickers"], [])

    def test_clear_failure_is_reported(self):
        app, _ = self.app()
        self.assertEqual(TestClient(app).delete("/memory").status_code, 500)


class BackgroundTests(unittest.IsolatedAsyncioTestCase):
    async def test_remember_turn_later_runs_in_the_background(self):
        done = asyncio.Event()

        async def fake(*_a, **_k):
            done.set()

        with patch.object(cm, "remember_turn", fake):
            cm.remember_turn_later("u1", "c1", "hi", [])
            await asyncio.wait_for(done.wait(), 1)


if __name__ == "__main__":
    unittest.main()
