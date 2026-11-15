import json
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

from app.agent.tools import get_tools_for_sources
from app.agent.tools.creator_tools import get_creator_record
from app.services import creator_record as cr
from app.services import opinion_outcomes as oo

NOW = datetime(2026, 11, 13, 22, 0, tzinfo=timezone.utc)  # Fri 17:00 New York: settled


def sessions(start: date, count: int) -> list[str]:
    days, day = [], start
    while len(days) < count:
        if day.weekday() < 5:
            days.append(day.isoformat())
        day += timedelta(days=1)
    return days


DAYS = sessions(date(2026, 1, 5), 230)
# The stock gains 1% a session, SPY 0.1%: every bullish opinion shows the stock ahead of SPY.
STOCK = [{"date": d, "open": 100 * 1.01**i, "close": 100 * 1.01**i} for i, d in enumerate(DAYS)]
SPY = [{"date": d, "open": 500 * 1.001**i, "close": 500 * 1.001**i} for i, d in enumerate(DAYS)]


def download(symbol, start, end):
    return {"SPY": SPY}.get(symbol, [] if symbol.endswith("-HK") else STOCK)


def row(id_, day, ticker="NVDA", sentiment="bullish", channel="c1", title="美投讲美股", **kw):
    return {
        "id": id_, "channel_id": channel, "channel_title": title, "channel_handle": "@meitou",
        "ticker": ticker, "sentiment": sentiment, "video_published_at": f"{day}T23:00:00+00:00",
        "video_url": f"https://youtu.be/{id_}", **kw,
    }  # fmt: skip


def many(count, every=6, channel="c1", **kw):
    """`count` opinions `every` sessions apart: further apart than the 7-day dedupe."""
    return [row(f"{channel}-{i}", DAYS[i * every], channel=channel, **kw) for i in range(count)]


class FindChannelTests(unittest.TestCase):
    rows = [
        row("a", DAYS[0]),
        row("b", DAYS[0], channel="c2", title="美投君", **{"channel_handle": "@mtj"}),
    ]

    def test_exact_name_handle_or_id(self):
        for query in ("美投讲美股", "@meitou", "meitou", "c1", " 美投讲美股 "):
            self.assertEqual(cr.find_channel(self.rows, query), "c1")

    def test_exact_match_beats_partial(self):
        self.assertEqual(cr.find_channel(self.rows, "美投君"), "c2")

    def test_partial_match_on_several_is_ambiguous(self):
        with self.assertRaises(cr.AmbiguousCreator) as caught:
            cr.find_channel(self.rows, "美投")
        self.assertEqual(caught.exception.candidates, ["美投君", "美投讲美股"])

    def test_unknown_creator(self):
        with self.assertRaises(cr.CreatorNotFound):
            cr.find_channel(self.rows, "nobody")


