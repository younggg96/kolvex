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
const { briefFilters, briefLibraryHref, briefArticleHref, formatBriefDate, briefDateKey, briefCalendarDate, shiftBriefDate, pacificBriefToday } = exportsObject;

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
  for (const date of ["2026-02-30", "2026-13-01", "invalid", "2026-1-1"]) assert.equal(briefFilters({ date }).date, undefined);
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
