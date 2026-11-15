const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { format } = require("./helpers/format.cjs");

const { MINUS_SIGN, signFor, withSign, signedPercent } = format;
const ROOT = path.join(__dirname, "..");

test("positives get +, negatives the typographic minus, zero no sign", () => {
  assert.equal(MINUS_SIGN, "−");
  assert.equal(signedPercent(1.234), "+1.23%");
  assert.equal(signedPercent(-1.234), "−1.23%");
  assert.equal(signedPercent(0), "0.00%");
  assert.equal(signedPercent(-12.96, 1), "−13.0%");
});

test("values that round to zero never show a signed zero", () => {
  assert.equal(signedPercent(-0.004), "0.00%");
  assert.equal(signedPercent(0.004), "0.00%");
  assert.equal(signedPercent(-0.04, 1), "0.0%");
  assert.equal(signFor(-0.004, 2), "");
  assert.equal(signFor(-0.004), "−");
});

test("missing values are a dash, and magnitudes never carry their own minus", () => {
  assert.equal(signedPercent(null), "—");
  assert.equal(signedPercent(undefined), "—");
  assert.equal(signedPercent(Number.NaN), "—");
  const money = (value) => `$${value.toFixed(2)}`;
  assert.equal(withSign(-4.5, money), "−$4.50");
  assert.equal(withSign(4.5, money), "+$4.50");
  assert.equal(withSign(4.5, money, { plus: false }), "$4.50");
  assert.equal(withSign(-4.5, money, { plus: false }), "−$4.50");
});

function sourceFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.(ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}

test('signs come from lib/format, not inline `> 0 ? "+" : …` ternaries', () => {
  const offenders = [];
  for (const file of ["app", "components", "hooks", "lib"].flatMap(sourceFiles)) {
    if (file === "lib/format.ts") continue;
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    if (/[<>]=? ?0 \? "\+" ?:/.test(text)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], "use withSign / signedPercent from @/lib/format");
});
