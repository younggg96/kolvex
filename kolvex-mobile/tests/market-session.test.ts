import assert from "node:assert/strict";
import { test } from "node:test";
import { latestQuote, withChartQuote } from "../src/lib/chartQuote";
import { extendedDayStart } from "../src/lib/chartTimeframes";
import { usMarketsClosed } from "../src/lib/pollingSchedule";

test("overnight quotes use their own timestamps and do not replace newer pre-market quotes", () => {
  const quote = {
    current_price: 100,
    change_percent: 1,
    market_time: 100,
    post_market_time: 101,
    post_market_price: 101,
    overnight_market_time: 102,
    overnight_market_price: 102,
  };
  assert.equal(latestQuote(quote)?.session, "overnight");
  assert.equal(latestQuote(quote, false)?.session, "regular");
  assert.equal(
    latestQuote({ ...quote, pre_market_time: 103, pre_market_price: 103 })
      ?.session,
    "pre",
  );
});

test("a live point crosses midnight without replacing a newer candle", () => {
  const points = [{ date: "2026-11-22T23:55:00-05:00", close: 100 }];
  const at = Date.parse("2026-11-23T05:05:00Z") / 1_000;
  const latest = {
    price: 101,
    time: at,
    session: "overnight" as const,
    changePercent: 1,
  };
  assert.equal(withChartQuote(points, latest).at(-1)?.close, 101);
  assert.equal(withChartQuote(points, { ...latest, time: at - 900 }), points);
  assert.equal(usMarketsClosed(new Date("2026-11-23T01:00:00Z")), false);
  assert.equal(usMarketsClosed(new Date("2026-11-21T01:00:00Z")), true);
});

test("the advanced chart retains the overnight session across the opening bell", () => {
  const fri = "2026-11-20T15:55:00-05:00";
  const night = "2026-11-22T20:05:00-05:00";
  const pre = "2026-11-23T04:05:00-05:00";
  const open = "2026-11-23T09:30:00-05:00";
  assert.equal(extendedDayStart([fri, night, pre], "5m"), Date.parse(fri));
  assert.equal(
    extendedDayStart([fri, night, pre, open], "5m"),
    Date.parse(night),
  );
});
