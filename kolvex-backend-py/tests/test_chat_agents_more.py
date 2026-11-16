"""Smart-money, valuation, buzz and paper-review chat agents: routing, prompts and their tools.

No model, network or database call: Supabase, SEC store, screeners and the valuation service are stubbed.
"""

import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from langchain_core.messages import ToolMessage

from app.agent.data_gaps import data_gap
from app.agent.graphs import supervisor
from app.agent.tools import (
    buzz_tools,
    get_tools_for_sources,
    paper_trading_tools,
    smart_money_tools,
    valuation_tools,
)


def run(tool, args=None):
    return json.loads(asyncio.run(tool.ainvoke(args or {})))


class Query:
    """A chainable PostgREST stand-in that records filters and returns fixed rows."""

    def __init__(self, rows):
        self.rows, self.calls = rows, []

    def __getattr__(self, name):
        def step(*args, **kwargs):
            self.calls.append((name, args))
            return self

        return step

    def execute(self):
        return SimpleNamespace(data=self.rows)


class RoutingTests(unittest.TestCase):
    def test_keywords_pick_the_new_specialists(self):
        cases = {
            "巴菲特最近买了什么": "smart_money",
            "哪些大佬持有 AAPL": "smart_money",
            "佩洛西最近交易了什么": "smart_money",
            "TSLA 期权异动": "smart_money",
            "Which hedge funds own NVDA?": "smart_money",
            "NVDA 现在贵不贵": "valuation",
            "Is AAPL overvalued?": "valuation",
            "今天什么在异动": "buzz",
            "reddit 上在炒什么": "buzz",
            "what is trending today": "buzz",
            "帮我复盘上周的模拟交易": "paper_review",
            "review my paper trades": "paper_review",
        }
        for text, agent in cases.items():
            with self.subTest(text=text):
                self.assertEqual(supervisor.route_by_keywords(text), agent)

    def test_earlier_routes_still_win_where_they_should(self):
        self.assertEqual(supervisor.route_by_keywords("NVDA 估值高，该不该买"), "research")
        self.assertEqual(supervisor.route_by_keywords("博主热议的股票"), "creators")
        self.assertEqual(supervisor.route_by_keywords("NVDA 期权链"), "financial")
        self.assertEqual(supervisor.route_by_keywords("我的持仓这周要注意什么"), "portfolio")


class PromptTests(unittest.TestCase):
    def test_new_prompts_keep_the_product_rules(self):
        prompts = supervisor.AGENT_PROMPTS
        self.assertIn("never call it smart money buying", prompts["smart_money"])
        self.assertIn("Do not suggest copying", prompts["smart_money"])
        self.assertIn("not fair value or a\n  price target", prompts["valuation"])
        self.assertIn("Attention is not an opinion", prompts["buzz"])
        self.assertIn("virtual account", prompts["paper_review"])


class ToolSetTests(unittest.TestCase):
    def test_paper_account_is_bound_to_signed_in_users_only(self):
        self.assertIn("get_paper_trading_account", {t.name for t in get_tools_for_sources([], "u")})
        self.assertNotIn(
            "get_paper_trading_account", {t.name for t in get_tools_for_sources([], "")}
        )

    def test_skills_gate_the_new_tools(self):
        options = {t.name for t in get_tools_for_sources(None, "u", skills=["options"])}
        self.assertEqual(options, {"get_options_chain_summary", "get_options_activity"})
        fundamentals = {t.name for t in get_tools_for_sources(None, "u", skills=["fundamentals"])}
        self.assertTrue(
            {
                "get_institutional_holders",
                "get_superinvestor_portfolio",
                "get_congress_trades",
                "get_valuation",
            }
            <= fundamentals
        )


