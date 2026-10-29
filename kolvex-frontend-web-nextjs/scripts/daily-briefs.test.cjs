const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../lib/dailyBriefs.ts"), "utf8");
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
  exports: exportsObject, URLSearchParams, Intl, Date, Number,
});
const { briefReadingFilters, briefFilters, briefLibraryHref, briefArticleHref, formatBriefDate, briefDateKey, briefCalendarDate, shiftBriefDate, pacificBriefToday } = exportsObject;

test("article and return links retain the reader's filter and page", () => {
  assert.equal(briefLibraryHref("evening", 2), "/dashboard/briefs?type=evening&page=2");
  assert.equal(briefArticleHref("evening-2026-10-17", "evening", 2), "/dashboard/briefs/evening-2026-10-17?type=evening&page=2");
  assert.equal(briefLibraryHref(), "/dashboard/briefs");
  assert.equal(briefArticleHref("bad/id?query"), "/dashboard/briefs/bad%2Fid%3Fquery");
});

test("invalid paging and filters recover without unbounded requests", () => {
  for (const page of ["0", "-1", "1.5", "Infinity", "1000001", "invalid"]) {
    assert.equal(briefFilters({ page, type: "other" }).page, 1);
    assert.equal(briefFilters({ page, type: "other" }).type, "all");
  }
  assert.equal(briefFilters({ page: "2", type: "morning" }).page, 2);
  assert.equal(briefFilters({ type: "morning" }).type, "morning");
});

