import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage

from app.agent.graphs import supervisor
from app.agent.tools import create_trading_analysis_tool, get_tools_for_sources


def names(tools) -> set[str]:
    return {t.name for t in tools}


class ToolSelectionTests(unittest.TestCase):
    def test_each_agent_gets_its_own_tools(self):
        financial = names(get_tools_for_sources(None, "financial", "user-1"))
        alert = names(get_tools_for_sources(None, "alert", "user-1"))
        self.assertIn("get_creator_opinions", financial)
        self.assertNotIn("get_stock_financials", alert)
        self.assertEqual(alert, {"get_stock_quote", "web_search", "get_user_portfolio"})

    def test_financial_keeps_price_history(self):
        self.assertIn("get_stock_history", names(get_tools_for_sources(None, "financial", "user-1")))

    def test_research_cannot_start_the_blocking_analysis(self):
        self.assertNotIn("run_trading_analysis", names(get_tools_for_sources(None, "research", "user-1")))
        self.assertNotIn("run_trading_analysis", supervisor.RESEARCH_SYSTEM_PROMPT)

    def test_unknown_agent_falls_back_to_financial(self):
        self.assertEqual(names(get_tools_for_sources(None, "nope", "u")), names(get_tools_for_sources(None, "financial", "u")))

    def test_no_sources_means_no_web_or_portfolio(self):
        tools = names(get_tools_for_sources([], "financial", "user-1"))
        self.assertNotIn("web_search", tools)
        self.assertNotIn("get_user_portfolio", tools)
        self.assertIn("get_stock_quote", tools)

    def test_only_selected_source_is_enabled(self):
        tools = names(get_tools_for_sources(["web"], "financial", "user-1"))
        self.assertIn("web_search", tools)
        self.assertNotIn("get_user_portfolio", tools)

    def test_skill_selection_narrows_tools_without_overriding_sources(self):
        selected = ["market", "news", "portfolio"]
        self.assertEqual(
            names(get_tools_for_sources(["web"], "financial", "user-1", skills=selected)),
            {"get_stock_quote", "get_stock_history", "web_search"},
        )

    def test_empty_skills_disable_all_tools(self):
        self.assertEqual(get_tools_for_sources(None, "financial", "user-1", skills=[]), [])

    def test_all_skills_preserve_default_tools(self):
        selected = ["market", "fundamentals", "options", "news", "creators", "portfolio"]
        self.assertEqual(
            names(get_tools_for_sources(None, "financial", "user-1", skills=selected)),
            names(get_tools_for_sources(None, "financial", "user-1")),
        )

    def test_portfolio_is_bound_to_the_current_user(self):
        with patch("app.agent.tools.create_portfolio_tool_for_user") as bind:
            bind.return_value = SimpleNamespace(name="get_user_portfolio")
            get_tools_for_sources(["portfolio"], "research", "user-1")
        bind.assert_called_once_with("user-1")


class RevenueComparisonTests(unittest.IsolatedAsyncioTestCase):
    async def get_comparison(self, prior_value):
        from app.agent.revenue_evidence import extract_revenue_evidence
        from app.agent.tools.stock_tools import get_reported_revenue

        def quarter(start, end, filed, value):
            return {"start": start, "period": end, "revenue": value, "sources": {"revenue": {
                "derived": False, "filed": filed,
                "source_url": "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/0000000001-26-000001-index.html",
            }}}

        rows = [
            quarter("2026-04-01", "2026-06-30", "2026-08-01", 200),
            quarter("2026-01-01", "2026-03-31", "2026-05-01", 160),
        ]
        if prior_value is not None:
            rows.append(quarter("2025-04-01", "2025-06-30", "2025-08-01", prior_value))
        with patch("app.agent.tools.stock_tools.sec_client.financials", AsyncMock(return_value={
            "symbol": "NVDA", "currency": "USD", "quarterly": rows,
        })):
            result = await get_reported_revenue.ainvoke({
                "type": "tool_call", "name": "get_reported_revenue", "id": "revenue",
                "args": {"symbol": "NVDA", "year_over_year": True},
            })
        return json.loads(result.content), extract_revenue_evidence(result)

    async def test_yoy_uses_prior_year_instead_of_prior_quarter(self):
        comparison, cards = await self.get_comparison(100)
        self.assertEqual(comparison["year_over_year_pct"], 100)
        self.assertEqual([str(row.period_end) for row in cards], ["2026-06-30", "2025-06-30"])
        # The card carries the server's percentage; the tool output keeps it at the top level only.
        self.assertEqual(cards[0].year_over_year_pct, 100)
        self.assertEqual(str(cards[0].compared_period_end), "2025-06-30")
        self.assertIsNone(cards[1].year_over_year_pct)
        self.assertNotIn("year_over_year_pct", comparison["evidence"][0])

    async def test_missing_or_zero_base_does_not_produce_a_growth_percentage(self):
        for prior_value, card_count in [(None, 1), (0, 2)]:
            with self.subTest(prior_value=prior_value):
                comparison, cards = await self.get_comparison(prior_value)
                self.assertIsNone(comparison["year_over_year_pct"])
                self.assertTrue(comparison["unavailable_reason"])
                self.assertEqual(len(cards), card_count)
                self.assertEqual(cards[0].unavailable_reason, comparison["unavailable_reason"])


