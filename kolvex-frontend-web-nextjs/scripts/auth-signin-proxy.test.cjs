const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(fetch) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/api/auth/signin/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module, exports: module.exports, fetch, AbortSignal,
    console: { error() {} },
    process: { env: { NEXT_PUBLIC_BACKEND_API_URL: 'http://127.0.0.1:8080' } },
    require(name) {
      if (name === 'next/server') return { NextResponse: Response };
      throw Error(name);
    },
  });
  return (body = { email: 'test@example.com', password: 'test-password' }) => module.exports.POST({
    json: async () => JSON.parse(body === 'malformed' ? '{' : JSON.stringify(body)),
  });
}

test('forwards valid auth responses and sends only email/password without caching', async () => {
  const result = { success: true, user: { id: 'test-user' }, session: { access_token: 'test-token' } };
  let sent;
  const call = fixture(async (url, options) => {
    sent = { url, ...options };
    return Response.json(result);
  });
  const response = await call({ email: 'test@example.com', password: 'test-password', admin: true });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), result);
  assert.equal(sent.url, 'http://127.0.0.1:8080/api/v1/auth/signin');
  assert.deepEqual(JSON.parse(sent.body), { email: 'test@example.com', password: 'test-password' });
  assert.equal(sent.cache, 'no-store');
  assert.ok(sent.signal instanceof AbortSignal);
});

test('rejects malformed or missing credentials before contacting backend', async () => {
  const call = fixture(async () => { throw Error('must not fetch'); });
  for (const body of ['malformed', null, {}, { email: 12, password: 'x' }, { email: ' ', password: 'x' }]) {
    assert.equal((await call(body)).status, 400);
  }
});

test('plain text 500 and HTML responses become safe JSON errors', async () => {
  for (const body of ['Internal Server Error: private traceback', '<html>proxy error</html>', '']) {
    const response = await fixture(async () => new Response(body, { status: 500 }))();
    assert.equal(response.status, 502);
    const data = await response.json();
    assert.equal(data.success, false);
    assert.equal(data.error_code, 'BACKEND_INVALID_RESPONSE');
    assert.ok(!JSON.stringify(data).includes('private traceback'));
  }
});

test('invalid JSON shapes do not masquerade as successful authentication', async () => {
  for (const body of [null, [], {}, { success: 'yes' }]) {
    const response = await fixture(async () => Response.json(body))();
    assert.equal(response.status, 502);
  }
});

test('keeps backend authentication failures and status', async () => {
  const data = { success: false, error: 'Invalid email or password', error_code: 'INVALID_CREDENTIALS' };
  const response = await fixture(async () => Response.json(data, { status: 401 }))();
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), data);
});

test('connection failures and timeouts return JSON service unavailable', async () => {
  for (const name of ['TypeError', 'TimeoutError']) {
    const response = await fixture(async () => { const error = new Error('connection failed'); error.name = name; throw error; })();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error_code, 'BACKEND_UNAVAILABLE');
  }
});
