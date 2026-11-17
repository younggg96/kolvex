"""Agent workspace: pinned chat agents, multi-agent suggestions and agent-bound workspace chats."""

import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from langchain_core.messages import AIMessage, HumanMessage
from pydantic import ValidationError

from app.agent.agents import CHAT_AGENTS
from app.agent.graphs import supervisor
from app.api.routes.chat.schemas import SendMessageRequest
from app.services import research_workspace as ws
from tests.test_research_workspace import FakeDB


class FakeAgent:
    async def astream_events(self, *_args, **_kwargs):
        return
        yield  # an async generator that yields nothing


def collect(**kwargs) -> list[dict]:
    async def run():
        return [event async for event in supervisor.stream_agent(**kwargs)]

    return asyncio.run(run())


class AgentNamesTests(unittest.TestCase):
    def test_names_match_the_supervisor_prompts(self):
        self.assertEqual(set(CHAT_AGENTS), set(supervisor.AGENT_PROMPTS))

    def test_request_accepts_known_agent_and_rejects_others(self):
        self.assertEqual(SendMessageRequest(content="hi", agent="buzz").agent, "buzz")
        self.assertIsNone(SendMessageRequest(content="hi").agent)
        with self.assertRaises(ValidationError):
            SendMessageRequest(content="hi", agent="astrology")


class SuggestAgentsTests(unittest.TestCase):
    def test_question_spanning_several_specialists(self):
        self.assertEqual(
            supervisor.suggest_agents("NVDA 现在估值贵不贵？巴菲特和国会议员最近在买吗？"),
            ["smart_money", "valuation"],
        )

    def test_routing_still_picks_the_first(self):
        text = "NVDA 现在估值贵不贵？巴菲特和国会议员最近在买吗？"
        self.assertEqual(supervisor.route_by_keywords(text), "smart_money")

    def test_single_topic_gets_no_suggestion(self):
        self.assertEqual(supervisor.suggest_agents("NVDA 估值贵吗"), [])
        self.assertEqual(supervisor.suggest_agents("hello"), [])

    def test_research_ask_already_combines(self):
        self.assertEqual(supervisor.suggest_agents("深度分析 NVDA 估值和机构持仓"), [])

    def test_earnings_covers_creator_opinions(self):
        self.assertEqual(supervisor.suggest_agents("NVDA 财报前博主怎么看"), [])

    def test_caps_at_four_and_ignores_page_evidence(self):
        text = (
            "我的持仓里，巴菲特在买的、财报快到的、降息受益的、估值低的、reddit 热议的有哪些"
            "\n\nKolvex page evidence\n模拟交易"
        )
        found = supervisor.suggest_agents(text)
        self.assertEqual(len(found), supervisor.MAX_SUGGESTED_AGENTS)
        self.assertNotIn("paper_review", found)
        self.assertEqual(found[0], "portfolio")


