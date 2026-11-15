import json
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.youtube_opinions import get_service, router
from app.services import opinion_review as review


def sessions(first: str, count: int) -> list[str]:
    day, days = date.fromisoformat(first), []
    while len(days) < count:
        if day.weekday() < 5:
            days.append(day.isoformat())
        day += timedelta(days=1)
    return days


DAYS = sessions("2026-09-28", 40)  # Mon 09-28 .. covers 20 sessions after an 10-01 entry
# Stock opens at 100 and closes 1% higher each session; SPY closes 0.5% higher.
STOCK = [
    {"date": d, "open": 100.0, "close": 100.0 * (1 + 0.01 * (i + 1))} for i, d in enumerate(DAYS)
]
SPY = [
    {"date": d, "open": 500.0, "close": 500.0 * (1 + 0.005 * (i + 1))} for i, d in enumerate(DAYS)
]
NOW = datetime(2026, 11, 30, 23, 0, tzinfo=timezone.utc)  # well after the last bar settled


def opinion(i, sentiment="bullish", ticker="NVDA", **kw):
    return {"id": f"{sentiment}-{i}", "channel_id": f"c{i}", "channel_title": f"Creator {i}",
            "ticker": ticker, "sentiment": sentiment, "confidence": 0.8, "direction_score": 70,
            "video_published_at": "2026-09-30T23:00:00+00:00", **kw}  # fmt: skip


def download(symbols, start, end):
    return {s: {"NVDA": STOCK, "SPY": SPY}.get(s, []) for s in symbols}


ROWS = [opinion(i) for i in range(35)] + [opinion(i, "bearish") for i in range(5)]


