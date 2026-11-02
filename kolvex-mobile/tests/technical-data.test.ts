import test from "node:test";
import assert from "node:assert/strict";
import { validBars, calendarDate } from "../src/lib/technicalData";
import {
  ema,
  bollinger,
  rsi,
  macd,
  kdj,
  vwap,
} from "../src/lib/technicalIndicators";
test("OHLC rejects invalid dates, non-finite prices and impossible highs; missing volume stays unavailable", () => {
  const b = { date: "2026-10-01", open: 10, high: 12, low: 9, close: 11 };
  assert.deepEqual(
    validBars([
      b,
      { ...b, date: "bad" },
      { ...b, high: 8 },
      { ...b, close: NaN },
    ]),
    [{ ...b, volume: null }],
  );
  assert.throws(() => validBars({ data: [] }));
});
test("calendar dates reject overflow dates rather than submitting normalized dates", () => {
  assert.equal(calendarDate("2026-02-29"), false);
  assert.equal(calendarDate("2024-02-29"), true);
  assert.equal(calendarDate("2026-11-01"), true);
});
test("EMA and Bollinger retain warm-up gaps and have exact constant-series results", () => {
  assert.deepEqual(ema([2, 2, 2, 2], 3), [null, null, 2, 2]);
  const b = bollinger([10, 10, 10], 3);
  assert.deepEqual(b.upper, [null, null, 10]);
  assert.deepEqual(b.lower, [null, null, 10]);
});
test("RSI, MACD and KDJ treat flat data as neutral, not bullish", () => {
  const values = Array(50).fill(10);
  assert.equal(rsi(values).at(-1), 50);
  assert.equal(macd(values).histogram.at(-1), 0);
  const bars = values.map((close, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    open: close,
    high: close,
    low: close,
    close,
    volume: 0,
  }));
  assert.equal(kdj(bars).j.at(-1), 50);
});
test("VWAP resets on session changes and cannot invent missing volume", () => {
  const bars = [
    {
      date: "2026-10-01T10:00:00Z",
      open: 10,
      high: 10,
      low: 10,
      close: 10,
      volume: 2,
    },
    {
      date: "2026-10-01T11:00:00Z",
      open: 20,
      high: 20,
      low: 20,
      close: 20,
      volume: 2,
    },
    {
      date: "2026-10-02T10:00:00Z",
      open: 30,
      high: 30,
      low: 30,
      close: 30,
      volume: 2,
    },
  ];
  assert.deepEqual(vwap(bars, true), [10, 15, 30]);
  assert.deepEqual(
    vwap(
      bars.map((b) => ({ ...b, volume: null })),
      true,
    ),
    [null, null, null],
  );
});
