"""Financial correctness boundaries for the first valuation data milestone."""
from copy import deepcopy
from datetime import date
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch

from app.services.valuation.audit import audit_company, markdown_report
from app.services.valuation.eps import align_eps_to_share_basis, parse_eps_facts, split_factor, ttm_candidate
from scripts.audit_valuation_data import PARAMETERS, download_market, load_sources, save_sources, years_before


def fact(start="2025-01-01", end="2025-12-31", value=5, filed="2026-02-01", form="10-K", accession=1):
    return {"start": start, "end": end, "val": value, "filed": filed, "form": form,
            "accn": f"0000320193-26-{accession:06d}"}


def payload(*rows, unit="USD/shares"):
    return {"cik": 320193, "entityName": "Synthetic financial fixture",
            "facts": {"us-gaap": {"EarningsPerShareDiluted": {"units": {unit: list(rows)}}}}}


def candidate(data, as_of="2026-03-01"):
    return ttm_candidate(parse_eps_facts(data)["facts"], as_of)


class PointInTimeEpsTests(unittest.TestCase):
    def test_later_reexpression_cannot_change_an_earlier_snapshot(self):
        data = payload(fact(value=5), fact(value=1.25, filed="2026-04-01", form="10-K/A", accession=2))
        ledger = parse_eps_facts(data)
        self.assertEqual(len(ledger["facts"]), 2)
        self.assertEqual(ttm_candidate(ledger["facts"], "2026-03-01")["eps"], 5)
        self.assertEqual(ttm_candidate(ledger["facts"], "2026-04-02")["eps"], 1.25)

    def test_same_day_filing_is_not_available_at_date_level(self):
        self.assertEqual(candidate(payload(fact()), "2026-02-01")["status"], "not_yet_reported")
        self.assertEqual(candidate(payload(fact()), "2026-02-02")["eps"], 5)

    def test_new_incomplete_quarter_invalidates_older_annual_ttm(self):
        result = candidate(payload(
            fact(), fact("2026-01-01", "2026-03-31", 2, "2026-05-01", "10-Q", 2),
        ), "2026-05-02")
        self.assertEqual(result["period_end"], "2026-03-31")
        self.assertEqual(result["status"], "missing_quarter_eps")
        self.assertIsNone(result["eps"])

    def test_annual_minus_nine_month_eps_does_not_create_q4(self):
        result = candidate(payload(
            fact(),
            fact("2025-01-01", "2025-09-30", 3, "2025-11-01", "10-Q", 2),
            fact("2026-01-01", "2026-03-31", 2, "2026-05-01", "10-Q", 3),
        ), "2026-05-02")
        self.assertEqual(result["missing_quarter_ends"], ["2025-12-31"])
        self.assertIsNone(result["eps"])

    def test_four_direct_contiguous_quarters_can_form_a_candidate(self):
        rows = [fact(start, end, value, filed, "10-Q", i) for i, (start, end, value, filed) in enumerate([
            ("2025-01-01", "2025-03-31", 1, "2025-05-01"),
            ("2025-04-01", "2025-06-30", 1.1, "2025-08-01"),
            ("2025-07-01", "2025-09-30", 1.2, "2025-11-01"),
            ("2025-10-01", "2025-12-31", 1.3, "2026-02-01"),
        ], 1)]
        result = candidate(payload(*rows))
        self.assertEqual(result["status"], "complete")
        self.assertAlmostEqual(result["eps"], 4.6)
        self.assertEqual(result["method"], "sum_reported_quarters")
        self.assertEqual(result["input_filing_count"], 4)
        self.assertEqual(result["share_basis_status"], "unverified")

    def test_gap_is_not_interpolated(self):
        result = candidate(payload(
            fact("2025-01-01", "2025-03-31", 1, "2025-05-01", "10-Q"),
            fact("2025-07-01", "2025-09-30", 1, "2025-11-01", "10-Q", 2),
        ), "2025-11-02")
        self.assertEqual(result["missing_quarter_ends"], ["2025-06-30"])

    def test_conflicting_same_day_facts_fail_closed(self):
        result = candidate(payload(fact(value=5), fact(value=6, accession=2)))
        self.assertEqual(result["status"], "conflicting_facts")
        self.assertIsNone(result["eps"])

    def test_conflict_is_not_resolved_by_input_order(self):
        rows = [fact(value=5), fact(value=6, accession=2)]
        self.assertEqual(candidate(payload(*rows)), candidate(payload(*reversed(rows))))

    def test_zero_and_negative_eps_remain_data_but_cannot_enable_pe(self):
        for value in (0, -2):
            with self.subTest(value=value):
                result = candidate(payload(fact(value=value)))
                self.assertEqual(result["status"], "nonpositive_eps")
                self.assertEqual(result["eps"], value)

    def test_reissued_old_period_cannot_refresh_financial_freshness(self):
        result = candidate(payload(fact("2023-01-01", "2023-12-31", 5, "2026-02-01")))
        self.assertEqual(result["status"], "stale_financials")

    def test_old_filing_becomes_stale(self):
        self.assertEqual(candidate(payload(fact()), "2026-08-01")["status"], "stale_financials")

    def test_invalid_and_nonfinite_values_are_counted_not_coerced(self):
        ledger = parse_eps_facts(payload(*(fact(value=value) for value in (True, "5", None, float("nan"), float("inf")))))
        self.assertEqual(ledger["rejected"], {"invalid_value": 5})
        self.assertEqual(ledger["facts"], [])

    def test_bad_dates_accessions_and_chronology_are_rejected(self):
        data = payload(fact(filed="2025-12-01"), fact(filed="2026-02-30"),
                       {**fact(), "accn": "../../outside"}, fact(form="8-K"))
        self.assertEqual(parse_eps_facts(data)["rejected"], {
            "invalid_chronology": 1, "invalid_date": 1, "invalid_accession": 1, "unsupported_form": 1,
        })

    def test_duplicate_observation_is_not_a_new_version(self):
        self.assertEqual(len(parse_eps_facts(payload(fact(), fact()))["facts"]), 1)

    def test_currency_is_not_silently_mixed(self):
        ledger = parse_eps_facts(payload(fact(), unit="EUR/shares"))
        self.assertEqual(ledger["facts"], [])
        self.assertEqual(ledger["other_units"], ["EUR/shares"])

    def test_source_payload_is_unchanged_and_result_is_strict_json(self):
        data = payload(fact())
        original = deepcopy(data)
        json.dumps(candidate(data), allow_nan=False)
        self.assertEqual(data, original)