class SnapshotTests(unittest.TestCase):
    def test_bullish_group_states_the_move_against_spy(self):
        snap = review.build_snapshot(ROWS, download, NOW)
        five = snap["groups"]["5"]["bullish"]["overall"]
        # Entry 10-01 open 100; 5th session close is index 7 -> 108; SPY 500 -> 520.
        self.assertEqual(five["n"], 35)
        self.assertTrue(five["enough"])
        self.assertEqual(five["mean_return_pct"], 8.0)
        self.assertEqual(five["mean_benchmark_pct"], 4.0)
        self.assertEqual(five["mean_excess_pct"], 4.0)
        self.assertEqual(five["beat_share_pct"], 100.0)
        self.assertEqual(five["beat_count"], five["n"])
        self.assertEqual(sum(b["count"] for b in five["histogram"]), 35)
        self.assertEqual(next(b for b in five["histogram"] if b["low"] == 0)["count"], 35)
        self.assertEqual(snap["as_of"], DAYS[-1])

    def test_calls_on_the_benchmark_itself_stay_out_of_the_statistics(self):
        spy_calls = [opinion(100 + i, ticker="SPY") for i in range(3)]
        snap = review.build_snapshot(ROWS + spy_calls, download, NOW)
        five = snap["groups"]["5"]["bullish"]["overall"]
        self.assertEqual(five["n"], 35)  # unchanged: the three SPY calls are not averaged in
        self.assertEqual(snap["counts"]["on_benchmark"], 3)
        self.assertEqual(snap["counts"]["neutral_or_mixed"], 0)
        listed = [e for e in snap["events"] if e["ticker"] == "SPY"]
        self.assertEqual(len(listed), 3)  # still listed per opinion
        self.assertEqual(listed[0]["horizons"]["5"]["excess_return_pct"], 0.0)

    def test_small_groups_state_only_their_count(self):
        bearish = review.build_snapshot(ROWS, download, NOW)["groups"]["20"]["bearish"]["overall"]
        self.assertEqual(bearish, {"n": 5, "enough": False})

    def test_no_creator_is_named_or_ranked(self):
        spawn = lambda fn: fn()  # noqa: E731
        with tempfile.TemporaryDirectory() as folder:
            review.reset()
            page = review.get_review(
                lambda: ROWS, download, now=NOW, spawn=spawn, path=Path(folder) / "s.json"
            )
            review.reset()
        text = json.dumps(page)
        self.assertNotIn("creators", page)
        self.assertNotIn("events", page)
        self.assertNotIn("Creator 1", text)
        self.assertNotIn("channel", text)
        self.assertNotIn("signed", text)

    def test_counts_exclusions_instead_of_zero_filling(self):
        rows = ROWS + [opinion(90, ticker="9984.T"), opinion(91, video_published_at=None),
                       opinion(92, ticker="")]  # fmt: skip
        counts = review.build_snapshot(rows, download, NOW)["counts"]
        self.assertEqual(counts["opinions"], 42)  # the blank ticker is not a stock opinion
        self.assertEqual((counts["no_price_data"], counts["no_publish_time"]), (1, 1))
        self.assertEqual((counts["bullish"], counts["bearish"]), (35, 5))

    def test_missing_benchmark_is_unavailable(self):
        with self.assertRaises(review.ReviewUnavailable):
            review.build_snapshot(ROWS, lambda s, a, b: {"NVDA": STOCK}, NOW)

    def test_segments_follow_the_edges_and_keep_unknown_last(self):
        rows = [opinion(i, confidence=0.9) for i in range(31)] + [opinion(40 + i, confidence=None)
                                                                  for i in range(2)]  # fmt: skip
        segments = review.build_snapshot(rows, download, NOW)["groups"]["5"]["bullish"][
            "confidence"
        ]
        self.assertEqual([(s["low"], s["high"], s["n"]) for s in segments],
                         [(0.85, None, 31), (None, None, 2)])  # fmt: skip
        self.assertTrue(segments[0]["enough"])
        self.assertTrue(segments[1]["unknown"])
        self.assertFalse(segments[1]["enough"])

    def test_market_context_starts_at_the_first_entry(self):
        market = review.build_snapshot(ROWS, download, NOW)["market"]
        self.assertEqual(market["benchmark"][0]["date"], "2026-10-01")
        self.assertEqual(
            market["weekly_opinions"], [{"week": "2026-09-28", "bullish": 35, "bearish": 5}]
        )


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        review.reset()
        self.dir = tempfile.TemporaryDirectory()
        self.path = Path(self.dir.name) / "snapshot.json"
        self.rows = Mock(return_value=ROWS)

    def tearDown(self):
        self.dir.cleanup()

    def test_first_request_builds_in_the_background_and_says_so(self):
        deferred = []
        with self.assertRaises(review.ReviewUnavailable) as raised:
            review.get_review(self.rows, download, now=NOW, spawn=deferred.append, path=self.path)
        self.assertEqual(str(raised.exception), "building")
        deferred[0]()  # the build finishes
        result = review.get_review(
            self.rows, download, now=NOW, spawn=deferred.append, path=self.path
        )
        self.assertFalse(result["refreshing"])
        self.assertEqual(len(deferred), 1)  # current snapshot: no second build
        self.assertTrue(self.path.exists())

    def test_a_new_session_serves_the_old_snapshot_while_rebuilding(self):
        review.get_review(self.rows, download, now=NOW, spawn=lambda fn: fn(), path=self.path)
        built = review._state.snapshot["built_at"]
        deferred = []
        later = review.get_review(self.rows, download, now=NOW + timedelta(days=2),
                                  spawn=deferred.append, path=self.path)  # fmt: skip
        self.assertTrue(later["refreshing"])
        self.assertEqual(later["built_at"], built)
        self.assertEqual(len(deferred), 1)

    def test_snapshot_survives_a_restart_through_the_file(self):
        review.get_review(self.rows, download, now=NOW, spawn=lambda fn: fn(), path=self.path)
        review.reset()
        never = Mock()
        result = review.get_review(self.rows, download, now=NOW, spawn=never, path=self.path)
        self.assertEqual(result["counts"]["bullish"], 35)

    def test_failed_build_is_not_retried_immediately(self):
        failing = Mock(side_effect=RuntimeError("rate limited"))
        spawned = Mock(side_effect=lambda fn: fn())
        for _ in range(2):
            with self.assertRaises(review.ReviewUnavailable) as raised:
                review.get_review(self.rows, failing, now=NOW, spawn=spawned, path=self.path)
            self.assertEqual(str(raised.exception), "unavailable")
        self.assertEqual(spawned.call_count, 1)

    def test_last_settle_is_the_most_recent_1630_new_york(self):
        before = datetime(2026, 11, 10, 20, 0, tzinfo=timezone.utc)  # 15:00 New York
        after = datetime(2026, 11, 10, 22, 0, tzinfo=timezone.utc)  # 17:00 New York
        self.assertEqual(review.last_settle(before).date().isoformat(), "2026-11-09")
        self.assertEqual(review.last_settle(after).date().isoformat(), "2026-11-10")


LONG_DAYS = sessions("2026-03-02", 200)
LONG_STOCK = [{"date": d, "open": 100.0, "close": 100.0 * (1 + 0.001 * (i + 1))}
              for i, d in enumerate(LONG_DAYS)]  # fmt: skip
LONG_SPY = [{"date": d, "open": 500.0, "close": 500.0} for d in LONG_DAYS]


def long_download(symbols, start, end):
    return {s: LONG_SPY if s == "SPY" else LONG_STOCK for s in symbols}


