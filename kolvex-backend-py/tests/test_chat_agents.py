"""Portfolio, creators, earnings and macro chat agents: routing, prompts and their new tools.

No model or network call: Supabase, the opinion table and the macro snapshot are stubbed.
"""

import asyncio
import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from langchain_core.messages import HumanMessage, ToolMessage

from app.agent.data_gaps import data_gap
from app.agent.graphs import supervisor
from app.agent.tools import calendar_tools, creator_tools, get_tools_for_sources, macro_tools


def days_ago(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).date().isoformat()


ROWS = [
    {
        "channel_id": "c1",
        "channel_title": "美投讲美股",
        "channel_handle": "@meitou",
        "ticker": "NVDA",
        "sentiment": "bullish",
        "confidence": 0.9,
        "opinion_date": days_ago(2),
        "thesis": "数据中心需求强劲",
        "key_points": ["AI 训练", "数据中心"],
        "risks": ["估值高"],
        "video_title": "英伟达还能买吗",
        "video_url": "https://youtube.com/watch?v=a",
    },
    {
        "channel_id": "c1",
        "channel_title": "美投讲美股",
        "channel_handle": "@meitou",
        "ticker": "TSLA",
        "sentiment": "bearish",
        "opinion_date": days_ago(10),
        "thesis": "交付放缓",
        "video_url": "https://youtube.com/watch?v=b",
    },
    {
        "channel_id": "c1",
        "channel_title": "美投讲美股",
        "ticker": "",
        "opinion_date": days_ago(1),
        "thesis": "视频整体分析 数据中心",
    },
    {
        "channel_id": "c1",
        "channel_title": "美投讲美股",
        "ticker": "AAPL",
        "sentiment": "neutral",
        "opinion_date": days_ago(200),
        "thesis": "数据中心无关",
    },
    {
        "channel_id": "c2",
        "channel_title": "视野环球财经",
        "ticker": "AMD",
        "sentiment": "bullish",
        "opinion_date": days_ago(5),
        "thesis": "Data center GPU share gains",
        "video_url": "https://youtube.com/watch?v=c",
    },
]


def with_rows(rows=ROWS):
    service = MagicMock()
    service.all_rows.return_value = [dict(r) for r in rows]
    return (
        patch("app.core.supabase.get_supabase_service", return_value=object()),
        patch(
            "app.services.youtube_stock_opinions.YouTubeStockOpinionService", return_value=service
        ),
    )


class RoutingTests(unittest.TestCase):
    def test_keywords_pick_the_specialist(self):
        cases = {
            "我的持仓这周要注意什么": "portfolio",
            "any news on my watchlist?": "portfolio",
            "NVDA 下周财报，博主怎么看": "earnings",
            "When are AAPL earnings?": "earnings",
            "谁提到过数据中心": "creators",
            "what did creators say about TSLA": "creators",
            "CPI 出来了对科技股意味着什么": "macro",
            "Is the Fed going to cut rates?": "macro",
            "现在利率多少": "macro",
        }
        for text, agent in cases.items():
            with self.subTest(text=text):
                self.assertEqual(supervisor.route_by_keywords(text), agent)

    def test_existing_routes_are_unchanged(self):
        self.assertEqual(supervisor.route_by_keywords("NVDA 该不该买"), "research")
        self.assertEqual(supervisor.route_by_keywords("NVDA 股价多少"), "financial")
        # 净利率 / 毛利率 are margins, not interest rates.
        self.assertEqual(supervisor.route_by_keywords("NVDA 净利率多少"), "financial")
        self.assertEqual(supervisor.route_by_keywords("AAPL 毛利率是多少"), "financial")

    def test_multiple_against_its_history_is_valuation(self):
        # The guardrail eval found this one going to financial as a short lookup.
        for text in (
            "META 的市盈率在历史上算高吗",
            "NVDA PE 比过去五年高吗",
            "AAPL 现在是不是偏贵",
            "Is MSFT's P/E high versus its history?",
        ):
            with self.subTest(text=text):
                self.assertEqual(supervisor.route_by_keywords(text), "valuation")
        # Looking a multiple up is still a quick answer.
        self.assertEqual(supervisor.route_by_keywords("TSLA 市盈率多少"), "financial")
        self.assertEqual(supervisor.route_by_keywords("META 历史最高价是多少"), "financial")

    def test_research_ask_beats_portfolio(self):
        self.assertEqual(supervisor.route_by_keywords("我的持仓 NVDA 值不值得继续拿"), "research")

    def test_page_evidence_does_not_steer_the_route(self):
        text = "NVDA 股价多少\n\nKolvex page evidence\n博主 美投讲美股 看多"
        self.assertEqual(supervisor.route_by_keywords(text), "financial")

    def test_model_router_answer_is_normalized(self):
        llm = MagicMock()
        for answer, expected in (
            ("creators", "creators"),
            ('"macro"', "macro"),
            ("unknown", "financial"),
        ):
            llm.ainvoke = AsyncMock(return_value=MagicMock(content=answer))
            with patch.object(supervisor, "get_fast_llm", return_value=llm):
                got = asyncio.run(
                    supervisor._classify_intent([HumanMessage(content="美投讲美股最近怎么样")])
                )
            self.assertEqual(got, expected)


