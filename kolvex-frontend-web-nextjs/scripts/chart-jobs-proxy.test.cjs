const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture(fetch, session = { access_token: "test-token" }) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../app/api/market/chart-jobs/[...path]/route.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module, exports: module.exports, fetch, AbortSignal,
    process: { env: { NEXT_PUBLIC_BACKEND_API_URL: "https://backend.example" } },
    require(name) {
      if (name === "next/server") return { NextResponse: Response };
      if (name === "@/lib/supabase/server") return {
        createServerSupabaseClient: async () => ({ auth: { getSession: async () => ({ data: { session } }) } }),
      };
      throw Error(name);
    },
  });
  return (method = "POST", body = {}, path = ["ORCL"]) => module.exports[method]({
    method, text: async () => JSON.stringify(body), signal: new AbortController().signal,
  }, { params: { path } });
}

test("submission preserves 202, model, focus and the idempotency key", async () => {
  let sent;
  const call = fixture(async (url, options) => {
    sent = { url, ...options };
    return Response.json({ id: "job-1", status: "queued" }, { status: 202 });
  });
  const body = { request_id: "request-1", model: "user-model", operation: "drawings", categories: ["levels"] };
  const response = await call("POST", body);
  assert.equal(response.status, 202);
  assert.equal(sent.url, "https://backend.example/api/v1/market/chart-jobs/ORCL");
  assert.deepEqual(JSON.parse(sent.body), body);
  assert.equal(sent.headers.Authorization, "Bearer test-token");
  assert.equal(sent.cache, "no-store");
});

test("polling forwards a short authenticated GET without a body", async () => {
  let sent;
  const call = fixture(async (_, options) => { sent = options; return Response.json({ items: [] }); });
  assert.equal((await call("GET")).status, 200);
  assert.equal(sent.method, "GET");
  assert.equal(sent.body, undefined);
});

test("unauthenticated polling and submission cannot reach the backend", async () => {
  let calls = 0;
  const call = fixture(async () => { calls++; }, null);
  assert.equal((await call("POST")).status, 401);
  assert.equal((await call("GET")).status, 401);
  assert.equal(calls, 0);
});

test("queue/configuration errors and invalid responses remain explicit failures", async () => {
  for (const [status, detail] of [[429, "ai_job_limit"], [503, "ai_not_configured"], [404, "ai_job_not_found"]]) {
    const response = await fixture(async () => Response.json({ detail }, { status }))();
    assert.equal(response.status, status);
    assert.equal((await response.json()).error, detail);
  }
  const response = await fixture(async () => new Response("bad gateway"))();
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, "ai_jobs_unavailable");
});