def call(n, channel="cA", sentiment="bullish", every_days=3):
    published = datetime(2026, 3, 2, 23, 0, tzinfo=timezone.utc) + timedelta(days=n * every_days)
    return {"id": f"{channel}-{sentiment}-{n}", "channel_id": channel, "channel_title": channel,
            "ticker": f"T{n}", "sentiment": sentiment, "confidence": 0.8, "direction_score": 70,
            "video_id": f"v{n}", "video_title": f"Video {n}", "video_url": f"https://youtu.be/v{n}",
            "video_published_at": published.isoformat()}  # fmt: skip


class CreatorTests(unittest.TestCase):
    def creators(self, rows):
        return review.build_snapshot(rows, long_download, NOW)["creators"]

    def test_card_needs_thirty_calls_over_ninety_days_and_shows_both_halves(self):
        rows = [call(n) for n in range(30)] + [call(40 + n, sentiment="bearish") for n in range(10)]
        rows += [call(n, channel="cB") for n in range(5)]
        records = self.creators(rows)
        mine = records["cA"]
        self.assertTrue(mine["enough"])
        self.assertEqual(mine["counted"], 40)
        self.assertGreaterEqual(mine["span_days"], 90)
        bullish = mine["groups"]["20"]["bullish"]
        self.assertTrue(bullish["enough"])
        self.assertEqual(bullish["n"], 30)
        self.assertEqual(bullish["early"]["n"] + bullish["late"]["n"], 30)
        # Each horizon splits at the median of the calls it counts.
        self.assertEqual(set(mine["split_dates"]), {"5", "20"})
        self.assertLessEqual(abs(bullish["early"]["n"] + mine["groups"]["20"]["bearish"]["early"]["n"]
                                 - (bullish["late"]["n"] + mine["groups"]["20"]["bearish"]["late"]["n"])),
                             1)  # fmt: skip
        self.assertTrue(bullish["early"]["enough"] and bullish["late"]["enough"])
        # Later entries open at 100 and close higher, so the late half moved more.
        self.assertGreater(bullish["late"]["mean_excess_pct"], bullish["early"]["mean_excess_pct"])
        self.assertEqual(mine["groups"]["20"]["bearish"]["n"], 10)
        self.assertFalse(mine["groups"]["20"]["bearish"]["enough"])
        self.assertEqual(records["cB"], {**records["cB"], "enough": False, "counted": 5})
        self.assertNotIn("groups", records["cB"])

    def test_many_calls_in_a_short_window_are_not_enough(self):
        mine = self.creators([call(n, every_days=1) for n in range(40)])["cA"]
        self.assertEqual(mine["counted"], 40)
        self.assertLess(mine["span_days"], 90)
        self.assertFalse(mine["enough"])

    def test_unknown_creator_states_no_history(self):
        review.reset()
        with tempfile.TemporaryDirectory() as folder:
            card = review.creator_review(lambda: [call(n) for n in range(3)], "nobody",
                                         download=long_download, now=NOW,
                                         spawn=lambda fn: fn(), path=Path(folder) / "s.json")  # fmt: skip
        review.reset()
        self.assertEqual((card["counted"], card["enough"], card["min_group"]), (0, False, 30))


class CreatorOpinionTests(unittest.TestCase):
    def setUp(self):
        review.reset()
        self.dir = tempfile.TemporaryDirectory()
        self.options = {"download": long_download, "now": NOW, "spawn": lambda fn: fn(),
                        "path": Path(self.dir.name) / "s.json"}  # fmt: skip
        repeat = {**call(5), "id": "cA-bullish-repeat", "ticker": "T1"}
        repeat["video_published_at"] = call(40)["video_published_at"]
        self.rows = [call(n) for n in range(3)] + [repeat, call(0, channel="cB")]
        self.rows += [{**call(7, sentiment="neutral"), "id": "cA-neutral"}]

    def tearDown(self):
        review.reset()
        self.dir.cleanup()

    def test_picker_lists_creators_by_activity_with_no_figures(self):
        listed = review.review_creators(lambda: self.rows, **self.options)
        self.assertEqual([c["channel_id"] for c in listed["creators"]], ["cA", "cB"])
        self.assertEqual(listed["creators"][0], {"channel_id": "cA", "channel_title": "cA",
                                                 "channel_avatar_url": None, "opinions": 4,
                                                 "stocks": 3})  # fmt: skip

    def test_lists_each_opinion_with_stock_and_market_newest_first(self):
        found = review.creator_opinions(lambda: self.rows, "cA", **self.options)
        self.assertEqual(found["total"], 4)  # the neutral call is not listed
        self.assertEqual(found["opinions"][0]["id"], "cA-bullish-repeat")
        self.assertEqual(found["stocks"][0], {"ticker": "T1", "count": 2})
        five = found["opinions"][-1]["horizons"]["5"]
        self.assertEqual(set(five), {"return_pct", "benchmark_return_pct", "excess_return_pct"})
        self.assertAlmostEqual(five["return_pct"] - five["benchmark_return_pct"],
                               five["excess_return_pct"], places=3)  # fmt: skip
        text = json.dumps(found)
        for word in ("mean", "median", "beat", "share", "rank", "signed"):
            self.assertNotIn(word, text)

    def test_unknown_creator_has_no_opinions(self):
        found = review.creator_opinions(lambda: self.rows, "nobody", **self.options)
        self.assertEqual((found["total"], found["opinions"], found["stocks"]), (0, [], []))


