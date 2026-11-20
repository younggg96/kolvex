"""Macro, valuation, 13F and options-flow figures join the chat's number check (no network).

Fixtures are the guardrail eval's synthetic tool results, so the shapes match what the eval sends."""

import json
import unittest

from langchain_core.messages import ToolMessage

from app.agent.answer_check import check_answer
from app.agent.financial_evidence import extract_financial_evidence
from evals.chat_guardrails import AAPL_VALUATION, BUFFETT, MACRO, OPTIONS_ACTIVITY


def evidence(name, data):
    return extract_financial_evidence(
        ToolMessage(content=json.dumps(data), name=name, tool_call_id="t")
    )


def verdict(text, name, data):
    check = check_answer(text, [], [], evidence(name, data))
    return check["matched"], check["mismatch"]


class DataEvidenceTests(unittest.TestCase):
    def test_macro_current_and_previous_readings_match_and_a_miscopy_is_flagged(self):
        self.assertEqual(
            verdict(
                "10 月 CPI 同比 2.7%，前值 2.9%；核心 CPI 3.0%。", "get_macro_indicators", MACRO
            ),
            (3, 0),
        )
        self.assertEqual(verdict("CPI 同比 2.4%。", "get_macro_indicators", MACRO), (0, 1))
        # A figure next to other words is not compared with CPI: "目标 2%" is the Fed's target.
        self.assertEqual(verdict("美联储目标 2%。", "get_macro_indicators", MACRO), (0, 0))

    def test_valuation_percentile_and_reference_values(self):
        self.assertEqual(
            verdict(
                "PE 31.2 倍，五年 82% 分位；中性参考值 $207.76。", "get_valuation", AAPL_VALUATION
            ),
            (3, 0),
        )
        self.assertEqual(
            verdict("当前市盈率 33.2 倍，分位 92%。", "get_valuation", AAPL_VALUATION), (0, 2)
        )

    def test_13f_weights_and_changes(self):
        self.assertEqual(
            verdict("AAPL 权重 24.1%，减持 13%。", "get_superinvestor_portfolio", BUFFETT), (2, 0)
        )
        self.assertEqual(
            verdict("AAPL 权重 21.4%。", "get_superinvestor_portfolio", BUFFETT), (0, 1)
        )

    def test_options_premiums(self):
        self.assertEqual(
            verdict("看涨权利金 $8.4 billion。", "get_options_activity", OPTIONS_ACTIVITY), (1, 0)
        )
        self.assertEqual(
            verdict("看涨权利金 $8.9 billion。", "get_options_activity", OPTIONS_ACTIVITY), (0, 1)
        )

    def test_errors_and_other_tools_give_no_evidence(self):
        self.assertEqual(evidence("get_valuation", {"symbol": "COST", "error": "not covered"}), [])
        self.assertEqual(evidence("get_market_buzz", {"items": [{"change_pct": 14.2}]}), [])


if __name__ == "__main__":
    unittest.main()
