const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, overrides = {}, globals = {}) {
  const filename = path.resolve(__dirname, "../", file);
  const module = { exports: {} };
  const requireModule = (name) => {
    if (name in overrides) return overrides[name];
    if (name === "server-only") return {};
    if (name === "react") return { cache: (fn) => fn };
    if (name.startsWith("@/")) return load(name.slice(2) + ".ts", overrides, globals);
    if (name.startsWith("."))
      return load(
        path.relative(path.resolve(__dirname, "../"), path.resolve(path.dirname(filename), name)) +
          ".ts",
        overrides,
        globals,
      );
    throw new Error("Unexpected module " + name);
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: requireModule,
      URL,
      URLSearchParams,
      Date,
      AbortSignal,
      process: { env: { NEXT_PUBLIC_BACKEND_API_URL: "https://backend.example/" } },
      ...globals,
    },
  );
  return module.exports;
}
const routes = load("lib/publicRoutes.ts");
const id = "11111111-1111-4111-8111-111111111111";
const published = {
  id,
  ticker: "NVDA",
  is_published: true,
  status: "completed",
  published_at: "2026-10-18T12:00:00Z",
};
const response = (data, status = 200) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => data,
});

test("public route inputs reject path/query injection and normalize page boundaries", () => {
  for (const ticker of ["../private", "NVDA?x=y", "", "nvda", "A/B", "X".repeat(21)])
    assert.equal(routes.validTicker(ticker), false);
  for (const ticker of ["NVDA", "BRK.B", "^GSPC", "BTC-USD", "0700.HK"])
    assert.equal(routes.validTicker(ticker), true);
  for (const value of ["0", "-1", "1.2", "abc", ["2"], "1000000"])
    assert.equal(routes.publicPage(value), null);
  assert.equal(routes.publicPage(undefined), 1);
  assert.equal(routes.publicPage("2"), 2);
  assert.equal(routes.publicPagePath("/research", 1), "/research");
  assert.equal(routes.publicPagePath("/research", 2), "/research/page/2");
  for (const value of ["/research", "/creators", "/stocks", "/stocks/NVDA"])
    assert.equal(routes.PAGINATED_PUBLIC_PATH.test(value), true);
  for (const value of [
    "/research/" + "1".repeat(8) + "/x",
    "/stocks/NVDA/page/2",
    "/share/creators/abc",
    "/dashboard",
  ])
    assert.equal(routes.PAGINATED_PUBLIC_PATH.test(value), false);
  assert.equal(routes.validReportId("../private"), false);
});

test("only published completed reports are visible and every read is anonymous and cache-tagged", async () => {
  let record = published;
  const calls = [];
  const api = load(
    "lib/publicContent.ts",
    {},
    {
      fetch: async (...args) => {
        calls.push(args);
        return response(record);
      },
    },
  );
  assert.equal(await api.getPublicResearch("../private"), null);
  assert.equal(calls.length, 0);
  assert.equal((await api.getPublicResearch(id)).ticker, "NVDA");
  record = { ...published, is_published: false };
  assert.equal(await api.getPublicResearch(id), null);
  record = { ...published, status: "running" };
  assert.equal(await api.getPublicResearch(id), null);
  for (const [url, options] of calls) {
    assert.equal(url, `https://backend.example/api/v1/trading-analysis/public/${id}`);
    assert.equal(options.cache, undefined);
    assert.equal(options.next.revalidate, api.PUBLIC_CONTENT_REVALIDATE_SECONDS);
    assert.deepEqual([...options.next.tags], [api.PUBLIC_CONTENT_TAG]);
    assert.equal(options.credentials, "omit");
    assert.equal(options.headers, undefined);
    assert.ok(options.signal instanceof AbortSignal);
  }
});

test("missing content and upstream failure remain distinct", async () => {
  const missing = load("lib/publicContent.ts", {}, { fetch: async () => response(null, 404) });
  assert.equal(await missing.getPublicResearch(id), null);
  const failure = load("lib/publicContent.ts", {}, { fetch: async () => response({}, 503) });
  await assert.rejects(failure.getPublicResearch(id), /temporarily unavailable/);
  await assert.rejects(failure.getPublicOpinions(), /temporarily unavailable/);
  const networkFailure = load(
    "lib/publicContent.ts",
    {},
    {
      fetch: async () => {
        throw new Error("offline");
      },
    },
  );
  await assert.rejects(networkFailure.getPublicResearch(id), /offline/);
});

test("research listing excludes unpublished or unfinished entries and preserves API pagination", async () => {
  let url;
  const api = load(
    "lib/publicContent.ts",
    {},
    {
      fetch: async (value) => {
        url = new URL(value);
        return response({
          items: [
            published,
            { ...published, is_published: false },
            { ...published, status: "failed" },
          ],
          total: 50,
          offset: 20,
          limit: 20,
        });
      },
    },
  );
  const data = await api.getPublicResearchList(20, 20, "NVDA");
  assert.equal(data.items.length, 1);
  assert.equal(data.total, 50);
  assert.equal(url.pathname, "/api/v1/trading-analysis/public/list");
  assert.equal(url.searchParams.get("offset"), "20");
  assert.equal(url.searchParams.get("ticker"), "NVDA");
});

