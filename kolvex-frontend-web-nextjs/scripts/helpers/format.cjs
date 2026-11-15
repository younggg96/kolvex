// Compiles lib/format.ts once, so tests that run a module in a vm sandbox can satisfy its
// `@/lib/format` import with the real sign rules.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const FORMAT = "@/lib/format";
const source = fs.readFileSync(path.join(__dirname, "../../lib/format.ts"), "utf8");
const module_ = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText,
  { module: module_, exports: module_.exports, Number, Math },
);

module.exports = { FORMAT, format: module_.exports };