test("Pacific issue dates remain calendar labels in any reader timezone", () => {
  const original = process.env.TZ;
  try {
    for (const zone of ["America/Los_Angeles", "Asia/Shanghai", "Pacific/Kiritimati"]) {
      process.env.TZ = zone;
      assert.equal(formatBriefDate("2026-10-17", "en-US"), "Oct 17, 2026");
      assert.match(formatBriefDate("2026-10-17", "zh-CN"), /2026.*10.*17/);
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});


test("calendar filters survive type changes, article links and returns", () => {
  const parsed = briefFilters({ date: "2026-10-17", type: "evening", page: "2" });
  assert.equal(parsed.date, "2026-10-17");
  assert.equal(briefLibraryHref(parsed.type, parsed.page, parsed.date), "/dashboard/briefs?type=evening&page=2&date=2026-10-17");
  assert.equal(briefArticleHref("evening-2026-10-17", parsed.type, parsed.page, parsed.date), "/dashboard/briefs/evening-2026-10-17?type=evening&page=2&date=2026-10-17");
  for (const date of ["2026-02-30", "2026-13-01", "invalid", "2026-1-1"]) assert.equal(briefFilters({ date }, new Date("2026-10-18T12:00:00Z")).date, "2026-10-18");
});

test("calendar day changes handle leap days, month/year boundaries and DST", () => {
  const original = process.env.TZ;
  try {
    for (const zone of ["America/Los_Angeles", "Asia/Shanghai", "Pacific/Kiritimati"]) {
      process.env.TZ = zone;
      assert.equal(briefDateKey(briefCalendarDate("2026-10-17")), "2026-10-17");
      assert.equal(shiftBriefDate("2026-01-01", -1), "2025-12-31");
      assert.equal(shiftBriefDate("2028-02-28", 1), "2028-02-29");
      assert.equal(shiftBriefDate("2028-02-29", 1), "2028-03-01");
      assert.equal(shiftBriefDate("2026-03-08", 1), "2026-03-09");
      assert.equal(pacificBriefToday(new Date("2026-10-18T01:00:00Z")), "2026-10-17");
      assert.equal(pacificBriefToday(new Date("2026-12-18T07:00:00Z")), "2026-12-17");
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test("reader entry defaults to only today in Pacific time, even with no published issue", () => {
  for (const [instant, expected] of [
    ["2026-10-18T06:59:59Z", "2026-10-17"],
    ["2026-10-18T07:00:00Z", "2026-10-18"],
    ["2026-12-18T07:59:59Z", "2026-12-17"],
    ["2026-12-18T08:00:00Z", "2026-12-18"],
  ]) {
    const now = new Date(instant);
    const entry = briefFilters(undefined, now);
    assert.equal(entry.date, expected);
    assert.equal(entry.type, "all");
    assert.equal(briefFilters({ type: "morning" }, now).date, expected);
    assert.equal(briefFilters({ date: "2026-10-16" }, now).date, "2026-10-16");
    assert.equal(briefLibraryHref(entry.type, entry.page, entry.date), `/dashboard/briefs?date=${expected}`);
  }
});

test("direct reader selects all three editions at Pacific session boundaries in summer and winter", () => {
  for (const [instant, expected, date] of [
    ["2026-10-18T07:00:00Z", "morning", "2026-10-18"],
    ["2026-10-18T13:29:59Z", "morning", "2026-10-18"],
    ["2026-10-18T13:30:00Z", "intraday", "2026-10-18"],
    ["2026-10-18T20:59:59Z", "intraday", "2026-10-18"],
    ["2026-10-18T21:00:00Z", "evening", "2026-10-18"],
    ["2026-12-18T21:59:59Z", "intraday", "2026-12-18"],
    ["2026-12-18T22:00:00Z", "evening", "2026-12-18"],
    ["2026-10-19T06:59:59Z", "evening", "2026-10-18"],
    ["2026-12-18T14:29:59Z", "morning", "2026-12-18"],
    ["2026-12-18T14:30:00Z", "intraday", "2026-12-18"],
  ]) {
    const now = new Date(instant);
    const result = briefReadingFilters(undefined, now);
    assert.equal(result.date, date);
    assert.equal(result.type, expected);
    assert.equal(result.id, `${expected}-${date}`);
    assert.equal(briefReadingFilters({ type: "all" }, now).type, expected);
    for (const type of ["morning", "intraday", "evening"]) {
      const selected = briefReadingFilters({ type, date: "2026-10-17" }, now);
      assert.equal(selected.id, `${type}-2026-10-17`);
    }
  }
});


test("uploaded language follows preference without translating or mutating source data", () => {
  const original = {
    language: "zh", schema_version: "kolvex-brief/1.0",
    brief: { id: "intraday-2026-10-29", type: "intraday", date: "2026-10-29", title: "中文标题", headline: "中文摘要", subtitle: "中文副标题", hero_image: { url: "https://example.com/image.png" } },
    sections: [{ section_id: "intraday", title: "中文正文" }], disclaimer: "中文声明",
    translations: { en: { title: "English title", headline: "English headline", sections: [{ section_id: "intraday", title: "Uploaded English body" }], disclaimer: "English disclaimer" } },
  };
  const snapshot = JSON.stringify(original);
  const english = exportsObject.localizedBrief(original, "en");
  assert.equal(english.brief.headline, "English headline");
  assert.equal(english.sections[0].title, "Uploaded English body");
  assert.equal(english.disclaimer, "English disclaimer");
  assert.equal(english.brief.subtitle, "");
  assert.equal(english.brief.id, original.brief.id);
  assert.equal(english.brief.date, original.brief.date);
  assert.equal(english.brief.hero_image.url, original.brief.hero_image.url);
  assert.equal(english.language, "en");
  assert.equal(exportsObject.localizedBrief(original, "zh"), original);
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(exportsObject.localizedBrief({ ...original, translations: {} }, "en").brief.headline, "中文摘要");
  const reverse = { ...original, language: "en", translations: { zh: { title: "上传中文", headline: "中文摘要", sections: [], hero_image: null } } };
  assert.equal(exportsObject.localizedBrief(reverse, "zh").brief.title, "上传中文");
  assert.equal(exportsObject.localizedBrief(reverse, "zh").brief.hero_image.url, original.brief.hero_image.url);
  const legacy = { ...original }; delete legacy.language; delete legacy.translations;
  assert.equal(exportsObject.localizedBrief(legacy, "en"), legacy);
});

test("admin mutations forward method, JSON and revision headers", async () => {
  const calls = [], contextExports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports: contextExports, URLSearchParams, Intl, Date, Number, AbortSignal,
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ id: "test" }) }; },
  });
  await contextExports.briefRequest('?id=test', '{"test":true}', undefined, { method: 'PUT', revision: '3' });
  await contextExports.briefRequest('?id=test', undefined, undefined, { method: 'DELETE', revision: '4' });
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(calls[0].options.headers['If-Match'], '3');
  assert.equal(calls[0].options.body, '{"test":true}');
  assert.equal(calls[1].options.method, 'DELETE');
  assert.equal(calls[1].options.headers['If-Match'], '4');
  assert.equal(calls[1].options.body, undefined);
});
