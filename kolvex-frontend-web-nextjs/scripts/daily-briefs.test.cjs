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
const { briefFilters, briefLibraryHref, briefArticleHref, formatBriefDate } = exportsObject;

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
