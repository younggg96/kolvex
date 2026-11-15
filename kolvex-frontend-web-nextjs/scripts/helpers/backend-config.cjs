// Evaluates lib/config/backend.ts against a test's own `process.env`, so route tests that
// run a handler in a vm sandbox can satisfy its `@/lib/config/backend` import.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const BACKEND_CONFIG = "@/lib/config/backend";
const source = fs.readFileSync(path.join(__dirname, "../../lib/config/backend.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function backendConfig(env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, process: { env } });
  return module.exports;
}

module.exports = { BACKEND_CONFIG, backendConfig };
