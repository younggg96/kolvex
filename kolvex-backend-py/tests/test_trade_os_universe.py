"""Scan universe: fixed lists plus KOL YouTube and Reddit trending (PRD §7.2)."""

import asyncio

from app.services.trade_os import universe as u


def build(fetchers):
    return asyncio.run(u.build_universe(fetchers))


async def yt():
    return [("GME", 5), ("NVDA", 4), ("ZZZ", 3)]


async def rd():
    return [("$AMC", 1), ("TSLL", 2), ("SOXL", 3), ("TCEHY", 4), ("nvda", 5), ("TOOLONGX", 6)]


def test_static_lists_cover_many_industries_and_etfs():
    syms = u.static_universe()
    assert len(syms) == len(set(syms))
    assert {"JPM", "UNH", "XOM", "COST", "CAT", "NEE"} <= set(syms)  # sectors beyond tech
    assert {"SPY", "QQQ", "SMH", "XLE", "GLD"} <= set(syms)  # ETFs
    assert u.is_etf("SMH") and not u.is_etf("NVDA")
    assert not set(syms) & u.LEVERAGED_OR_INVERSE  # PRD §2.3: no leveraged products


def test_symbols_keep_every_source_that_named_them():
    res = build({"youtube": yt, "reddit": rd})
    assert res["sources"]["NVDA"] == ["core", "youtube", "reddit"]
    assert res["sources"]["GME"] == ["youtube"]
    assert res["sources"]["AMC"] == ["reddit"]  # "$AMC" cleaned
    assert res["sources"]["SPY"] == ["etf"]
    assert res["sources"]["JPM"] == ["sector"]
    assert res["counts"]["youtube"] == 3 and res["counts"]["reddit"] == 2


def test_leveraged_otc_and_garbage_tickers_are_dropped():
    res = build({"reddit": rd})
    for bad in ("TSLL", "SOXL", "TCEHY", "TOOLONGX"):
        assert bad not in res["sources"]


def test_trending_names_are_listed_before_fixed_lists():
    res = build({"youtube": yt})
    assert res["symbols"][0] in {"NVDA", "GME", "ZZZ"}


def test_failed_source_is_reported_and_scan_still_has_fixed_lists():
    async def broken():
        raise RuntimeError("supabase down")

    res = build({"youtube": broken, "reddit": rd})
    assert "supabase down" in res["errors"]["youtube"]
    assert res["counts"]["youtube"] == 0
    assert "AMC" in res["sources"] and "SPY" in res["sources"]


def test_each_trending_source_is_capped():
    async def many():
        return [(f"AB{c}{d}", 9) for c in "ABCDEFGHIJ" for d in "ABCDEFGHIJ"]

    res = build({"reddit": many})
    assert res["counts"]["reddit"] == u.REDDIT_LIMIT


def test_total_is_capped_but_fixed_lists_are_never_dropped(monkeypatch):
    monkeypatch.setattr(u, "MAX_UNIVERSE", len(u.static_universe()) + 2)

    async def many():
        return [(f"AB{c}{d}", 9) for c in "ABCDEFGHIJ" for d in "ABCDEFGHIJ"]

    res = build({"reddit": many})
    assert res["counts"]["total"] == len(u.static_universe()) + 2
    assert set(u.static_universe()) <= set(res["symbols"])


def test_manual_symbols_skip_the_universe(monkeypatch):
    from app.services.trade_os.scanner import run_opportunity_scanner

    async def boom():
        raise AssertionError("must not build the universe for a manual run")

    monkeypatch.setattr("app.services.trade_os.scanner.build_universe", boom)
    res = asyncio.run(
        run_opportunity_scanner(
            symbols=["abc"], bar_fetcher=lambda s: [], save_to_db=False, market_regime="risk_on"
        )
    )
    assert res["universe_type"] == "manual"
    assert res["candidates"][0]["sources"] == ["manual"]


def test_english_words_from_reddit_are_dropped_but_real_fixed_stocks_stay():
    async def reddit():
        return [("ALL", 1), ("YOU", 2), ("IT", 3), ("NOW", 4), ("GME", 5)]

    res = build({"reddit": reddit})
    assert (
        "ALL" not in res["sources"] and "YOU" not in res["sources"] and "IT" not in res["sources"]
    )
    assert res["sources"]["NOW"] == ["core", "reddit"]  # ServiceNow is a real core stock
    assert res["sources"]["GME"] == ["reddit"]


def test_product_lookup_needs_no_network_for_fixed_lists_and_blocks_leveraged():
    assert u.default_product_lookup("SMH") == {"is_etf": True, "leveraged": False}
    assert u.default_product_lookup("NVDA") == {"is_etf": False, "leveraged": False}
    assert u.default_product_lookup("SOXL") == {"is_etf": True, "leveraged": True}


def test_leveraged_signal_is_blocked_and_unknown_etf_skips_earnings():
    from datetime import date

    from app.services.trade_os.scanner import evaluate_symbol
    from tests.test_trade_os_scanner import SPY, signal_bars

    def no_earnings(_):
        raise AssertionError("ETFs must not hit the earnings lookup")

    lev = evaluate_symbol(
        "XYZ", signal_bars(), SPY, "risk_on", no_earnings, date(2026, 11, 23),
        product_lookup=lambda s: {"is_etf": True, "leveraged": True},
    )  # fmt: skip
    assert lev["status"] == "BLOCKED" and lev["status_reason"] == "LEVERAGED_PRODUCT"
    etf = evaluate_symbol(
        "VOO", signal_bars(), SPY, "risk_on", no_earnings, date(2026, 11, 23),
        product_lookup=lambda s: {"is_etf": True, "leveraged": False},
    )  # fmt: skip
    assert etf["status"] == "SIGNAL_CONFIRMED" and etf["earnings_status"] == "not_applicable"
