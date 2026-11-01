/**
 * Regression tests for `lib/stockLinks.ts` — the canonical stock → quotes-page
 * href helpers.
 *
 * Run with:  node --test scripts/stock-links.test.cjs
 *
 * Follows the repo's existing dependency-free convention (`scripts/*.test.cjs`:
 * node:test + node:assert, TypeScript transpiled on the fly with the already
 * installed `typescript` package, nothing imported from Next/React).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const FILE = path.join(__dirname, "../lib/stockLinks.ts");
const source = fs.readFileSync(FILE, "utf8");

// Pure module: no imports, so a bare CommonJS transpile is enough.
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const module_ = { exports: {} };
vm.runInNewContext(compiled, {
  module: module_,
  exports: module_.exports,
  require: () => {
    throw new Error("lib/stockLinks.ts must stay dependency-free");
  },
  URL,
  URLSearchParams,
});
const stockLinks = module_.exports;

const {
  MARKET_STOCK_BASE,
  normalizeStockSymbol,
  isValidStockSymbol,
  isSafeReturnHref,
  marketStockHref,
  marketStockUrl,
} = stockLinks;

test("exports the full documented surface", () => {
  for (const name of [
    "MARKET_STOCK_BASE",
    "normalizeStockSymbol",
    "isValidStockSymbol",
    "isSafeReturnHref",
    "marketStockHref",
    "marketStockUrl",
  ]) {
    assert.equal(typeof stockLinks[name], name === "MARKET_STOCK_BASE" ? "string" : "function", `missing export ${name}`);
  }
  assert.equal(MARKET_STOCK_BASE, "/dashboard/market");
});

test("marketStockHref always targets /dashboard/market/<TICKER>", () => {
  // Tickers from the landing marquee in the user's screenshot.
  assert.equal(marketStockHref("MU"), "/dashboard/market/MU");
  assert.equal(marketStockHref("PLTR"), "/dashboard/market/PLTR");
  assert.equal(marketStockHref("TSLA"), "/dashboard/market/TSLA");
  // Lower/ mixed case and surrounding whitespace are normalized (never `/pltr`).
  assert.equal(marketStockHref("pltr"), "/dashboard/market/PLTR");
  assert.equal(marketStockHref("  tsla  "), "/dashboard/market/TSLA");
  // Dots and dashes are legal path characters and must NOT be escaped.
  assert.equal(marketStockHref("BRK.B"), "/dashboard/market/BRK.B");
  assert.equal(marketStockHref("BTC-USD"), "/dashboard/market/BTC-USD");
});

test("marketStockHref carries ?from= only for safe same-origin paths", () => {
  const withFrom = marketStockHref("NVDA", "/dashboard/watchlist");
  assert.equal(withFrom, "/dashboard/market/NVDA?from=%2Fdashboard%2Fwatchlist");
  assert.ok(withFrom.endsWith("?from=%2Fdashboard%2Fwatchlist"));

  // Open-redirect guard: absolute/protocol-relative/backslash targets are dropped.
  for (const evil of [
    "https://evil.com",
    "http://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "dashboard/watchlist",
    "",
    undefined,
    null,
  ]) {
    const href = marketStockHref("NVDA", evil);
    assert.equal(href, "/dashboard/market/NVDA", `unsafe ?from=${JSON.stringify(evil)} leaked into ${href}`);
    assert.equal(href.includes("?"), false, `no query string expected for ?from=${JSON.stringify(evil)}`);
  }

  // A path that already contains a query is still same-origin — preserved and encoded.
  assert.equal(
    marketStockHref("NVDA", "/dashboard/x-opinions?ticker=NVDA"),
    "/dashboard/market/NVDA?from=%2Fdashboard%2Fx-opinions%3Fticker%3DNVDA",
  );
});

test("marketStockHref never emits an unescaped or empty segment", () => {
  // Index notation is not routable but the href must still be a single, encoded segment.
  assert.equal(marketStockHref("^VIX"), "/dashboard/market/%5EVIX");
  // Path/query injection attempts stay inside one encoded segment.
  for (const raw of ["../NVDA", "NVDA?x=y", "NVDA#frag", "A/B", "NVDA\\B", "A B"]) {
    const href = marketStockHref(raw);
    assert.equal(href.startsWith("/dashboard/market/"), true, href);
    const segment = href.slice("/dashboard/market/".length);
    assert.equal(segment.includes("/"), false, `unescaped slash in ${href}`);
    assert.equal(segment.includes("?"), false, `unescaped query in ${href}`);
    assert.equal(segment.includes("#"), false, `unescaped fragment in ${href}`);
    assert.equal(segment.includes(" "), false, `unescaped space in ${href}`);
    if (raw !== "../NVDA") continue;
    // Encoded dot-segments cannot traverse (`%2E%2E%2F` is not a path separator).
    assert.equal(segment, "..%2FNVDA");
  }
  // Empty symbol degrades to the bare base — callers must use marketStockUrl instead.
  assert.equal(marketStockHref(""), "/dashboard/market/");
  assert.equal(marketStockHref("   "), "/dashboard/market/");
});

test("marketStockUrl returns a routable href or null", () => {
  assert.equal(marketStockUrl("PLTR"), "/dashboard/market/PLTR");
  assert.equal(marketStockUrl("brk.b"), "/dashboard/market/BRK.B");
  // Non-routable identities render as plain text at call sites.
  assert.equal(marketStockUrl("^VIX"), null);
  assert.equal(marketStockUrl(""), null);
  assert.equal(marketStockUrl("   "), null);
  assert.equal(marketStockUrl("ES=F"), null);
  assert.equal(marketStockUrl("EUR/USD"), null);
  assert.equal(marketStockUrl("A".repeat(22)), null);
  assert.equal(marketStockUrl("..."), null);
});

test("isValidStockSymbol accepts tradable tickers and rejects notation", () => {
  for (const ok of ["NVDA", "pltr", " BRK.B ", "BTC-USD", "0700.HK", "A", "V1"]) {
    assert.equal(isValidStockSymbol(ok), true, `expected valid: ${JSON.stringify(ok)}`);
  }
  for (const bad of [
    "^VIX",
    "^GSPC",
    "ES=F",
    "EUR/USD",
    "",
    "   ",
    "NVDA?x=y",
    "A B",
    "NV\tDA",
    "NV\u0000DA",
    "NVDA#f",
    "%41",
    "..",
    "--",
    "A".repeat(22),
  ]) {
    assert.equal(isValidStockSymbol(bad), false, `expected invalid: ${JSON.stringify(bad)}`);
  }
  // Non-string input from untyped/JSON sources never throws.
  for (const weird of [undefined, null, 42, {}, []]) {
    assert.equal(isValidStockSymbol(weird), false);
    assert.equal(normalizeStockSymbol(weird), "");
  }
  assert.equal(isValidStockSymbol("BTC-USD"), true);
});

test("normalizeStockSymbol trims and upper-cases", () => {
  assert.equal(normalizeStockSymbol(" pltr "), "PLTR");
  assert.equal(normalizeStockSymbol("brk.b"), "BRK.B");
  assert.equal(normalizeStockSymbol(""), "");
  assert.equal(normalizeStockSymbol("   "), "");
});

test("isSafeReturnHref only allows same-origin absolute paths", () => {
  for (const ok of ["/", "/dashboard", "/dashboard/watchlist?tab=all", "/a b"]) {
    assert.equal(isSafeReturnHref(ok), true, `expected safe: ${ok}`);
  }
  for (const bad of [
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "dashboard",
    "",
    " ",
    undefined,
    null,
  ]) {
    assert.equal(isSafeReturnHref(bad), false, `expected unsafe: ${JSON.stringify(bad)}`);
  }
});
