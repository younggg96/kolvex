import json
import unittest

from langchain_core.messages import ToolMessage

from app.agent.answer_check import check_answer
from app.agent.financial_evidence import extract_financial_evidence

YAHOO = {"symbol": "NVDA", "gross_margins": 0.733, "profit_margins": 0.556, "pe_ratio": 45.21,
         "net_income": 86_600_000_000, "revenue_growth": -0.032, "forward_pe": None}


def evidence(data=YAHOO, name="get_stock_financials", status="success"):
    return extract_financial_evidence(ToolMessage(content=json.dumps(data), name=name, tool_call_id="t", status=status))


def verdicts(text):
    return {c["text"]: c["status"] for c in check_answer(text, [], [], evidence())["claims"]}


class ExtractTests(unittest.TestCase):
    def test_fractions_become_percentages_and_gaps_are_skipped(self):
        items = {i["label"]: i for i in evidence()}
        self.assertAlmostEqual(items["NVDA gross margin (Yahoo Finance)"]["value"], 73.3)
        self.assertEqual(items["NVDA trailing P/E (Yahoo Finance)"]["kind"], "multiple")
        self.assertNotIn("NVDA forward P/E (Yahoo Finance)", items)

    def test_errors_and_other_tools_give_nothing(self):
        self.assertEqual(evidence({"error": "Failed"}), [])
        self.assertEqual(evidence(name="get_stock_quote"), [])
        self.assertEqual(evidence(status="error"), [])


class CheckTests(unittest.TestCase):
    def test_correct_figures_match(self):
        self.assertEqual(verdicts("毛利率 73.3%，净利率约 56%，市盈率约 45.2 倍，净利润 866 亿美元。"),
                         {"73.3%": "matched", "56%": "matched", "45.2": "matched", "866 亿": "matched"})
        self.assertEqual(verdicts("Trades at 45x trailing earnings."), {"45x": "matched"})

    def test_named_metric_off_by_a_little_is_a_mismatch(self):
        self.assertEqual(verdicts("毛利率 78%。"), {"78%": "mismatch"})
        self.assertEqual(verdicts("P/E 52.0。"), {"52.0": "mismatch"})
        self.assertEqual(verdicts("净利润 86.6 亿美元。"), {"86.6 亿": "mismatch"})  # 100x unit slip

    def test_unnamed_or_other_figures_stay_unverified(self):
        self.assertEqual(verdicts("数据中心占 78%。"), {"78%": "unverified"})
        self.assertEqual(verdicts("ROE 30%。"), {"30%": "unverified"})

    def test_growth_sign_is_checked_but_margins_are_not(self):
        self.assertEqual(verdicts("营收增长 3.2%。"), {"3.2%": "mismatch"})
        self.assertEqual(verdicts("营收增长下降 3.2%。"), {"3.2%": "matched"})


if __name__ == "__main__":
    unittest.main()