class TradingAnalysisKeyTests(unittest.TestCase):
    def test_each_tool_uses_only_its_own_users_keys(self):
        graph = Mock()
        graph.propagate.return_value = ({}, "HOLD")
        with patch("app.services.trading_analysis_service.TRADINGAGENTS_AVAILABLE", True), \
                patch("app.services.trading_analysis_service.build_ta_config", return_value={}) as build, \
                patch("app.services.trading_analysis_service.create_trading_graph", return_value=graph):
            alice = create_trading_analysis_tool({"openai": "alice-key"})
            bob = create_trading_analysis_tool({"openai": "bob-key"})
            bob.invoke({"ticker": "NVDA"})
            alice.invoke({"ticker": "NVDA"})
        used = [call.kwargs["user_api_keys"] for call in build.call_args_list]
        self.assertEqual(used, [{"openai": "bob-key"}, {"openai": "alice-key"}])


def quote_result(**overrides):
    data = {"symbol": "NVDA", "current_price": 123.45, "currency": "USD",
            "quote_source": "Yahoo Finance", "market_time": 1793814337, **overrides}
    return ToolMessage(name="get_stock_quote", tool_call_id="quote-1", content=json.dumps(data))


def quote_end(**overrides):
    return {"event": "on_tool_end", "name": "get_stock_quote",
            "data": {"output": quote_result(**overrides)}}


def stream(run_id, content="", tool_call=False, node="agent"):
    chunks = [{"name": "get_stock_quote", "args": "", "id": "1", "index": 0}] if tool_call else []
    return {"event": "on_chat_model_stream", "run_id": run_id, "metadata": {"langgraph_node": node},
            "data": {"chunk": AIMessageChunk(content=content, tool_call_chunks=chunks)}}


def end(run_id, content="", tool_call=False, node="agent"):
    calls = [{"name": "get_stock_quote", "args": {}, "id": "1"}] if tool_call else []
    return {"event": "on_chat_model_end", "run_id": run_id, "metadata": {"langgraph_node": node},
            "data": {"output": AIMessage(content=content, tool_calls=calls)}}


class FakeAgent:
    def __init__(self, events):
        self.events = events

    async def astream_events(self, *_a, **_k):
        for event in self.events:
            yield event