class InstitutionalTests(unittest.TestCase):
    FILINGS = [
        {"manager_id": "berkshire", "manager_name": "Berkshire Hathaway", "accession": "b-q3",
         "period": "2026-09-30", "filed": "2026-11-14"},
        {"manager_id": "berkshire", "manager_name": "Berkshire Hathaway", "accession": "b-q2",
         "period": "2026-06-30", "filed": "2026-08-14"},
        {"manager_id": "ark", "manager_name": "ARK Invest", "accession": "a-q3",
         "period": "2026-09-30", "filed": "2026-11-10"},
        {"manager_id": "untracked", "manager_name": "Someone", "accession": "x", "period": "2026-09-30",
         "filed": "2026-11-01"},
    ]  # fmt: skip
    HOLDINGS = [
        {"accession": "b-q3", "ticker": "AAPL", "shares": 280, "previous_shares": 300,
         "change_percent": -6.7, "value": 60_000, "weight": 22.1, "activity": "reduced"},
        {"accession": "a-q3", "ticker": "AAPL", "shares": 0, "value": 0, "weight": 0, "activity": "exited"},
    ]  # fmt: skip

    def test_holders_use_each_managers_latest_filing(self):
        filings, holdings = Query(self.FILINGS), Query(self.HOLDINGS)
        db = MagicMock()
        db.table.side_effect = (
            lambda name: filings if name == smart_money_tools.FILINGS else holdings
        )
        with patch.object(smart_money_tools, "get_supabase_service", return_value=db):
            out = json.loads(smart_money_tools.get_institutional_holders.invoke({"ticker": "aapl"}))
        in_filter = next(args for name, args in holdings.calls if name == "in_")
        self.assertEqual(
            sorted(in_filter[1]), ["a-q3", "b-q3"]
        )  # not the older Q2 or the untracked one
        self.assertEqual(out["holder_count"], 1)  # the exited ARK row is reported but not counted
        top = out["holders"][0]
        self.assertEqual(
            (top["manager"], top["quarter_end"], top["filed"]),
            ("Berkshire Hathaway", "2026-09-30", "2026-11-14"),
        )
        self.assertIn("45 days", out["note"])

    def test_manager_lookup_by_chinese_name_and_unknown_name(self):
        data = {"id": "duan_yongping", "name": "H&H International Investment",
                "filing": {"period": "2026-09-30", "filed": "2026-11-12"},
                "holdings": [{"ticker": "AAPL", "weight": 60, "activity": "increased", "value": 9},
                             {"ticker": "BABA", "weight": 0, "activity": "exited", "value": 3},
                             {"ticker": "PDD", "weight": 10, "activity": "new", "value": 2}]}  # fmt: skip
        store = SimpleNamespace(latest=AsyncMock(return_value=data), sync_later=MagicMock())
        with patch("app.services.sec.holdings_store.institution_store", store):
            out = run(smart_money_tools.get_superinvestor_portfolio, {"manager": "段永平"})
            missing = run(
                smart_money_tools.get_superinvestor_portfolio, {"manager": "不存在的基金"}
            )
        store.latest.assert_awaited_once_with("duan_yongping")
        self.assertEqual([h["ticker"] for h in out["top_holdings"]], ["AAPL", "PDD"])
        self.assertEqual([h["ticker"] for h in out["exited"]], ["BABA"])
        self.assertEqual(missing["status"], "not_tracked")
        self.assertIn("Berkshire Hathaway", missing["tracked"])

    def test_manager_not_synced_queues_a_sync_and_reports_a_gap(self):
        store = SimpleNamespace(latest=AsyncMock(return_value=None), sync_later=MagicMock())
        with patch("app.services.sec.holdings_store.institution_store", store):
            out = run(smart_money_tools.get_superinvestor_portfolio, {"manager": "berkshire"})
        store.sync_later.assert_called_once_with("berkshire")
        self.assertEqual(out["gap"], "unavailable")


