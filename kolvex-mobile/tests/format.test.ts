import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { signedPercent, withSign } from "../src/lib/format";

// The rules themselves are tested on the Web; web-source-parity keeps the two copies identical.
test("signed figures use the typographic minus and drop the sign on zero", () => {
  assert.equal(signedPercent(1.234), "+1.23%");
  assert.equal(signedPercent(-1.234), "−1.23%");
  assert.equal(signedPercent(-0.004), "0.00%");
  assert.equal(signedPercent(null), "—");
  assert.equal(
    withSign(-4.5, (m) => `$${m.toFixed(2)}`),
    "−$4.50",
  );
});

function sourceFiles(dir: URL): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) return sourceFiles(url);
    return /\.(ts|tsx)$/.test(entry.name) ? [url] : [];
  });
}

test('signs come from src/lib/format, not inline `> 0 ? "+" : …` ternaries', () => {
  const src = new URL("../src/", import.meta.url);
  const offenders = sourceFiles(src)
    .filter((url) => !url.pathname.endsWith("/src/lib/format.ts"))
    .filter((url) =>
      /[<>]=? ?0 \? "\+" ?:|\? "\+" : "−"/.test(readFileSync(url, "utf8")),
    )
    .map((url) => url.pathname.slice(src.pathname.length));
  assert.deepEqual(
    offenders,
    [],
    "use withSign / signedPercent from src/lib/format",
  );
});
