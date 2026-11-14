import unittest
from datetime import date

from app.services import opinion_backtest as bt


def bar(day, o, c=None):
    return {"date": f"2026-11-{day:02d}", "open": o, "close": o if c is None else c}


def opinion(**kw):
    return {"id": "o1", "channel_id": "c1", "channel_title": "Chan", "ticker": "NVDA",
            "sentiment": "bullish", "direction_score": 70, "confidence": 0.8,
            "time_horizon": "short", "video_id": "v1",
            # Mon 2026-11-02 18:00 New York (after the close)
            "video_published_at": "2026-11-02T23:00:00+00:00", **kw}  # fmt: skip


# Mon 11-02 .. Fri 11-06, then Mon 11-09
STOCK = [
    bar(2, 95),
    bar(3, 100, 102),
    bar(4, 102, 105),
    bar(5, 105, 107),
    bar(6, 107, 110),
    bar(9, 120),
]
SPY = [bar(2, 500), bar(3, 500, 501), bar(4, 502), bar(5, 503), bar(6, 503, 510), bar(9, 511)]


class EntryTests(unittest.TestCase):
    def test_after_close_enters_next_session_open(self):
        e = bt.score_opinion(opinion(), STOCK, SPY, (1, 4))
        self.assertEqual(
            (e["status"], e["entry_date"], e["entry_price"]), ("scored", "2026-11-03", 100.0)
        )
        self.assertEqual(e["horizons"][1]["exit_date"], "2026-11-03")
        self.assertEqual(e["horizons"][1]["return_pct"], 2.0)
        four = e["horizons"][4]
        self.assertEqual(four["exit_date"], "2026-11-06")
        self.assertEqual((four["return_pct"], four["benchmark_return_pct"]), (10.0, 2.0))
        self.assertEqual((four["excess_return_pct"], four["signed_excess_pct"]), (8.0, 8.0))

    def test_premarket_enters_same_day_open_but_intraday_waits(self):
        pre = opinion(video_published_at="2026-11-03T13:00:00+00:00")  # 08:00 NY
        mid = opinion(video_published_at="2026-11-03T15:00:00+00:00")  # 10:00 NY
        self.assertEqual(bt.score_opinion(pre, STOCK, SPY, (1,))["entry_date"], "2026-11-03")
        self.assertEqual(bt.score_opinion(mid, STOCK, SPY, (1,))["entry_date"], "2026-11-04")

    def test_weekend_video_enters_monday(self):
        sat = opinion(video_published_at="2026-11-07T15:00:00+00:00")
        self.assertEqual(bt.score_opinion(sat, STOCK, SPY, (1,))["entry_date"], "2026-11-09")

    def test_opinion_date_is_never_used(self):
        e = bt.score_opinion(
            opinion(video_published_at=None, opinion_date="2026-11-02"), STOCK, SPY
        )
        self.assertEqual(e["status"], "no_publish_time")
        self.assertEqual(bt.score_opinion(opinion(video_published_at="2026-11-02T18:00:00"), STOCK, SPY)["status"],
                         "no_publish_time")  # no timezone  # fmt: skip


class ScoreTests(unittest.TestCase):
    def test_bearish_flips_sign_and_neutral_has_none(self):
        bear = bt.score_opinion(opinion(sentiment="bearish"), STOCK, SPY, (4,))
        self.assertEqual(bear["horizons"][4]["signed_excess_pct"], -8.0)
        flat = bt.score_opinion(opinion(sentiment="neutral"), STOCK, SPY, (4,))
        self.assertEqual(flat["horizons"][4]["excess_return_pct"], 8.0)
        self.assertIsNone(flat["horizons"][4]["signed_excess_pct"])

    def test_uncovered_horizon_is_pending_not_zero(self):
        e = bt.score_opinion(opinion(), STOCK, SPY, (4, 20))
        self.assertEqual(e["horizons"][20], {"status": "pending"})
        self.assertEqual(bt.signed_values([e], 20), [])
        late = opinion(video_published_at="2026-11-09T23:00:00+00:00")
        self.assertEqual(bt.score_opinion(late, STOCK, SPY)["status"], "pending")

    def test_missing_prices_and_missing_benchmark(self):
        self.assertEqual(bt.score_opinion(opinion(), [], SPY)["status"], "no_price_data")
        e = bt.score_opinion(opinion(), STOCK, [b for b in SPY if b["date"] != "2026-11-06"], (4,))
        self.assertEqual(e["horizons"][4]["return_pct"], 10.0)
        self.assertIsNone(e["horizons"][4]["excess_return_pct"])
        self.assertIsNone(e["horizons"][4]["signed_excess_pct"])

    def test_ticker_spelling(self):
        self.assertEqual(bt.price_symbol(" brk.b "), "BRK-B")


