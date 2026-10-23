const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module, exports: module.exports, fetch: dependencies.fetch, AbortSignal, Intl, Date,
    process: { env: { NEXT_PUBLIC_BACKEND_API_URL: "https://backend.example" } },
    require(name) {
      if (name === "next/server") return { NextResponse: Response };
      if (name === "@/lib/supabase/server") return { createServerSupabaseClient: async () => ({ auth: { getSession: async () => ({ data: { session: dependencies.session } }) } }) };
      throw Error(name);
    },
  });
  return module.exports;
}

const helpers = load("lib/economicIndicators.ts");
test("quarterly and monthly observation dates never shift across time zones", () => {
  assert.equal(helpers.indicatorPeriod({ frequency: "quarterly" }, "2026-04-01", "en-US"), "2026 Q2");
  assert.equal(helpers.indicatorPeriod({ frequency: "monthly" }, "2026-09-01", "en-US"), "Sep 2026");
});
test("employment converts thousands into Chinese ten-thousands without changing English units", () => {
  assert.equal(helpers.indicatorValue(130, "thousands", "zh-CN", true), "+13.0 万人");
  assert.equal(helpers.indicatorValue(130, "thousands", "en-US", true), "+130K");
  assert.equal(helpers.indicatorValue(-17, "bp", "en-US", true), "−17.00 bp");
  assert.equal(helpers.indicatorValue(0, "percent", "en-US"), "0.00%");
  assert.equal(helpers.indicatorValue(null, "percent", "en-US"), "—");
});
test("economic proxy is authenticated, private, and reads the government snapshot", async () => {
  let sent;
  const proxy = load("app/api/market/indicators/route.ts", {
    session: { access_token: "test-session" },
    fetch: async (url, options) => { sent = { url, ...options }; return Response.json({ status: "ready", indicators: [] }); },
  });
  const response = await proxy.GET();
  assert.equal(response.status, 200);
  assert.equal(sent.url, "https://backend.example/api/v1/market/indicators");
  assert.equal(sent.headers.Authorization, "Bearer test-session");
  assert.equal(sent.cache, "no-store");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});
test("unauthenticated users never reach the backend", async () => {
  let calls = 0;
  const proxy = load("app/api/market/indicators/route.ts", { session: null, fetch: async () => { calls++; } });
  assert.equal((await proxy.GET()).status, 401);
  assert.equal(calls, 0);
});
test("timeouts and malformed payloads remain explicit failures", async () => {
  for (const fetch of [async () => { throw new Error("upstream"); }, async () => Response.json({ rows: [] }), async () => Response.json({}, { status: 500 })]) {
    const proxy = load("app/api/market/indicators/route.ts", { session: { access_token: "test" }, fetch });
    assert.equal((await proxy.GET()).status, 503);
  }
});