class StreamAgentTests(unittest.IsolatedAsyncioTestCase):
    async def run_stream(self, events):
        with patch.object(supervisor, "_classify_intent", AsyncMock(return_value="financial")), \
                patch.object(supervisor, "_create_agent_for_request", return_value=FakeAgent(events)):
            out = [e async for e in supervisor.stream_agent([HumanMessage(content="hi")])]
        return [e for e in out if e["type"] != "status"]

    async def test_answer_arrives_token_by_token(self):
        out = await self.run_stream([stream("a", "NVDA "), stream("a", "is up"), end("a", "NVDA is up")])
        self.assertEqual(out, [{"type": "token", "content": "NVDA "}, {"type": "token", "content": "is up"},
                               {"type": "done", "content": ""}])

    async def test_text_before_a_tool_call_is_retracted(self):
        out = await self.run_stream([
            stream("a", "Let me check"), stream("a", "", tool_call=True), end("a", "Let me check", tool_call=True),
            stream("b", "Answer"), end("b", "Answer"),
        ])
        self.assertEqual([e["type"] for e in out], ["token", "token_reset", "token", "done"])
        self.assertEqual(out[2]["content"], "Answer")

    async def test_tool_calls_only_visible_at_turn_end_still_retract(self):
        out = await self.run_stream([stream("a", "Planning"), end("a", "Planning", tool_call=True),
                                     stream("b", "Answer"), end("b", "Answer")])
        self.assertEqual([e["type"] for e in out], ["token", "token_reset", "token", "done"])

    async def test_non_streaming_provider_sends_the_whole_answer(self):
        out = await self.run_stream([end("a", "Whole answer")])
        self.assertEqual(out[0], {"type": "token", "content": "Whole answer"})

    async def test_model_inside_a_tool_is_not_the_answer(self):
        out = await self.run_stream([stream("t", "inner", node="tools"), end("t", "inner", node="tools"),
                                     stream("a", "Answer"), end("a", "Answer")])
        self.assertEqual([e.get("content") for e in out if e["type"] == "token"], ["Answer"])

    async def test_stream_attaches_latest_successful_quote_for_each_symbol(self):
        events = [quote_end(), quote_end(current_price=130.25, market_time=None),
                  quote_end(symbol="AMD", error="Unavailable"), end("a", "NVDA: 130.25 USD")]
        out = await self.run_stream(events)
        self.assertEqual(out[-1]["quote_evidence"], [{
            "symbol": "NVDA", "price": 130.25, "currency": "USD",
            "source": "Yahoo Finance", "quoted_at": None,
        }])

    async def test_unsuccessful_or_missing_tool_result_has_no_evidence(self):
        for events in ([quote_end(current_price=None)], []):
            out = await self.run_stream([*events, end("a", "Could not verify quote")])
            self.assertNotIn("quote_evidence", out[-1])

    async def test_sync_agent_collects_only_current_turn_quote(self):
        initial = [quote_result(symbol="AMD"), HumanMessage(content="NVDA?")]
        agent = Mock(ainvoke=AsyncMock(return_value={
            "messages": [*initial, quote_result(), AIMessage(content="NVDA: 123.45 USD")],
        }))
        evidence = []
        with patch.object(supervisor, "_classify_intent", AsyncMock(return_value="financial")), \
                patch.object(supervisor, "_create_agent_for_request", return_value=agent):
            answer = await supervisor.run_agent(initial, quote_evidence=evidence)
        self.assertEqual(answer, "NVDA: 123.45 USD")
        self.assertEqual([quote.symbol for quote in evidence], ["NVDA"])
        self.assertEqual(evidence[0].quoted_at.timestamp(), 1793814337)

    async def test_no_final_text_is_an_error(self):
        out = await self.run_stream([end("a", "")])
        self.assertEqual(out[-1]["type"], "error")


class StreamRouteTests(unittest.TestCase):
    def test_stream_persists_final_text_and_quote_together(self):
        from app.api.routes.chat import routes
        from app.services.user_api_keys_service import UserApiKeysService  # noqa: F401

        quotes = [{"symbol": "NVDA", "price": 123.45, "currency": "USD",
                   "source": "Yahoo Finance", "quoted_at": None}]

        async def fake_stream(**_kwargs):
            for event in ({"type": "token", "content": "Let me check"}, {"type": "token_reset"},
                          {"type": "token", "content": "Answer"}, {"type": "done", "quote_evidence": quotes}):
                yield event

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

        events = [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith("data: ")]
        self.assertIn({"type": "token_reset"}, events)
        self.assertEqual(save.await_args_list[-1].kwargs["content"], "Answer")
        self.assertEqual(events[-1]["content"], "Answer")
        self.assertEqual(save.await_args_list[-1].kwargs["quote_evidence"], quotes)
        self.assertEqual(events[-1]["quote_evidence"], quotes)
        # "Answer" states no number, so every claim list is empty but the check still ran.
        check = save.await_args_list[-1].kwargs["answer_check"]
        self.assertEqual((check["matched"], check["mismatch"]), (0, 0))
        self.assertEqual(events[-1]["answer_check"], check)

        from app.api.routes.chat.schemas import MessageSchema
        history_message = MessageSchema(id="m1", role="assistant", content="Answer",
                                        created_at="2026-11-10T12:00:00Z", quote_evidence=quotes)
        self.assertEqual(history_message.model_dump(mode="json")["quote_evidence"], quotes)


