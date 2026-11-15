// Web styles are Tailwind only: app/globals.css is the one stylesheet, and no component imports CSS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const GLOBAL_CSS = path.join("app", "globals.css");
const SOURCE_DIRS = ["app", "components", "lib", "hooks", "pages"];

function walk(dir, files = []) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return files;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, files);
    else files.push(rel);
  }
  return files;
}

const files = SOURCE_DIRS.flatMap((dir) => walk(dir));

test("app/globals.css is the only stylesheet", () => {
  const sheets = files.filter(
    (file) => /\.(css|scss|sass|less)$/.test(file) && file !== GLOBAL_CSS,
  );
  assert.deepEqual(sheets, [], "write these styles as Tailwind classes instead");
});

test("only the root layout imports CSS", () => {
  const offenders = [];
  for (const file of files.filter((f) => /\.(jsx?|tsx?|mjs|cjs)$/.test(f))) {
    fs.readFileSync(path.join(root, file), "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (!/^\s*import\b.*['"][^'"]+\.(css|scss|sass|less)['"]/.test(line)) return;
        if (file === path.join("app", "layout.tsx") && /['"]\.\/globals\.css['"]/.test(line))
          return;
        offenders.push(`${file}:${index + 1}`);
      });
  }
  assert.deepEqual(offenders, []);
});
