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

test("old backends return an actionable error instead of generic Not Found", async () => {
  const response = await proxy(async () =>
    Response.json({ detail: "Not Found" }, { status: 404 }),
  )();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "paper_backend_outdated");
});

test("upstream session expiry normalizes to the localized unauthorized code", async () => {
  const response = await proxy(async () =>
    Response.json({ detail: "Unauthorized" }, { status: 401 }),
  )();
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "unauthorized");
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

test("stock panel isolates lots, pending orders and realized results by ticker", () => {
  const { stockPaperTrading } = load("../lib/stockPaperTrading.ts");
  const account = {
    state: {
      positions: [
        {
          id: "a",
          symbol: "AMD",
          side: "long",
          quantity: 10,
          entry_price: "100",
        },
        {
          id: "b",
          symbol: "AMD",
          side: "short",
          quantity: 4,
          entry_price: "130",
        },
        {
          id: "c",
          symbol: "NVDA",
          side: "long",
          quantity: 100,
          entry_price: "10",
        },
      ],
      orders: [
        { id: "pending", symbol: "AMD", status: "pending" },
        { id: "filled", symbol: "AMD", status: "filled" },
        { id: "other", symbol: "NVDA", status: "pending" },
      ],
      fills: [
        { id: "open", symbol: "AMD", effect: "open", realized_pnl: "0" },
        { id: "close1", symbol: "AMD", effect: "close", realized_pnl: "19.5" },
        { id: "other", symbol: "NVDA", effect: "close", realized_pnl: "9999" },
        { id: "close2", symbol: "AMD", effect: "close", realized_pnl: "-3.2" },
      ],
      marks: { AMD: { price: "120", at: "2026-11-03T15:00:00Z" } },
    },
    summary: { realized_pnl: "9999" },
  };
  const result = stockPaperTrading(account, " amd ");
  assert.equal(result.positions.length, 2);
  assert.equal(result.unrealizedPnl, 240);
  assert.equal(result.realizedPnl, 16.3);
  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].id, "pending");
  assert.equal(result.fills[0].id, "close2");
  assert.equal(account.state.fills[0].id, "open");
  const empty = stockPaperTrading(account, "MSFT");
  assert.equal(empty.positions.length, 0);
  assert.equal(empty.fills.length, 0);
  assert.equal(empty.realizedPnl, 0);
});

test("missing marks use entry and short price rises show a loss", () => {
  const { stockPaperTrading } = load("../lib/stockPaperTrading.ts");
  const account = {
    state: {
      positions: [
        { symbol: "AMD", side: "short", quantity: 3, entry_price: "100" },
      ],
      orders: [],
      fills: [],
      marks: {},
    },
  };
  assert.equal(stockPaperTrading(account, "AMD").unrealizedPnl, 0);
  account.state.marks.AMD = { price: "110" };
  assert.equal(stockPaperTrading(account, "AMD").unrealizedPnl, -30);
});

test("journal separates same-symbol lots and keeps partial closes private", () => {
  const { paperTradingReviews } = load("../lib/paperTradingReviews.ts");
  const fill = (id, position_id, effect, at, extra = {}) => ({
    id,
    position_id,
    symbol: "AMD",
    side: "short",
    effect,
    at,
    price: "100",
    quantity: 10,
    fee: "1",
    realized_pnl: "0",
    note: "",
    ...extra,
  });
  const fills = [
    fill("a-open", "a", "open", "2026-11-01T12:00:00Z", {
      note: "Entry thesis",
    }),
    fill("b-open", "b", "open", "2026-11-01T13:00:00Z"),
    fill("a-partial", "a", "close", "2026-11-02T12:00:00Z", {
      realized_pnl: "18.75",
    }),
    fill("b-partial", "b", "close", "2026-11-02T13:00:00Z", {
      realized_pnl: "-11.50",
    }),
    fill("b-close", "b", "close", "2026-11-03T13:00:00Z", {
      realized_pnl: "4.25",
    }),
  ];
  const account = {
    state: {
      positions: [
        {
          id: "a",
          symbol: "AMD",
          side: "short",
          quantity: 5,
          entry_price: "100",
        },
      ],
      fills,
      marks: { AMD: { price: "110", at: "2026-11-03T14:00:00Z" } },
    },
  };
  const [closed, open] = paperTradingReviews(account);
  assert.equal(closed.id, "b");
  assert.equal(closed.completed, true);
  assert.equal(closed.realizedPnl, -7.25);
  assert.equal(closed.fees, 3);
  assert.equal(closed.lastAt, "2026-11-03T13:00:00Z");
  assert.equal(open.completed, false);
  assert.equal(open.remaining, 5);
  assert.equal(open.unrealizedPnl, -50);
  assert.equal(open.realizedPnl, 18.75);
  assert.equal(open.thesis, "Entry thesis");
  assert.equal(fills[0].id, "a-open");
});

test("journal uses entry valuation without a mark and has no fabricated trades", () => {
  const { paperTradingReviews } = load("../lib/paperTradingReviews.ts");
  const account = { state: { positions: [], fills: [], marks: {} } };
  assert.equal(paperTradingReviews(account).length, 0);
  account.state.positions.push({
    id: "open",
    symbol: "AAPL",
    side: "long",
    quantity: 2,
    entry_price: "120",
    note: "Original thesis",
  });
  account.state.fills.push({
    id: "fill",
    position_id: "open",
    symbol: "AAPL",
    side: "long",
    effect: "open",
    at: "2026-11-01T12:00:00Z",
    fee: "0.25",
    realized_pnl: "0",
  });
  const trade = paperTradingReviews(account)[0];
  assert.equal(trade.completed, false);
  assert.equal(trade.unrealizedPnl, 0);
  assert.equal(trade.markAt, undefined);
  assert.equal(trade.thesis, "Original thesis");
});
