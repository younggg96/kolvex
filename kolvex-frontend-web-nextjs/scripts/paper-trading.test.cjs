const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(relativePath, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, relativePath), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText,
    {
      module,
      exports: module.exports,
      URLSearchParams,
      AbortController,
      AbortSignal,
      setTimeout,
      clearTimeout,
      ...globals,
    },
  );
  return module.exports;
}

function proxy(fetch, session = { access_token: "fixture-token" }) {
  const api = load("../app/api/paper-trading/[...path]/route.ts", {
    fetch,
    process: {
      env: { NEXT_PUBLIC_BACKEND_API_URL: "https://backend.example" },
    },
    require(name) {
      if (name === "next/server") return { NextResponse: Response };
      if (name === "@/lib/supabase/server")
        return {
          createServerSupabaseClient: async () => ({
            auth: { getSession: async () => ({ data: { session } }) },
          }),
        };
      throw Error(name);
    },
  });
  return (method = "GET", path = ["account"], body = {}) =>
    api[method](
      {
        method,
        nextUrl: { search: "" },
        text: async () => JSON.stringify(body),
      },
      { params: { path } },
    );
}

test("AI setup becomes an editable draft with no quantity or execution command", () => {
  const api = load("../lib/paperTrading.ts");
  const url = new URL(
    api.paperSetupHref("NVDA", {
      direction: "bearish",
      entry_low: 150,
      invalidation: 160,
      targets: [130, 120],
      name: "压力位回落",
      reason: "等待确认 & 控制风险",
    }),
    "https://example.test",
  );
  assert.equal(url.pathname, "/dashboard/paper-trading");
  assert.equal(url.searchParams.get("side"), "short");
  assert.equal(url.searchParams.get("stop"), "160");
  assert.equal(url.searchParams.get("target"), "130");
  assert.match(url.searchParams.get("note"), /等待确认 & 控制风险/);
  assert.equal(url.searchParams.has("quantity"), false);
  assert.equal(url.searchParams.has("action"), false);
});

test("retry sends the same request ID and forbids cached balances", async () => {
  const sent = [];
  const api = load("../lib/paperTrading.ts", {
    fetch: async (_, options) => {
      sent.push(options);
      return Response.json({ version: 1 });
    },
  });
  const body = {
    action: "order",
    request_id: "same-id",
    symbol: "AAPL",
    kind: "market",
    side: "long",
    quantity: 1,
  };
  await api.sendCommand(body);
  await api.sendCommand(body);
  assert.equal(
    JSON.parse(sent[0].body).request_id,
    JSON.parse(sent[1].body).request_id,
  );
  assert.equal(sent[0].cache, "no-store");
});

test("proxy attaches only the authenticated session and preserves the command", async () => {
  let sent;
  const call = proxy(async (url, options) => {
    sent = { url, ...options };
    return Response.json({ version: 1 });
  });
  const body = {
    action: "cancel",
    order_id: "order-id",
    request_id: "same-id",
  };
  const response = await call("POST", ["commands"], body);
  assert.equal(response.status, 200);
  assert.equal(
    sent.url,
    "https://backend.example/api/v1/paper-trading/commands",
  );
  assert.equal(sent.headers.Authorization, "Bearer fixture-token");
  assert.deepEqual(JSON.parse(sent.body), body);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("unauthenticated requests and non-allowlisted routes cannot reach backend", async () => {
  let calls = 0;
  const fetch = async () => {
    calls++;
    return Response.json({});
  };
  assert.equal((await proxy(fetch, null)()).status, 401);
  assert.equal((await proxy(fetch)("GET", ["admin", "accounts"])).status, 404);
  assert.equal(calls, 0);
});

test("proxy preserves account conflict, validation and unavailable failures", async () => {
  for (const [status, detail] of [
    [409, "account_conflict"],
    [422, "insufficient_funds"],
    [503, "paper_storage_unavailable"],
  ]) {
    const response = await proxy(async () =>
      Response.json({ detail }, { status }),
    )();
    assert.equal(response.status, status);
    assert.equal((await response.json()).error, detail);
  }
});

test("malformed upstream success becomes an explicit gateway failure", async () => {
  const response = await proxy(async () => new Response("invalid"))();
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, "backend_unavailable");
});

test("client retains the server error code and status for recovery", async () => {
  const api = load("../lib/paperTrading.ts", {
    fetch: async () =>
      Response.json({ error: "account_conflict" }, { status: 409 }),
  });
  await assert.rejects(
    api.sendCommand({ request_id: "id", action: "sync" }),
    (error) => error.code === "account_conflict" && error.status === 409,
  );
});
