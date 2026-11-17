"""13F simulated returns: snapshots, pricing, chaining and the background refresh, all faked."""

import asyncio
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

from app.services.sec import performance
from app.services.sec.performance import (
    BENCHMARK,
    METHOD_VERSION,
    PerformanceStore,
    PriceBook,
    is_quarter_end,
    quarter_ends,
    quarter_snapshot,
    simulate,
)


def quarter(period, positions, equity=None):
    return {
        "period": period,
        "equity_value": equity if equity is not None else sum(v for _, v in positions),
        "positions_count": len(positions),
        "positions": [{"cusip": c, "issuer": c, "value": v} for c, v in positions],
    }


def book(table, latest):
    """table: {symbol: {date: close}}; latest: {symbol: (date, close)}."""
    return lambda s: {"closes": table[s], "latest": latest[s]} if s in table else None


class SnapshotTests(unittest.TestCase):
    def test_keeps_long_shares_aggregated_and_scaled(self):
        rows = [
            {
                "cusip": "aaa000001",
                "issuer": "A",
                "value": 30,
                "shares": 1,
                "share_type": "SH",
                "put_call": None,
            },
            {
                "cusip": "AAA000001",
                "issuer": "A",
                "value": 10,
                "shares": 1,
                "share_type": "SH",
                "put_call": None,
            },
            {
                "cusip": "BBB000002",
                "issuer": "B",
                "value": 50,
                "shares": 1,
                "share_type": "SH",
                "put_call": "Call",
            },
            {
                "cusip": "CCC000003",
                "issuer": "C",
                "value": 20,
                "shares": 1,
                "share_type": "PRN",
                "put_call": None,
            },
            {
                "cusip": "DDD000004",
                "issuer": "D",
                "value": 5,
                "shares": 1,
                "share_type": "SH",
                "put_call": None,
            },
        ]
        snap = quarter_snapshot(rows, "2022-12-31", top=1)  # before 2023: thousands
        self.assertEqual(snap["equity_value"], 45_000)
        self.assertEqual(snap["positions_count"], 2)
        self.assertEqual(
            snap["positions"], [{"cusip": "AAA000001", "issuer": "A", "value": 40_000}]
        )

    def test_quarter_dates(self):
        self.assertTrue(is_quarter_end("2024-12-31"))
        self.assertTrue(is_quarter_end("2024-06-30"))
        self.assertFalse(is_quarter_end("2024-06-29"))
        self.assertFalse(is_quarter_end("bad"))
        self.assertEqual(
            quarter_ends(date(2024, 5, 1), date(2025, 1, 2)),
            ["2024-06-30", "2024-09-30", "2024-12-31"],
        )


