const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');

function load(file, mocks = {}, globals = {}) {
  const module = { exports: {} };
  const filename = path.resolve(__dirname, '../', file);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports: module.exports, URL, URLSearchParams, console, setTimeout, clearTimeout, ...globals,
    require: (name) => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), mocks, globals);
      return require(name);
    },
  });
  return module.exports;
}
const redirect = load('lib/supabase/redirect.ts');

test('local redirect retains query and rejects auth loops or external destinations', () => {
  assert.equal(redirect.getAuthRedirect('/dashboard/stocks?symbol=NVDA#chart'), '/dashboard/stocks?symbol=NVDA#chart');
  for (const value of [null, '', '/auth', '/auth?redirectTo=/dashboard', '/auth/reset-password', '//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)']) {
    assert.equal(redirect.getAuthRedirect(value), '/dashboard');
  }
});

function middleware(user, writes = []) {
  return load('lib/supabase/middleware.ts', {
    './config': { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'anon' },
    '@supabase/ssr': { createServerClient: (_url, _key, { cookies }) => ({ auth: {
      getUser: async () => {
        assert.ok(Array.isArray(cookies.getAll()));
        for (const batch of writes) cookies.setAll(batch);
        return { data: { user } };
      },
    } }) },
  }).updateSession;
}
const chunks = [
  { name: 'sb-project-auth-token.0', value: 'fresh-part-0', options: { path: '/', sameSite: 'lax' } },
  { name: 'sb-project-auth-token.1', value: 'fresh-part-1', options: { path: '/', sameSite: 'lax' } },
  { name: 'sb-project-auth-token.2', value: '', options: { path: '/', maxAge: 0 } },
];