class DedupeTests(unittest.TestCase):
    def test_repeat_within_window_dropped_other_keys_kept(self):
        rows = [
            opinion(id="a"),
            opinion(
                id="b", video_published_at="2026-11-05T23:00:00+00:00"
            ),  # 3 days later: dropped
            opinion(id="c", video_published_at="2026-11-10T23:00:00+00:00"),  # 8 days after a: kept
            opinion(id="d", sentiment="bearish", video_published_at="2026-11-03T23:00:00+00:00"),
            opinion(id="e", channel_id="c2", video_published_at="2026-11-03T23:00:00+00:00"),
            opinion(id="f", video_published_at=None),
        ]
        self.assertEqual(
            sorted(o["id"] for o in bt.dedupe_opinions(rows, 7)), ["a", "c", "d", "e", "f"]
        )


class StatsTests(unittest.TestCase):
    def test_summarize(self):
        s = bt.summarize([2.0, 4.0, -1.0, 3.0])
        self.assertEqual(
            (s["n"], s["hit_rate_pct"], s["mean_pct"], s["median_pct"]), (4, 75.0, 2.0, 2.5)
        )
        self.assertEqual(s["t_stat"], 1.85)  # 2 / (stdev 2.1602 / 2)
        self.assertEqual(s["hit_rate_ci"], (30.1, 95.4))

    def test_empty_and_single(self):
        self.assertEqual(bt.summarize([])["mean_pct"], None)
        self.assertEqual(bt.summarize([])["n"], 0)
        self.assertIsNone(bt.summarize([1.0])["t_stat"])
        self.assertEqual(bt.wilson_interval(0, 5)[0], 0.0)
        self.assertEqual(bt.wilson_interval(5, 5)[1], 100.0)

    def test_bucket(self):
        edges = (0.5, 0.7, 0.85)
        self.assertEqual([bt.bucket(v, edges) for v in (0.2, 0.5, 0.84, 0.9, None)],
                         ["<0.5", "0.5-0.7", "0.7-0.85", ">=0.85", "unknown"])  # fmt: skip
        self.assertEqual(bt.bucket(-75, (30, 60, 80), absolute=True), "60-80")

    def test_groups_and_channel_split(self):
        def event(channel, day, signed, sentiment="bullish"):
            return {"channel_id": channel, "channel_title": channel, "sentiment": sentiment,
                    "direction": 1, "entry_date": f"2026-11-{day:02d}",
                    "horizons": {5: {"signed_excess_pct": signed}}}  # fmt: skip

        events = [event("a", 2, 4.0), event("a", 3, 2.0), event("a", 10, -6.0), event("b", 11, 1.0),
                  event("b", 12, None)]  # fmt: skip
        split = bt.split_date(events, 5)
        self.assertEqual(split, date(2026, 11, 10))
        rows = {r["channel_id"]: r for r in bt.channel_table(events, 5, split)}
        self.assertEqual(
            (rows["a"]["n"], rows["a"]["early_n"], rows["a"]["early_mean_pct"]), (3, 2, 3.0)
        )
        self.assertEqual((rows["a"]["late_n"], rows["a"]["late_mean_pct"]), (1, -6.0))
        self.assertEqual(
            (rows["b"]["n"], rows["b"]["early_n"], rows["b"]["early_mean_pct"]), (1, 0, None)
        )
        groups = bt.group_summary(events, 5, lambda e: e["sentiment"])
        self.assertEqual([(g["group"], g["n"]) for g in groups], [("bullish", 4)])


if __name__ == "__main__":
    unittest.main()
