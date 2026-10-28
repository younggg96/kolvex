const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const createCache = require('./helpers/client-cache.cjs');
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../hooks/useCachedResource.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function harness(cache) {
  let cursor = 0;
  const slots = [], effects = [];
  const same = (a,b) => a && b && a.length === b.length && a.every((value,i) => Object.is(value,b[i]));
  const react = {
    useState(initial) { const i=cursor++; if (!(i in slots)) slots[i]=typeof initial==='function'?initial():initial; return [slots[i], value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}]; },
    useRef(initial) { const i=cursor++; if (!(i in slots)) slots[i]={current:initial}; return slots[i]; },
    useCallback(fn,deps) { const i=cursor++; if(!slots[i] || !same(slots[i].deps,deps)) slots[i]={fn,deps}; return slots[i].fn; },
    useEffect(fn,deps) { const i=cursor++; if (!slots[i] || !same(slots[i].deps,deps)) { const previous=slots[i]; slots[i]={deps}; effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn();}); } },
  };
  const exports = {};
  vm.runInNewContext(source, { exports, AbortController, require: key => key === 'react' ? react : cache });
  return {
    render(key, loader, options={ttl:100,maxAge:1000}) { cursor=0; return exports.useCachedResource(key,loader,options); },
    effects() { effects.splice(0).forEach(run=>run()); },
    unmount() { slots.forEach(slot=>slot?.cleanup?.()); },
  };
}

test('two mounted views share one cold fetch, and returning to the page paints cached data synchronously', async () => {
  const cache=createCache(); const pending=deferred(); let requests=0;
  const loader=()=>{requests++;return pending.promise;};
  const a=harness(cache), b=harness(cache);
  assert.equal(a.render('/list',loader).loading,true);a.effects();
  b.render('/list',loader);b.effects();
  assert.equal(requests,1);
  pending.resolve(['one']);await tick();
  assert.equal(a.render('/list',loader).loading,false);
  a.unmount();b.unmount();
  const returned=harness(cache);
  const first=returned.render('/list',loader);
  assert.equal(first.loading,false);
  assert.equal(first.data[0],'one');
  returned.effects();await tick();
  assert.equal(requests,1);
  returned.unmount();
});

test('stale data remains visible during background refresh and a failed refresh', async () => {
  let now=0;
  const cache=createCache({Date:{now:()=>now}});
  await cache.loadClientCache('/list',async()=>['old'],{ttl:100,maxAge:1000});
  now=101;
  const h=harness(cache),pending=deferred();
  const loader=()=>pending.promise;
  assert.equal(h.render('/list',loader).data[0],'old');h.effects();
  const refreshing=h.render('/list',loader);
  assert.equal(refreshing.loading,false);
  assert.equal(refreshing.refreshing,true);
  pending.resolve(['new']);await tick();
  let state=h.render('/list',loader);
  assert.equal(state.data[0],'new');
  state.refresh();h.render('/list',async()=>{throw Error('offline');});h.effects();await tick();
  state=h.render('/list',loader);
  assert.equal(state.data[0],'new');
  assert.equal(state.loading,false);
  assert.equal(state.error.message,'offline');
  h.unmount();
});

test('a different route never displays the previous route data and old replies cannot overwrite it', async () => {
  const cache=createCache(),h=harness(cache),a=deferred(),b=deferred();
  h.render('/a',()=>a.promise);h.effects();
  const next=h.render('/b',()=>b.promise);
  assert.equal(next.data,undefined);assert.equal(next.loading,true);h.effects();
  b.resolve('b');await tick();a.resolve('a');await tick();
  assert.equal(h.render('/b',()=>b.promise).data,'b');
  h.unmount();
});

test('account changes remove visible snapshots before loading the new account', async () => {
  const cache=createCache();cache.setClientCacheIdentity('a');await tick();
  await cache.loadClientCache('/private',async()=>'account-a');
  const h=harness(cache);let next=deferred();const loader=()=>next.promise;
  h.render('/private',loader);h.effects();await tick();
  cache.setClientCacheIdentity('b');await tick();
  const reset=h.render('/private',loader);
  assert.equal(reset.data,undefined);assert.equal(reset.loading,true);h.effects();
  next.resolve('account-b');await tick();
  assert.equal(h.render('/private',loader).data,'account-b');h.unmount();
});


test('fresh visits never enter a refreshing state, including false and zero payloads', async () => {
  for (const value of [false, 0, [], 'cached']) {
    const cache = createCache();
    await cache.loadClientCache('/fresh', async () => value);
    const h = harness(cache);
    const loader = () => { throw Error('Fresh reads must skip the network'); };
    h.render('/fresh', loader); h.effects();
    const state = h.render('/fresh', loader);
    assert.equal(state.data, value);
    assert.equal(state.refreshing, false);
    assert.equal(state.loading, false);
    h.unmount();
  }
});
