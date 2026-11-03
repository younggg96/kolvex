import test from "node:test";
import assert from "node:assert/strict";
process.env.EXPO_PUBLIC_API_URL = "https://api.example.test/api/v1";
const modules = Promise.all([
  import("../src/lib/http"),
  import("../src/lib/featureApi"),
]);
test("creator/video/option reads use existing reader contracts without an account token", async () => {
  const [http, api] = await modules;
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const old = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      headers: init?.headers as Record<string, string>,
    });
    return new Response(JSON.stringify({}));
  };
  try {
    http.configureIdentity(async () => ({ token: "private", userId: "u" }));
    await api.catalogue(
      new AbortController().signal,
      "&channel_id=c&offset=20",
    );
    await api.creatorProfile("a/b", new AbortController().signal);
    await api.videos(2, new AbortController().signal);
    await api.optionChain("BRK.B", "2026-12-18", new AbortController().signal);
    assert.ok(
      calls[0].url.endsWith(
        "/youtube-opinions/dashboard?limit=20&channel_id=c&offset=20",
      ),
    );
    assert.ok(calls[1].url.includes("/creators/a%2Fb/profile"));
    assert.ok(calls[2].url.endsWith("/videos?limit=20&offset=20"));
    assert.ok(calls[3].url.endsWith("/market/options/BRK.B/2026-12-18"));
    calls.forEach((c) => assert.equal(c.headers.Authorization, undefined));
  } finally {
    globalThis.fetch = old;
    http.configureIdentity(async () => null);
  }
});
test("macro reads require the selected account; versioned writes and multipart uploads preserve their wire formats", async () => {
  const [http, api] = await modules;
  const calls: { url: string; init?: RequestInit }[] = [];
  const old = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({}));
  };
  try {
    http.configureIdentity(async () => ({ token: "session", userId: "u" }));
    await api.indicators("u", new AbortController().signal);
    await http.apiRequest("/admin/briefs/id", {
      method: "PUT",
      body: { payload: 1 },
      revision: "7",
      authenticated: true,
      expectedUser: "u",
    });
    const form = new FormData();
    form.append("image_data", "encoded");
    await http.apiRequest("/upload/avatar/base64", {
      method: "POST",
      form,
      authenticated: true,
      expectedUser: "u",
    });
    assert.equal(
      (calls[0].init?.headers as Record<string, string>).Authorization,
      "Bearer session",
    );
    assert.equal(
      (calls[1].init?.headers as Record<string, string>)["If-Match"],
      "7",
    );
    assert.equal(calls[2].init?.body, form);
    assert.equal(
      (calls[2].init?.headers as Record<string, string>)["Content-Type"],
      undefined,
    );
    await assert.rejects(api.indicators("other", new AbortController().signal));
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = old;
    http.configureIdentity(async () => null);
  }
});
test("macro unit conversion preserves zero and percentage-point semantics", async () => {
  const { indicatorValue } = await import("../src/lib/economicIndicators");
  assert.equal(indicatorValue(0, "percent", "zh-CN"), "0.00%");
  assert.equal(indicatorValue(100, "thousands", "zh-CN"), "10.0 万人");
  assert.equal(indicatorValue(100, "thousands", "en-US"), "100K");
  assert.equal(indicatorValue(null, "bp", "zh-CN"), "—");
  assert.equal(indicatorValue(0.5, "pp", "zh-CN"), "0.50 个百分点");
  assert.equal(indicatorValue(-5, "bp", "zh-CN", true), "−5.00 bp");
});