class PromptTests(unittest.TestCase):
    def prompts(self):
        out = {}
        with (
            patch.object(supervisor, "get_llm", return_value=object()),
            patch.object(supervisor, "create_react_agent", side_effect=lambda **kw: kw),
        ):
            for kind in supervisor.AGENT_PROMPTS:
                out[kind] = supervisor._create_agent_for_request(
                    kind, sources=[], user_id="u", skills=None
                )
        return out

    def test_each_agent_has_its_own_prompt_and_tool_set(self):
        made = self.prompts()
        self.assertEqual(
            set(made),
            {"financial", "research", "portfolio", "creators", "earnings", "macro",
             "smart_money", "valuation", "buzz", "paper_review"},
        )  # fmt: skip
        tool_sets = {kind: {t.name for t in m["tools"]} for kind, m in made.items()}
        # financial and research keep every tool; each specialist gets its own narrower set.
        self.assertEqual(tool_sets["financial"], tool_sets["research"])
        for kind in supervisor.AGENT_TOOL_NAMES:
            self.assertLess(tool_sets[kind], tool_sets["financial"])
        self.assertIn("get_macro_indicators", tool_sets["macro"])
        self.assertNotIn("get_macro_indicators", tool_sets["paper_review"])
        self.assertIn("Portfolio Agent", made["portfolio"]["prompt"])
        self.assertIn("Creators Agent", made["creators"]["prompt"])
        self.assertIn("Earnings Agent", made["earnings"]["prompt"])
        self.assertIn("Macro Agent", made["macro"]["prompt"])

    def test_only_financial_is_asked_to_be_brief(self):
        made = self.prompts()
        self.assertIn("Answer shape: put the direct answer", made["financial"]["prompt"])
        for kind in set(supervisor.AGENT_PROMPTS) - {"financial"}:
            self.assertNotIn("Answer shape: put the direct answer", made[kind]["prompt"])

    def test_unknown_agent_falls_back_to_financial(self):
        with (
            patch.object(supervisor, "get_llm", return_value=object()),
            patch.object(supervisor, "create_react_agent", side_effect=lambda **kw: kw["prompt"]),
        ):
            prompt = supervisor._create_agent_for_request("nope", sources=[], skills=[])
        self.assertIn("Financial Assistant", prompt)

    def test_specialists_do_not_advise_trades_or_rank_creators(self):
        prompts = supervisor.AGENT_PROMPTS
        self.assertIn("Never tell the user to buy, sell", prompts["portfolio"])
        self.assertIn("never rank or compare", prompts["creators"])
        self.assertIn("never show numeric scores", prompts["creators"])
        self.assertIn("Do not predict whether a company will beat or miss", prompts["earnings"])
        self.assertIn("Do not predict Fed decisions", prompts["macro"])


