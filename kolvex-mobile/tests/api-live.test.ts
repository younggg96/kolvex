import assert from "node:assert/strict";
import { test } from "node:test";

process.env.EXPO_PUBLIC_API_URL = "https://api.example.test/api/v1/";
const api = import("../src/lib/api");

test("live requests use existing FastAPI paths and preserve unavailable prices", async () => {
  const { quote, history, opinions, demoMode } = await api;
  assert.equal(demoMode, false);
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    paths.push(url);
    const body = url.includes("/history/")
      ? {
          data: [
            { date: "2026-10-29", close: null },
            { date: "2026-10-30", close: 12 },
          ],
        }
      : url.includes("dashboard")
        ? { latest: [] }
        : {
            symbol: "AAPL",
            current_price: null,
            change: null,
            change_percent: null,
          };
    return new Response(JSON.stringify(body));
  };
  const signal = new AbortController().signal;
  assert.equal((await quote("AAPL", signal)).current_price, null);
  assert.deepEqual(await history("AAPL", "1mo", signal), [
    { date: "2026-10-30", close: 12 },
  ]);
  assert.deepEqual(await opinions(signal), { latest: [] });
  assert.deepEqual(paths, [
    "https://api.example.test/api/v1/market/quote/AAPL",
    "https://api.example.test/api/v1/market/history/AAPL?period=1mo&interval=1d",
    "https://api.example.test/api/v1/youtube-opinions/dashboard?limit=30",
  ]);
});

test("live errors and malformed quotes never return demo fixtures", async () => {
  const { quote } = await api;
  const signal = new AbortController().signal;
  globalThis.fetch = async () => new Response("{}", { status: 503 });
  await assert.rejects(quote("AAPL", signal), /503/);
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ symbol: "MSFT", current_price: 123 }));
  await assert.rejects(quote("AAPL", signal), /报价格式无效/);
});

test("request cancellation reaches fetch", async () => {
  const { quote } = await api;
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async (_, options) => {
    assert.equal(options?.signal, controller.signal);
    options?.signal?.throwIfAborted();
    throw new Error("must abort");
  };
  await assert.rejects(quote("AAPL", controller.signal), {
    name: "AbortError",
  });
});
