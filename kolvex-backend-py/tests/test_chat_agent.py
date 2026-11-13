import unittest.mock
import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, AsyncMock, Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage

from app.agent.graphs import supervisor
from app.agent.tools import create_trading_analysis_tool, get_tools_for_sources


def names(tools) -> set[str]:
    return {t.name for t in tools}



def saving_user_through(save):
    """Route the retry-aware user save through the test's save_message mock."""
    async def save_user(user_id, conversation_id, content):
        return await save(user_id=user_id, conversation_id=conversation_id, role="user", content=content)
    return save_user


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
            {"get_stock_quote", "get_stock_history", "web_search", "get_user_watchlist", "get_daily_brief", "search_news_flashes"},
        )

    def test_empty_skills_disable_all_tools(self):
        self.assertEqual(get_tools_for_sources(None, "financial", "user-1", skills=[]), [])

    def test_all_skills_preserve_default_tools(self):
        selected = ["market", "fundamentals", "options", "news", "creators", "portfolio"]
        self.assertEqual(
            names(get_tools_for_sources(None, "financial", "user-1", skills=selected)),
            names(get_tools_for_sources(None, "financial", "user-1")),
        )

    def test_watchlist_available_without_sources_for_signed_in_user(self):
        self.assertIn("get_user_watchlist", names(get_tools_for_sources([], "financial", "user-1")))
        self.assertIn("get_user_watchlist", names(get_tools_for_sources([], "research", "user-1")))
        self.assertNotIn("get_user_watchlist", names(get_tools_for_sources([], "financial", "")))

    def test_watchlist_reads_only_current_users_rows(self):
        from app.agent.tools import watchlist_tools
        client = unittest.mock.MagicMock()
        query = client.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value
        query.execute.return_value = SimpleNamespace(data=[{"ticker": "AAPL"}, {"ticker": "NVDA"}])
        with patch.object(watchlist_tools, "get_supabase_service", return_value=client):
            out = watchlist_tools.create_watchlist_tool_for_user("user-1").invoke({})
        client.table.assert_called_once_with("user_watchlist")
        client.table.return_value.select.return_value.eq.assert_called_once_with("user_id", "user-1")
        self.assertIn('"tickers": ["AAPL", "NVDA"]', out)

    def test_daily_brief_available_to_financial_and_research(self):
        self.assertIn("get_daily_brief", names(get_tools_for_sources([], "financial", "user-1")))
        self.assertIn("get_daily_brief", names(get_tools_for_sources([], "research", "user-1")))

    def test_daily_brief_digest_lists_hot_topics(self):
        from app.agent.tools import brief_tools
        payload = {
            "schema_version": "kolvex-brief/1.0",
            "brief": {"id": "morning-2026-11-12", "type": "morning", "date": "2026-11-12",
                      "title": "盘前日报", "headline": "芯片领涨", "generated_at_pt": "2026-11-12T05:00:00-08:00",
                      "market_status": "trading_day"},
            "sections": [{"section_id": "hot", "order": 1, "title": "热点",
                          "items": [{"title": "NVDA 财报超预期", "summary": "营收大增", "related_tickers": ["NVDA"]}]}],
        }
        client = unittest.mock.MagicMock()
        chain = client.table.return_value.select.return_value.order.return_value.order.return_value.limit.return_value
        chain.execute.return_value = SimpleNamespace(data=[{"id": "morning-2026-11-12", "payload": payload}])
        with patch.object(brief_tools, "get_supabase_service", return_value=client):
            out = brief_tools.get_daily_brief.invoke({})
        client.table.assert_called_once_with("daily_briefs")
        self.assertIn("NVDA 财报超预期", out)
        self.assertIn("[NVDA]", out)

    def test_news_flash_search_filters_by_keyword_and_ticker(self):
        import asyncio
        from app.agent.tools import news_flash_tools
        feed = {"articles": [
            {"title": "Siemens CEO: partnership with NVIDIA continues $NVDA", "symbols": ["NVDA"], "publish_time": 1, "link": "x"},
            {"title": "UK GDP MoM 0.2%", "symbols": [], "publish_time": 2, "link": "y"},
        ], "fetched_at": "now"}
        with patch.object(news_flash_tools.news_feed_service, "get_feed", new=unittest.mock.AsyncMock(return_value=feed)):
            by_ticker = json.loads(asyncio.run(news_flash_tools.search_news_flashes.ainvoke({"ticker": "nvda"})))
            by_word = json.loads(asyncio.run(news_flash_tools.search_news_flashes.ainvoke({"query": "gdp cpi"})))
        self.assertEqual([h["title"][:7] for h in by_ticker["headlines"]], ["Siemens"])
        self.assertEqual(by_word["match_count"], 1)

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


