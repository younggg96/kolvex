"""Quarterly 13F sync into Supabase, with the repository, SEC and OpenFIGI faked."""
import asyncio
import copy
import unittest

from app.services.sec.holdings_store import SYNC_VERSION, InstitutionStore, response
from app.services.sec.parsers import value_multiplier


def filing(accession, period, form="13F-HR", filed=None):
    return {"form": form, "accession": accession, "period": period, "filed": filed or period}


class FakeRepo:
    def __init__(self):
        self.filings, self.rows, self.saves = {}, {}, []

    def latest(self, manager_id):
        rows = [r for r in self.filings.values() if r["manager_id"] == manager_id and r["complete"]]
        return max(rows, key=lambda r: (r["period"], r["filed"])) if rows else None

    def find(self, accession):
        return self.filings.get(accession)

    def holdings(self, accession):
        return self.rows[accession]

    def known_tickers(self, cusips):
        return {h["cusip"]: h["ticker"] for rows in self.rows.values() for h in rows if h.get("ticker") and h["cusip"] in cusips}

    def save(self, data, mapped):
        f = data["filing"]
        old = self.filings.get(f["accession"], {})
        self.filings[f["accession"]] = {"accession": f["accession"], "manager_id": data["id"], "manager_name": data["name"],
            "cik": data["cik"], "period": f["period"], "filed": f["filed"], "filing": f,
            "previous_filing": data.get("previous_filing"), "amendments": data.get("amendments") or [],
            "partial": data.get("partial"), "coverage": None, "summary": {"id": data["id"]},
            "sec_fetched_at": "t", "synced_at": "t", "complete": True, "sync_version": SYNC_VERSION,
            "tickers_mapped_at": "t" if mapped else old.get("tickers_mapped_at")}
        self.rows[f["accession"]] = copy.deepcopy(data["holdings"])
        self.saves.append((f["accession"], mapped, [h.get("ticker") for h in data["holdings"]]))


class FakeSec:
    def __init__(self, filings, holdings):
        self.filings, self.holdings, self.fetches = filings, holdings, 0

    async def submissions(self, cik):
        return {"cik": cik}

    async def institution(self, manager):
        self.fetches += 1
        current = next(r for r in self.filings if r["form"] == "13F-HR")
        return {"name": "Pershing Square", "cik": 1336528, "filing": current, "previous_filing": None,
                "holdings": copy.deepcopy(self.holdings), "partial": False,
                "amendments": [r for r in self.filings if r["form"] == "13F-HR/A"]}


class FakeTickers:
    def __init__(self, known):
        self.known, self.sent = known, set()

    async def attach(self, holdings, now=100):
        for h in holdings:
            h["ticker"] = self.known.get(h["cusip"]) if h["cusip"] in self.sent else None

    async def resolve(self, cusips, wait=False):
        self.sent.update(cusips)

    def pending(self, cusips):
        return [c for c in cusips if c not in self.sent]

    async def load(self):
        pass

    def remember(self, known):
        self.remembered = dict(known)
        self.known.update(known)
        self.sent.update(known)