test("sitemap walks every report batch, adds opinion routes and pagination without account URLs", async () => {
  const reports = Array.from({ length: 205 }, (_, i) => ({
    ...published,
    id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
  }));
  const offsets = [];
  const api = {
    getPublicOpinions: async () => ({
      creators: [{ channel_id: "creator1", total_opinions: 45 }],
      stocks: [{ ticker: "NVDA", total_opinions: 45 }],
    }),
    getPublicResearchList: async (offset, limit) => {
      offsets.push(offset);
      return { items: reports.slice(offset, offset + limit), total: reports.length };
    },
  };
  const sitemap = await load("lib/publicSitemap.ts", {
    "@/lib/publicContent": api,
  }).buildPublicSitemap();
  const urls = sitemap.map((entry) => entry.url);
  assert.deepEqual(offsets, [0, 100, 200]);
  assert.equal(urls.filter((url) => /\/research\/[0-9]/.test(url)).length, 205);
  assert.ok(urls.includes("https://kolvex.app/research/page/11"));
  assert.ok(urls.includes("https://kolvex.app/stocks/NVDA/page/3"));
  assert.ok(urls.every((url) => !url.includes("?")));
  assert.ok(urls.includes("https://kolvex.app/share/creators/creator1"));
  assert.equal(urls.filter((url) => url === "https://kolvex.app/stocks/NVDA").length, 1);
  assert.ok(urls.every((url) => !/dashboard|auth|api\//.test(url)));
  assert.ok(
    sitemap.some(
      (entry) => entry.lastModified?.toISOString() === published.published_at.replace("Z", ".000Z"),
    ),
  );
  api.getPublicOpinions = async () => {
    throw new Error("offline");
  };
  await assert.rejects(
    load("lib/publicSitemap.ts", { "@/lib/publicContent": api }).buildPublicSitemap(),
    /offline/,
  );
});

test("stock summary states only recorded counts and omits itself when nothing is recorded", () => {
  const seo = load("lib/publicSeo.ts");
  const counts = {
    total_opinions: 172,
    total_creators: 13,
    bullish_count: 64,
    bearish_count: 33,
    neutral_count: 75,
  };
  const latest = {
    ticker: "NVDA",
    channel_title: "博主A",
    opinion_date: "2026-11-13",
    sentiment: "bearish",
  };
  assert.equal(
    seo.stockOpinionSummary("NVDA", counts, latest, 2),
    "Kolvex 共收录 13 位博主对 NVDA 的 172 条观点：看多 64 条、看空 33 条、中性 75 条。最近一条来自「博主A」（2026-11-13，看空）。另有 2 篇已发布的 NVDA AI 研究报告。",
  );
  assert.equal(seo.stockOpinionSummary("NVDA", counts, null, 0).includes("最近一条"), false);
  assert.equal(seo.stockOpinionSummary("NVDA", { ...counts, total_opinions: 0 }, latest, 0), null);
  assert.equal(
    seo.stockOpinionSummary("NVDA", null, null, 3),
    "另有 3 篇已发布的 NVDA AI 研究报告。",
  );
});

test("opinion structured data mirrors each recorded opinion and its source video", () => {
  const seo = load("lib/publicSeo.ts");
  const data = seo.opinionCollectionData(
    "NVDA 股票研究与博主观点",
    "/stocks/NVDA/page/2",
    [
      {
        ticker: "NVDA",
        company_name: "NVIDIA",
        sentiment: "bullish",
        channel_title: "博主A",
        opinion_date: "2026-11-13",
        video_url: "https://www.youtube.com/watch?v=abc",
        summary: "看好数据中心",
      },
      { ticker: "NVDA", sentiment: null },
    ],
    { "@type": "Corporation", tickerSymbol: "NVDA" },
  );
  assert.equal(data["@type"], "CollectionPage");
  assert.equal(data.url, "https://kolvex.app/stocks/NVDA/page/2");
  assert.equal(data.mainEntity.numberOfItems, 2);
  const [first, second] = data.mainEntity.itemListElement.map((entry) => entry.item);
  assert.equal(first.author.name, "博主A");
  assert.equal(first.dateCreated, "2026-11-13");
  assert.equal(first.url, "https://www.youtube.com/watch?v=abc");
  assert.equal(first.text, "看好数据中心");
  assert.equal(first.keywords, "看多");
  assert.equal(first.about.name, "NVIDIA");
  // Missing fields are omitted, never filled with placeholders.
  assert.equal(second.author, undefined);
  assert.equal(second.text, undefined);
  assert.equal(second.url, undefined);
});