class CongressAndOptionsTests(unittest.TestCase):
    def test_congress_filters_and_escapes_member_name(self):
        trades = Query([{"member_name": "Nancy Pelosi", "ticker": "NVDA", "trade_date": "2026-10-01",
                         "filed_date": "2026-10-20", "direction": "buy", "amount_range": "$1M-$5M"}])  # fmt: skip
        db = MagicMock()
        db.table.return_value = trades
        with patch.object(smart_money_tools, "get_supabase_service", return_value=db):
            out = json.loads(
                smart_money_tools.get_congress_trades.invoke(
                    {"ticker": "nvda", "member": "Pel_osi%"}
                )
            )
        self.assertIn(("eq", ("ticker", "NVDA")), trades.calls)
        self.assertIn(("ilike", ("member_name", "%Pel\\_osi\\%%")), trades.calls)
        self.assertEqual(out["trades"][0]["amount_range"], "$1M-$5M")

    def test_no_congress_rows_after_a_sync_is_no_data(self):
        empty, synced = Query([]), Query([{"fetched_at": "2026-11-15"}])
        db = MagicMock()
        db.table.side_effect = lambda name: empty if name == "congress_trades" else synced
        with patch.object(smart_money_tools, "get_supabase_service", return_value=db):
            out = smart_money_tools.get_congress_trades.invoke({"member": "Nobody"})
        self.assertEqual(
            data_gap(ToolMessage(content=out, name="get_congress_trades", tool_call_id="1"))[
                "kind"
            ],
            "no_data",
        )

    def test_options_activity_for_one_ticker(self):
        run_row = {"trade_date": "2026-11-14", "session": "post", "data_date": "2026-11-14",
                   "payload": {"market": {"pc_premium_ratio": 0.8},
                               "contributors": {"positive": [{"symbol": "NVDA"}], "negative": []},
                               "tickers": [{"symbol": "TSLA", "net_premium": -5, "history": [1, 2]}],
                               "contracts": [{"underlying": "TSLA", "premium": 9}, {"underlying": "NVDA", "premium": 8}]},
                   "summary": {"points_zh": ["看跌权利金偏多"]}}  # fmt: skip
        with (
            patch.object(smart_money_tools, "get_supabase_service", return_value=object()),
            patch("app.services.options_activity.store.get_run", AsyncMock(return_value=run_row)),
        ):
            out = run(smart_money_tools.get_options_activity, {"ticker": "tsla"})
            other = run(smart_money_tools.get_options_activity, {"ticker": "AAPL"})
        self.assertEqual(
            out["ticker_activity"], {"symbol": "TSLA", "net_premium": -5}
        )  # lists dropped
        self.assertEqual(out["largest_contracts"], [{"underlying": "TSLA", "premium": 9}])
        self.assertEqual(out["data_date"], "2026-11-14")
        self.assertIsNone(other["ticker_activity"])
        self.assertIn("ticker_note", other)


class ValuationTests(unittest.TestCase):
    DATA = {
        "symbol": "NVDA", "as_of": "2026-11-14", "price_kind": "regular_session_close",
        "current": {"price": 180.0, "price_date": "2026-11-14", "eps": 3.0, "period_end": "2026-10-26",
                    "status": "complete", "pe": 60.0,
                    "calibration": {"status": "complete", "lookback_start": "2021-11-14", "sample_count": 1200,
                                    "percentile": 0.42, "multiples": {"conservative": 40, "base": 55, "optimistic": 70}},
                    "reference": {"scenarios": {"base": {"target_pe": 55, "reference_value": 165.0,
                                                          "comparison": {"premium_discount": 0.0909}}}}},
        "points": [{"pe": 50.0}, {"pe": None}, {"pe": 65.0}],
    }  # fmt: skip

    def test_reports_percentile_scenarios_and_range(self):
        service = MagicMock()
        service.request.return_value = (200, self.DATA)
        with patch.object(valuation_tools, "valuation_service", service):
            out = run(valuation_tools.get_valuation, {"symbol": "nvda"})
        self.assertEqual(out["pe_reference"]["current_pe_percentile_pct"], 42.0)
        self.assertEqual(
            out["scenarios"]["base"],
            {"target_pe": 55, "reference_value": 165.0, "premium_discount_pct": 9.09},
        )
        self.assertEqual(out["past_year_pe_range"], {"low": 50.0, "high": 65.0})

    def test_unsupported_stock_lists_covered_ones(self):
        service = MagicMock()
        service.request.return_value = (
            200,
            {"symbol": "TSLA", "status": "unsupported", "supported_symbols": ["NVDA"]},
        )
        with patch.object(valuation_tools, "valuation_service", service):
            out = run(valuation_tools.get_valuation, {"symbol": "TSLA"})
        self.assertEqual((out["gap"], out["supported_symbols"]), ("no_data", ["NVDA"]))

    def test_waits_for_a_first_build_then_reads_the_cache(self):
        async def scenario():
            done = asyncio.get_running_loop().create_future()
            done.set_result(None)
            service = MagicMock()
            service.request.side_effect = [(202, {"job_id": "j"}), (200, self.DATA)]
            service.jobs = {"j": {"task": done}}
            with patch.object(valuation_tools, "valuation_service", service):
                return json.loads(await valuation_tools.get_valuation.ainvoke({"symbol": "NVDA"}))

        self.assertEqual(asyncio.run(scenario())["current_pe"], 60.0)


