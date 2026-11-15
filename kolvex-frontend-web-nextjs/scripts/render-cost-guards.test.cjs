// Guards against the Nov 2026 Vercel Hobby pause: public pages rendered on every visit and
// every client fetch paid for a Supabase Auth round trip in middleware.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const walk = (dir) =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : /\.(ts|tsx)$/.test(entry.name) ? [file] : [];
  });

const CACHED_PUBLIC_FILES = [
  ...walk("app/(public)"),
  ...walk("app/share"),
  "app/sitemap.ts",
  "app/llms.txt/route.ts",
  "lib/publicContent.ts",
];

test("public reading pages stay ISR-cached", () => {
  const offenders = CACHED_PUBLIC_FILES.filter((file) =>
    /force-dynamic|no-store|revalidate\s*=\s*0\b|dynamic\s*=\s*["']force-dynamic|searchParams/.test(
      read(file),
    ),
  );
  assert.deepEqual(offenders, [], "These files would render public pages on every visit");
});

test("public layout, sitemap and llms.txt declare a revalidate window", () => {
  for (const file of ["app/(public)/layout.tsx", "app/sitemap.ts", "app/llms.txt/route.ts"]) {
    assert.match(read(file), /export const revalidate = [1-9]\d*/, file);
  }
});

test("middleware never runs on API routes", () => {
  const matcher = read("middleware.ts").match(/matcher:\s*\[\s*(?:\/\*[\s\S]*?\*\/\s*)?"([^"]+)"/);
  assert.ok(matcher, "middleware matcher not found");
  assert.match(matcher[1], /^\/\(\(\?!api\//, "the matcher must exclude api/");
});

test("image proxy responses are cacheable by the CDN", () => {
  assert.match(read("app/api/image-proxy/route.ts"), /"CDN-Cache-Control": "public, max-age=\d+/);
  assert.match(read("next.config.js"), /source: "\/api\/:path\(\(\?!image-proxy\$\)\.\*\)"/);
});
