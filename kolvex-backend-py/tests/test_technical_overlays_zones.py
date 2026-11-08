import unittest

from typing import get_args

from app.services.technical_focus import TechnicalCategory, TechnicalFocus
from app.services.technical_overlays import structure_overlays, volume_overlays, zone_overlays


def bar(i, o, h, l, c, v=1000):
    return {"date": f"2026-01-{i + 1:02d}", "open": o, "high": h, "low": l, "close": c, "volume": v}


def flat(n, price=100.0):
    # Two-point ranges give a stable average range of ~2 before any impulse.
    return [bar(i, price, price + 1, price - 1, price) for i in range(n)]


class SupplyDemandTests(unittest.TestCase):
    def series(self):
        bars = flat(20)
        bars[17] = bar(17, 100, 102.5, 97.5, 100)  # wider than average: ends the base
        bars[18] = bar(18, 100, 100.4, 99.8, 100.1)  # narrow base
        bars[19] = bar(19, 100.2, 106, 100.1, 105.8)  # impulse up, body 5.6 >> 1.2 * ATR
        bars += [bar(20 + i, 106, 107, 105, 106) for i in range(3)]
        return bars

    def test_detects_single_demand_zone_from_base(self):
        zones = [z for z in zone_overlays(self.series(), "en") if z["category"] == "supply_demand"]
        self.assertEqual(len(zones), 1)
        zone = zones[0]
        self.assertEqual(zone["direction"], "bullish")
        self.assertEqual(zone["shape"], "area")
        self.assertEqual(zone["points"][0], {"date": "2026-01-19", "price": 99.8})
        self.assertEqual(zone["points"][1]["price"], 100.4)
        self.assertEqual(zone["status"], "fresh")

    def test_close_through_zone_removes_it(self):
        bars = self.series() + [bar(23, 101, 101, 99, 99.5)]
        self.assertFalse([z for z in zone_overlays(bars) if z["category"] == "supply_demand"])


class GapTests(unittest.TestCase):
    def test_unfilled_gap_then_filled(self):
        bars = flat(20)
        bars.append(bar(20, 104, 106, 103, 105))  # gap up over previous high 101
        bars.append(bar(21, 105, 107, 104, 106))  # its FVG would repeat the gap, so it is skipped
        gaps = [g for g in zone_overlays(bars, "en") if g["category"] == "gaps"]
        self.assertEqual([g["kind"] for g in gaps], ["gap"])
        self.assertEqual([p["price"] for p in gaps[0]["points"]], [101, 103])
        bars.append(bar(22, 104, 104, 100.5, 101))
        self.assertFalse([g for g in zone_overlays(bars) if g["category"] == "gaps"])

    def test_fair_value_gap_without_true_gap(self):
        bars = flat(20)
        bars.append(bar(20, 100.5, 106, 100.5, 105.5))  # overlaps bar 19: no true gap
        bars.append(bar(21, 105.5, 107, 103, 106))  # low 103 above bar 19's high 101
        gaps = [g for g in zone_overlays(bars, "en") if g["category"] == "gaps"]
        self.assertEqual([g["kind"] for g in gaps], ["fvg"])
        self.assertEqual([p["price"] for p in gaps[0]["points"]], [101, 103])
        self.assertEqual(gaps[0]["points"][0]["date"], bars[19]["date"])


class VolumeTests(unittest.TestCase):
    def test_poc_sits_in_heavy_volume_band_inside_value_area(self):
        bars = [bar(i, 100, 101, 99, 100, 10_000) for i in range(10)]
        bars += [bar(10 + i, 110, 120, 100, 110, 100) for i in range(10)]
        lines = {o["label"]: o["level"] for o in volume_overlays(bars) if o["category"] == "volume_profile"}
        self.assertTrue(99 <= lines["POC"] <= 101)
        self.assertLessEqual(lines["VAL"], lines["POC"])
        self.assertLessEqual(lines["POC"], lines["VAH"])

    def test_anchored_vwap_starts_at_anchor_typical_price(self):
        bars = [bar(i, 100 + i, 102 + i, 99 + i, 101 + i) for i in range(10)]
        vwaps = [o for o in volume_overlays(bars, "en") if o["category"] == "anchored_vwap"]
        from_low = next(o for o in vwaps if "low" in o["label"])
        self.assertEqual(from_low["points"][0], {"date": "2026-01-01", "price": round((102 + 99 + 101) / 3, 4)})
        self.assertEqual(len(from_low["points"]), 10)

    def test_no_volume_no_profile(self):
        self.assertEqual(volume_overlays([dict(b, volume=0) for b in flat(5)]), [])


class StructureTests(unittest.TestCase):
    def test_channel_width_and_pitchfork_median(self):
        bars = [bar(i, 100 + i, 101 + i, 99 + i, 100 + i) for i in range(12)]
        bars[2].update(low=99, high=103)
        bars[5].update(high=110)
        bars[8].update(low=105)
        pivots = [
            {"index": 2, "date": bars[2]["date"], "kind": "low", "price": 99},
            {"index": 5, "date": bars[5]["date"], "kind": "high", "price": 110},
            {"index": 8, "date": bars[8]["date"], "kind": "low", "price": 105},
        ]
        result = structure_overlays(bars, pivots, "en")
        channel = next(o for o in result if o["category"] == "channels")
        self.assertEqual(channel["shape"], "channel")
        a, b, c = channel["points"]
        self.assertEqual((a["price"], b["price"]), (99, 105))
        self.assertEqual(c, {"date": bars[5]["date"], "price": 110})
        self.assertEqual(channel["direction"], "bullish")
        fork = next(o for o in result if o["category"] == "pitchfork")
        p0, p1, p2 = fork["points"]
        self.assertEqual(p0["price"], 99)
        self.assertEqual((p1["price"] + p2["price"]) / 2, 107.5)
        self.assertEqual(fork["direction"], "bullish")


class FocusTests(unittest.TestCase):
    def test_accepts_every_category(self):
        focus = TechnicalFocus(categories=list(get_args(TechnicalCategory)))
        self.assertIn("pitchfork", focus.categories)


if __name__ == "__main__":
    unittest.main()