class SplitBasisTests(unittest.TestCase):
    splits = [{"date": "2021-07-20", "ratio": 4}, {"date": "2024-06-10", "ratio": 10}]

    def test_missing_verified_basis_emits_no_adjusted_eps(self):
        result = align_eps_to_share_basis(10, verified_basis_date=None, target_date="2026-11-04", splits=self.splits)
        self.assertEqual(result, {"status": "share_basis_unverified", "eps": None})

    def test_pure_splits_keep_pe_unchanged_when_both_inputs_share_a_basis(self):
        result = align_eps_to_share_basis(10, verified_basis_date="2020-01-01", target_date="2026-11-04", splits=self.splits)
        self.assertEqual(result["split_factor"], 40)
        self.assertEqual(result["eps"], .25)
        self.assertEqual((200 / 40) / result["eps"], 200 / 10)

    def test_already_recast_eps_is_not_split_adjusted_twice(self):
        result = align_eps_to_share_basis(.25, verified_basis_date="2024-06-10", target_date="2026-11-04", splits=self.splits)
        self.assertEqual(result["eps"], .25)
        self.assertEqual(result["split_factor"], 1)

    def test_reverse_split_is_supported(self):
        result = align_eps_to_share_basis(2, verified_basis_date="2024-01-01", target_date="2026-01-01",
                                          splits=[{"date": "2025-01-01", "ratio": .1}])
        self.assertEqual(result["eps"], 20)

    def test_invalid_or_duplicate_split_events_are_not_multiplied(self):
        for events in ([{"date": "2025-01-01", "ratio": 0}],
                       [{"date": "2025-01-01", "ratio": float("nan")}], self.splits + self.splits):
            with self.subTest(events=events), self.assertRaises(ValueError):
                split_factor(events, "2020-01-01", "2026-01-01")