class SimulateTests(unittest.TestCase):
    def setUp(self):
        self.table = {
            "AAA": {"2025-03-31": 10.0, "2025-06-30": 11.0},
            "BBB": {"2025-03-31": 20.0, "2025-06-30": 18.0},
            BENCHMARK: {"2025-03-31": 100.0, "2025-06-30": 105.0},
        }
        self.latest = {
            "AAA": ("2025-08-01", 12.1),
            "BBB": ("2025-08-01", 18.0),
            BENCHMARK: ("2025-08-01", 105.0),
        }
        self.tickers = {"A1": "AAA", "B1": "BBB"}

    def test_chains_value_weighted_quarters(self):
        result = simulate(
            [quarter("2025-03-31", [("A1", 75), ("B1", 25)]), quarter("2025-06-30", [("A1", 100)])],
            self.tickers,
            book(self.table, self.latest),
        )
        self.assertEqual(result["status"], "ready")
        # Q1: 0.75*10% + 0.25*-10% = 5%; Q2: AAA 11 -> 12.1 = 10%.
        self.assertAlmostEqual(result["quarters"][0]["return"], 0.05)
        self.assertAlmostEqual(result["total_return"], 1.05 * 1.10 - 1)
        self.assertAlmostEqual(result["benchmark_return"], 0.05)
        self.assertEqual(
            [p["date"] for p in result["points"]], ["2025-03-31", "2025-06-30", "2025-08-01"]
        )
        self.assertEqual(
            result["points"][0], {"date": "2025-03-31", "value": 0.0, "benchmark": 0.0}
        )
        self.assertIsNone(result["annualized_return"])  # under a year

    def test_unpriced_value_lowers_coverage_and_reweights(self):
        result = simulate(
            [quarter("2025-03-31", [("A1", 60), ("ZZ", 40)]), quarter("2025-06-30", [("A1", 100)])],
            self.tickers,
            book(self.table, self.latest),
        )
        first = result["quarters"][0]
        self.assertAlmostEqual(first["return"], 0.10)
        self.assertAlmostEqual(first["coverage"], 0.6)

    def test_curve_starts_after_a_low_coverage_quarter(self):
        self.table["AAA"]["2024-12-31"] = 9.0
        self.table[BENCHMARK]["2024-12-31"] = 90.0
        result = simulate(
            [
                quarter("2024-12-31", [("A1", 10), ("ZZ", 90)]),
                quarter("2025-03-31", [("A1", 100)]),
                quarter("2025-06-30", [("A1", 100)]),
            ],
            self.tickers,
            book(self.table, self.latest),
        )
        self.assertEqual(result["start"], "2025-03-31")
        self.assertEqual(result["dropped_quarters"], 1)

    def test_too_few_usable_quarters_is_insufficient(self):
        result = simulate(
            [quarter("2025-06-30", [("A1", 100)])], self.tickers, book(self.table, self.latest)
        )
        self.assertEqual((result["status"], result["points"]), ("insufficient", []))

    def test_missing_filing_gap_breaks_the_curve(self):
        self.table["AAA"]["2024-09-30"] = 8.0
        self.table[BENCHMARK]["2024-09-30"] = 80.0
        result = simulate(
            [
                quarter("2024-09-30", [("A1", 100)]),  # next filing is two quarters later
                quarter("2025-03-31", [("A1", 100)]),
                quarter("2025-06-30", [("A1", 100)]),
            ],
            self.tickers,
            book(self.table, self.latest),
        )
        self.assertEqual(result["start"], "2025-03-31")

    def test_stale_latest_close_is_not_used(self):
        self.latest["AAA"] = ("2025-06-30", 11.0)  # a month older than the benchmark's latest
        result = simulate(
            [quarter("2025-03-31", [("A1", 100)]), quarter("2025-06-30", [("A1", 100)])],
            self.tickers,
            book(self.table, self.latest),
        )
        self.assertEqual(result["status"], "insufficient")

    def test_missing_benchmark_raises(self):
        with self.assertRaises(ValueError):
            simulate([quarter("2025-03-31", [("A1", 1)])], self.tickers, lambda s: None)


class PriceBookTests(unittest.TestCase):
    def test_indexes_last_close_within_a_week(self):
        calls = []

        def downloader(symbols, start, end):
            calls.append(list(symbols))
            return {"AAA": [("2025-06-27", 10.0), ("2025-09-15", 11.0)], "BBB": []}

        prices = PriceBook(today=date(2025, 10, 1), downloader=downloader)
        asyncio.run(prices.load({"AAA", "BBB"}))
        asyncio.run(prices.load({"AAA"}))
        self.assertEqual(calls, [["AAA", "BBB"]])
        self.assertEqual(
            prices.get("AAA")["closes"], {"2025-06-30": 10.0}
        )  # 2025-09-30 is 15 days stale
        self.assertEqual(prices.get("AAA")["latest"], ("2025-09-15", 11.0))
        self.assertIsNone(prices.get("BBB"))

    def test_failed_download_is_tracked(self):
        def downloader(symbols, start, end):
            raise RuntimeError("yahoo down")

        prices = PriceBook(today=date(2025, 10, 1), downloader=downloader)
        asyncio.run(prices.load({"AAA"}))
        self.assertEqual(prices.failed, {"AAA"})


def filing(accession, period, form="13F-HR"):
    return {"form": form, "accession": accession, "period": period, "filed": period}


class FakeSec:
    def __init__(self, filings, rows):
        self.filings, self.rows, self.fetched = filings, rows, []

    async def submissions(self, cik):
        columns = {
            "form": "form",
            "accessionNumber": "accession",
            "reportDate": "period",
            "filingDate": "filed",
        }
        recent = {
            column: [filing[field] for filing in self.filings] for column, field in columns.items()
        }
        return {"cik": cik, "filings": {"recent": recent}}

    async def holdings_filing(self, cik, f):
        self.fetched.append(f["accession"])
        return self.rows[f["accession"]]


