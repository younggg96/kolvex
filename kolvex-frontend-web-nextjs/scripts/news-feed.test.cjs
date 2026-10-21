const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(file, deps = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, require: name => { if (name in deps) return deps[name]; throw new Error(name); },
    URL, AbortSignal, process: { env: {} }, ...globals,
  });
  return exports;
}
const feed = load('lib/newsFeed.ts');
const article = (id, title, time = 100, symbols = []) => ({id, title, symbols, link:`https://www.financialjuice.com/News/${id}/story.aspx`, publish_time:time, publisher:'FinancialJuice'});
test('updates preserve reading position and buffer each new headline once', () => {
  const old = article('1', 'Original');
  const corrected = article('1', 'Correction');
  const fresh = article('2', 'New', 200);
  let state = feed.receiveNews(feed.EMPTY_FEED, [old]);
  state = feed.receiveNews(feed.receiveNews(state, [fresh, corrected]), [fresh, corrected]);
  assert.equal(state.articles.length, 1);
  assert.equal(state.articles[0].title, 'Correction');
  assert.equal(state.pending.length, 1);
  state = feed.revealNews(state);
  assert.equal(state.articles.map(a => a.id).join(','), '2,1');
  assert.equal(feed.receiveNews(state, [fresh, corrected]).pending.length, 0);
});
test('rolling window remains bounded', () => {
  let state = feed.receiveNews(feed.EMPTY_FEED, [article('0', 'First')]);
  state = feed.receiveNews(state, Array.from({length:400}, (_,i) => article(String(i+1), 'New', i+200)));
  assert.equal(state.pending.length, 300);
  assert.equal(feed.revealNews(state).articles.length, 300);
});
function route(fetch) {
  return load('app/api/news/route.ts', {'next/server': {NextResponse:{json:(body, options={}) => ({body, status:options.status || 200, headers:options.headers})}}}, {fetch});
}
test('proxy preserves delayed/stale source metadata and disables caching', async () => {
  const payload = {articles:[article('1','Headline')], fetched_at:'2026-10-20T12:00:00Z', delivery:'delayed', stale:true, source:'FinancialJuice RSS'};
  const result = await route(async (url, options) => {
    assert.equal(url, 'http://localhost:8080/api/v1/news/feed');
    assert.equal(options.cache, 'no-store');
    return {ok:true,json:async()=>payload};
  }).GET();
  assert.equal(result.body, payload);
  assert.equal(result.headers['Cache-Control'], 'no-store');
});
test('provider failure and malformed response fail; valid empty feed succeeds', async () => {
  for (const fetch of [async()=>{throw Error('offline')}, async()=>({ok:false}), async()=>({ok:true,json:async()=>({articles:[]})})]) {
    assert.equal((await route(fetch).GET()).status, 502);
  }
  assert.equal((await route(async()=>({ok:true,json:async()=>({articles:[],fetched_at:'2026-10-20T12:00:00Z'})})).GET()).status, 200);
});

function hookHarness() {
  let slots = [], cursor = 0, effects = [], scheduled = [], result;
  const timers = new Map(), events = new Map(), responses = [], requests = [];
  let timerId = 0;
  const document = {hidden:false, addEventListener:(name, fn)=>events.set(name,fn), removeEventListener:name=>events.delete(name)};
  const react = {
    useState(initial) { const i=cursor++; if (!(i in slots)) slots[i]=initial; return [slots[i], value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}]; },
    useRef(initial) {const i=cursor++; if (!(i in slots)) slots[i]={current:initial}; return slots[i];},
    useEffect(fn, deps) {const i=cursor++; const previous=effects[i]; if (!previous || deps.some((d,n)=>d!==previous.deps[n])) scheduled.push(()=>{previous?.cleanup?.(); effects[i]={deps,cleanup:fn()};});},
  };
  const hooks = load('components/news/useNewsTerminal.ts', {react, '@/lib/newsFeed':feed}, {
    AbortController, document, window:document,
    setInterval:fn=>{timers.set(++timerId,fn);return timerId;}, clearInterval:id=>timers.delete(id),
    fetch:(_url, options)=>{requests.push(options); return new Promise(resolve=>responses.push(resolve));},
  });
  function render() {cursor=0; result=hooks.useNewsTerminal(); const pending=scheduled;scheduled=[];pending.forEach(fn=>fn());return result;}
  return {render, document, requests, events,
    tick:()=>timers.forEach(fn=>fn()),
    respond:async articles=>{responses.shift()({ok:true,json:async()=>({articles,fetched_at:'2026-10-20T12:00:00Z',source:'FinancialJuice RSS',delivery:'delayed',stale:false})});await new Promise(setImmediate);},
    unmount:()=>effects.forEach(effect=>effect?.cleanup?.()),
  };
}
test('polling pauses in hidden tabs or on Pause, resumes and aborts on unmount', async () => {
  const h=hookHarness(); h.render();
  assert.equal(h.requests.length,1);
  h.tick(); assert.equal(h.requests.length,1, 'no overlapping request');
  await h.respond([article('1','First')]);
  let state=h.render();
  h.document.hidden=true;h.tick();assert.equal(h.requests.length,1);
  h.document.hidden=false;state.togglePause();state=h.render();
  h.tick();h.events.get('online')();assert.equal(h.requests.length,1);
  state.togglePause();h.render();assert.equal(h.requests.length,2);
  await h.respond([article('2','Second',200),article('1','First')]);
  state=h.render();assert.equal(state.feed.pending.length,1);
  state.refresh();h.render();assert.equal(h.requests.length,3);
  h.unmount();assert.equal(h.requests[2].signal.aborted,true);
  h.tick();assert.equal(h.requests.length,3);
});

