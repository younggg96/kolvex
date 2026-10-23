const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function fixture(fetch) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/api/market/history/[symbol]/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module, exports: module.exports, fetch, console,
    process: { env: { NEXT_PUBLIC_BACKEND_API_URL: 'https://backend.example' } },
    require: () => ({ NextResponse: Response }),
  });
  return (symbol, query = 'period=3mo&interval=1d') => module.exports.GET({ nextUrl: new URL(`https://kolvex.example/api?${query}`) }, { params: Promise.resolve({ symbol }) });
}
test('all five index symbols forward once encoded and preserve the OHLC candles and range', async () => {
  for (const symbol of ['^GSPC', '^IXIC', '^DJI', '^RUT', '^VIX']) {
    for (const input of [symbol, encodeURIComponent(symbol)]) {
      const candles = { symbol, data: [{ date: '2026-10-22', open: 20, high: 23, low: 19, close: 22, volume: null }] };
      const get = fixture(async url => {
        assert.equal(url, `https://backend.example/api/v1/market/history/${encodeURIComponent(symbol)}?period=3mo&interval=1d`);
        return Response.json(candles);
      });
      const response = await get(input);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), candles);
    }
  }
});
test('invalid symbol escapes and path characters never reach the backend', async () => {
  const get = fixture(() => { throw Error('Backend must not be called'); });
  for (const symbol of ['%', '%E0%A4', '%255EVIX', '..%2FVIX', 'VIX%3Finterval=1m']) {
    assert.equal((await get(symbol)).status, 400);
  }
});
test('upstream history errors remain explicit errors instead of empty charts', async () => {
  const response = await fixture(async () => Response.json({ detail: 'History unavailable' }, { status: 503 }))('%5EVIX');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'History unavailable' });
});
