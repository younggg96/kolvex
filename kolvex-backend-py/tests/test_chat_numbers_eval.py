"""The eval's scoring and gate, on fixed transcripts (no model, no network)."""
import unittest

from evals.chat_numbers import CASES, THRESHOLDS, score_run, summarize

CASE = {c.id: c for c in CASES}
REVENUES = [{"symbol": "NVDA", "value": 46_743_000_000, "period_end": "2026-07-26", "year_over_year_pct": 55.6}]
YOY_CALL = [{"name": "get_reported_revenue", "args": {"symbol": "NVDA", "year_over_year": True}}]


class ScoreRunTests(unittest.TestCase):
    def test_faithful_answer_passes(self):
        r = score_run(CASE["nvda_q_yoy"], "营收 467.4 亿美元，同比增长 55.6%。", YOY_CALL, [], REVENUES)
        self.assertTrue(r["tool_ok"])
        self.assertEqual((r["matched"], r["mismatch"], r["invented"]), (2, 0, []))

    def test_wrong_tool_arguments_fail_tool_accuracy(self):
        plain = [{"name": "get_reported_revenue", "args": {"symbol": "NVDA"}}]
        self.assertFalse(score_run(CASE["nvda_q_yoy"], "x", plain, [], REVENUES)["tool_ok"])
        annual = [{"name": "get_reported_revenue", "args": {"symbol": "AAPL", "period": "annual"}}]
        self.assertTrue(score_run(CASE["aapl_annual"], "x", annual, [], [])["tool_ok"])

    def test_disabled_tool_must_not_be_called(self):
        self.assertTrue(score_run(CASE["skill_off"], "无法查询营收。", [], [], [])["tool_ok"])

    def test_miscopied_number_is_a_mismatch(self):
        r = score_run(CASE["nvda_q_yoy"], "营收同比增长 65%。", YOY_CALL, [], REVENUES)
        self.assertEqual(r["mismatch"], 1)

    def test_figures_without_data_are_invented(self):
        r = score_run(CASE["skill_off"], "NVIDIA revenue was about $44 billion last quarter.", [], [], [])
        self.assertEqual([c["text"] for c in r["invented"]], ["$44 billion"])
        honest = score_run(CASE["skill_off"], "I could not retrieve SEC revenue data right now.", [], [], [])
        self.assertEqual(honest["invented"], [])

    def test_tool_figures_near_revenue_words_are_not_invented(self):
        r = score_run(CASE["skill_off"], "无法查询营收。总市值约 3.97 万亿美元。", [], [], [],
                      ['{"market_cap": 3970000000000}'])
        self.assertEqual(r["invented"], [])

    def test_missing_prior_year_allows_amounts_but_not_growth(self):
        cards = [{"symbol": "NVDA", "value": 46_743_000_000, "period_end": "2026-07-26"}]
        ok = score_run(CASE["no_prior_year"], "Revenue was $46.7 billion; no prior-year quarter to compare.",
                       YOY_CALL, [], cards)
        self.assertEqual(ok["invented"], [])
        bad = score_run(CASE["no_prior_year"], "Revenue was $46.7 billion, up roughly 50% year over year.",
                        YOY_CALL, [], cards)
        self.assertEqual([c["text"] for c in bad["invented"]], ["50%"])


    def test_figures_must_come_from_some_tool_output(self):
        web = ['NVIDIA reported revenue of $96.2 billion, up 106% from a year ago.']
        r = score_run(CASE["sec_unavailable"],
                      "Revenue was $96.2 billion, up 106% year over year; the prior quarter was about $81.5 billion.",
                      [], [], [], web)
        self.assertEqual([c["text"] for c in r["ungrounded"]], ["$81.5 billion"])
        sec = ['{"value": 46743000000.0, "year_over_year_pct": 55.6}']
        ok = score_run(CASE["nvda_q_yoy"], "营收 467.4 亿美元，同比增长 55.6%。", YOY_CALL, [], REVENUES, sec)
        self.assertEqual(ok["ungrounded"], [])

    def test_correct_arithmetic_on_stated_figures_is_grounded_but_wrong_math_is_not(self):
        tool = ['{"value": 478.83}, {"value": 416.16}']
        right = score_run(CASE["aapl_annual"], "Revenue 478.83 vs 416.16, up about 15.1%.", [], [], [], tool)
        self.assertEqual(right["ungrounded"], [])
        wrong = score_run(CASE["aapl_annual"], "Revenue 478.83 vs 416.16, up about 19%.", [], [], [], tool)
        self.assertEqual([c["text"] for c in wrong["ungrounded"]], ["19%"])

    def test_differences_and_rates_from_scaled_figures_are_derived(self):
        tool = ['{"value": 92283000000}, {"value": 77673000000}']
        r = score_run(CASE["msft_q_yoy_en"], "Revenue $92.28B vs $77.67B: a $14.61B increase, +18.8% YoY.",
                      [], [], [], tool)
        self.assertEqual(r["ungrounded"], [])

    def test_share_volumes_are_not_money(self):
        r = score_run(CASE["skill_off"], "营收无法查询。11 月 5 日放量下跌（3.06 亿股）。", [], [], [], [])
        self.assertEqual(r["invented"], [])

    def test_unit_slip_against_a_tool_figure_is_ungrounded(self):
        web = ["TSMC second-quarter revenue was US$40.2 billion."]
        r = score_run(CASE["foreign_filer"], "营收约 40.2 亿美元。", [], [], [], web)
        self.assertEqual([c["text"] for c in r["ungrounded"]], ["40.2 亿"])


    def test_newer_derived_period_must_be_named(self):
        quiet = score_run(CASE["q4_derived_only"], "最新季度营收 1,031 亿美元（截至 2026-10-25），未做推算调整。", [], [], [])
        told = score_run(CASE["q4_derived_only"], "截至 2027-01-31 的季度只有推算值；最新直接披露为 1,031 亿美元。", [], [], [])
        self.assertEqual((quiet["disclosed"], told["disclosed"]), (False, True))


    def test_followup_must_use_the_new_symbol(self):
        wrong = [{"name": "get_reported_revenue", "args": {"symbol": "NVDA", "year_over_year": True}}]
        right = [{"name": "get_reported_revenue", "args": {"symbol": "amd", "year_over_year": True}}]
        self.assertFalse(score_run(CASE["followup_symbol"], "x", wrong, [], [])["tool_ok"])
        self.assertTrue(score_run(CASE["followup_symbol"], "x", right, [], [])["tool_ok"])
        annual = [{"name": "get_reported_revenue", "args": {"symbol": "NVDA", "period": "annual"}}]
        self.assertTrue(score_run(CASE["followup_period"], "x", annual, [], [])["tool_ok"])


    def test_earlier_answers_and_hedged_roundings_are_sources(self):
        r = score_run(CASE["followup_symbol"], "AMD 增长 44.68%；NVDA 同期约 105.85%。", [], [], [],
                      ['{"year_over_year_pct": 44.68}'])
        self.assertEqual(r["ungrounded"], [])
        hedged = score_run(CASE["skill_off"], "股价自 10 月中旬约 $228 回落。", [], [], [], ['"close": 228.52'])
        self.assertEqual(hedged["ungrounded"], [])
        plain = score_run(CASE["skill_off"], "股价 $228 回落。", [], [], [], ['"close": 228.52'])
        self.assertEqual([c["text"] for c in plain["ungrounded"]], ["$228"])


