"""Fiscal period selection, derived quarters and filing classification for SEC facts."""
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("sec_parsers", Path(__file__).resolve().parents[1] / "app/services/sec/parsers.py")
parsers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parsers)
ACCN = "0000320193-26-000001"


def fact(start, end, val, form="10-K", filed="2026-01-01"):
    row = {"end": end, "val": val, "form": form, "filed": filed, "accn": ACCN}
    return {**row, "start": start} if start else row


def payload(**tags):
    return {"cik": 320193, "facts": {"us-gaap": {tag: {"units": {"USD": rows}} for tag, rows in tags.items()}}}


class FinancialHistoryTests(unittest.TestCase):
    def test_rolling_twelve_months_in_a_10q_is_not_a_fiscal_year(self):
        result = parsers.financial_history(payload(Revenues=[
            fact("2025-01-01", "2025-12-31", 100),
            fact("2025-04-01", "2026-03-31", 110, form="10-Q"),
        ]))
        self.assertEqual([r["period"] for r in result["annual"]], ["2025-12-31"])

    def test_sixteen_week_fourth_quarter_is_derived_and_completes_ttm(self):
        result = parsers.financial_history(payload(Revenues=[
            fact("2025-09-01", "2026-08-30", 100),
            fact("2025-09-01", "2025-11-23", 20, form="10-Q"),
            fact("2025-09-01", "2026-02-15", 42, form="10-Q"),
            fact("2025-11-24", "2026-02-15", 22, form="10-Q"),
            fact("2025-09-01", "2026-05-10", 65, form="10-Q"),
            fact("2026-02-16", "2026-05-10", 23, form="10-Q"),
        ]))
        latest = result["quarterly"][0]
        self.assertEqual(latest["period"], "2026-08-30")
        self.assertEqual(latest["revenue"], 35)
        self.assertTrue(latest["sources"]["revenue"]["derived"])
        self.assertEqual(result["ttm"]["revenue"], 100)

    def test_capex_falls_back_to_productive_assets(self):
        result = parsers.financial_history(payload(
            Revenues=[fact("2025-01-01", "2025-12-31", 100)],
            NetCashProvidedByUsedInOperatingActivities=[fact("2025-01-01", "2025-12-31", 30)],
            PaymentsToAcquireProductiveAssets=[fact("2025-01-01", "2025-12-31", 10)],
        ))
        self.assertEqual(result["annual"][0]["free_cash_flow"], 20)

    def test_missing_values_stay_missing(self):
        result = parsers.financial_history(payload(Revenues=[fact("2025-01-01", "2025-12-31", 100)]))
        self.assertNotIn("free_cash_flow", result["annual"][0])
        self.assertIsNone(result["annual"][0]["gross_margin"])
        self.assertIsNone(parsers.financial_history(payload())["currency"])


class FilingTests(unittest.TestCase):
    def test_item_202_identifies_earnings_8k(self):
        submissions = {"cik": 320193, "filings": {"recent": {
            "form": ["8-K", "8-K"], "accessionNumber": [ACCN, "0000320193-26-000002"],
            "filingDate": ["2026-01-02", "2026-01-01"], "reportDate": ["", ""], "primaryDocument": ["a.htm", "b.htm"],
            "primaryDocDescription": ["", ""], "items": ["2.02,9.01", "5.02"],
        }}}
        rows = parsers.filings_from(submissions)
        self.assertEqual(rows[0]["items"], ["2.02", "9.01"])
        self.assertTrue(parsers.is_earnings_filing(rows[0]))
        self.assertFalse(parsers.is_earnings_filing(rows[1]))
        self.assertTrue(parsers.is_earnings_filing({"form": "10-Q", "items": []}))


if __name__ == "__main__":
    unittest.main()


class InstitutionSummaryTests(unittest.TestCase):
    def row(self, issuer, value, activity):
        return {"issuer": issuer, "class": "COM", "cusip": issuer, "put_call": None, "value": value, "weight": None, "activity": activity}

    def test_exited_positions_count_as_changes_but_not_holdings(self):
        result = parsers.summarize_institution({"id": "x", "name": "X", "holdings": [
            self.row("A", 300, "unchanged"), self.row("B", 200, "increased"), self.row("C", 100, "new"), self.row("D", 0, "exited")]}, top=2)
        self.assertEqual(result["positions"], 3)
        self.assertEqual(result["value"], 600)
        self.assertEqual(result["changes"], {"new": 1, "increased": 1, "reduced": 0, "exited": 1})
        self.assertEqual([r["issuer"] for r in result["top"]], ["A", "B"])

    def test_uncompared_filing_reports_no_change_counts(self):
        result = parsers.summarize_institution({"holdings": [self.row("A", 1, "unknown")]})
        self.assertIsNone(result["changes"])
