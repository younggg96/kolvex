const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { FORMAT, format } = require("./helpers/format.cjs");

const load = (relative, mocks = {}) => {
  const file = path.join(__dirname, "..", relative);
  const compiled = new Module(file, module);
  compiled.paths = module.paths;
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = (name) => (Object.hasOwn(mocks, name) ? mocks[name] : originalRequire(name));
  compiled._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    file,
  );
  return compiled.exports;
};
const { BENCHMARKS, isMarketIndex } = load("lib/marketBenchmarks.ts");
const { validTicker } = load("lib/decision.ts");
const discovery = load("lib/stockDiscovery.ts", {
  [FORMAT]: format,
  "./socialBuzz": load("lib/socialBuzz.ts"),
  "./opinionDates": load("lib/opinionDates.ts"),
  "./decision": { validTicker },
});
const StockWorkspace = () => null;
const page = load("app/dashboard/market/[ticker]/page.tsx", {
  "next/navigation": {
    notFound() {
      throw new Error("NOT_FOUND");
    },
    redirect(url) {
      throw new Error(`REDIRECT:${url}`);
    },
  },
  "@/components/decision/StockWorkspace": { default: StockWorkspace },
  "@/lib/decision": { validTicker },
  "@/lib/marketBenchmarks": { isMarketIndex },
  "@/lib/stockDiscovery": discovery,
  // The page pre-fetches the headline quote; these tests only cover routing.
  "@/lib/server/stockQuote": { loadQuote: async () => null },
}).default;

test("all overview index links open with encoded or decoded symbols without redirect loops", async () => {
  for (const { symbol } of BENCHMARKS) {
    for (const ticker of [symbol, encodeURIComponent(symbol)]) {
      const result = await page({ params: { ticker } });
      assert.equal(result.props.ticker, symbol);
    }
  }
});
test("stock and index case canonicalization preserves valid encoded destinations", async () => {
  assert.equal((await page({ params: { ticker: "AAPL" } })).props.ticker, "AAPL");
  await assert.rejects(page({ params: { ticker: "aapl" } }), /REDIRECT:\/dashboard\/market\/AAPL/);
  await assert.rejects(
    page({ params: { ticker: "%5Evix" } }),
    /REDIRECT:\/dashboard\/market\/%5EVIX/,
  );
});
test("malformed escapes, unknown indices and encoded path characters remain 404s", async () => {
  for (const ticker of ["%", "%E0%A4", "%5EINVALID", "%255EVIX", "..%2FAAPL", "AAPL%2Fnews"]) {
    await assert.rejects(page({ params: { ticker } }), /NOT_FOUND/);
  }
});

test("opinion links open creator intelligence and preserve only a market-list return", async () => {
  const result = await page({
    params: { ticker: "NVDA" },
    searchParams: { insight: "creators", from: "/dashboard?stocks=creators&stockSort=heat" },
  });
  assert.equal(result.props.initialInsight, "creators");
  assert.equal(result.props.returnHref, "/dashboard?stocks=creators&stockSort=heat");
  assert.equal(
    (await page({ params: { ticker: "NVDA" }, searchParams: { from: "https://example.com" } }))
      .props.returnHref,
    "/dashboard",
  );
});