class ToolSetTests(unittest.TestCase):
    def test_new_tools_follow_their_skills(self):
        creators = {t.name for t in get_tools_for_sources(None, "u", skills=["creators"])}
        self.assertEqual(
            creators,
            {
                "get_creator_opinions",
                "get_creator_record",
                "get_creator_recent_opinions",
                "search_creator_opinions",
            },
        )
        news = {t.name for t in get_tools_for_sources([], "u", skills=["news"])}
        self.assertTrue({"get_market_events", "get_macro_indicators"} <= news)


class CreatorToolTests(unittest.TestCase):
    def test_recent_opinions_of_one_creator(self):
        a, b = with_rows()
        with a, b:
            out = json.loads(
                creator_tools.get_creator_recent_opinions.invoke({"creator": "@meitou", "days": 30})
            )
        self.assertEqual(out["creator"], "美投讲美股")
        # The video-level row (empty ticker) and the 200-day-old opinion are left out.
        self.assertEqual([o["ticker"] for o in out["opinions"]], ["NVDA", "TSLA"])
        self.assertEqual(out["sentiment_counts"], {"bullish": 1, "bearish": 1, "neutral": 0})
        self.assertEqual(out["opinions"][0]["video_url"], "https://youtube.com/watch?v=a")
        # Strength stays in words: no numeric confidence reaches the model.
        self.assertNotIn("confidence", out["opinions"][0])
        self.assertEqual(out["opinions"][0]["risks"], "估值高")

    def test_recent_opinions_filter_by_ticker_and_report_empty_as_no_data(self):
        a, b = with_rows()
        with a, b:
            out = json.loads(
                creator_tools.get_creator_recent_opinions.invoke(
                    {"creator": "美投讲美股", "ticker": "msft"}
                )
            )
        self.assertEqual(out["total_opinions"], 0)
        msg = ToolMessage(
            content=json.dumps(out), name="get_creator_recent_opinions", tool_call_id="1"
        )
        self.assertEqual(data_gap(msg)["kind"], "no_data")

    def test_ambiguous_and_unknown_creators(self):
        rows = ROWS + [
            {
                "channel_id": "c3",
                "channel_title": "美投精选",
                "ticker": "NVDA",
                "opinion_date": days_ago(1),
            }
        ]
        a, b = with_rows(rows)
        with a, b:
            ambiguous = json.loads(
                creator_tools.get_creator_recent_opinions.invoke({"creator": "美投"})
            )
            missing = json.loads(
                creator_tools.get_creator_recent_opinions.invoke({"creator": "不存在"})
            )
        self.assertEqual(ambiguous["status"], "ambiguous")
        self.assertIn("美投精选", ambiguous["candidates"])
        self.assertIn("error", missing)

    def test_topic_search_matches_every_term_case_insensitively(self):
        a, b = with_rows()
        with a, b:
            zh = json.loads(
                creator_tools.search_creator_opinions.invoke({"query": "数据中心", "days": 90})
            )
            en = json.loads(
                creator_tools.search_creator_opinions.invoke({"query": "data CENTER gpu"})
            )
            none = json.loads(
                creator_tools.search_creator_opinions.invoke({"query": "数据中心 关税"})
            )
        # Matches key points too; skips the video-level row and the opinion outside the window.
        self.assertEqual([o["ticker"] for o in zh["opinions"]], ["NVDA"])
        self.assertEqual(zh["opinions"][0]["creator"], "美投讲美股")
        self.assertEqual([o["ticker"] for o in en["opinions"]], ["AMD"])
        self.assertEqual(none["match_count"], 0)

    def test_search_failure_is_a_data_gap(self):
        with patch.object(
            creator_tools, "search_opinions_payload", side_effect=RuntimeError("db down")
        ):
            out = creator_tools.search_creator_opinions.invoke({"query": "降息"})
        msg = ToolMessage(content=out, name="search_creator_opinions", tool_call_id="1")
        self.assertEqual(data_gap(msg)["kind"], "unavailable")
        self.assertNotIn("db down", out)


