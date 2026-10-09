import unittest
from app.services.technical_overlays import chart_overlays, price_action_overlays

class OverlayTests(unittest.TestCase):
    def bars(self):
        return [{"date": f"d{i}", "open": 100, "high": 102, "low": 98, "close": 101} for i in range(12)]

    def test_candidate_impulse_rules_and_exact_anchors(self):
        pivots = [{"index": i, "date": f"d{i}", "kind": "low" if i%2==0 else "high", "price": price}
                  for i,price in enumerate([100,110,105,125,115,130,120,125,110])]
        annotations = chart_overlays(self.bars(),pivots,{},1)
        waves = [a for a in annotations if a["category"] == "waves"]
        self.assertEqual([a["label"] for a in waves], [f"候选浪 {i}" for i in [1,2,3,4,5,"A","B","C"]])
        self.assertEqual(waves[0]["points"],[{"date":"d0","price":100},{"date":"d1","price":110}])
        pivots[4]["price"] = 108 # Wave four overlaps wave one: reject.
        self.assertFalse(any(a["category"] == "waves" for a in chart_overlays(self.bars(),pivots,{},1)))

    def test_bearish_impulse_and_shortest_wave_three_rejected(self):
        def waves(prices):
            pivots=[{"index":i,"date":f"d{i}","kind":"high" if i%2==0 else "low","price":p} for i,p in enumerate(prices)]
            return [a for a in chart_overlays(self.bars(),pivots,{},1,"en") if a["category"]=="waves"]
        result=waves([130,120,125,105,115,100])
        self.assertEqual(len(result),5)
        self.assertTrue(all(a["direction"]=="bearish" for a in result))
        self.assertEqual(waves([130,110,120,105,108,85]),[])

    def test_engulfing_and_zero_range_candles(self):
        bars=self.bars()
        bars[-2].update(open=103,close=100,high=104,low=99)
        bars[-1].update(open=99,close=104,high=105,low=98)
        patterns=[a for a in chart_overlays(bars,[],{},1) if a["category"]=="candlesticks"]
        self.assertTrue(any(a["label"]=="看涨吞没" for a in patterns))
        flat=[dict(b,open=100,high=100,low=100,close=100) for b in bars]
        self.assertEqual(chart_overlays(flat,[],{},1),[])

    def test_average_series_and_double_top_confirmation(self):
        bars=self.bars()
        swings=[{"index":i,"date":f"d{i}","kind":kind,"price":price} for i,kind,price in [(1,"high",110),(3,"low",100),(5,"high",110.5)]]
        bars[-1]["close"]=99
        averages={20:[{"date":"d1","price":101},{"date":"d2","price":102}]}
        result=chart_overlays(bars,swings,averages,1)
        self.assertEqual(result[0]["points"],averages[20])
        self.assertTrue(any(a["label"]=="双顶 · 已破颈线" for a in result))
        self.assertFalse(any(a["category"]=="waves" for a in result))

class PriceActionTests(unittest.TestCase):
    def bars(self,count=9):
        return [{"date":f"2026-01-{i+1:02d}","open":99,"high":99.5,"low":98.5,"close":99} for i in range(count)]

    def pivot(self):
        return [{"index":1,"date":"2026-01-02","kind":"high","price":100}]

    def breakout(self):
        bars=self.bars()
        bars[1]["high"]=100
        bars[4].update(open=99,high=101.5,low=99,close=101)
        bars[5].update(open=101,high=102.5,low=100.8,close=102)
        bars[6].update(open=102,high=102,low=100,close=101)
        return bars

    def test_confirmed_break_and_retest_then_failed_break(self):
        bars=self.breakout()
        result=price_action_overlays(bars,self.pivot(),2)
        breaks=[e for e in result if e["category"]=="breakouts"]
        retests=[e for e in result if e["category"]=="retests"]
        failures=[e for e in result if e["category"]=="false_breakouts"]
        self.assertEqual(breaks[0]["detected_at"],bars[5]["date"])
        self.assertEqual(breaks[0]["status"],"failed")
        self.assertEqual(retests[0]["detected_at"],bars[6]["date"])
        self.assertEqual(failures[0]["detected_at"],bars[7]["date"])
        self.assertEqual(failures[0]["level"],100)

    def test_last_bar_break_is_pending_not_confirmed(self):
        bars=self.breakout()[:5]
        result=price_action_overlays(bars,self.pivot(),2)
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]["status"],"pending")
        self.assertEqual(result[0]["category"],"breakouts")

    def test_wick_rejection_without_close_break(self):
        bars=self.bars(5)
        bars[4]["high"]=102
        result=price_action_overlays(bars,self.pivot(),2)
        self.assertEqual([e["category"] for e in result],["false_breakouts"])
        self.assertIn("影线",result[0]["label"])

    def test_future_or_unconfirmed_pivot_cannot_be_used(self):
        bars=self.breakout()[:5]
        future=[dict(self.pivot()[0],index=3,date=bars[3]["date"])]
        self.assertEqual(price_action_overlays(bars,future,2),[])
        self.assertEqual(price_action_overlays(bars,[],2),[])

    def test_breakdown_rebound_and_false_breakdown_are_symmetric(self):
        bars=self.breakout()
        reflected=[dict(b,open=200-b["open"],close=200-b["close"],high=200-b["low"],low=200-b["high"]) for b in bars]
        pivot=[dict(self.pivot()[0],kind="low")]
        result=price_action_overlays(reflected,pivot,2)
        self.assertTrue(any("反抽确认" in e["label"] and e["direction"]=="bearish" for e in result))
        self.assertTrue(any("假跌破" in e["label"] and e["direction"]=="bullish" for e in result))

    def test_expired_single_close_is_not_left_pending(self):
        bars=self.breakout()[:7]
        bars[5].update(close=100,high=100.2,low=99.8)
        bars[6].update(close=100,high=100.2,low=99.8)
        result=price_action_overlays(bars,self.pivot(),2)
        self.assertEqual(result[0]["status"],"unconfirmed")

if __name__=='__main__': unittest.main()