class BinTests(unittest.TestCase):
    def setUp(self):
        review.reset()
        self.dir = tempfile.TemporaryDirectory()
        self.options = {"download": download, "now": NOW, "spawn": lambda fn: fn(),
                        "path": Path(self.dir.name) / "s.json"}  # fmt: skip

    def tearDown(self):
        review.reset()
        self.dir.cleanup()

    def test_lists_the_opinions_behind_one_bar(self):
        rows = [{**opinion(i), "video_title": f"Video {i}", "video_url": f"https://youtu.be/{i}"}
                for i in range(35)]  # fmt: skip
        found = review.opinions_in_bin(lambda: rows, 5, "bullish", 0, 5, **self.options)
        self.assertEqual(found["total"], 35)
        first = found["opinions"][0]
        self.assertEqual((first["ticker"], first["excess_return_pct"]), ("NVDA", 4.0))
        self.assertTrue(first["video_url"].startswith("https://"))
        empty = review.opinions_in_bin(lambda: rows, 5, "bullish", 5, 10, **self.options)
        self.assertEqual(empty["total"], 0)
        open_ended = review.opinions_in_bin(lambda: rows, 5, "bullish", None, 0, **self.options)
        self.assertEqual(open_ended["total"], 0)
        spy = [{**opinion(100), "ticker": "SPY"}]
        flat = review.opinions_in_bin(lambda: rows + spy, 5, "bullish", 0, 5, **self.options)
        self.assertEqual(flat["total"], 35)  # the SPY call (0% excess) is not in any bar

    def test_rejects_unknown_horizon(self):
        with self.assertRaises(ValueError):
            review.opinions_in_bin(lambda: ROWS, 60, "bullish", 0, 5, **self.options)

    def test_an_older_snapshot_file_is_rebuilt_not_served(self):
        path = self.options["path"]
        path.write_text(json.dumps({"method_version": 1, "built_at": NOW.isoformat()}))
        spawned = []
        with self.assertRaises(review.ReviewUnavailable):
            review.get_review(lambda: ROWS, download, now=NOW, spawn=spawned.append, path=path)
        self.assertEqual(len(spawned), 1)


class RouteTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.service = Mock()
        app.dependency_overrides[get_service] = lambda: self.service
        self.client = TestClient(app)

    def test_returns_snapshot(self):
        with patch.object(review, "get_review", return_value={"as_of": "2026-11-13"}) as got:
            response = self.client.get("/youtube-opinions/review")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["as_of"], "2026-11-13")
        got.assert_called_once_with(self.service.all_rows)

    def test_bin_opinions_and_creator_card(self):
        with patch.object(review, "opinions_in_bin", return_value={"total": 2}) as listed:
            response = self.client.get(
                "/youtube-opinions/review/opinions?horizon=20&sentiment=bullish&low=-5&high=0"
            )
        self.assertEqual((response.status_code, response.json()["total"]), (200, 2))
        listed.assert_called_once_with(self.service.all_rows, 20, "bullish", -5.0, 0.0)
        bad = self.client.get("/youtube-opinions/review/opinions?horizon=20&sentiment=neutral")
        self.assertEqual(bad.status_code, 422)
        with patch.object(review, "creator_review", return_value={"enough": False}) as card:
            response = self.client.get("/youtube-opinions/creators/c1/review")
        self.assertEqual((response.status_code, response.json()["enough"]), (200, False))
        card.assert_called_once_with(self.service.all_rows, "c1")

    def test_creator_picker_and_opinions(self):
        with patch.object(review, "review_creators", return_value={"creators": []}) as picker:
            response = self.client.get("/youtube-opinions/review/creators")
        self.assertEqual((response.status_code, response.json()["creators"]), (200, []))
        picker.assert_called_once_with(self.service.all_rows)
        with patch.object(review, "creator_opinions", return_value={"total": 3}) as listed:
            response = self.client.get("/youtube-opinions/review/creators/c1")
        self.assertEqual((response.status_code, response.json()["total"]), (200, 3))
        listed.assert_called_once_with(self.service.all_rows, "c1")

    def test_first_build_is_503_building(self):
        with patch.object(review, "get_review", side_effect=review.ReviewUnavailable("building")):
            response = self.client.get("/youtube-opinions/review")
        self.assertEqual((response.status_code, response.json()["detail"]), (503, "building"))


if __name__ == "__main__":
    unittest.main()