class MarketEventsToolTests(unittest.TestCase):
    LISTING = {
        "today": "2026-11-16",
        "start_date": "2026-11-09",
        "end_date_exclusive": "2026-11-30",
        "events": [
            {
                "id": "nvda",
                "title": "英伟达财报",
                "category": "earnings",
                "event_date": "2026-11-19",
                "timing": "after_close",
                "tickers": ["NVDA"],
                "status": "published",
                "summary": "Q3",
            },
            {
                "id": "fomc",
                "title": "FOMC 会议纪要",
                "category": "fed",
                "event_date": "2026-11-20",
                "timing": "scheduled",
                "starts_at": "2026-11-20T14:00:00-05:00",
                "tickers": [],
                "status": "published",
            },
        ],
    }

    def call(self, **args):
        with (
            patch.object(calendar_tools, "get_supabase_service", return_value=object()),
            patch.object(calendar_tools, "list_events", return_value=self.LISTING),
        ):
            return json.loads(calendar_tools.get_market_events.invoke(args))

    def test_filters_by_category_and_ticker(self):
        self.assertEqual(self.call(category="earnings")["event_count"], 1)
        self.assertEqual([e["title"] for e in self.call(ticker="nvda")["events"]], ["英伟达财报"])
        self.assertEqual(self.call(ticker="AAPL")["event_count"], 0)
        self.assertEqual(self.call(category="bogus")["event_count"], 2)

    def test_states_its_curated_coverage(self):
        out = self.call()
        self.assertEqual(out["coverage"]["from"], "2026-11-09")
        self.assertIn("not a complete earnings calendar", out["coverage"]["scope"])

    def test_read_failure_is_a_data_gap(self):
        with (
            patch.object(calendar_tools, "get_supabase_service", return_value=object()),
            patch.object(calendar_tools, "list_events", side_effect=RuntimeError("missing table")),
        ):
            out = calendar_tools.get_market_events.invoke({})
        self.assertEqual(json.loads(out)["gap"], "unavailable")
        self.assertNotIn("missing table", out)


class MacroToolTests(unittest.TestCase):
    SNAPSHOT = {
        "status": "ready",
        "fetched_at": "2026-11-16T00:00:00+00:00",
        "indicators": [
            {
                "id": "cpi",
                "name_zh": "CPI 同比",
                "name_en": "CPI inflation, YoY",
                "status": "ready",
                "value": 2.9,
                "unit": "percent",
                "period": "2026-10-01",
                "previous_value": 3.0,
                "previous_period": "2026-09-01",
                "change": -0.1,
                "change_unit": "pp",
                "frequency": "monthly",
                "source": "BLS via FRED",
                "source_url": "https://fred.stlouisfed.org/series/CPIAUCNS",
                "history": [{"date": f"2026-{m:02d}-01", "value": 3.0} for m in range(1, 11)],
            },
            {"id": "us10y", "status": "ready", "value": 4.1, "period": "2026-11-14", "history": []},
        ],
    }

    def call(self, snapshot, **args):
        with patch.object(
            macro_tools.economic_indicators_service,
            "get_snapshot",
            AsyncMock(return_value=snapshot),
        ):
            return json.loads(asyncio.run(macro_tools.get_macro_indicators.ainvoke(args)))

    def test_returns_requested_indicators_with_period_and_short_history(self):
        out = self.call(self.SNAPSHOT, indicators=["CPI"])
        self.assertEqual([i["id"] for i in out["indicators"]], ["cpi"])
        cpi = out["indicators"][0]
        self.assertEqual(
            (cpi["value"], cpi["period"], cpi["previous_value"]), (2.9, "2026-10-01", 3.0)
        )
        self.assertEqual(len(cpi["recent"]), macro_tools.RECENT_POINTS)
        self.assertEqual(len(self.call(self.SNAPSHOT)["indicators"]), 2)

    def test_empty_snapshot_is_a_gap_not_zeroes(self):
        pending = {"status": "pending", "indicators": [{"id": "cpi", "value": None, "history": []}]}
        out = self.call(pending)
        self.assertEqual(out["gap"], "unavailable")
        self.assertIsNone(out["indicators"][0]["value"])


