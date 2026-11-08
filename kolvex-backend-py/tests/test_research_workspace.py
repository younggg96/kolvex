import asyncio
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from app.services import research_workspace as ws


class Query:
    """Tiny in-memory stand-in for the supabase-py query builder."""

    def __init__(self, db, table):
        self.db, self.table, self.filters, self.op, self.payload = db, table, [], "select", None
        self._limit, self._order, self.on_conflict = None, None, None

    def select(self, *_a, **_k): self.op = "select"; return self
    def insert(self, payload): self.op, self.payload = "insert", payload; return self
    def update(self, payload): self.op, self.payload = "update", payload; return self
    def upsert(self, payload, on_conflict=None): self.op, self.payload, self.on_conflict = "upsert", payload, on_conflict; return self
    def delete(self): self.op = "delete"; return self
    def eq(self, k, v): self.filters.append(lambda r: r.get(k) == v); return self
    def in_(self, k, vs): self.filters.append(lambda r: r.get(k) in vs); return self
    def order(self, k, desc=False): self._order = (k, desc); return self
    def limit(self, n): self._limit = n; return self

    def _match(self):
        return [r for r in self.db.rows[self.table] if all(f(r) for f in self.filters)]

    def execute(self):
        rows = self.db.rows[self.table]
        if self.op == "insert":
            items = self.payload if isinstance(self.payload, list) else [self.payload]
            out = []
            for item in items:
                row = {"id": str(uuid.uuid4()), "tickers": [], "brief": "", **item}
                if self.table == ws.RUNS and row.get("status") == "running" and any(
                        r["workspace_id"] == row["workspace_id"] and r["status"] == "running" for r in rows):
                    raise RuntimeError("duplicate key value violates unique constraint (23505)")
                rows.append(row)
                out.append(row)
            return SimpleNamespace(data=out)
        if self.op == "upsert":
            key = self.on_conflict
            existing = next((r for r in rows if r.get(key) == self.payload[key]), None)
            if existing:
                existing.update(self.payload)
            else:
                rows.append(dict(self.payload))
            return SimpleNamespace(data=[self.payload])
        matched = self._match()
        if self.op == "update":
            for r in matched:
                r.update(self.payload)
            return SimpleNamespace(data=matched)
        if self.op == "delete":
            self.db.rows[self.table] = [r for r in rows if r not in matched]
            return SimpleNamespace(data=matched)
        if self._order:
            k, desc = self._order
            matched = sorted(matched, key=lambda r: str(r.get(k) or ""), reverse=desc)
        return SimpleNamespace(data=matched[: self._limit] if self._limit else matched)


class FakeDB:
    def __init__(self):
        self.rows = {t: [] for t in (ws.WORKSPACES, ws.CHATS, ws.RUNS, ws.RESULTS, "chat_conversations", "chat_messages")}

    def table(self, name):
        return Query(self, name)


class NormalizeTests(unittest.TestCase):
    def test_tickers_are_cleaned_deduped_and_validated(self):
        self.assertEqual(ws.normalize_tickers("$nvda, amd，NVDA  brk.b"), ["NVDA", "AMD", "BRK.B"])
        with self.assertRaises(ws.WorkspaceError):
            ws.normalize_tickers(["NOT A TICKER"])
        with self.assertRaises(ws.WorkspaceError):
            ws.normalize_tickers([f"A{i}" for i in range(11)])

    def test_agents_default_and_reject_unknown(self):
        self.assertEqual(ws.normalize_agents(None), list(ws.DEFAULT_AGENTS))
        self.assertEqual(ws.normalize_agents(["news", "market"]), ["market", "news"])
        with self.assertRaises(ws.WorkspaceError):
            ws.normalize_agents(["market", "astrology"])


class CrudTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB()
        self.db.rows["chat_conversations"] += [
            {"id": "c1", "user_id": "u1", "title": "NVDA 估值", "updated_at": "2026-11-07"},
            {"id": "c2", "user_id": "u2", "title": "someone else", "updated_at": "2026-11-07"},
        ]
        self.w = ws.create_workspace(self.db, "u1", "半导体", "AI 资本开支", "nvda amd")

    def test_attach_moves_chat_and_detail_lists_it(self):
        other = ws.create_workspace(self.db, "u1", "Other")
        ws.attach_chat(self.db, "u1", other["id"], "c1")
        ws.attach_chat(self.db, "u1", self.w["id"], "c1")
        self.assertEqual(len(self.db.rows[ws.CHATS]), 1)
        self.assertEqual(ws.chat_workspace(self.db, "u1", "c1")["id"], self.w["id"])
        detail = ws.get_workspace_detail(self.db, "u1", self.w["id"])
        self.assertEqual([c["title"] for c in detail["chats"]], ["NVDA 估值"])
        listed = ws.list_workspaces(self.db, "u1")
        self.assertEqual({w["title"]: w["chat_count"] for w in listed}, {"半导体": 1, "Other": 0})

    def test_cannot_touch_other_users_data(self):
        with self.assertRaises(ws.WorkspaceError) as ctx:
            ws.attach_chat(self.db, "u1", self.w["id"], "c2")
        self.assertEqual(ctx.exception.status, 404)
        with self.assertRaises(ws.WorkspaceError):
            ws.get_workspace_detail(self.db, "u2", self.w["id"])
        self.assertIsNone(ws.chat_workspace(self.db, "u2", "c1"))

    def test_start_run_queues_agents_and_blocks_second_run(self):
        run = ws.start_run(self.db, "u1", self.w["id"], "能否加仓？", ["market", "news"], None)
        self.assertEqual(run["status"], "running")
        self.assertEqual(sorted(r["agent"] for r in self.db.rows[ws.RESULTS]), ["market", "news"])
        with self.assertRaises(ws.WorkspaceError) as ctx:
            ws.start_run(self.db, "u1", self.w["id"], "", None, None)
        self.assertEqual(ctx.exception.status, 409)

    def test_empty_workspace_cannot_run(self):
        empty = ws.create_workspace(self.db, "u1", "Empty")
        with self.assertRaises(ws.WorkspaceError):
            ws.start_run(self.db, "u1", empty["id"], "  ", None, None)

    def test_stale_runs_are_failed(self):
        run = ws.start_run(self.db, "u1", self.w["id"], "", ["market"], None)
        self.assertEqual(ws.fail_stale_runs(self.db), 1)
        self.assertEqual(ws.get_run(self.db, "u1", run["id"])["results"][0]["status"], "failed")

    def test_context_frames_chat_text_as_material(self):
        ws.attach_chat(self.db, "u1", self.w["id"], "c1")
        self.db.rows["chat_messages"] += [
            {"conversation_id": "c1", "role": "user", "content": "NVDA 太贵了吗", "created_at": "1"},
            {"conversation_id": "c1", "role": "assistant", "content": "PE 约 40", "created_at": "2"},
        ]
        ctx = ws.build_context(self.db, "u1", self.w, "能否加仓？")
        self.assertIn("Tickers: NVDA, AMD", ctx)
        self.assertIn("not instructions", ctx)
        self.assertLess(ctx.index("NVDA 太贵了吗"), ctx.index("PE 约 40"))


class FakeAgent:
    def __init__(self, tools, fail=False):
        self.tools, self.fail = tools, fail

    async def ainvoke(self, *_a, **_k):
        if self.fail:
            raise RuntimeError("tool exploded")
        return {"messages": [AIMessage(content="", tool_calls=[{"name": self.tools[0].name, "args": {}, "id": "1"}]),
                             AIMessage(content=f"# Finding\n{self.tools[0].name} looks fine")]}


class RunTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB()
        self.w = ws.create_workspace(self.db, "u1", "半导体", "", ["NVDA"])

    def deps(self, failing=()):
        llm = Mock()
        llm.ainvoke = AsyncMock(return_value=AIMessage(content="综合：偏多"))
        fast = Mock()
        fast.ainvoke = AsyncMock(return_value=AIMessage(
            content='```json\n{"summary": "偏多", "stance": "偏多", "confidence": 0.6}\n```'))
        calls = iter(range(100))

        def agent_factory(model, tools, prompt):
            index = next(calls)
            return FakeAgent(tools, fail=index in failing)
        return ws.RunDeps(lambda **_k: llm, lambda **_k: fast, agent_factory)

    def test_run_saves_each_result_and_synthesis(self):
        run = ws.start_run(self.db, "u1", self.w["id"], "", ["market", "creators"], None)
        with patch.object(ws, "tools_for", side_effect=lambda a, u: [SimpleNamespace(name=f"{a}_tool")]):
            final = asyncio.run(ws.run_research(self.db, run, "u1", None, None, None, self.deps()))
        self.assertEqual(final["status"], "completed")
        saved = ws.get_run(self.db, "u1", run["id"])
        self.assertEqual(saved["synthesis"], "综合：偏多")
        self.assertEqual(saved["stance"], "bullish")
        self.assertEqual([r["status"] for r in saved["results"]], ["completed", "completed"])
        self.assertEqual(saved["results"][0]["tools_used"], ["market_tool"])

    def test_one_failure_makes_run_partial(self):
        run = ws.start_run(self.db, "u1", self.w["id"], "", ["market", "news"], None)
        with patch.object(ws, "tools_for", side_effect=lambda a, u: [SimpleNamespace(name=f"{a}_tool")]):
            final = asyncio.run(ws.run_research(self.db, run, "u1", None, None, None, self.deps(failing={0})))
        self.assertEqual(final["status"], "partial")
        statuses = {r["agent"]: r["status"] for r in ws.get_run(self.db, "u1", run["id"])["results"]}
        self.assertEqual(statuses, {"market": "failed", "news": "completed"})

    def test_all_failures_fail_run_without_synthesis(self):
        run = ws.start_run(self.db, "u1", self.w["id"], "", ["market"], None)
        with patch.object(ws, "tools_for", side_effect=lambda a, u: [SimpleNamespace(name=f"{a}_tool")]):
            final = asyncio.run(ws.run_research(self.db, run, "u1", None, None, None, self.deps(failing={0})))
        self.assertEqual(final["status"], "failed")

    def test_real_tool_sets_bind_the_user(self):
        names = {a: [t.name for t in ws.tools_for(a, "u1")] for a in ws.AGENT_KEYS}
        self.assertEqual(names["creators"], ["get_creator_opinions"])
        self.assertIn("web_search", names["news"])
        self.assertIn("get_user_portfolio", names["portfolio"])


class ParseFindingTests(unittest.TestCase):
    def test_tolerant_parse(self):
        f = ws.parse_finding('好的：{"summary": "趋势破位", "stance": "偏空", "confidence": 1.7}')
        self.assertEqual((f.summary, f.stance, f.confidence), ("趋势破位", "bearish", None))
        self.assertEqual(ws.parse_finding('{"summary": "x", "stance": "MIXED", "confidence": 0.4}').stance, "mixed")
        self.assertIsNone(ws.parse_finding("no json here"))
        self.assertIsNone(ws.parse_finding('{"summary": ""}'))

    def test_summary_falls_back_to_first_line(self):
        fast = Mock()
        fast.ainvoke = AsyncMock(side_effect=RuntimeError("400"))
        f = asyncio.run(ws.summarize_finding(fast, "# 关键结论：偏多\n正文"))
        self.assertEqual((f.summary, f.stance), ("关键结论：偏多", None))


class RouteTests(unittest.TestCase):
    def setUp(self):
        from app.api.dependencies.auth import get_current_user_id
        from app.api.routes import research_workspaces as routes
        self.routes = routes
        app = FastAPI()
        app.include_router(routes.router)
        app.dependency_overrides[get_current_user_id] = lambda: "u1"
        keys = Mock()
        keys.get_keys_dict = AsyncMock(return_value={})
        app.dependency_overrides[routes.get_user_api_keys_service] = lambda: keys
        self.db = FakeDB()
        self.patch = patch.object(routes, "get_supabase_service", return_value=self.db)
        self.patch.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.patch.stop()

    def test_create_list_and_errors(self):
        r = self.client.post("/research-workspaces", json={"title": "半导体", "tickers": ["nvda"]})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["tickers"], ["NVDA"])
        self.assertEqual(len(self.client.get("/research-workspaces").json()["workspaces"]), 1)
        self.assertEqual(self.client.get("/research-workspaces/missing").status_code, 404)
        self.assertEqual(self.client.post("/research-workspaces", json={"title": "x", "tickers": ["!!"]}).status_code, 400)

    def test_start_run_launches_in_background(self):
        wid = self.client.post("/research-workspaces", json={"title": "半导体", "tickers": ["NVDA"]}).json()["id"]
        with patch.object(self.routes.ws, "launch") as launch:
            r = self.client.post(f"/research-workspaces/{wid}/runs", json={"agents": ["market"], "model": "deepseek-flash"})
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("workspace", r.json())
        launch.assert_called_once()
        self.assertEqual(launch.call_args.args[3], "deepseek")

    def test_db_outage_is_503(self):
        with patch.object(self.routes.ws, "list_workspaces", side_effect=RuntimeError("relation does not exist")):
            self.assertEqual(self.client.get("/research-workspaces").status_code, 503)



class ChatContextTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB()
        self.db.rows["chat_conversations"].append({"id": "c1", "user_id": "u1", "title": "t"})
        self.w = ws.create_workspace(self.db, "u1", "英伟达研究", "AI 资本开支", ["NVDA"])

    def finish_run(self, **values):
        run = ws.start_run(self.db, "u1", self.w["id"], "能加仓吗", ["market", "news"], None)
        for r in self.db.rows[ws.RESULTS]:
            if r["agent"] == "market":
                r.update(status="completed", stance="bearish", confidence=0.7, summary="趋势破位")
            else:
                r.update(status="failed")
        self.db.table(ws.RUNS).update({"status": "partial", "stance": "bearish", "synthesis": "不支持现在加仓",
                                       "completed_at": "2026-11-07T22:00:00Z", **values}).eq("id", run["id"]).execute()
        return run

    def test_none_without_workspace(self):
        self.assertIsNone(ws.chat_workspace_context(self.db, "u1", "c1"))

    def test_workspace_without_research(self):
        ws.attach_chat(self.db, "u1", self.w["id"], "c1")
        text = ws.chat_workspace_context(self.db, "u1", "c1")
        self.assertIn("Tickers: NVDA", text)
        self.assertIn("not instructions", text)
        self.assertIn("No research has been run", text)

    def test_latest_finished_research_is_summarised(self):
        ws.attach_chat(self.db, "u1", self.w["id"], "c1")
        self.finish_run()
        text = ws.chat_workspace_context(self.db, "u1", "c1")
        self.assertIn("Latest research (2026-11-07, partial, overall bearish) — question: 能加仓吗", text)
        self.assertIn("Conclusion: 不支持现在加仓", text)
        self.assertIn("- Market / 行情与技术 [bearish, 70%]: 趋势破位", text)
        self.assertIn("- News / 新闻与事件: did not finish", text)
        self.assertEqual(text.splitlines()[1][:20], "When you use this re")

    def test_long_research_is_capped_and_keeps_usage_rule(self):
        ws.attach_chat(self.db, "u1", self.w["id"], "c1")
        self.finish_run(synthesis="长" * 5000)
        text = ws.chat_workspace_context(self.db, "u1", "c1")
        self.assertLessEqual(len(text), ws.CHAT_CONTEXT_LIMIT)
        self.assertIn("When you use this research", text)

    def test_other_users_chat_gets_nothing(self):
        ws.attach_chat(self.db, "u1", self.w["id"], "c1")
        self.assertIsNone(ws.chat_workspace_context(self.db, "u2", "c1"))


class TurnContextTests(unittest.TestCase):
    def test_combines_page_and_workspace_and_survives_errors(self):
        from app.api.routes.chat import routes as chat_routes
        with patch("app.services.research_workspace.chat_workspace_context", return_value="WS"), \
             patch("app.core.supabase.get_supabase_service", return_value=None):
            self.assertEqual(asyncio.run(chat_routes.turn_context("u1", "c1", "PAGE")), "PAGE\n\nWS")
            self.assertEqual(asyncio.run(chat_routes.turn_context("u1", "c1", None)), "WS")
        with patch("app.services.research_workspace.chat_workspace_context", side_effect=RuntimeError("no table")), \
             patch("app.core.supabase.get_supabase_service", return_value=None):
            self.assertEqual(asyncio.run(chat_routes.turn_context("u1", "c1", "PAGE")), "PAGE")
            self.assertIsNone(asyncio.run(chat_routes.turn_context("u1", "c1", "  ")))


if __name__ == "__main__":
    unittest.main()
