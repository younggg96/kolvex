import unittest
from unittest.mock import Mock, patch

from tradingagents.graph.signal_processing import (
    SIGNAL_SCHEMA_VERSION,
    SignalProcessor,
    TradingSignal,
    parse_rating,
)
from app.services import trading_analysis_service as service

VERDICT = (
    "After weighing both sides we recommend accumulating on dips toward $120, "
    "exit if it closes below $110.\nFINAL TRANSACTION PROPOSAL: **BUY**"
)
GOOD = {
    "rating": "buy", "conviction": 0.7, "horizon_days": 20,
    "entry_plan": "Limit buys near $120", "invalidation": "Close below $110",
    "stop_loss_pct": 8, "take_profit_pct": 15,
    "key_reasons": ["AI demand", " ", "margin expansion"], "key_risks": ["valuation"],
}


def llm_returning(value=None, error=None):
    structured = Mock()
    if error:
        structured.invoke.side_effect = error
    else:
        structured.invoke.return_value = value
    llm = Mock()
    llm.with_structured_output.return_value = structured
    return llm


class ParseRatingTests(unittest.TestCase):
    def test_explicit_proposal_line_wins(self):
        self.assertEqual(parse_rating("We could SELL later.\nFINAL TRANSACTION PROPOSAL: **HOLD**"), "HOLD")

    def test_last_bare_rating_when_no_proposal_line(self):
        self.assertEqual(parse_rating("not a buy yet, so hold"), "HOLD")

    def test_none_when_absent(self):
        self.assertIsNone(parse_rating("no decision here"))


class ExtractStructuredTests(unittest.TestCase):
    def test_structured_output_from_dict(self):
        result = SignalProcessor(llm_returning(GOOD)).extract_structured(VERDICT, "trader plan")
        self.assertEqual(result.status, "structured")
        self.assertEqual(result.signal.rating, "BUY")
        self.assertEqual(result.signal.key_reasons, ["AI demand", "margin expansion"])
        self.assertIsNone(result.error)

    def test_structured_output_from_model_instance(self):
        result = SignalProcessor(llm_returning(TradingSignal(**GOOD))).extract_structured(VERDICT)
        self.assertEqual(result.status, "structured")

    def test_extraction_contradicting_proposal_line_is_rejected(self):
        result = SignalProcessor(llm_returning({**GOOD, "rating": "SELL"})).extract_structured(VERDICT)
        self.assertEqual(result.status, "rating_only")
        self.assertEqual(result.signal.rating, "BUY")
        self.assertEqual(result.signal.conviction, 0)
        self.assertIn("verdict says BUY", result.error)

    def test_out_of_range_values_degrade_to_rating_only(self):
        result = SignalProcessor(llm_returning({**GOOD, "conviction": 3})).extract_structured(VERDICT)
        self.assertEqual(result.status, "rating_only")
        self.assertEqual(result.signal.rating, "BUY")

    def test_provider_error_degrades_to_rating_only(self):
        result = SignalProcessor(llm_returning(error=RuntimeError("timeout"))).extract_structured(VERDICT)
        self.assertEqual(result.status, "rating_only")
        self.assertIn("timeout", result.error)

    def test_unreadable_verdict_falls_back_to_hold(self):
        result = SignalProcessor(llm_returning(error=RuntimeError("x"))).extract_structured("unclear text")
        self.assertEqual(result.status, "fallback_hold")
        self.assertEqual(result.signal.rating, "HOLD")
        self.assertEqual(result.signal.conviction, 0)

    def test_empty_verdict_holds_without_calling_llm(self):
        llm = llm_returning(GOOD)
        result = SignalProcessor(llm).extract_structured("  ")
        self.assertEqual(result.status, "fallback_hold")
        llm.with_structured_output.assert_not_called()


class SignalRowTests(unittest.TestCase):
    def setUp(self):
        self.extraction = SignalProcessor(llm_returning(GOOD)).extract_structured(VERDICT)
        self.config = {"llm_provider": "openai", "quick_think_llm": "gpt-4o-mini"}

    def test_row_maps_signal_and_expiry(self):
        row = service.build_signal_row("a-1", "u-1", "nvda", "2026-11-06", self.config, self.extraction)
        self.assertEqual(row["ticker"], "NVDA")
        self.assertEqual(row["rating"], "BUY")
        self.assertEqual(row["expires_on"], "2026-11-26")
        self.assertEqual(row["extraction_status"], "structured")
        self.assertIsNone(row["extraction_error"])
        self.assertEqual(row["schema_version"], SIGNAL_SCHEMA_VERSION)
        self.assertEqual(row["model_id"], "gpt-4o-mini")
        self.assertIsNone(row["position_action"])
        self.assertIsNone(row["portfolio_context"])

    def test_save_signal_swallows_db_errors(self):
        db = Mock()
        db.table.return_value.upsert.return_value.execute.side_effect = RuntimeError("no table")
        with patch.object(service, "get_supabase_service", return_value=db):
            service._save_signal("a-1", {"analysis_id": "a-1"})
        db.table.assert_called_with(service.SIGNALS_TABLE)
        db.table.return_value.upsert.assert_called_with({"analysis_id": "a-1"}, on_conflict="analysis_id")


if __name__ == "__main__":
    unittest.main()
