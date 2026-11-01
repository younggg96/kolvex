import assert from "node:assert/strict";
import { test } from "node:test";
process.env.EXPO_PUBLIC_API_URL = "https://backend.example.test/api/v1";
const transport = import("../src/lib/http");
test("private routes require login and never issue an anonymous request", async () => {
  const { apiRequest, configureIdentity } = await transport;
  configureIdentity(async () => null);
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("{}");
  };
  await assert.rejects(
    apiRequest("/portfolio/holdings", { authenticated: true }),
    /请先登录/,
  );
  assert.equal(calls, 0);
});
test("bearer is scoped to API and account; public calls never get it", async () => {
  const { apiRequest, configureIdentity } = await transport;
  configureIdentity(async () => ({ token: "test-token", userId: "alice" }));
  let headers: Record<string, string> = {};
  globalThis.fetch = async (_, options) => {
    headers = options?.headers as Record<string, string>;
    return new Response("{}");
  };
  await apiRequest("/portfolio/holdings", {
    authenticated: true,
    expectedUser: "alice",
  });
  assert.equal(headers.Authorization, "Bearer test-token");
  await apiRequest("/news/feed");
  assert.equal(headers.Authorization, undefined);
  await assert.rejects(
    apiRequest("https://outside.example/steal", { authenticated: true }),
    /无效/,
  );
  await assert.rejects(
    apiRequest("//outside.example/steal", { authenticated: true }),
    /无效/,
  );
  await assert.rejects(
    apiRequest("/portfolio/holdings", {
      authenticated: true,
      expectedUser: "bob",
    }),
    /账户已切换/,
  );
});
test("late response for an old account cannot be consumed", async () => {
  const { apiRequest, configureIdentity } = await transport;
  let userId = "alice";
  configureIdentity(async () => ({ token: "test", userId }));
  globalThis.fetch = async () => {
    userId = "bob";
    return new Response('{"private":true}');
  };
  await assert.rejects(
    apiRequest("/chat/conversations", {
      authenticated: true,
      expectedUser: "alice",
    }),
    /账户已切换/,
  );
});
test("a failed mutation is not replayed automatically and leaks no server internals", async () => {
  const { apiRequest, configureIdentity } = await transport;
  configureIdentity(async () => ({ token: "test", userId: "alice" }));
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("secret server trace", { status: 500 });
  };
  await assert.rejects(
    apiRequest("/chat/conversations", {
      method: "POST",
      body: { title: "new" },
      authenticated: true,
    }),
    (error) =>
      error instanceof Error &&
      !error.message.includes("secret") &&
      error.message.includes("500"),
  );
  assert.equal(calls, 1);
});
