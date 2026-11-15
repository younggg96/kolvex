"""The opinion-extraction scorer on fixed predictions with known errors (no model, no network)."""

import json
import tempfile
import unittest
from pathlib import Path

from evals.opinion_extraction import (
    gate,
    load_cases,
    main,
    read_opinions,
    score_case,
    score_runs,
)

CASES = load_cases()
CASE = {c["id"]: c for c in CASES}


def gold(case):
    """A perfect extractor's answer for one case."""
    return {
        "opinions": [
            {
                "ticker": e["ticker"],
                "sentiment": e["sentiment"],
                "summary": "测试摘要",
                "price_targets": [{"value": v} for v in e.get("price_targets", [])],
            }
            for e in case["expected"]
        ]
    }


def one(case_id, *opinions):
    return score_case(CASE[case_id], {"opinions": list(opinions)})


def op(ticker, sentiment, targets=(), summary="测试摘要"):
    return {
        "ticker": ticker,
        "sentiment": sentiment,
        "summary": summary,
        "price_targets": [{"value": v} for v in targets],
    }


class CaseFileTests(unittest.TestCase):
    def test_cases_are_well_formed(self):
        ids = [c["id"] for c in CASES]
        self.assertEqual(len(ids), len(set(ids)))
        for case in CASES:
            for e in case["expected"]:
                self.assertIn(
                    e["sentiment"], {"bullish", "bearish", "neutral", "mixed"}, case["id"]
                )
                for target in e.get("price_targets", []):
                    self.assertIn(f"{target:g}", case["transcript"], case["id"])

    def test_perfect_answers_pass_every_threshold(self):
        scored = score_runs(CASES, [{c["id"]: gold(c) for c in CASES}] * 3)
        self.assertEqual(scored["failures"], [])
        m = scored["metrics"]
        self.assertEqual(
            (m["ticker_recall"], m["sentiment_accuracy"], m["target_recall"]), (1, 1, 1)
        )
        self.assertEqual((m["invented_rate"], m["flip_rate"], m["schema_error_rate"]), (0, 0, 0))
        self.assertEqual(scored["unstable"], {})


