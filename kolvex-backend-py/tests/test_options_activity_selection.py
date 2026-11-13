import asyncio
import unittest
from datetime import date

from app.services.options_activity import aggregate, selection
from app.services.options_activity.universe import ACTIVE_LIMIT, KOL_LIMIT, MANUAL_LIMIT, MAX_UNIVERSE, MOVERS_LIMIT, UNIVERSE

TODAY = date(2026, 11, 6)


def fetcher(symbols=None, error=None):
    async def fetch():
        if error:
            raise error
        return symbols
    return fetch


def scan(symbol, call_volume, sources):
    rows = [{"symbol": f"{symbol}C", "type": "call", "strike": 100.0, "expiration": "2026-11-20", "volume": call_volume,
             "open_interest": 10, "vwap": 1.0, "bid": None, "ask": None, "last": None, "close": None,
             "multiplier": 100, "gamma": None, "iv": None, "delta": None}]
    return {"symbol": symbol, "is_etf": False, "rows": rows, "earnings": None, "sources": sources,
            "stock": {"price": 100.0, "change_pct": 1.0, "bar_date": TODAY.isoformat()}}


class SelectionTests(unittest.TestCase):
    def test_core_first_then_dynamic_groups_with_reasons(self):
        symbols, sources = asyncio.run(selection.select_universe({
            "movers": fetcher(["ZZZA", "NVDA", "$zzzb"]),
            "active": fetcher(["ZZZA", "ZZZC"]),
            "reddit": fetcher(["ZZZD", "BRK.B", "ZZZF"]),
            "x": fetcher([("ZZZD", 1), ("ZZZE", 2), ("ZZZG", 1)]),
            "youtube": fetcher(error=RuntimeError("db down")),
        }))
        self.assertEqual(symbols[:len(UNIVERSE)], list(UNIVERSE))
        self.assertEqual(symbols[len(UNIVERSE):], ["ZZZA", "ZZZB", "ZZZC", "ZZZD", "ZZZE"])
        self.assertEqual(sources["NVDA"], ["core", "mover"])
        self.assertEqual(sources["ZZZA"], ["mover", "active"])
        self.assertEqual(sources["ZZZD"], ["kol"])  # Reddit + X
        self.assertNotIn("ZZZF", sources)  # Reddit only
        self.assertNotIn("ZZZG", sources)  # one X author only
        self.assertNotIn("BRK.B", sources)  # not a plain option underlying

    def test_every_source_failing_falls_back_to_core(self):
        down = fetcher(error=RuntimeError("down"))
        symbols, _ = asyncio.run(selection.select_universe({n: down for n in selection.DEFAULT_SOURCES}))
        self.assertEqual(symbols, list(UNIVERSE))

    def test_group_limits_and_total_cap(self):
        many = lambda prefix: [f"{prefix}{chr(65 + i // 26)}{chr(65 + i % 26)}" for i in range(100)]
        symbols, sources = selection.combine(UNIVERSE, many("M"), many("A"), many("K"))
        added = [s for s in symbols if "core" not in sources[s]]
        self.assertEqual(sum(sources[s] == ["mover"] for s in added), MOVERS_LIMIT)
        self.assertEqual(sum(sources[s] == ["active"] for s in added), ACTIVE_LIMIT)
        self.assertEqual(sum(sources[s] == ["kol"] for s in added), KOL_LIMIT)
        self.assertLessEqual(len(symbols), MAX_UNIVERSE)

    def test_movers_need_stock_dollar_volume(self):
        items = [{"symbol": "BIG", "price": 100, "volume": 3_000_000}, {"symbol": "TINY", "price": 10, "volume": 1_000_000}]
        self.assertEqual(selection.liquid(items), ["BIG"])

    def test_kol_round_robin_and_youtube_ranking(self):
        self.assertEqual(selection.interleave(["A", "B", "C"], ["X"], ["B", "Y"]), ["A", "X", "B", "Y", "C"])
        rows = [{"ticker": "AAA", "channel_id": 1}, {"ticker": "AAA", "channel_id": 1},
                {"ticker": "BBB", "channel_id": 1}, {"ticker": "BBB", "channel_id": 2}]
        self.assertEqual(selection.rank_youtube(rows), [("BBB", 2), ("AAA", 1)])


class ManualSymbolTests(unittest.TestCase):
    def test_parse_accepts_commas_spaces_cashtags_and_dedupes(self):
        self.assertEqual(selection.parse_manual(" lly, XOM，$nvda  lly "), ["LLY", "XOM", "NVDA"])
        self.assertEqual(selection.parse_manual(""), [])
        self.assertEqual(selection.parse_manual(None), [])

    def test_parse_rejects_bad_or_too_many_symbols(self):
        with self.assertRaises(ValueError):
            selection.parse_manual("LLY, BRK.B")
        with self.assertRaises(ValueError):
            selection.parse_manual(" ".join(f"A{chr(65 + i // 26)}{chr(65 + i % 26)}" for i in range(MANUAL_LIMIT + 1)))

    def test_add_manual_appends_new_and_tags_existing(self):
        symbols, sources = selection.add_manual(["SPY", "MOD"], {"SPY": ["core"], "MOD": ["mover"]}, ["MOD", "LLY"])
        self.assertEqual(symbols, ["SPY", "MOD", "LLY"])
        self.assertEqual(sources, {"SPY": ["core"], "MOD": ["mover", "manual"], "LLY": ["manual"]})


class CoreMarketTests(unittest.TestCase):
    def test_market_totals_cover_core_only_but_rankings_include_dynamic(self):
        report = aggregate.build_report([scan("AAA", 10, ["core"]), scan("HOT", 500, ["kol"])], [], TODAY)
        market = report["market"]
        self.assertEqual(market["call_premium"], 1000)  # 10 contracts * $1 * 100, HOT excluded
        self.assertEqual((market["tickers_scanned"], market["dynamic_scanned"]), (1, 1))
        self.assertEqual(report["contributors"]["positive"][0]["symbol"], "HOT")
        self.assertEqual(report["contributors"]["positive"][0]["sources"], ["kol"])
        self.assertEqual(report["contracts"][0]["underlying"], "HOT")

    def test_scans_without_sources_count_as_core(self):
        legacy = scan("AAA", 10, None)
        legacy.pop("sources")
        self.assertEqual(aggregate.build_report([legacy], [], TODAY)["market"]["tickers_scanned"], 1)


if __name__ == "__main__":
    unittest.main()