function translationHarness() {
  const slots = [], effects = [], requests = [];
  let cursor = 0, pendingEffects = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useEffect(fn, deps) { const i = cursor++; const previous = effects[i]; if (!previous || deps.some((d, n) => d !== previous.deps[n])) pendingEffects.push(() => { previous?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
  };
  const { useNewsTranslations } = load('components/news/useNewsTranslations.ts', {
    react,
    '@/components/trading-analysis/translate': { translateText: (text, language, signal) => new Promise((resolve, reject) => requests.push({text, language, signal, resolve, reject})) },
  }, { AbortController, setTimeout, clearTimeout });
  return {
    requests,
    render(articles, locale = 'zh') { cursor = 0; const result = useNewsTranslations(articles, locale); const pending = pendingEffects; pendingEffects = []; pending.forEach(fn => fn()); return result; },
    async respond(i, value) { requests[i].resolve(value); await new Promise(setImmediate); },
    async fail(i) { requests[i].reject(Error('offline')); await new Promise(setImmediate); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
  };
}

test('Chinese automatically translates displayed headlines with at most three concurrent requests; English uses originals', async () => {
  const h = translationHarness();
  const articles = Array.from({length:4},(_,i)=>article(String(i), `Headline ${i}`));
  h.render(articles, 'en'); assert.equal(h.requests.length,0);
  h.render(articles); assert.equal(h.requests.length,3);
  assert.equal(h.requests[0].language,'zh');
  assert.equal(h.render(articles).pending,4);
  await h.respond(0,'译文0'); assert.equal(h.requests.length,4);
  await h.respond(1,'译文1'); await h.respond(2,'译文2'); await h.respond(3,'译文3');
  assert.equal(h.render(articles).pending,0);
  assert.equal(h.render(articles).translations['Headline 0'],'译文0');
  const english=h.render(articles,'en');
  assert.equal(Object.keys(english.translations).length,0);
  assert.equal(english.pending,0);
  h.render(articles); assert.equal(h.requests.length,4, 'cached translations are reused');
  h.unmount();
});

test('failed automatic translations retain originals and retry only failed headlines', async () => {
  const h=translationHarness(), articles=[article('1','First'),article('2','Second')];
  h.render(articles);
  await h.respond(0,'第一条'); await h.fail(1);
  const state=h.render(articles);
  assert.equal(state.failed,1); assert.equal(state.translations.First,'第一条');
  assert.equal(state.translations.Second,undefined, 'reader falls back to the source');
  state.retry();h.render(articles);
  assert.equal(h.requests.length,3);assert.equal(h.requests[2].text,'Second');
  await h.respond(2,'第二条');
  assert.equal(h.render(articles).failed,0);assert.equal(h.render(articles).translations.Second,'第二条');
  h.unmount();
});

test('locale changes and corrections abort old requests and cannot overwrite the selected language', async () => {
  const h=translationHarness(), original=[article('1','Original')], corrected=[article('1','Corrected')];
  h.render(original); h.render(corrected);
  assert.equal(h.requests[0].signal.aborted,true);
  await h.respond(0,'过期');
  assert.equal(h.render(corrected).translations.Original,undefined);
  h.render(corrected,'en'); assert.equal(h.requests[1].signal.aborted,true);
  await h.respond(1,'过期更正');
  assert.equal(Object.keys(h.render(corrected,'en').translations).length,0);
  h.render(corrected);assert.equal(h.requests.length,3);
  await h.respond(2,'更正');assert.equal(h.render(corrected).translations.Corrected,'更正');
  h.render([article('2','Next')]);h.unmount();assert.equal(h.requests[3].signal.aborted,true);
  await h.respond(3,'卸载后');
});

test('identical headline text shares one translation request', async () => {
  const h=translationHarness(), articles=[article('1','Same'),article('2','Same')];
  h.render(articles);assert.equal(h.requests.length,1);
  await h.respond(0,'同一标题');assert.equal(h.render(articles).translations.Same,'同一标题');
  h.unmount();
});