HOLDINGS = [{"issuer": "Uber", "cusip": "90353T100", "value": 2, "activity": "unknown"},
            {"issuer": "Odd bond", "cusip": "000000000", "value": 1, "activity": "unknown"}]


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.repo = FakeRepo()
        self.sec_filings = [filing("A2", "2026-09-30")]
        self.sec = FakeSec(self.sec_filings, HOLDINGS)
        self.store = InstitutionStore(self.repo, self.sec, FakeTickers({"90353T100": "UBER"}))
        import app.services.sec.holdings_store as module
        self._filings_from, module.filings_from = module.filings_from, lambda _: self.sec_filings

    def tearDown(self):
        import app.services.sec.holdings_store as module
        module.filings_from = self._filings_from

    def run_sync(self, **kw):
        return asyncio.run(self.store.sync("pershing", **kw))

    def test_first_sync_publishes_then_fills_tickers(self):
        self.assertEqual(self.run_sync(), "synced")
        self.assertEqual(self.repo.saves, [("A2", False, [None, None]), ("A2", True, ["UBER", None])])
        data = asyncio.run(self.store.latest("pershing"))
        self.assertEqual(data["filing"]["accession"], "A2")
        self.assertEqual([h["ticker"] for h in data["holdings"]], ["UBER", None])

    def test_no_new_filing_skips_sec(self):
        self.run_sync()
        self.assertEqual(self.run_sync(), "current")
        self.assertEqual(self.sec.fetches, 1)

    def test_new_quarter_and_amendment_resync(self):
        self.run_sync()
        self.sec_filings.insert(0, filing("A3", "2026-12-31"))
        self.assertEqual(self.run_sync(), "synced")
        self.assertEqual(asyncio.run(self.store.latest("pershing"))["filing"]["accession"], "A3")
        self.sec_filings.insert(0, filing("A3-amend", "2026-12-31", form="13F-HR/A"))
        self.assertEqual(self.run_sync(), "synced")
        self.assertEqual(self.sec.fetches, 3)
        self.assertEqual(self.run_sync(), "current")

    def test_unmapped_snapshot_only_remaps(self):
        self.store.tickers.resolve = lambda cusips, wait=False: asyncio.sleep(0)  # OpenFIGI window exhausted
        self.run_sync()
        self.assertIsNone(self.repo.filings["A2"]["tickers_mapped_at"])
        self.store.tickers = FakeTickers({"90353T100": "UBER"})
        self.assertEqual(self.run_sync(), "synced")
        self.assertEqual(self.repo.saves[-1], ("A2", True, ["UBER", None]))
        self.assertEqual(len(self.repo.saves), 3)  # remap skips the quick first write

    def test_publish_pass_skips_ticker_wait(self):
        self.assertEqual(self.run_sync(map_all=False), "published")
        self.assertEqual(self.repo.saves, [("A2", False, [None, None])])
        self.assertEqual(self.run_sync(map_all=False), "current")
        self.assertEqual(self.run_sync(), "synced")
        self.assertEqual(self.repo.saves[-1], ("A2", True, ["UBER", None]))

    def test_older_parser_rows_resync(self):
        self.run_sync()
        self.repo.filings["A2"]["sync_version"] = SYNC_VERSION - 1
        self.assertEqual(self.run_sync(), "synced")
        self.assertEqual(self.sec.fetches, 2)

    def test_stored_tickers_survive_cache_loss(self):
        self.run_sync()
        self.store.tickers = FakeTickers({})  # fresh process: empty cache, OpenFIGI knows nothing
        self.assertEqual(self.run_sync(force=True), "synced")
        self.assertEqual(self.store.tickers.remembered, {"90353T100": "UBER"})
        self.assertEqual(self.repo.saves[-2], ("A2", False, ["UBER", None]))

    def test_missing_snapshot_reads_none(self):
        self.assertIsNone(asyncio.run(self.store.latest("pershing")))
        self.assertIsNone(asyncio.run(self.store.summary("pershing")))

    def test_response_matches_live_shape(self):
        self.run_sync()
        row = self.repo.latest("pershing")
        self.assertEqual(set(response(row, [])), {"id", "name", "cik", "source", "fetched_at", "synced_at", "filing",
            "previous_filing", "holdings", "partial", "amendments", "coverage"})


class ValueUnitTests(unittest.TestCase):
    def rows(self, *pairs):
        return [{"value": v, "shares": n, "share_type": "SH", "put_call": None} for v, n in pairs]

    def test_dollar_table_kept(self):
        self.assertEqual(value_multiplier(self.rows((65_950_296_923, 227_917_808), (100_000, 2_000)), "2026-06-30"), 1)

    def test_thousands_table_after_2023_scaled(self):
        # Baupost Q2 2026: AMZN 3,743,854 shares reported as 892,310.
        self.assertEqual(value_multiplier(self.rows((892_310, 3_743_854), (493_140, 1_275_154), (489_612, 6_753_112)), "2026-06-30"), 1000)

    def test_pre_2023_always_thousands_and_options_ignored(self):
        self.assertEqual(value_multiplier([], "2022-12-31"), 1000)
        rows = self.rows((5_000_000, 10_000)) + [{"value": 1, "shares": 10_000, "share_type": "SH", "put_call": "Put"}]
        self.assertEqual(value_multiplier(rows, "2026-06-30"), 1)


if __name__ == "__main__":
    unittest.main()
