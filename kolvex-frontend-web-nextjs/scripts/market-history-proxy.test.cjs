const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { BACKEND_CONFIG, backendConfig } = require("./helpers/backend-config.cjs");
const createCache = require("./helpers/client-cache.cjs");
const stockApi = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, "../lib/stockApi.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function fixture(fetch) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../app/api/market/history/[symbol]/route.ts"), "utf8"),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      },
    ).outputText,
    {
      module,
      exports: module.exports,
      fetch,
      console,
      AbortSignal,
      process: { env: { NEXT_PUBLIC_BACKEND_API_URL: "https://backend.example" } },
      require: (name) =>
        name === BACKEND_CONFIG
          ? backendConfig({ NEXT_PUBLIC_BACKEND_API_URL: "https://backend.example" })
          : { NextResponse: Response },
    },
  );
  return (symbol, query = "period=3mo&interval=1d") =>
    module.exports.GET(
      {
        signal: new AbortController().signal,
        nextUrl: new URL(`https://kolvex.example/api?${query}`),
      },
      { params: Promise.resolve({ symbol }) },
    );
}
test("all five index symbols forward once encoded and preserve the OHLC candles and range", async () => {
  for (const symbol of ["^GSPC", "^IXIC", "^DJI", "^RUT", "^VIX"]) {
    for (const input of [symbol, encodeURIComponent(symbol)]) {
      const candles = {
        symbol,
        data: [{ date: "2026-10-22", open: 20, high: 23, low: 19, close: 22, volume: null }],
      };
      const get = fixture(async (url) => {
        assert.equal(
          url,
          `https://backend.example/api/v1/market/history/${encodeURIComponent(symbol)}?period=3mo&interval=1d`,
        );
        return Response.json(candles);
      });
      const response = await get(input);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(await response.json(), candles);
    }
  }
});
test("invalid symbol escapes and path characters never reach the backend", async () => {
  const get = fixture(() => {
    throw Error("Backend must not be called");
  });
  for (const symbol of ["%", "%E0%A4", "%255EVIX", "..%2FVIX", "VIX%3Finterval=1m"]) {
    assert.equal((await get(symbol)).status, 400);
  }
});
test("upstream history errors remain explicit errors instead of empty charts", async () => {
  const response = await fixture(async () =>
    Response.json({ detail: "History unavailable" }, { status: 503 }),
  )("%5EVIX");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "History unavailable" });
});

test("empty HTTP 200 histories are not cached as successful charts", async () => {
  const response = await fixture(async (_url, options) => {
    assert.equal(options.cache, "no-store");
    return Response.json({ data: [] });
  })("^VIX");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("market history forwards the upstream cooldown without caching the response", async () => {
  const response = await fixture(async () =>
    Response.json(
      { detail: "market_history_rate_limited" },
      { status: 429, headers: { "Retry-After": "45" } },
    ),
  )("SPY");
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "45");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { error: "market_history_rate_limited" });
});

test("history cooldown skips immediate retries and other symbols while preserving fresh cache hits", async () => {
  const seen = [];
  let now = 100_000;
  const fetch = async (url) => {
    seen.push(url);
    if (seen.length === 2) {
      return Response.json({}, { status: 429, headers: { "Retry-After": "60" } });
    }
    return Response.json({
      data: [{ date: "2026-10-28", open: 1, high: 2, low: 1, close: 2 }],
    });
  };
  const cache = createCache();
  const api = {};
  vm.runInNewContext(stockApi, {
    exports: api,
    fetch,
    Date: { now: () => now },
    URLSearchParams,
    require: () => cache,
  });
  await api.getStockHistory("SPY");
  await assert.rejects(api.getStockHistory("QQQ"), { status: 429 });
  await assert.rejects(api.getStockHistory("IWM", {}, undefined, true), { status: 429 });
  assert.equal((await api.getStockHistory("SPY")).length, 1);
  assert.equal(seen.length, 2);

  now += 60_000;
  assert.equal((await api.getStockHistory("IWM")).length, 1);
  assert.equal(seen.length, 3);
});