class RouterSeveralAgentsTests(unittest.TestCase):
    def route(self, answer: str):
        specialists: list[str] = []
        llm = AsyncMock()
        llm.ainvoke = AsyncMock(return_value=AIMessage(content=answer))
        with patch.object(supervisor, "get_fast_llm", return_value=llm):
            agent = asyncio.run(
                supervisor._classify_intent(
                    [HumanMessage(content="NVDA 到底是怎么回事")], specialists=specialists
                )
            )
        return agent, specialists

    def test_parse_keeps_order_and_drops_repeats(self):
        self.assertEqual(
            supervisor.parse_router_answer("Buzz, earnings, buzz, smart_money."),
            ["buzz", "earnings", "smart_money"],
        )
        self.assertEqual(supervisor.parse_router_answer("none of these"), [])

    def test_broad_question_gets_several_agents(self):
        self.assertEqual(
            self.route("buzz, earnings, valuation"), ("buzz", ["buzz", "earnings", "valuation"])
        )

    def test_one_name_is_a_normal_route(self):
        self.assertEqual(self.route("macro"), ("macro", []))

    def test_research_is_not_a_panel_and_caps_at_four(self):
        agent, found = self.route("research, buzz, earnings, valuation, creators, macro")
        self.assertEqual(agent, "buzz")
        self.assertEqual(found, ["buzz", "earnings", "valuation", "creators"])

    def test_allowed_agents_limit_the_router(self):
        specialists: list[str] = []
        llm = AsyncMock()
        llm.ainvoke = AsyncMock(return_value=AIMessage(content="buzz, earnings, valuation"))
        with patch.object(supervisor, "get_fast_llm", return_value=llm):
            agent = asyncio.run(
                supervisor._classify_intent(
                    [HumanMessage(content="NVDA 到底是怎么回事")],
                    specialists=specialists,
                    allowed=["financial", "earnings", "valuation"],
                )
            )
        self.assertEqual((agent, specialists), ("earnings", ["earnings", "valuation"]))
        prompt = llm.ainvoke.call_args.args[0][0].content
        self.assertIn('Only these agents are available for this user: "financial"', prompt)

    def test_disallowed_keyword_route_falls_back(self):
        llm = AsyncMock()
        llm.ainvoke = AsyncMock(return_value=AIMessage(content="paper_review"))
        with patch.object(supervisor, "get_fast_llm", return_value=llm):
            agent = asyncio.run(
                supervisor._classify_intent(
                    [HumanMessage(content="复盘我的模拟交易")], allowed=["valuation", "macro"]
                )
            )
        # Keywords say paper_review, which is off; the model says it too; first allowed wins.
        self.assertEqual(agent, "macro")

    def test_full_allowlist_keeps_the_plain_prompt(self):
        self.assertEqual(supervisor._available_note(list(supervisor.AGENT_PROMPTS)), "")

    def test_research_plus_one_stays_single(self):
        self.assertEqual(self.route("research, valuation"), ("research", []))


class StreamAgentTests(unittest.TestCase):
    def setUp(self):
        patcher = patch.object(supervisor, "_create_agent_for_request", return_value=FakeAgent())
        self.create = patcher.start()
        self.addCleanup(patcher.stop)

    def test_pinned_agent_skips_routing_and_suggestions(self):
        classify = AsyncMock(return_value="financial")
        with patch.object(supervisor, "_classify_intent", classify):
            events = collect(
                messages=[HumanMessage(content="NVDA 估值贵不贵？巴菲特在买吗？")],
                agent="valuation",
            )
        classify.assert_not_called()
        self.assertEqual(self.create.call_args.args[0], "valuation")
        self.assertIn({"type": "agent", "agent": "valuation", "pinned": True}, events)
        self.assertFalse(any(e["type"] == "agent_suggestion" for e in events))

    def test_unknown_pin_falls_back_to_routing(self):
        with patch.object(supervisor, "_classify_intent", AsyncMock(return_value="macro")):
            events = collect(messages=[HumanMessage(content="降息")], agent="astrology")
        self.assertIn({"type": "agent", "agent": "macro", "pinned": False}, events)

    def test_router_specialists_win_over_keywords(self):
        async def classify(messages, user_api_keys=None, specialists=None, **_kwargs):
            specialists.extend(["buzz", "earnings"])
            return "buzz"

        with patch.object(supervisor, "_classify_intent", classify):
            events = collect(messages=[HumanMessage(content="NVDA 到底是怎么回事")])
        self.assertIn({"type": "agent_suggestion", "agents": ["buzz", "earnings"]}, events)

    def test_suggestions_respect_allowed_agents(self):
        with patch.object(supervisor, "_classify_intent", AsyncMock(return_value="valuation")):
            events = collect(
                messages=[HumanMessage(content="NVDA 估值贵不贵？巴菲特在买吗？")],
                allowed_agents=["valuation", "financial"],
            )
        self.assertFalse(any(e["type"] == "agent_suggestion" for e in events))

    def test_routed_turn_suggests_specialists(self):
        with patch.object(supervisor, "_classify_intent", AsyncMock(return_value="smart_money")):
            events = collect(messages=[HumanMessage(content="NVDA 估值贵不贵？巴菲特在买吗？")])
        self.assertIn({"type": "agent_suggestion", "agents": ["smart_money", "valuation"]}, events)

    def test_explicit_team_request_uses_the_previous_question(self):
        classify = AsyncMock()
        with patch.object(supervisor, "_classify_intent", classify):
            events = collect(
                messages=[
                    HumanMessage(content="NVDA 到底是怎么回事"),
                    HumanMessage(content="我想要使用多agent 的功能"),
                ],
                allowed_agents=["earnings", "valuation"],
                team_research=True,
            )
        classify.assert_not_awaited()
        self.assertIn(
            {
                "type": "agent_suggestion",
                "agents": ["earnings", "valuation"],
                "question": "NVDA 到底是怎么回事",
                "explicit": True,
            },
            events,
        )

    def test_asking_how_to_use_the_team_does_not_launch_it(self):
        with patch.object(supervisor, "_classify_intent", AsyncMock(return_value="financial")):
            events = collect(
                messages=[HumanMessage(content="怎么使用多 Agent？")], team_research=True
            )
        self.assertFalse(any(event["type"] == "agent_suggestion" for event in events))


class WorkspaceAgentChatTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB()
        self.db.rows["chat_conversations"] += [
            {"id": "c1", "user_id": "u1", "title": "估值", "updated_at": "2026-11-16"},
            {"id": "c2", "user_id": "u1", "title": "随便聊", "updated_at": "2026-11-16"},
        ]
        self.w = ws.create_workspace(self.db, "u1", "NVDA")

    def test_agent_binding_is_stored_and_listed(self):
        ws.attach_chat(self.db, "u1", self.w["id"], "c1", "valuation")
        ws.attach_chat(self.db, "u1", self.w["id"], "c2")
        detail = ws.get_workspace_detail(self.db, "u1", self.w["id"])
        self.assertEqual(
            {c["id"]: c["agent"] for c in detail["chats"]}, {"c1": "valuation", "c2": None}
        )

    def test_plain_attach_does_not_write_the_agent_column(self):
        row = ws.attach_chat(self.db, "u1", self.w["id"], "c2")
        self.assertNotIn("agent", row)

    def test_unknown_agent_is_rejected(self):
        with self.assertRaises(ws.WorkspaceError) as ctx:
            ws.attach_chat(self.db, "u1", self.w["id"], "c1", "astrology")
        self.assertEqual(ctx.exception.code, "invalid_agent")

    def test_specialists_share_one_workspace_run_and_one_source_message(self):
        self.db.rows["chat_messages"] = [
            {"id": "m1", "role": "user", "conversation_id": "c1"},
        ]
        first, created = ws.start_chat_run(
            self.db, "u1", "c1", "m1", "研究 NVDA", ["earnings", "valuation"], "model", ["NVDA"]
        )
        self.assertTrue(created)
        second, created = ws.start_chat_run(
            self.db, "u1", "c1", "m1", "研究 NVDA", ["earnings", "valuation"], "model", ["NVDA"]
        )
        self.assertFalse(created)
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(ws.chat_workspace(self.db, "u1", "c1")["tickers"], ["NVDA"])
        self.assertEqual(len(self.db.rows["chat_conversations"]), 2)
        self.assertEqual(len(self.db.rows[ws.RUNS]), 1)
        self.assertEqual([r["agent"] for r in self.db.rows[ws.RESULTS]], ["earnings", "valuation"])

    def test_starting_in_an_existing_workspace_reuses_it(self):
        ws.attach_chat(self.db, "u1", self.w["id"], "c1")
        self.db.rows["chat_messages"] = [{"id": "m1", "role": "user", "conversation_id": "c1"}]
        run, _ = ws.start_chat_run(
            self.db, "u1", "c1", "m1", "研究 NVDA", ["earnings", "valuation"], None, ["NVDA"]
        )
        self.assertEqual(run["workspace_id"], self.w["id"])
        self.assertEqual(len(self.db.rows[ws.WORKSPACES]), 1)
        with self.assertRaises(ws.WorkspaceError) as error:
            ws.start_chat_run(
                self.db, "u1", "c2", "m1", "研究 NVDA", ["earnings", "valuation"], None, ["NVDA"]
            )
        self.assertEqual(error.exception.code, "message_not_found")


if __name__ == "__main__":
    unittest.main()
