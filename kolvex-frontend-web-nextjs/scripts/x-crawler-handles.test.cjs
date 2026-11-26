const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, "../lib/xCrawlerHandles.ts"), "utf8");
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports: module.exports, module },
  );
  return module.exports;
}

const { parseHandle, parseHandles: parseInSandbox } = load();
// Arrays built inside the vm sandbox have a different prototype; compare plain copies.
const parseHandles = (text) => JSON.parse(JSON.stringify(parseInSandbox(text)));

test("accepts usernames, @handles and x.com profile links", () => {
  assert.equal(parseHandle("@MentoviaX"), "mentoviax");
  assert.equal(parseHandle("https://x.com/Unusual_Whales?lang=en"), "unusual_whales");
  assert.equal(parseHandle("https://www.x.com/tj_research/"), "tj_research");
  assert.equal(parseHandle("https://x.com/a/status/1"), null);
  assert.equal(parseHandle("http://x.com/a"), null);
  assert.equal(parseHandle("way_too_long_username"), null);
});

test("splits lines, spaces and Chinese or Latin commas and removes duplicates", () => {
  const result = parseHandles("@One\nhttps://x.com/two，three, one  four;五\n\n");
  assert.deepEqual(result.usernames, ["one", "two", "three", "four"]);
  assert.deepEqual(result.invalid, ["五"]);
});

test("empty input has nothing to add", () => {
  assert.deepEqual(parseHandles(" \n , "), { usernames: [], invalid: [] });
});