class AuditTests(unittest.TestCase):
    def market(self):
        return {"symbol": "AAPL", "currency": "USD", "parameters": PARAMETERS,
                "rows": [{"date": day, "close": 100, "adj_close": 99} for day in ("2026-02-02", "2026-02-03", "2026-03-01")]}

    def test_completeness_is_not_approval_and_cutoff_session_is_excluded(self):
        result = audit_company(payload(fact()), self.market(), start="2026-01-01", as_of="2026-03-01")
        self.assertEqual(result["history"]["candidate_coverage"], 1)
        self.assertEqual(result["history"]["price_sessions"], 2)
        self.assertEqual(result["market"]["close_vs_adj_close_differing_sessions"], 2)
        self.assertFalse(result["ready_for_pe"])
        self.assertFalse(result["checks"]["eps_share_basis_verified"])

    def test_first_eligible_session_uses_observed_prices_including_holiday_gaps(self):
        market = self.market()
        market["rows"] = [{"date": day, "close": 100} for day in ("2025-07-03", "2025-07-07")]
        result = audit_company(payload(fact("2024-07-01", "2025-06-30", 5, "2025-07-03")),
                               market, start="2025-07-01", as_of="2025-07-08")
        self.assertEqual(result["history"]["events"][0]["status"], "not_yet_reported")
        self.assertEqual(result["history"]["events"][1]["effective_session"], "2025-07-07")
        self.assertEqual(result["history"]["events"][1]["status"], "complete")

    def test_empty_prices_do_not_claim_complete_history(self):
        result = audit_company(payload(fact()), {"rows": []}, start="2026-01-01", as_of="2026-03-01")
        self.assertIsNone(result["history"]["candidate_coverage"])
        self.assertFalse(result["ready_for_pe"])

    def test_duplicate_sessions_fail_instead_of_inflating_coverage(self):
        market = self.market()
        market["rows"] *= 2
        with self.assertRaises(ValueError):
            audit_company(payload(fact()), market, start="2026-01-01", as_of="2026-03-01")

    def test_nan_price_is_not_zero_or_a_successful_session(self):
        market = self.market()
        market["rows"][0]["close"] = float("nan")
        result = audit_company(payload(fact()), market, start="2026-01-01", as_of="2026-03-01")
        self.assertEqual(result["history"]["rejected_price_rows"], 1)
        self.assertEqual(result["history"]["price_sessions"], 1)

    def test_report_records_a_failed_source_without_sample_data(self):
        text = markdown_report({"as_of": "2026-03-01", "generated_at": "test", "companies": {"AAPL": {"error": "ValueError"}}})
        self.assertIn("来源读取失败", text)
        self.assertNotIn("100.0%", text)


class SourceReproductionTests(unittest.TestCase):
    def save(self, directory):
        return save_sources(directory, "AAPL", 320193, json.dumps(payload(fact())).encode(),
                            {"symbol": "AAPL", "rows": []}, fetched_at="2026-03-01T00:00:00Z",
                            start="2021-03-01", as_of="2026-03-01")

    def test_exact_source_round_trip_and_checksum_failure(self):
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            receipt = self.save(directory)
            facts, market, loaded = load_sources(directory, "AAPL", 320193, start="2021-03-01", as_of="2026-03-01")
            self.assertEqual(loaded, receipt)
            self.assertEqual(facts, payload(fact()))
            self.assertEqual(market["symbol"], "AAPL")
            (directory / receipt["files"]["sec"]["filename"]).write_text("{}")
            with self.assertRaisesRegex(ValueError, "checksum"):
                load_sources(directory, "AAPL", 320193, start="2021-03-01", as_of="2026-03-01")

    def test_different_cutoff_cannot_reuse_an_unrelated_manifest(self):
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            self.save(directory)
            with self.assertRaisesRegex(ValueError, "range differs"):
                load_sources(directory, "AAPL", 320193, start="2021-03-01", as_of="2026-03-02")

    def test_provider_explicitly_disables_dividend_adjustment(self):
        import pandas as pd
        ticker = Mock()
        ticker.history.return_value = pd.DataFrame({"Close": [100.0], "Adj Close": [99.0],
                                                    "Dividends": [.5], "Stock Splits": [4.0]},
                                                   index=[pd.Timestamp("2025-01-02", tz="America/New_York")])
        ticker.get_history_metadata.return_value = {"currency": "USD", "exchangeTimezoneName": "America/New_York"}
        with patch("yfinance.Ticker", return_value=ticker):
            result = download_market("AAPL", "2025-01-01", "2025-02-01")
        ticker.history.assert_called_once_with(start="2025-01-01", end="2025-02-01", **PARAMETERS)
        self.assertEqual(result["rows"][0]["close"], 100)
        self.assertEqual(result["rows"][0]["adj_close"], 99)
        self.assertEqual(result["splits"], [{"date": "2025-01-02", "ratio": 4}])

    def test_leap_year_lookback(self):
        self.assertEqual(years_before(date(2024, 2, 29), 5), date(2019, 2, 28))


if __name__ == "__main__":
    unittest.main()