class NewerDerivedPeriodTests(unittest.IsolatedAsyncioTestCase):
    async def test_latest_direct_quarter_names_the_newer_derived_one(self):
        from app.agent.revenue_evidence import extract_revenue_evidence
        from app.agent.tools.stock_tools import get_reported_revenue
        url = "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/0000000001-26-000001-index.html"

        def row(start, end, derived, value):
            return {"start": start, "period": end, "revenue": value,
                    "sources": {"revenue": {"derived": derived, "filed": "2027-02-25", "source_url": url}}}
        history = {"symbol": "NVDA", "currency": "USD", "quarterly": [
            row("2026-10-26", "2027-01-31", True, 108),
            row("2026-07-27", "2026-10-25", False, 103),
            row("2025-07-28", "2025-10-26", False, 57),
            row("2025-10-27", "2026-01-25", True, 68),
        ]}
        with patch("app.agent.tools.stock_tools.sec_client.financials", AsyncMock(return_value=history)):
            result = await get_reported_revenue.ainvoke({
                "type": "tool_call", "name": "get_reported_revenue", "id": "r", "args": {"symbol": "NVDA"}})
        cards = extract_revenue_evidence(result)
        self.assertEqual(str(cards[0].period_end), "2026-10-25")
        self.assertEqual(str(cards[0].newer_derived_period_end), "2027-01-31")
        self.assertIsNone(cards[1].newer_derived_period_end)

    async def test_no_note_when_the_newest_period_is_directly_reported(self):
        from app.agent.revenue_evidence import extract_revenue_evidence
        comparison, cards = await RevenueComparisonTests().get_comparison(100)
        self.assertIsNone(cards[0].newer_derived_period_end)


class QuoteTimeTests(unittest.TestCase):
    def test_quote_carries_an_eastern_time_string(self):
        from app.agent.tools.stock_tools import get_stock_quote
        service = SimpleNamespace(get_quote=lambda _s: {"symbol": "NVDA", "current_price": 1.0,
                                                         "market_time": 1794517201})
        with patch("app.agent.tools.stock_tools.get_yfinance_service", return_value=service):
            result = json.loads(get_stock_quote.invoke({"symbol": "NVDA"}))
        self.assertEqual(result["market_time_et"], "2026-11-12 16:00 ET")


class AnswerShapeTests(unittest.TestCase):
    def test_only_the_quick_answer_agent_is_asked_to_be_brief(self):
        from app.agent.graphs import supervisor
        prompts = {}
        with patch.object(supervisor, "get_llm", return_value=object()), \
                patch.object(supervisor, "create_react_agent", side_effect=lambda **kw: kw["prompt"]):
            for kind in ("financial", "research"):
                prompts[kind] = supervisor._create_agent_for_request(kind, sources=[], skills=[])
        self.assertIn("Answer shape", prompts["financial"])
        self.assertNotIn("Answer shape", prompts["research"])


class YahooRevenueFallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_foreign_filer_falls_back_to_yahoo_with_its_currency(self):
        import pandas as pd
        from app.agent.revenue_evidence import extract_revenue_evidence
        from app.agent.tools.stock_tools import get_reported_revenue
        from app.services.sec.client import SecNotFound

        frame = pd.DataFrame({pd.Timestamp("2026-09-30"): [1_494_243_284_000.0],
                              pd.Timestamp("2026-06-30"): [1_270_380_000_000.0],
                              pd.Timestamp("2025-09-30"): [989_918_000_000.0],
                              pd.Timestamp("2025-06-30"): [float("nan")]}, index=["Total Revenue"])
        ticker = SimpleNamespace(quarterly_income_stmt=frame, income_stmt=frame, info={"financialCurrency": "TWD"})
        with patch("app.agent.tools.stock_tools.sec_client.financials", AsyncMock(side_effect=SecNotFound("TSM"))), \
                patch("app.agent.tools.stock_tools.get_yfinance_service",
                      return_value=SimpleNamespace(get_ticker=lambda _symbol: ticker)):
            result = await get_reported_revenue.ainvoke({
                "type": "tool_call", "name": "get_reported_revenue", "id": "r",
                "args": {"symbol": "tsm", "year_over_year": True},
            })
        comparison = json.loads(result.content)
        self.assertEqual(comparison["year_over_year_pct"], 50.95)
        cards = extract_revenue_evidence(result)
        self.assertEqual([(c.source, c.currency, str(c.period_end)) for c in cards],
                         [("yahoo", "TWD", "2026-09-30"), ("yahoo", "TWD", "2025-09-30")])
        self.assertIsNone(cards[0].filed_on)
        self.assertIsNone(cards[0].usd_value)  # FX lookup is patched out below

    def test_sec_evidence_still_needs_its_filing_date_and_link(self):
        from pydantic import ValidationError
        from app.agent.revenue_evidence import RevenueEvidence
        with self.assertRaises(ValidationError):
            RevenueEvidence(symbol="NVDA", value=1, currency="USD", period_kind="quarterly",
                            period_end="2026-07-26", source_url="https://finance.yahoo.com/quote/NVDA/financials/")


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

    async def test_sync_agent_collects_financials_and_data_gaps(self):
        initial = [HumanMessage(content="NVDA?")]
        financials = ToolMessage(content=json.dumps({"symbol": "NVDA", "gross_margins": 0.75}),
                                 name="get_stock_financials", tool_call_id="f")
        failed = ToolMessage(content=json.dumps({"error": "Failed to get options chain for NVDA: timeout"}),
                             name="get_options_chain_summary", tool_call_id="o")
        agent = Mock(ainvoke=AsyncMock(return_value={
            "messages": [*initial, financials, failed, AIMessage(content="毛利率 75%")]}))
        found, gaps = [], []
        with patch.object(supervisor, "_classify_intent", AsyncMock(return_value="financial")), \
                patch.object(supervisor, "_create_agent_for_request", return_value=agent):
            await supervisor.run_agent(initial, financial_evidence=found, data_gaps=gaps)
        self.assertEqual([i["label"] for i in found], ["NVDA gross margin (Yahoo Finance)"])
        self.assertEqual(gaps, [{"tool": "get_options_chain_summary", "kind": "unavailable"}])

    async def test_stream_errors_do_not_show_the_exception_text(self):
        from app.agent.graphs import supervisor

        class Boom:
            async def astream_events(self, *_args, **_kwargs):
                raise RuntimeError("upstream 500 at http://10.0.0.7/v1 key=sk-live-123")
                yield  # pragma: no cover

        with patch.object(supervisor, "_classify_intent", AsyncMock(return_value="financial")), \
                patch.object(supervisor, "_create_agent_for_request", return_value=Boom()):
            events = [e async for e in supervisor.stream_agent(messages=[])]
        self.assertEqual(events[-1]["type"], "error")
        self.assertNotIn("10.0.0.7", events[-1]["content"])
        self.assertNotIn("sk-live", events[-1]["content"])

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
                patch("app.agent.memory.save_user_message_once", new=saving_user_through(save)), \
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
                patch("app.agent.memory.save_user_message_once", new=saving_user_through(save)), \
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
                patch("app.agent.memory.save_user_message_once", new=saving_user_through(save)), \
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


class RetryReuseTests(unittest.IsolatedAsyncioTestCase):
    def db(self, latest):
        tables = {"chat_conversations": MagicMock(), "chat_messages": MagicMock()}
        tables["chat_conversations"].select.return_value.eq.return_value.eq.return_value.single.return_value \
            .execute.return_value = SimpleNamespace(data={"id": "c1"})
        tables["chat_messages"].select.return_value.eq.return_value.order.return_value.limit.return_value \
            .execute.return_value = SimpleNamespace(data=[latest] if latest else [])
        return SimpleNamespace(table=lambda name: tables[name])

    async def run_save(self, latest, content="NVDA 营收？"):
        from app.agent import memory
        save = AsyncMock(return_value={"id": "new"})
        with patch.object(memory, "get_supabase_service", return_value=self.db(latest)), \
                patch.object(memory, "save_message", save):
            row = await memory.save_user_message_once("u1", "c1", content)
        return row, save

    async def test_unanswered_same_question_is_reused(self):
        row, save = await self.run_save({"id": "old", "role": "user", "content": "NVDA 营收？"})
        self.assertEqual(row["id"], "old")
        save.assert_not_awaited()

    async def test_answered_or_different_questions_are_saved(self):
        for latest in ({"id": "a", "role": "assistant", "content": "NVDA 营收？"},
                       {"id": "old", "role": "user", "content": "AMD 营收？"}, None):
            with self.subTest(latest=latest):
                row, save = await self.run_save(latest)
                self.assertEqual(row["id"], "new")
                save.assert_awaited_once()
