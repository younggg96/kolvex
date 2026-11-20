const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

// Rendered outside the page (OG image, brand asset exports), so CSS variables are unavailable.
const ALLOWED = new Set([
  "app/opengraph-image.tsx",
  "app/share/[id]/opengraph-image.tsx",
  "lib/brandAssets.ts",
]);

function sourceFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.(ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}

test("components take colours from the app/globals.css tokens, not hex literals", () => {
  const offenders = [];
  for (const file of ["app", "components", "hooks", "lib"].flatMap(sourceFiles)) {
    if (ALLOWED.has(file)) continue;
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    const hex = text.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
    if (hex) offenders.push(`${file}: ${[...new Set(hex)].join(" ")}`);
  }
  assert.deepEqual(offenders, [], "add a token to app/globals.css and use it");
});
