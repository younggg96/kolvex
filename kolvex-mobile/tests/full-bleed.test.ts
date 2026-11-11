import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const src = new URL("../src", import.meta.url).pathname;
const app = join(src, "app");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const file = join(dir, entry);
    return statSync(file).isDirectory() ? walk(file) : [file];
  });
}
const routes = walk(app).filter(
  (file) =>
    /\.tsx$/.test(file) &&
    // Layouts and code-only route helpers are not screens of their own.
    !file.endsWith("_layout.tsx") &&
    !file.endsWith("+native-intent.ts"),
);
/** The shared page shells, the backdrop itself, and the routes that draw no screen at all. */
const fullBleed = [
  /<Page[\s>]/,
  /<ListPage[\s>]/,
  /<EmbeddedPage[\s>]/,
  /<Backdrop\s*\/>/,
  /<Redirect[\s>]/,
  /absoluteFill[\s\S]{0,200}require\("\.\.\/\.\.\/assets\/auth-backdrop\.jpg"\)/,
];
test("every screen paints the backdrop edge to edge, behind the status bar", () => {
  assert.ok(routes.length > 20, `walked only ${routes.length} screens`);
  for (const file of routes) {
    const source = readFileSync(file, "utf8");
    assert.ok(
      fullBleed.some((pattern) => pattern.test(source)),
      `${relative(app, file)} has no full-bleed background: use Page/ListPage, or render <Backdrop />`,
    );
  }
});
// The owner has asked for a full-screen app: the status area shows the page's own
// background, never a flat band painted over it.
test("nothing paints an opaque status-area scrim", () => {
  for (const file of walk(src)) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /height:\s*insets\.top\s*[,}]/,
      `${relative(src, file)} paints a status-area band; let the backdrop run to the top edge`,
    );
  }
});
