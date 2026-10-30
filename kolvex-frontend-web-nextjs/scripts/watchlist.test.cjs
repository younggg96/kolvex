const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/watchlist.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports:exportsObject});
const { createWatchlistStore, parseWatchlist, normalizeWatchlistTicker, WATCHLIST_KEY, LEGACY_WATCHLIST_KEY } = exportsObject;
function fixture(initial = {}) {
  const values = new Map(Object.entries(initial));
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  return {values, storage, store:createWatchlistStore(()=>storage)};
}
test('normalizes optional dollar prefix, rejects invalid symbols and corrupt storage',()=>{
  assert.equal(normalizeWatchlistTicker(' $aapl '),'AAPL');
  assert.equal(normalizeWatchlistTicker('../x'),null);
  assert.equal(normalizeWatchlistTicker(''),null);
  for(const raw of [null,'{bad','{}','null']) assert.equal(parseWatchlist(raw).length,0);
  assert.deepEqual(Array.from(parseWatchlist('["aapl","AAPL",5,null,"BRK-B","../x"]')),['AAPL','BRK-B']);
});
test('imports legacy Reddit stars only when the global list has never existed',()=>{
  const {store,values}=fixture({[LEGACY_WATCHLIST_KEY]:'["AAPL","MSFT"]'});
  store.hydrate(); assert.equal(store.getSnapshot().watchlist.join(','),'AAPL,MSFT');
  store.setTicker('AAPL',false); store.setTicker('MSFT',false);
  const reloaded=createWatchlistStore(()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}));
  reloaded.hydrate(); assert.equal(reloaded.getSnapshot().watchlist.length,0);
});
test('all subscribers see rapid changes and duplicate adds are idempotent',()=>{
  const {store}=fixture(); let changes=0;
  const unsubscribe=store.subscribe(()=>changes++);
  store.hydrate();store.setTicker('AAPL',true);store.setTicker('MSFT',true);store.setTicker('aapl',true);
  assert.equal(store.getSnapshot().watchlist.join(','),'AAPL,MSFT');
  store.toggle('AAPL'); assert.equal(store.getSnapshot().watchlist.join(','),'MSFT');
  assert.equal(changes,5); unsubscribe();
  store.toggle('MSFT');assert.equal(changes,5);
});
test('mutations preserve durable edits from another tab; events synchronize clearing',()=>{
  const {store,values}=fixture({[WATCHLIST_KEY]:'["AAPL"]'});store.hydrate();
  values.set(WATCHLIST_KEY,'["AAPL","NVDA"]');store.setTicker('MSFT',true);
  assert.equal(store.getSnapshot().watchlist.join(','),'AAPL,NVDA,MSFT');
  store.sync('["TSLA"]');assert.equal(store.getSnapshot().watchlist.join(','),'TSLA');
  store.sync(null);assert.equal(store.getSnapshot().watchlist.length,0);
});
test('blocked storage and quota failures retain session edits without losing the list',()=>{
  const blocked=createWatchlistStore(()=>{throw new Error('blocked')});blocked.hydrate();blocked.setTicker('AAPL',true);blocked.setTicker('MSFT',true);
  assert.equal(blocked.getSnapshot().storageUnavailable,true);
  assert.equal(blocked.getSnapshot().watchlist.join(','),'AAPL,MSFT');
  const {store,storage}=fixture({[WATCHLIST_KEY]:'["NVDA"]'});store.hydrate();storage.setItem=()=>{throw new Error('quota')};
  store.setTicker('AAPL',true);store.setTicker('MSFT',true);
  assert.equal(store.getSnapshot().watchlist.join(','),'NVDA,AAPL,MSFT');
  assert.equal(store.getSnapshot().storageUnavailable,true);
});