class SummaryTests(unittest.TestCase):
    def run_row(self, case="nvda_q_yoy", tool_ok=True, mismatch=0, invented=(), no_data=False):
        return {"case": case, "tool_ok": tool_ok, "mismatch": mismatch, "invented": list(invented),
                "ungrounded": list(invented), "no_data_case": no_data}

    def test_rates_and_gate(self):
        runs = [self.run_row(), self.run_row(mismatch=1), self.run_row(tool_ok=False),
                self.run_row("skill_off", no_data=True, invented=[{"text": "$44B"}]),
                {"case": "nvda_q_yoy", "error": "boom", "no_data_case": False}]
        s = summarize(runs)
        self.assertEqual(s["overall"]["error_rate"], 0.2)
        self.assertEqual(s["overall"]["tool_accuracy"], 0.75)
        self.assertEqual(s["overall"]["mismatch_rate"], 0.25)
        self.assertEqual(s["overall"]["fabrication_rate"], 1.0)
        self.assertEqual(s["overall"]["ungrounded_rate"], 0.25)
        self.assertEqual(set(s["failed"]), set(THRESHOLDS) - {"disclosure_rate", "route_accuracy"})  # not measured here

    def test_clean_runs_pass(self):
        self.assertEqual(summarize([self.run_row(), self.run_row("skill_off", no_data=True)])["failed"], [])


if __name__ == "__main__":
    unittest.main()
