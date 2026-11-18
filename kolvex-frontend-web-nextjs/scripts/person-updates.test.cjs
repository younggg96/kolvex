const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const context = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, "../lib/personUpdates.ts"), "utf8");
vm.runInNewContext(
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  context,
);
const { PERSON_UPDATE_ZONES, personUpdateTime, personUpdatePeople } = context.exports;

test("the same instant keeps each market's local date", () => {
  const winter = "2026-11-18T02:44:00-05:00";
  const result = PERSON_UPDATE_ZONES.map(([zone]) => personUpdateTime(winter, "en-US", zone));
  assert.equal(result[0], "Nov 17, 2026, 23:44");
  assert.equal(result[1], "Nov 18, 2026, 02:44");
  assert.equal(result[2], "Nov 18, 2026, 15:44");
});

test("market time follows daylight saving time", () => {
  const summer = "2026-07-20T12:00:00Z";
  assert.match(personUpdateTime(summer, "zh-CN", "America/Los_Angeles"), /05:00/);
  assert.match(personUpdateTime(summer, "zh-CN", "America/New_York"), /08:00/);
  assert.match(personUpdateTime(summer, "zh-CN", "Asia/Shanghai"), /20:00/);
});

test("groups the avatar rail by person and counts only updates from the last 24 hours", () => {
  const now = Date.parse("2026-11-18T10:00:00Z");
  const items = [
    { person: "Alpha", person_cn: "甲", published_at: "2026-11-18T11:00:00Z" },
    { person: "Alpha", person_cn: "甲", published_at: "2026-11-18T10:00:00Z" },
    { person: "Beta", person_cn: "乙", published_at: "2026-11-18T04:00:00-05:00" },
    {
      person: "Alpha",
      person_cn: "甲",
      published_at: "2026-11-17T10:00:01Z",
      avatar_url: "https://example.test/alpha.jpg",
    },
    {
      person: "Beta",
      person_cn: "乙",
      published_at: "2026-11-17T10:00:00Z",
      avatar_url: "https://example.test/beta.jpg",
    },
    { person: "Gamma", person_cn: "丙", published_at: "invalid" },
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(personUpdatePeople(items, now))), [
    { name: "Alpha", label: "甲", avatar: "https://example.test/alpha.jpg", newCount: 2 },
    { name: "Beta", label: "乙", avatar: "https://example.test/beta.jpg", newCount: 1 },
    { name: "Gamma", label: "丙", avatar: null, newCount: 0 },
  ]);
});
