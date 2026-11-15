const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { backendConfig } = require("./helpers/backend-config.cjs");

const ROOT = path.join(__dirname, "..");

test("the backend URL prefers the server-only variable, then the public one, then local IPv4", () => {
  assert.equal(backendConfig({}).BACKEND_API_URL, "http://127.0.0.1:8080");
  assert.equal(
    backendConfig({ NEXT_PUBLIC_BACKEND_API_URL: "https://public.example" }).BACKEND_API_URL,
    "https://public.example",
  );
  assert.equal(
    backendConfig({
      BACKEND_API_URL: "https://private.example",
      NEXT_PUBLIC_BACKEND_API_URL: "https://public.example",
    }).BACKEND_API_URL,
    "https://private.example",
  );
});

test("trailing slashes are dropped so joined paths never contain //", () => {
  const config = backendConfig({ NEXT_PUBLIC_BACKEND_API_URL: "https://backend.example//" });
  assert.equal(config.BACKEND_API_URL, "https://backend.example");
  assert.equal(config.BACKEND_API_V1, "https://backend.example/api/v1");
});

/**
 * Browser code that talks to the backend directly (the SSE stream) cannot use the
 * server-side config, so it may read the public variable itself.
 */
const ALLOWED_ENV_READS = new Set([
  "lib/config/backend.ts",
  "lib/tradingAnalysisApi.ts",
  "app/dashboard/trading-analysis/[id]/page.tsx",
]);

function sourceFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.(ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}

test("only lib/config/backend.ts resolves the backend URL", () => {
  const offenders = [];
  for (const file of ["app", "components", "hooks", "lib"].flatMap(sourceFiles)) {
    if (ALLOWED_ENV_READS.has(file)) continue;
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    if (
      /process\.env\.(NEXT_PUBLIC_)?BACKEND_API_URL|["'`]https?:\/\/(localhost|127\.0\.0\.1):8080/.test(
        text,
      )
    ) {
      offenders.push(file);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "import BACKEND_API_URL / BACKEND_API_V1 from @/lib/config/backend",
  );
});
