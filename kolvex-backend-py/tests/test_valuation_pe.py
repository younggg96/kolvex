"""Verify PE model semantics with synthetic inputs; never substitute for source QA."""
from datetime import date, timedelta
import json
import unittest

from app.services.valuation.pe import comparison, historical_pe_reference, pe_reference, project_pe

MULTIPLES = {"conservative": 16, "base": 20, "optimistic": 24}


class PeCalculationTests(unittest.TestCase):
    def test_upside_and_discount_use_different_denominators(self):
        result = comparison(price=100, reference=125)
        self.assertEqual(result["price_space"], .25)
        self.assertAlmostEqual(result["premium_discount"], -.2)

    def test_price_can_be_outside_all_three_scenarios(self):
        result = pe_reference(eps=5, multiples=MULTIPLES, price=200)
        self.assertEqual(result["scenarios"]["base"]["reference_value"], 100)
        self.assertEqual(result["scenarios"]["optimistic"]["comparison"]["price_space"], -.4)

    def test_loss_or_missing_input_cannot_become_a_zero_fair_price(self):
        for value in (0, -1, None, float("nan"), float("inf"), True):
            with self.subTest(eps=value), self.assertRaises(ValueError):
                pe_reference(eps=value, multiples=MULTIPLES)

    def test_invalid_price_and_comparison_overflow_are_rejected(self):
        for price in (0, -1, False, float("inf")):
            with self.subTest(price=price), self.assertRaises(ValueError):
                comparison(price=price, reference=100)
        with self.assertRaises(ValueError):
            comparison(price=1e-300, reference=1e300)

    def test_reversed_multiples_are_not_silently_sorted(self):
        with self.assertRaisesRegex(ValueError, "ordered"):
            pe_reference(eps=5, multiples={"conservative": 24, "base": 20, "optimistic": 16})

    def test_zero_growth_does_not_change_target_and_does_not_imply_a_return(self):
        assumptions = {key: {"target_pe": value, "eps_growth": 0} for key, value in MULTIPLES.items()}
        result = project_pe(eps=5, assumptions=assumptions, as_of="2026-11-04", target_date="2027-02-04")
        self.assertEqual(result["scenarios"]["base"]["target_price"], 100)
        self.assertIsNone(result["scenarios"]["base"]["price_space"])
        self.assertEqual(result["result_kind"], "mechanical_scenario")

    def test_growth_uses_actual_target_date_and_annual_units(self):
        assumptions = {key: {"target_pe": value, "eps_growth": .2} for key, value in MULTIPLES.items()}
        result = project_pe(eps=5, assumptions=assumptions, as_of="2026-11-04", target_date="2027-02-04", price=100)
        self.assertAlmostEqual(result["years"], 92 / 365.25)
        expected = 5 * 1.2 ** (92 / 365.25) * 20
        self.assertAlmostEqual(result["scenarios"]["base"]["target_price"], expected)
        self.assertAlmostEqual(result["scenarios"]["base"]["price_space"], expected / 100 - 1)
        json.dumps(result, allow_nan=False)

    def test_negative_growth_is_allowed_above_minus_100_percent(self):
        assumptions = {key: {"target_pe": value, "eps_growth": -.2} for key, value in MULTIPLES.items()}
        result = project_pe(eps=5, assumptions=assumptions, as_of="2026-11-04", target_date="2027-11-04")
        self.assertLess(result["scenarios"]["base"]["target_price"], 100)

    def test_growth_can_make_scenarios_cross_and_must_not_relabel_results(self):
        assumptions = {key: {"target_pe": value, "eps_growth": 0} for key, value in MULTIPLES.items()}
        assumptions["conservative"]["eps_growth"] = 5
        with self.assertRaisesRegex(ValueError, "cross"):
            project_pe(eps=5, assumptions=assumptions, as_of="2026-11-04", target_date="2027-11-04")

    def test_nonfuture_target_and_invalid_growth_fail_validation(self):
        for growth, target in ((-1, "2027-11-04"), (.2, "2026-11-04"), (float("nan"), "2027-11-04")):
            assumptions = {key: {"target_pe": value, "eps_growth": growth} for key, value in MULTIPLES.items()}
            with self.subTest(growth=growth, target=target), self.assertRaises(ValueError):
                project_pe(eps=5, assumptions=assumptions, as_of="2026-11-04", target_date=target)


class HistoricalCalibrationTests(unittest.TestCase):
    def observations(self, count=252):
        first = date(2025, 1, 1)
        # Distinct sessions supplied by the validated price pipeline in production.
        return [{"date": str(first + timedelta(days=i)), "pe": 20,
                 "financial_input_id": f"input-{i % 4}"} for i in range(count)]

    def test_ties_have_half_weight_and_constant_sample_has_equal_bands(self):
        result = historical_pe_reference(self.observations(), as_of="2026-01-01", current_pe=20)
        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["percentile"], .5)
        self.assertEqual(result["multiples"], {key: 20 for key in MULTIPLES})

    def test_today_and_future_samples_do_not_change_reference(self):
        rows = self.observations()
        expected = historical_pe_reference(rows, as_of="2026-01-01", current_pe=20)
        rows += [{"date": day, "pe": 1000, "financial_input_id": "future"} for day in ("2026-01-01", "2026-01-02")]
        self.assertEqual(historical_pe_reference(rows, as_of="2026-01-01", current_pe=20), expected)

    def test_insufficient_days_or_distinct_inputs_cannot_recommend_multiples(self):
        rows = self.observations()
        for sample in (rows[:251], [{**row, "financial_input_id": "one"} for row in rows]):
            with self.subTest(size=len(sample)):
                result = historical_pe_reference(sample, as_of="2026-01-01")
                self.assertEqual(result["status"], "insufficient_reference_history")
                self.assertIsNone(result["multiples"])

    def test_invalid_samples_do_not_inflate_sample_count(self):
        rows = self.observations()
        rows[0]["pe"] = -2
        result = historical_pe_reference(rows, as_of="2026-01-01")
        self.assertEqual(result["sample_count"], 251)
        self.assertEqual(result["status"], "insufficient_reference_history")

    def test_duplicate_days_cannot_inflate_confidence(self):
        rows = self.observations()
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            historical_pe_reference(rows + [rows[0]], as_of="2026-01-01")

    def test_five_year_boundary_excludes_older_observation(self):
        rows = self.observations()
        rows.append({"date": "2020-12-31", "pe": 1000, "financial_input_id": "old"})
        self.assertEqual(historical_pe_reference(rows, as_of="2026-01-01")["sample_count"], 252)

    def test_linear_quantiles_are_reproducible(self):
        rows = self.observations()
        for i, row in enumerate(rows):
            row["pe"] = i + 1
        result = historical_pe_reference(rows, as_of="2026-01-01", current_pe=126)
        self.assertEqual(result["multiples"], {"conservative": 63.75, "base": 126.5, "optimistic": 189.25})
        self.assertAlmostEqual(result["percentile"], 125.5 / 252)


if __name__ == "__main__":
    unittest.main()