class CreatorRecordTests(unittest.TestCase):
    def setUp(self):
        oo.clear_cache()

    def record(self, rows, **kw):
        return cr.creator_record(
            rows, "c1", now=NOW, download=download, days=kw.pop("days", None), **kw
        )

    def test_enough_opinions_over_enough_time_give_averages_and_halves(self):
        result = self.record(many(32))
        group = result["groups"]["20_sessions"]["bullish"]
        self.assertTrue(group["enough"])
        self.assertEqual(group["n"], 32)
        self.assertGreater(group["mean_excess_pct"], 0)
        self.assertEqual(group["beat_spy_share_pct"], 100.0)
        self.assertEqual(group["first_half"]["n"] + group["second_half"]["n"], 32)
        self.assertEqual(result["groups"]["20_sessions"]["bearish"], {"n": 0, "enough": False})
        self.assertEqual(result["creator"], {"channel_id": "c1", "name": "美投讲美股"})

    def test_small_group_states_only_its_count(self):
        group = self.record(many(10))["groups"]["5_sessions"]["bullish"]
        self.assertEqual(group["enough"], False)
        self.assertEqual(group["n"], 10)
        self.assertNotIn("mean_excess_pct", group)

    def test_short_span_is_not_enough_even_with_many_opinions(self):
        rows = [row(f"t{i}", DAYS[i], ticker=f"T{i}") for i in range(40)]  # 40 tickers, ~8 weeks
        group = self.record(rows)["groups"]["5_sessions"]["bullish"]
        self.assertEqual(group["n"], 40)
        self.assertLess(group["span_days"], cr.MIN_SPAN_DAYS)
        self.assertFalse(group["enough"])

    def test_no_verdict_fields_anywhere(self):
        text = json.dumps(self.record(many(32))).lower()
        for word in ("signed", "hit_rate", "accuracy", "win_rate", "correct", "rank"):
            self.assertNotIn(word, text)

    def test_repeats_within_seven_days_count_once(self):
        rows = [row("a", DAYS[0]), row("b", DAYS[1]), row("c", DAYS[10])]
        counts = self.record(rows)["counts"]
        self.assertEqual((counts["opinions"], counts["after_dedupe"]), (3, 2))

    def test_other_creators_and_tickers_are_left_out(self):
        rows = many(5) + many(5, channel="c2") + [row("amd", DAYS[3], ticker="AMD")]
        result = self.record(rows, ticker="nvda")
        self.assertEqual(result["counts"]["after_dedupe"], 5)
        self.assertEqual({r["ticker"] for r in result["recent"]}, {"NVDA"})

    def test_window_drops_older_opinions(self):
        rows = [row("old", DAYS[0]), row("new", DAYS[200])]
        result = cr.creator_record(rows, "c1", days=60, now=NOW, download=download)
        self.assertEqual([r["date"] for r in result["recent"]], [DAYS[200]])

    def test_recent_lists_newest_first_with_moves_and_links(self):
        result = self.record(many(15))
        recent = result["recent"]
        self.assertEqual(len(recent), cr.MAX_RECENT)
        self.assertEqual(recent[0]["date"], DAYS[14 * 6])
        first = recent[-1]
        self.assertEqual(first["video_url"], "https://youtu.be/c1-3")
        five = first["after"]["5_sessions"]
        self.assertEqual(five["stock_minus_spy_pct"], round(five["stock_pct"] - five["spy_pct"], 4))

    def test_unknown_ticker_is_no_price_data_not_zero(self):
        result = self.record([row("hk", DAYS[0], ticker="0700.HK")] + many(3))
        self.assertEqual(result["counts"]["no_price_data"], 1)
        hk = next(r for r in result["recent"] if r["ticker"] == "0700-HK")
        self.assertEqual(hk["price_status"], "no_price_data")
        self.assertNotIn("after", hk)

    def test_provider_failure_for_every_ticker_raises(self):
        def broken(symbol, start, end):
            raise ConnectionError("down")

        with self.assertRaises(cr.PricesUnavailable):
            cr.creator_record(many(3), "c1", days=None, now=NOW, download=broken)

    def test_one_failed_ticker_is_counted_not_hidden(self):
        def flaky(symbol, start, end):
            if symbol == "AMD":
                raise ConnectionError("down")
            return download(symbol, start, end)

        rows = many(3) + [row("amd", DAYS[2], ticker="AMD")]
        result = cr.creator_record(rows, "c1", days=None, now=NOW, download=flaky)
        self.assertEqual(result["counts"]["price_unavailable"], 1)
        self.assertEqual(result["counts"]["scored"], 3)


class ToolTests(unittest.TestCase):
    def setUp(self):
        oo.clear_cache()

    def call(self, rows, **args):
        real = cr.creator_record

        def offline(*a, **kw):
            return real(*a, now=NOW, download=download, **kw)

        with (
            patch("app.core.supabase.get_supabase_service"),
            patch(
                "app.services.youtube_stock_opinions.YouTubeStockOpinionService.all_rows",
                return_value=rows,
            ),
            patch.object(cr, "creator_record", side_effect=offline),
        ):
            return json.loads(get_creator_record.invoke(args))

    def test_tool_returns_record(self):
        result = self.call(many(3), creator="美投讲美股", days=None)
        self.assertEqual(result["creator"]["channel_id"], "c1")
        self.assertIsNone(result["window_days"])

    def test_tool_reports_ambiguity_and_missing_creator(self):
        rows = [row("a", DAYS[0]), row("b", DAYS[0], channel="c2", title="美投君")]
        self.assertEqual(self.call(rows, creator="美投")["candidates"], ["美投君", "美投讲美股"])
        self.assertIn("no tracked creator", self.call(rows, creator="nobody")["error"])

    def test_tool_clamps_window(self):
        result = self.call(many(3), creator="c1", days=5)
        self.assertEqual(result["window_days"], 30)

    def test_registered_under_creators_skill(self):
        tools = get_tools_for_sources(None, "u", skills=["creators"])
        self.assertIn("get_creator_record", {t.name for t in tools})
        market = get_tools_for_sources(None, "u", skills=["market"])
        self.assertNotIn("get_creator_record", {t.name for t in market})


if __name__ == "__main__":
    unittest.main()