class FakeRepo:
    def __init__(self, stored=None, index=None):
        self.quarter_rows = dict(stored or {})
        self.saved = []
        self.index = index or []

    def accessions(self, manager_id):
        return {a for a, r in self.quarter_rows.items() if r["manager_id"] == manager_id}

    def save_quarter(self, row):
        self.quarter_rows[row["accession"]] = row

    def quarters(self, accessions):
        return sorted((dict(self.quarter_rows[a]) for a in accessions), key=lambda r: r["period"])

    def performance_index(self):
        return self.index

    def save_performance(self, row):
        self.saved.append(row)


class FakeTickers:
    async def load(self):
        pass

    def remember(self, known):
        pass

    async def resolve(self, cusips, wait=False):
        return {"AAA000001": "AAA", "BBB000002": None}


class FakeHoldings:
    def known_tickers(self, cusips):
        return {}


def sh(cusip, value):
    return {
        "cusip": cusip,
        "issuer": cusip,
        "value": value,
        "shares": 1,
        "share_type": "SH",
        "put_call": None,
    }


class StoreTests(unittest.TestCase):
    def make(self, downloader, stored=None, index=None):
        filings = [
            filing("0000000001-25-000003", "2025-06-30"),
            filing("0000000001-25-000002", "2025-03-31", form="13F-HR/A"),
            filing("0000000001-25-000001", "2025-03-31"),
            filing("0000000001-15-000001", "2015-03-31"),  # outside the window
        ]
        rows = {f["accession"]: [sh("AAA000001", 100), sh("BBB000002", 1)] for f in filings}
        self.sec = FakeSec(filings, rows)
        self.repo = FakeRepo(stored, index)
        store = PerformanceStore(
            repo=self.repo,
            sec=self.sec,
            tickers=FakeTickers(),
            holdings=FakeHoldings(),
            book=lambda: PriceBook(today=date(2025, 8, 2), downloader=downloader),
        )
        return store

    @staticmethod
    def prices(symbols, start, end):
        series = {
            "AAA": [("2025-03-31", 10.0), ("2025-06-30", 11.0), ("2025-08-01", 12.0)],
            BENCHMARK: [("2025-03-31", 100.0), ("2025-06-30", 101.0), ("2025-08-01", 102.0)],
        }
        return {s: series.get(s, []) for s in symbols}

    def test_refresh_backfills_once_and_saves_the_curve(self):
        stored = {
            "0000000001-25-000001": {
                "accession": "0000000001-25-000001",
                "manager_id": "pershing",
                "period": "2025-03-31",
                "filed": "2025-05-15",
                "equity_value": "101",
                "positions_count": 2,
                "positions": [
                    {"cusip": "AAA000001", "issuer": "A", "value": 100},
                    {"cusip": "BBB000002", "issuer": "B", "value": 1},
                ],
            }
        }
        store = self.make(self.prices, stored)
        self.assertEqual(asyncio.run(store.refresh("pershing")), "ready")
        self.assertEqual(
            self.sec.fetched, ["0000000001-25-000003"]
        )  # stored one and the amendment skipped
        saved = self.repo.saved[0]
        self.assertEqual((saved["manager_id"], saved["latest_period"]), ("pershing", "2025-06-30"))
        self.assertAlmostEqual(saved["result"]["total_return"], 1.1 * (12 / 11) - 1)

    def test_price_failure_keeps_the_previous_curve(self):
        def broken(symbols, start, end):
            raise RuntimeError("yahoo down")

        store = self.make(broken)
        self.assertIsNone(asyncio.run(store.refresh("pershing")))
        self.assertEqual(self.repo.saved, [])

    def test_refresh_due_skips_fresh_rows(self):
        fresh = datetime.now(timezone.utc).isoformat()
        old = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        index = [
            {"manager_id": "pershing", "method_version": METHOD_VERSION, "computed_at": fresh},
            {"manager_id": "berkshire", "method_version": METHOD_VERSION, "computed_at": old},
        ]
        store = self.make(self.prices, index=index)
        done = []

        async def refresh(manager, book=None):
            done.append(manager)

        store.refresh = refresh
        with patch.object(
            performance, "MANAGERS", {"pershing": {}, "berkshire": {}, "baupost": {}}
        ):
            asyncio.run(store.refresh_due())
        self.assertEqual(done, ["berkshire", "baupost"])


if __name__ == "__main__":
    unittest.main()
