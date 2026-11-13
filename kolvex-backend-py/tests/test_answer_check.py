"""Fixed answers with known errors: the checker must flag each miscopy and nothing else."""
import unittest

from app.agent.answer_check import check_answer
from app.agent.revenue_evidence import RevenueEvidence, merge_revenue_evidence

REVENUES = [
    {"symbol": "NVDA", "value": 46_743_000_000, "period_end": "2026-07-26", "year_over_year_pct": 55.6},
    {"symbol": "NVDA", "value": 30_040_000_000, "period_end": "2025-07-27"},
]
QUOTES = [{"symbol": "NVDA", "price": 177.82}]


def verdicts(text):
    check = check_answer(text, QUOTES, REVENUES)
    return {claim["text"]: claim["status"] for claim in check["claims"]}


class AnswerCheckTests(unittest.TestCase):
    def test_correct_and_rounded_figures_match(self):
        self.assertEqual(verdicts(
            "NVDA revenue was $46.7 billion, up 56% year over year from $30.04B. Shares trade at $177.82."
        ), {"$46.7 billion": "matched", "56%": "matched", "$30.04B": "matched", "$177.82": "matched"})

    def test_chinese_units_match(self):
        self.assertEqual(verdicts("营收 467.4 亿美元，同比增长 55.6%。"),
                         {"467.4 亿": "matched", "55.6%": "matched"})

    def test_wrong_amount_unit_and_percentage_are_mismatches(self):
        self.assertEqual(verdicts("Revenue was $49.2B."), {"$49.2B": "mismatch"})
        self.assertEqual(verdicts("Revenue was $46.7 million."), {"$46.7 million": "mismatch"})
        self.assertEqual(verdicts("营收同比增长 65%。"), {"65%": "mismatch"})
        # NT$1,494,243 million written as "1,494,243 亿" is 100x too large.
        check = check_answer("该季营收（NT$1,494,243 亿）", [], [
            {"symbol": "TSM", "value": 1_494_243_284_000, "period_end": "2026-09-30"}])
        self.assertEqual([c["status"] for c in check["claims"]], ["mismatch"])

    def test_correct_arithmetic_on_evidence_is_matched(self):
        # 467.43 - 300.40 = 167.03 亿; 467.43 / 300.40 - 1 = 55.6%
        self.assertEqual(verdicts("营收较上年同期增加约 167.0 亿美元，同比 55.6%。"),
                         {"167.0 亿": "matched", "55.6%": "matched"})
        self.assertEqual(verdicts("营收较上年同期增加约 494.8 亿美元。"), {"494.8 亿": "mismatch"})

    def test_ratio_of_two_evidence_amounts_is_matched(self):
        rev = [{"symbol": "NVDA", "value": 96_221_000_000, "period_end": "2026-07-26"},
               {"symbol": "AMD", "value": 13_377_000_000, "period_end": "2026-09-26"}]
        check = check_answer("NVDA 营收是 AMD 的 7.2 倍。", [], rev)
        self.assertEqual([c["status"] for c in check["claims"]], ["matched"])
        self.assertEqual([c["status"] for c in check_answer("NVDA 营收是 AMD 的 9 倍。", [], rev)["claims"]],
                         ["unverified"])

    def test_taiwan_compound_amounts(self):
        check = check_answer("合并营收新台币 1 兆 460.9 亿元。", [], [
            {"symbol": "TSM", "value": 1_046_090_000_000, "period_end": "2025-12-31"}])
        self.assertEqual([c["status"] for c in check["claims"]], ["matched"])

    def test_other_figures_near_a_correctly_stated_value_are_not_mismatches(self):
        # Production answer: revenue stated correctly, then guidance and another quarter nearby.
        self.assertEqual(verdicts("营收 467.4 亿美元；下季营收指引 500 亿美元，上一季营收 441 亿美元。"),
                         {"467.4 亿": "matched", "500 亿": "unverified", "441 亿": "unverified"})
        # A unit slip is still a mismatch even when the value is also stated correctly.
        self.assertEqual(verdicts("营收 467.4 亿美元（即 4.674 亿美元）。")["4.674 亿"], "mismatch")

    def test_growth_direction_must_match_the_sign(self):
        down = [{"symbol": "INTC", "value": 12_000_000_000, "period_end": "2026-09-27", "year_over_year_pct": -3.2}]
        verdict = lambda text: [c["status"] for c in check_answer(text, [], down)["claims"]]
        self.assertEqual(verdict("营收同比下降 3.2%。"), ["matched"])
        self.assertEqual(verdict("Revenue fell 3.2% year over year."), ["matched"])
        self.assertEqual(verdict("营收同比增长 3.2%。"), ["mismatch"])
        self.assertEqual(verdict("Revenue rose 3.2% YoY."), ["mismatch"])
        self.assertEqual(verdict("同比 -3.2%。"), ["matched"])
        self.assertEqual(verdict("同比变化 3.2%。"), ["matched"])  # no direction stated
        self.assertEqual(verdicts("营收同比下降 55.6%。"), {"55.6%": "mismatch"})

    def test_bounds_are_not_mismatches(self):
        self.assertEqual(verdicts("同比增速超过 50%，属于高速增长。"), {"50%": "unverified"})
        self.assertEqual(verdicts("50% 以上的同比增长。"), {"50%": "unverified"})

    def test_unrelated_figures_are_unverified_not_wrong(self):
        self.assertEqual(verdicts("Gross margin was 72.4%. Analysts target $180. FY2027 Q2."),
                         {"72.4%": "unverified", "$180": "unverified"})

    def test_mismatches_are_listed_first_with_the_evidence(self):
        check = check_answer("Revenue rose 56% YoY to $49.2B.", QUOTES, REVENUES)
        self.assertEqual((check["matched"], check["mismatch"]), (1, 1))
        self.assertEqual(check["claims"][0]["expected"]["value"], 46_743_000_000)

    def test_no_evidence_means_no_check(self):
        self.assertIsNone(check_answer("Revenue was $46.7 billion.", [], []))


class MergeTests(unittest.TestCase):
    def test_plain_lookup_keeps_an_earlier_comparison(self):
        base = dict(symbol="NVDA", value=1, currency="USD", period_kind="quarterly",
                    period_start="2026-04-28", period_end="2026-07-26", filed_on="2026-08-27",
                    source_url="https://www.sec.gov/Archives/edgar/data/1/000000000126000001/0000000001-26-000001-index.html")
        found = {}
        merge_revenue_evidence(found, RevenueEvidence(**base, year_over_year_pct=55.6))
        merge_revenue_evidence(found, RevenueEvidence(**base))
        self.assertEqual(next(iter(found.values())).year_over_year_pct, 55.6)


if __name__ == "__main__":
    unittest.main()
