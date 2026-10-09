const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Run the real route with controlled upstream responses and a virtual deadline.
// No account, backend, or paid model calls are made.
function fixture(fetch, session = { access_token: "test-token" }) {
  const deadline = new AbortController();
  let timeoutMs;
  const module = { exports: {} };
  const source = fs.readFileSync(
    path.join(__dirname, "../app/api/market/ai-technical/[symbol]/route.ts"),
    "utf8",
  );
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module, exports: module.exports, fetch,
    process: { env: { NEXT_PUBLIC_BACKEND_API_URL: "https://backend.example" } },
    console: { error() {}, warn() {} },
    AbortSignal: {
      any: (signals) => AbortSignal.any(signals),
      timeout(ms) { timeoutMs = ms; return deadline.signal; },
    },
    require(name) {
      if (name === "next/server") return { NextResponse: Response };
      if (name === "@/lib/supabase/server") return {
        createServerSupabaseClient: async () => ({
          auth: { getSession: async () => ({ data: { session } }) },
        }),
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return {
    maxDuration: module.exports.maxDuration,
    get timeoutMs() { return timeoutMs; },
    expire() { deadline.abort(new DOMException("Deadline exceeded", "TimeoutError")); },
    call(body = {}, signal = new AbortController().signal, symbol = "MSFT") {
      return module.exports.POST({ text: async () => JSON.stringify(body), signal }, {
        params: Promise.resolve({ symbol }),
      });
    },
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
function untilAborted(signal) {
  return new Promise((_, reject) => {
    if (signal.aborted) return reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

test("a slow MSFT drawings response keeps the selected model, focus and saved version", async () => {
  let finish;
  let forwarded;
  const h = fixture((url, options) => {
    forwarded = { url, options };
    return new Promise((resolve) => { finish = resolve; });
  });
  const body = {
    period: "3mo", interval: "1d",
    categories: ["levels", "trendlines", "fibonacci", "trade_plan"],
    custom_scenarios: [], operation: "drawings", model: "deepseek-v4-pro",
    view_start: "2026-07-09T00:00:00-04:00",
    view_end: "2026-10-08T00:00:00-04:00", locale: "zh",
  };
  const pending = h.call(body);
  await tick();
  assert.ok(h.maxDuration > 60, "reasoning requests must be allowed past the old 60s limit");
  assert.ok(h.timeoutMs > 60_000 && h.timeoutMs < h.maxDuration * 1000);
  assert.equal(forwarded.url, "https://backend.example/api/v1/market/ai-technical/MSFT");
  assert.equal(forwarded.options.method, "POST");
  assert.equal(forwarded.options.headers.Authorization, "Bearer test-token");
  assert.equal(forwarded.options.cache, "no-store");
  assert.deepEqual(JSON.parse(forwarded.options.body), body);
  const result = { symbol: "MSFT", model: body.model, levels: [], version_id: "saved" };
  finish(Response.json(result));
  const response = await pending;
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), result);
});

test("an upstream that never returns is aborted and gets a JSON 504 before the platform deadline", async () => {
  let upstreamSignal;
  const h = fixture((_, { signal }) => {
    upstreamSignal = signal;
    return untilAborted(signal);
  });
  const pending = h.call();
  await tick();
  h.expire();
  const response = await pending;
  assert.equal(upstreamSignal.aborted, true);
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { error: "ai_analysis_timeout" });
});

test("a stalled response body cannot swallow a timeout or return empty success", async () => {
  const h = fixture(async (_, { signal }) => ({
    ok: true, status: 200, json: () => untilAborted(signal),
  }));
  const pending = h.call();
  await tick();
  h.expire();
  const response = await pending;
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error, "ai_analysis_timeout");
});

test("client cancellation aborts the upstream request", async () => {
  let upstreamSignal;
  const h = fixture((_, { signal }) => {
    upstreamSignal = signal;
    return untilAborted(signal);
  });
  const client = new AbortController();
  const pending = h.call({}, client.signal);
  await tick();
  client.abort();
  assert.equal((await pending).status, 499);
  assert.equal(upstreamSignal.aborted, true);
});

test("backend configuration and validation errors keep their status", async () => {
  for (const [status, detail, error] of [
    [503, "ai_not_configured", "ai_not_configured"],
    [422, [{ msg: "Invalid model" }], "Invalid request"],
  ]) {
    const h = fixture(async () => Response.json({ detail }, { status }));
    const response = await h.call();
    assert.equal(response.status, status);
    assert.equal((await response.json()).error, error);
  }
});

test("invalid successful JSON is a backend failure, while non-JSON errors retain their status", async () => {
  for (const [upstreamStatus, expectedStatus] of [[200, 502], [504, 504]]) {
    const h = fixture(async () => new Response("upstream gateway error", { status: upstreamStatus }));
    const response = await h.call();
    assert.equal(response.status, expectedStatus);
    assert.ok((await response.json()).error);
  }
});

test("unauthenticated requests do not invoke the backend", async () => {
  let calls = 0;
  const h = fixture(async () => { calls++; }, null);
  assert.equal((await h.call()).status, 401);
  assert.equal(calls, 0);
});
