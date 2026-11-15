const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const loaded = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/pollingSchedule.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText,
  { module: loaded, exports: loaded.exports, Intl, Date, Number },
);
const { usMarketsClosed } = loaded.exports;

test("US markets count as open from 04:00 to 20:00 New York time on weekdays", () => {
  // Wed 2026-11-11, EST (UTC-5)
  assert.equal(usMarketsClosed(new Date("2026-11-11T08:59:00Z")), true); // 03:59
  assert.equal(usMarketsClosed(new Date("2026-11-11T09:00:00Z")), false); // 04:00 pre-market
  assert.equal(usMarketsClosed(new Date("2026-11-11T15:00:00Z")), false); // 10:00 regular
  assert.equal(usMarketsClosed(new Date("2026-11-12T00:59:00Z")), false); // 19:59 after-hours
  assert.equal(usMarketsClosed(new Date("2026-11-12T01:00:00Z")), true); // 20:00
  // Summer time (EDT, UTC-4): 04:00 New York is 08:00 UTC
  assert.equal(usMarketsClosed(new Date("2026-07-15T08:00:00Z")), false);
  assert.equal(usMarketsClosed(new Date("2026-07-15T07:59:00Z")), true);
});

test("weekends are closed all day", () => {
  assert.equal(usMarketsClosed(new Date("2026-11-14T15:00:00Z")), true); // Sat 10:00
  assert.equal(usMarketsClosed(new Date("2026-11-15T20:00:00Z")), true); // Sun 15:00
});