class BuzzTests(unittest.TestCase):
    def test_one_failing_source_does_not_hide_the_others(self):
        discovery = {"movers": {"items": [{"symbol": "PLTR", "changePercent": 12.345, "volumeMultiple": None}],
                                "sessionDate": "2026-11-14"},
                     "active": {"items": [], "sessionDate": "2026-11-14"}}  # fmt: skip
        reddit = SimpleNamespace(get=AsyncMock(side_effect=RuntimeError("apewisdom down")))
        x = MagicMock()
        x.return_value.ticker_heat.return_value = {
            "tickers": [{"ticker": "PLTR", "posts": 4, "previous": 1, "authors": 2}]
        }
        with (
            patch("app.services.stock_discovery.get_stock_discovery", return_value=discovery),
            patch("app.services.reddit_opinions.reddit_opinion_service", reddit),
            patch("app.services.x_content.XContentService", x),
            patch.object(buzz_tools, "get_supabase_service", return_value=object()),
        ):
            out = run(buzz_tools.get_market_buzz)
        self.assertEqual(out["unavailable_sources"], ["reddit"])
        self.assertEqual(
            out["price_and_volume"]["movers_by_abs_change"]["items"][0]["change_pct"], 12.35
        )
        self.assertEqual(out["x"]["items"][0]["posts"], 4)
        self.assertNotIn("gap", out)


class PaperTradingTests(unittest.TestCase):
    STATE = {
        "initial_cash": "100000", "cash": "99000", "realized_pnl": "-46", "marks": {},
        "orders": [{"status": "pending", "symbol": "AAPL", "side": "long", "effect": "open", "kind": "limit",
                    "quantity": 1, "price": "150", "reserved": "150"}],
        "positions": [],
        "fills": [
            {"position_id": "p1", "symbol": "NVDA", "side": "long", "effect": "open", "quantity": 10,
             "price": "100", "fee": "0.10", "realized_pnl": "0", "at": "2026-11-10T14:00:00+00:00", "reason": "order"},
            {"position_id": "p1", "symbol": "NVDA", "side": "long", "effect": "close", "quantity": 10,
             "price": "95", "fee": "0.10", "realized_pnl": "-50.20", "at": "2026-11-11T16:00:00+00:00",
             "reason": "stop_loss"},
            {"position_id": "p2", "symbol": "TSLA", "side": "short", "effect": "open", "quantity": 1,
             "price": "300", "fee": "0.03", "realized_pnl": "0", "at": "2026-11-12T14:00:00+00:00", "reason": "order"},
            {"position_id": "p2", "symbol": "TSLA", "side": "short", "effect": "close", "quantity": 1,
             "price": "296", "fee": "0.03", "realized_pnl": "3.94", "at": "2026-11-12T15:30:00+00:00", "reason": "order"},
        ],
        "snapshots": [{"at": "t", "equity": "100000"}],
        "commands": [{"id": "secret-idempotency-key"}],
    }  # fmt: skip

    def read(self, rows):
        table = Query(rows)
        db = MagicMock()
        db.table.return_value = table
        with patch.object(paper_trading_tools, "get_supabase_service", return_value=db):
            out = json.loads(
                paper_trading_tools.create_paper_trading_tool_for_user("user-1").invoke({})
            )
        return out, table

    def test_review_is_scoped_to_the_user_and_summarizes_closed_lots(self):
        out, table = self.read([{"state": self.STATE}])
        self.assertIn(("eq", ("user_id", "user-1")), table.calls)
        self.assertNotIn("secret-idempotency-key", json.dumps(out))
        stats = out["closed_trade_stats"]
        self.assertEqual(
            (stats["count"], stats["wins"], stats["losses"], stats["with_stop_loss_exit"]),
            (2, 1, 1, 1),
        )
        newest = out["recent_closed_trades"][0]
        self.assertEqual(
            (newest["symbol"], newest["holding_hours"], newest["net_pnl"]), ("TSLA", 1.5, "3.94")
        )
        self.assertEqual(out["pending_orders"][0]["symbol"], "AAPL")

    def test_no_account_is_reported_and_never_created(self):
        out, table = self.read([])
        self.assertEqual(out["status"], "no_account")
        self.assertNotIn("upsert", [name for name, _ in table.calls])
        self.assertNotIn("insert", [name for name, _ in table.calls])


if __name__ == "__main__":
    unittest.main()
