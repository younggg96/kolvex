const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../lib/clientCache.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
module.exports = function createCache(globals = {}) {
  const exports = {};
  vm.runInNewContext(source, {
    exports, window: {}, Date, AbortController, DOMException, queueMicrotask, clearTimeout,
    setTimeout: (fn, ms) => { const timer = setTimeout(fn, ms); timer.unref(); return timer; },
    ...globals,
  });
  return exports;
};