class ScoreCaseTests(unittest.TestCase):
    def test_negation_read_as_bullish_is_a_flip(self):
        r = one("negation_bear", op("TSLA", "bullish"))
        self.assertEqual(r["flips"], ["TSLA"])
        self.assertEqual(
            gate(
                score_runs(
                    [CASE["negation_bear"]],
                    [{"negation_bear": {"opinions": [op("TSLA", "bullish")]}}],
                )["metrics"]
            )[:2],
            ["sentiment_accuracy = 0.0 (≥ 0.85)", "flip_rate = 1.0 (≤ 0.0)"],
        )

    def test_mixed_vs_neutral_is_wrong_but_not_a_flip(self):
        r = one("short_long_mixed", op("AAPL", "neutral"))
        self.assertEqual((r["wrong_sentiment"], r["flips"]), (["AAPL: neutral ≠ mixed"], []))

    def test_mention_only_may_be_omitted_or_neutral_but_not_directional(self):
        nvda = op("NVDA", "bullish")
        self.assertEqual(one("comparison_mention_only", nvda)["misread"], [])
        self.assertEqual(one("comparison_mention_only", nvda, op("AMD", "neutral"))["misread"], [])
        self.assertEqual(
            one("comparison_mention_only", nvda, op("AMD", "bullish"))["misread"],
            ["AMD as bullish"],
        )

    def test_stock_with_no_basis_is_invented(self):
        r = one("macro_no_stock", op("SPY", "bullish"))
        self.assertEqual(r["invented"], ["SPY (bullish)"])
        self.assertEqual(one("macro_no_stock")["invented"], [])

    def test_accepted_alias_matches(self):
        r = one("chinese_names_only", op("MSFT", "bullish"), op("GOOG", "neutral"))
        self.assertEqual((r["found"], r["invented"]), (["MSFT", "GOOGL"], []))

    def test_missing_stock_lowers_recall(self):
        r = one("many_tickers", op("AMZN", "bullish"), op("TSM", "bullish", [300]))
        self.assertEqual(r["not_found"], ["INTC", "NFLX"])

    def test_stop_loss_as_target_is_wrong_but_grounded(self):
        r = one("target_vs_stop", op("META", "bullish", [850, 680]))
        self.assertEqual((r["targets_found"], r["targets_correct"]), (1, 1))
        self.assertEqual((r["wrong_targets"], r["ungrounded_targets"]), (["META 680"], []))

    def test_target_not_in_transcript_is_ungrounded(self):
        r = one("clear_bull_target", op("NVDA", "bullish", [250]))
        self.assertEqual((r["targets_found"], r["ungrounded_targets"]), (0, ["NVDA 250"]))

    def test_analyst_target_quoted_by_creator_is_not_the_creators_target(self):
        r = one("quoted_consensus", op("PLTR", "bearish", [200]))
        self.assertEqual((r["wrong_targets"], r["ungrounded_targets"]), (["PLTR 200"], []))

    def test_unrecognised_sentiment_is_stored_as_neutral_and_flagged(self):
        r = one("negation_bear", op("TSLA", "看空"))
        self.assertEqual(r["sentiments"], {"TSLA": "neutral"})
        self.assertEqual(r["schema_errors"], ["TSLA: sentiment '看空' is stored as neutral"])

    def test_import_aliases_and_shapes_are_read_like_the_import(self):
        # "sell" is an import alias for bearish; "symbol" and "$" prefixes are accepted.
        opinions = read_opinions(
            [{"symbol": "$tsla", "rating": "sell", "summary": "x", "price_target": "目标 150 美元"}]
        )
        self.assertEqual(opinions[0]["ticker"], "TSLA")
        self.assertEqual(opinions[0]["sentiment"], "bearish")
        self.assertEqual(opinions[0]["targets"], [150.0])

    def test_duplicates_and_empty_summary_are_schema_errors(self):
        r = one("negation_bear", op("TSLA", "bearish", summary=""), op("TSLA", "bearish"))
        self.assertEqual(r["schema_errors"], ["TSLA: empty summary", "TSLA: duplicate opinion"])

    def test_missing_case_counts_against_recall(self):
        scored = score_runs([CASE["negation_bear"]], [{}])
        self.assertEqual(scored["metrics"]["missing_rate"], 1)
        self.assertEqual(scored["metrics"]["ticker_recall"], 0)

    def test_direction_changing_between_runs_is_reported(self):
        runs = [{"negation_bear": {"opinions": [op("TSLA", s)]}} for s in ("bearish", "neutral")]
        self.assertEqual(
            score_runs([CASE["negation_bear"]], runs)["unstable"],
            {"negation_bear/TSLA": ["bearish", "neutral"]},
        )


class CliTests(unittest.TestCase):
    def test_missing_or_broken_files_exit_2_without_traceback(self):
        with tempfile.TemporaryDirectory() as tmp:
            broken = Path(tmp, "broken.json")
            broken.write_text("{not json", encoding="utf-8")
            self.assertEqual(main(["score", str(Path(tmp, "nope.json")), "--no-save"]), 2)
            self.assertEqual(main(["score", str(broken), "--no-save"]), 2)

    def test_score_exit_codes(self):
        with tempfile.TemporaryDirectory() as tmp:
            good, bad = Path(tmp, "good.json"), Path(tmp, "bad.json")
            good.write_text(json.dumps({c["id"]: gold(c) for c in CASES}), encoding="utf-8")
            bad.write_text(
                json.dumps({"negation_bear": {"opinions": [op("TSLA", "bullish")]}}),
                encoding="utf-8",
            )
            self.assertEqual(main(["score", str(good), "--no-save"]), 0)
            self.assertEqual(main(["score", str(bad), "--no-save"]), 1)


if __name__ == "__main__":
    unittest.main()