test('authenticated redirect retains refreshed token chunks across batches', async () => {
  const request = new NextRequest('https://kolvex.app/auth?redirectTo=%2Fdashboard%3Ftab%3Dstocks');
  const response = await middleware({ id: 'user' }, [chunks.slice(0, 1), chunks.slice(1)])(request);
  assert.equal(response.headers.get('location'), 'https://kolvex.app/dashboard?tab=stocks');
  for (const cookie of chunks) assert.equal(response.cookies.get(cookie.name).value, cookie.value);
  assert.equal(response.cookies.get(chunks[2].name).maxAge, 0);
  assert.equal(request.cookies.get(chunks[1].name).value, chunks[1].value);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('unauthenticated protected redirect retains query and session cleanup cookies', async () => {
  const response = await middleware(null, [[chunks[2]]])(new NextRequest('https://kolvex.app/dashboard/stocks?symbol=NVDA'));
  assert.equal(new URL(response.headers.get('location')).searchParams.get('redirectTo'), '/dashboard/stocks?symbol=NVDA');
  assert.equal(response.cookies.get(chunks[2].name).maxAge, 0);
});

test('callback and password recovery remain accessible with an existing session', async () => {
  for (const route of ['/auth/callback?code=abc', '/auth/reset-password', '/auth/forgot-password']) {
    const response = await middleware({ id: 'user' })(new NextRequest('https://kolvex.app' + route));
    assert.equal(response.headers.get('location'), null);
  }
});

function auth(response, setSession) {
  return load('lib/supabase/auth.ts', {
    './client': { createClient: () => ({ auth: { setSession } }) },
  }, { fetch: async () => ({ json: async () => response }) });
}

test('login awaits session installation before returning success', async () => {
  let complete;
  const api = auth({ success: true, session: { access_token: 'access', refresh_token: 'refresh' } }, () => new Promise(resolve => { complete = resolve; }));
  let settled = false;
  const result = api.signIn({ email: 'test@example.com', password: 'test' }).then(value => { settled = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(settled, false);
  complete({ data: { session: { user: { id: 'user' } } }, error: null });
  assert.equal((await result).success, true);
});

test('missing sessions and session errors cannot report successful login', async () => {
  for (const session of [undefined, { access_token: 'access' }]) {
    const api = auth({ success: true, session }, () => { throw new Error('should not be called'); });
    assert.equal((await api.signIn({ email: 'test@example.com', password: 'test' })).success, false);
  }
  const api = auth({ success: true, session: { access_token: 'access', refresh_token: 'refresh' } }, async () => ({ data: { session: null }, error: { message: 'invalid token' } }));
  const result = await api.signIn({ email: 'test@example.com', password: 'test' });
  assert.equal(result.success, false);
  assert.equal(result.error, 'invalid token');
});

function componentMocks(effects = [], initialStates = []) {
  let index = 0;
  return {
    react: { useState: (value) => [initialStates[index++] ?? value, () => {}], useEffect: (fn) => effects.push(fn), useRef: (value) => ({ current: value }) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'next/navigation': { useSearchParams: () => new URLSearchParams('redirectTo=/dashboard?tab=stocks'), useRouter: () => ({ replace: () => {} }) },
    '@/lib/supabase/redirect': redirect,
    '@/lib/i18n': { useTranslation: () => ({ t: (value) => value }) },
    sonner: { toast: { success: () => {}, error: () => {} } },
  };
}
function find(node, type) {
  if (!node || typeof node !== 'object') return;
  if (node.type === type) return node;
  for (const child of [node.props?.children].flat()) {
    const result = find(child, type);
    if (result) return result;
  }
}

test('password login loads a fresh document at its intended destination', async () => {
  const destinations = [], empty = {};
  const form = load('components/auth/AuthForm.tsx', {
    ...componentMocks([], ['test@example.com', 'test-password']),
    'next/link': empty, 'next/image': empty,
    '@/components/ui/button': empty, '@/components/ui/input': empty, '@/components/ui/password-input': empty,
    '@/components/ui/tabs': empty,
    './AuthUI': { validateAuthEmail: () => undefined, authDescription: () => undefined },
    '@/lib/supabase/auth': { signIn: async () => ({ success: true }) },
  }, { window: { location: { replace: (url) => destinations.push(url) } } });
  await find(form.default({ mode: 'login', onModeChange: () => {} }), 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(destinations, ['/dashboard?tab=stocks']);
});

test('existing session redirects cached login page outside auth callback and unsubscribes', () => {
  const effects = [], destinations = [], timers = [];
  let callback, unsubscribed = false;
  const page = load('components/auth/AuthPageClient.tsx', {
    ...componentMocks(effects),
    '@/components/auth/AuthForm': {}, '@/components/auth/AuthLayout': {},
    '@/lib/supabase/client': { createClient: () => ({ auth: { onAuthStateChange: (fn) => {
      callback = fn;
      return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
    } } }) },
  }, {
    window: { location: { hash: '', replace: (url) => destinations.push(url) } },
    setTimeout: (fn) => { timers.push(fn); return 1; }, clearTimeout: () => {},
  });
  page.default();
  const cleanup = effects[0]();
  callback('INITIAL_SESSION', { user: { id: 'user' } });
  assert.equal(destinations.length, 0);
  timers[0]();
  assert.deepEqual(destinations, ['/dashboard?tab=stocks']);
  cleanup();
  assert.equal(unsubscribed, true);
});

test('server cookie adapter reads every chunk and persists refreshes and removals as a batch', async () => {
  const initial = Array.from({ length: 8 }, (_, index) => ({ name: `sb-project-auth-token.${index}`, value: `part-${index}` }));
  const writes = [];
  let adapter;
  const server = load('lib/supabase/server.ts', {
    './config': { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'anon' },
    'next/headers': { cookies: async () => ({ getAll: () => initial, set: (...args) => writes.push(args) }) },
    '@supabase/ssr': { createServerClient: (_url, _key, { cookies }) => { adapter = cookies; return {}; } },
  });
  await server.createServerSupabaseClient();
  assert.equal(adapter.getAll().length, 8);
  adapter.setAll(chunks);
  assert.equal(writes.length, chunks.length);
  assert.deepEqual(writes[2], [chunks[2].name, '', chunks[2].options]);
});

test('browser SDK persists chunked sessions beyond access-token expiry and server can read them', async () => {
  const oldWindow = global.window, oldDocument = global.document;
  const jar = new Map(), cookieWrites = [];
  global.window = { location: { href: 'https://kolvex.app/', hash: '', search: '' }, addEventListener() {}, removeEventListener() {} };
  global.document = {
    visibilityState: 'hidden',
    get cookie() { return [...jar].map(([name, value]) => `${name}=${value}`).join('; '); },
    set cookie(value) {
      cookieWrites.push(value);
      const pair = value.split(';')[0], split = pair.indexOf('=');
      const name = pair.slice(0, split);
      if (/max-age=0(?:;|$)/i.test(value)) jar.delete(name);
      else jar.set(name, pair.slice(split + 1));
    },
  };
  global.window.document = global.document;
  let client, server;
  try {
    const config = { supabaseUrl: 'https://persist-test.supabase.co', supabaseAnonKey: 'test-anon-key' };
    const browser = load('lib/supabase/client.ts', { './config': config });
    client = browser.createClient();
    await client.auth.initialize();
    assert.equal(client.auth.persistSession, true);
    assert.equal(client.auth.autoRefreshToken, true);
    const session = {
      access_token: 'test-access', refresh_token: 'test-refresh', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'user', user_metadata: { profile: 'x'.repeat(30000) } },
    };
    await client.auth.storage.setItem(client.auth.storageKey, JSON.stringify(session));
    assert.ok(jar.size > 5, 'session must span more chunks than the legacy adapter could read');
    for (const value of cookieWrites) {
      const age = Number(value.match(/Max-Age=(\d+)/i)?.[1]);
      assert.ok(age >= 30 * 24 * 60 * 60, 'cookie must outlive the short-lived access token');
      assert.ok(/Path=\//i.test(value));
    }
    const { createServerClient, parseCookieHeader } = require('@supabase/ssr');
    server = createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
      cookies: { getAll: () => parseCookieHeader(global.document.cookie), setAll() {} },
    });
    const result = await server.auth.getSession();
    assert.equal(result.data.session.refresh_token, 'test-refresh');
    assert.equal(result.data.session.user.user_metadata.profile.length, 30000);
  } finally {
    if (client) {
      await client.auth.stopAutoRefresh();
      client.auth.broadcastChannel?.close();
    }
    server?.auth.broadcastChannel?.close();
    if (oldWindow === undefined) delete global.window; else global.window = oldWindow;
    if (oldDocument === undefined) delete global.document; else global.document = oldDocument;
  }
});