class DetachedStreamTests(unittest.IsolatedAsyncioTestCase):
    async def test_web_disconnect_does_not_cancel_or_duplicate_the_turn(self):
        from fastapi import HTTPException
        from app.api.routes.chat import routes

        release = asyncio.Event()

        async def fake_stream(**_kwargs):
            yield {"type": "token", "content": "Answer"}
            await release.wait()
            yield {"type": "done"}

        user = {"id": "question", "role": "user", "content": "hi", "created_at": "now"}
        save = AsyncMock(side_effect=[user, {"id": "answer", "created_at": "now"}])
        api_keys = SimpleNamespace(get_keys_dict=AsyncMock(return_value={}))
        request = routes.SendMessageRequest(content="hi")

        with patch("app.agent.memory.save_message", save), \
                patch("app.agent.memory.load_conversation_history", AsyncMock(return_value=[])), \
                patch.object(routes, "turn_context", AsyncMock(return_value=None)), \
                patch("app.agent.graphs.supervisor.stream_agent", fake_stream):
            response = await routes.stream_message("chat", request, True, "owner", api_keys)
            stream = response.body_iterator
            try:
                self.assertIn('"accepted"', await asyncio.wait_for(anext(stream), 1))
                self.assertIn('"token"', await asyncio.wait_for(anext(stream), 1))
                await stream.aclose()
                self.assertEqual(await routes.get_stream_status("chat", "owner"), {"active": True})
                self.assertEqual(await routes.get_stream_status("chat", "other"), {"active": False})
                with self.assertRaises(HTTPException) as conflict:
                    await routes.stream_message("chat", request, True, "owner", api_keys)
                self.assertEqual(conflict.exception.status_code, 409)
                task = routes._chat_turns[("owner", "chat")]
                release.set()
                await asyncio.wait_for(task, 1)
                self.assertEqual(await routes.get_stream_status("chat", "owner"), {"active": False})
                self.assertEqual(save.await_count, 2)
                self.assertEqual(save.await_args.kwargs["content"], "Answer")
            finally:
                await routes.stop_stream("chat", "owner")


    async def test_explicit_stop_cancels_a_detached_turn(self):
        from app.api.routes.chat import routes

        async def fake_stream(**_kwargs):
            yield {"type": "token", "content": "Partial"}
            await asyncio.Event().wait()

        user = {"id": "question", "role": "user", "content": "hi", "created_at": "now"}
        save = AsyncMock(return_value=user)
        api_keys = SimpleNamespace(get_keys_dict=AsyncMock(return_value={}))
        request = routes.SendMessageRequest(content="hi")
        with patch("app.agent.memory.save_message", save), \
                patch("app.agent.memory.load_conversation_history", AsyncMock(return_value=[])), \
                patch.object(routes, "turn_context", AsyncMock(return_value=None)), \
                patch("app.agent.graphs.supervisor.stream_agent", fake_stream):
            response = await routes.stream_message("chat", request, True, "owner", api_keys)
            stream = response.body_iterator
            try:
                await asyncio.wait_for(anext(stream), 1)
                await asyncio.wait_for(anext(stream), 1)
                await asyncio.wait_for(routes.stop_stream("chat", "owner"), 1)
                self.assertIn("Generation was stopped.", await asyncio.wait_for(anext(stream), 1))
                self.assertEqual(await routes.get_stream_status("chat", "owner"), {"active": False})
                self.assertEqual(save.await_count, 1)
            finally:
                await stream.aclose()
                await routes.stop_stream("chat", "owner")


if __name__ == "__main__":
    unittest.main()
