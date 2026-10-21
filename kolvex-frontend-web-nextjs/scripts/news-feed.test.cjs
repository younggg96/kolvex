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
test('local categories may overlap; explicit ticker and focus filters work', () => {
  const macro = article('1', 'CPI inflation pushes Treasury yields and dollar higher');
  const stock = article('2', '$AMZN reports earnings', 200, ['AMZN']);
  const crypto = article('3', '$BTC bitcoin price', 200, ['BTC']);
  assert.equal(feed.articleCategories(macro).join(','), 'macro,bonds,forex');
  assert.equal(feed.articleCategories(crypto).join(','), 'crypto');
  assert.equal(feed.filterNews([macro, stock], 'equities', 'amzn', true, true, ['2'])[0].id, '2');
  assert.equal(feed.filterNews([macro, stock], 'all', '', false, true, []).length, 0);
  assert.equal(feed.isFocusHeadline(crypto), false);
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
