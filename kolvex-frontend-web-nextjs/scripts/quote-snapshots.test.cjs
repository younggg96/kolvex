const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const createCache = require('./helpers/client-cache.cjs');

function fixture() {
  const cache = createCache(), module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../lib/quoteSnapshots.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, window: {}, require: () => cache });
  return { ...module.exports, cache };
}
const quote = (price, marketTime) => ({ symbol: 'NVDA', price, marketTime, change: 0, changePercent: 0 });

test('a late older response cannot roll back a newer quote seen by other readers', () => {
  const h = fixture(), seen = [];
  h.cache.subscribeClientCacheWrites(key => seen.push(h.cache.peekClientCache(key).price));
  h.publishQuote(quote(203.36, 2000));
  const old = h.publishQuote(quote(201, 1000));
  assert.equal(old.price, 203.36);
  assert.deepEqual(seen, [203.36, 203.36]);
  assert.equal(h.cache.peekClientCache(h.quoteKey(' nvda ')).price, 203.36);
  assert.equal(h.publishQuote(quote(999, undefined)).price, 203.36);
});

test('regular and extended-session observations are reconciled by their own timestamps', () => {
  const h = fixture();
  h.publishQuote({ ...quote(203, 2000), postMarketPrice: 205, postMarketTime: 3000 });
  const combined = h.publishQuote({ ...quote(202, 1000), postMarketPrice: 206, postMarketTime: 4000 });
  assert.equal(combined.price, 203);
  assert.equal(combined.marketTime, 2000);
  assert.equal(combined.postMarketPrice, 206);
  assert.equal(combined.postMarketTime, 4000);
  const nextDay = h.publishQuote({ ...quote(207, 5000), postMarketPrice: undefined, postMarketTime: undefined });
  assert.equal(nextDay.price, 207);
  assert.equal(nextDay.postMarketPrice, 206);
  assert.ok(nextDay.marketTime > nextDay.postMarketTime);
});

test('general read-cache eviction cannot reintroduce an older quote from an in-flight batch', () => {
  const h = fixture();
  h.publishQuote(quote(203.36, 2000));
  for (let i = 0; i < 180; i++) h.cache.writeClientCache(`/other/${i}`, i);
  assert.equal(h.cache.peekClientCache(h.quoteKey('NVDA')), undefined);
  assert.equal(h.publishQuote(quote(199, 1000)).price, 203.36);
});
