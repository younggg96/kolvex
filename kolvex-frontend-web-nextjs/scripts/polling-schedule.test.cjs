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
const { usMarketsClosed, usRegularSessionOpen } = loaded.exports;

test("24/5 polling continues through overnight in New York time", () => {
  // Wed 2026-11-11, EST (UTC-5)
  assert.equal(usMarketsClosed(new Date("2026-11-11T08:59:00Z")), false); // 03:59
  assert.equal(usMarketsClosed(new Date("2026-11-11T09:00:00Z")), false); // 04:00 pre-market
  assert.equal(usMarketsClosed(new Date("2026-11-11T15:00:00Z")), false); // 10:00 regular
  assert.equal(usMarketsClosed(new Date("2026-11-12T00:59:00Z")), false); // 19:59 after-hours
  assert.equal(usMarketsClosed(new Date("2026-11-12T01:00:00Z")), false); // 20:00
  // Summer time (EDT, UTC-4): 04:00 New York is 08:00 UTC
  assert.equal(usMarketsClosed(new Date("2026-07-15T08:00:00Z")), false);
  assert.equal(usMarketsClosed(new Date("2026-07-15T07:59:00Z")), false);
});

test("Friday after-hours, Saturday and Sunday before the overnight open are closed", () => {
  assert.equal(usMarketsClosed(new Date("2026-11-14T15:00:00Z")), true); // Sat 10:00
  assert.equal(usMarketsClosed(new Date("2026-11-15T20:00:00Z")), true); // Sun 15:00
  assert.equal(usMarketsClosed(new Date("2026-11-16T01:00:00Z")), false); // Sun 20:00
  assert.equal(usMarketsClosed(new Date("2026-11-14T01:00:00Z")), true); // Fri 20:00
});

test("the regular session runs 09:30 to 16:00 New York time on weekdays", () => {
  // Wed 2026-11-11, EST (UTC-5)
  assert.equal(usRegularSessionOpen(new Date("2026-11-11T14:29:00Z")), false); // 09:29
  assert.equal(usRegularSessionOpen(new Date("2026-11-11T14:30:00Z")), true); // 09:30
  assert.equal(usRegularSessionOpen(new Date("2026-11-11T20:59:00Z")), true); // 15:59
  assert.equal(usRegularSessionOpen(new Date("2026-11-11T21:00:00Z")), false); // 16:00
  // Summer time (EDT, UTC-4): 09:30 New York is 13:30 UTC
  assert.equal(usRegularSessionOpen(new Date("2026-07-15T13:30:00Z")), true);
  assert.equal(usRegularSessionOpen(new Date("2026-07-15T13:29:00Z")), false);
  // Saturday 10:00
  assert.equal(usRegularSessionOpen(new Date("2026-11-14T15:00:00Z")), false);
});