if __name__ == "__main__":
    unittest.main()


class CreatorOpinionScoreTests(unittest.TestCase):
    def test_stock_opinions_carry_no_numeric_scores(self):
        # The product shows creator strength in words only; the earnings and research agents
        # copied "confidence" from this tool into answers (evals/chat_guardrails.py).
        row = {
            "ticker": "NVDA",
            "channel_title": "美股老王",
            "opinion_date": days_ago(2),
            "sentiment": "bullish",
            "confidence": 0.86,
            "score": 0.8,
            "time_horizon": "long",
            "thesis": "数据中心需求扩张",
            "video_url": "https://www.youtube.com/watch?v=x",
        }
        service = MagicMock()
        service._fetch_rows.return_value = [row]
        service._build_summary.return_value = {
            "total_opinions": 1,
            "total_creators": 1,
            "bullish_count": 1,
            "bearish_count": 0,
            "neutral_count": 0,
            "avg_score": 0.8,
            "latest_opinion_at": days_ago(2),
        }
        with (
            patch("app.core.supabase.get_supabase_service"),
            patch(
                "app.services.youtube_stock_opinions.YouTubeStockOpinionService",
                return_value=service,
            ),
        ):
            payload = creator_tools.creator_opinions_payload("NVDA", 30)
        text = json.dumps(payload, ensure_ascii=False)
        self.assertNotIn("confidence", text)
        self.assertNotIn("score", text)
        self.assertEqual(payload["opinions"][0]["sentiment"], "bullish")
        self.assertEqual(payload["summary"]["bullish_count"], 1)


class AgentToolSetTests(unittest.TestCase):
    """Specialists get a narrower tool set; nothing their prompt or the guardrail eval needs is dropped."""

    def setUp(self):
        from app.agent.config import SYSTEM_PROMPT

        self.shared = SYSTEM_PROMPT
        self.all_tools = get_tools_for_sources(["web", "portfolio"], user_id="u1", skills=None)
        self.names = {t.name for t in self.all_tools}

    def test_tool_names_are_real(self):
        for agent, names in supervisor.AGENT_TOOL_NAMES.items():
            with self.subTest(agent=agent):
                self.assertLessEqual(names, self.names)

    def test_every_tool_a_prompt_names_is_in_its_set(self):
        for agent, wanted in supervisor.AGENT_TOOL_NAMES.items():
            own = supervisor.AGENT_PROMPTS[agent].replace(self.shared, "")
            named = {n for n in self.names if n in own}
            with self.subTest(agent=agent):
                self.assertLessEqual(named, wanted)

    def test_guardrail_eval_cases_keep_their_tools(self):
        from evals.chat_guardrails import CASES

        for case in CASES:
            if case.agent in supervisor.AGENT_TOOL_NAMES:
                with self.subTest(case=case.id):
                    self.assertLessEqual(
                        set(case.fixtures), supervisor.AGENT_TOOL_NAMES[case.agent]
                    )

    def test_fallback_and_research_keep_everything_and_user_switches_still_apply(self):
        for agent in ("financial", "research"):
            self.assertEqual(
                len(supervisor.tools_for_agent(agent, self.all_tools)), len(self.all_tools)
            )
        macro = {t.name for t in supervisor.tools_for_agent("macro", self.all_tools)}
        self.assertIn("get_macro_indicators", macro)
        self.assertNotIn("get_options_activity", macro)
        no_news = get_tools_for_sources([], user_id="u1", skills=["market"])
        self.assertEqual(
            {t.name for t in supervisor.tools_for_agent("macro", no_news)}, {"get_stock_quote"}
        )
