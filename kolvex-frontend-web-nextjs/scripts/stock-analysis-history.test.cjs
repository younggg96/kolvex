const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const deferred = () => { let resolve, reject; const promise = new Promise((y,n) => {resolve=y;reject=n}); return {promise,resolve,reject}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
class HistoryError extends Error { constructor(status){super('history error');this.status=status;} }
function compile(file, mocks) {
  const m = {exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,
    {module:m,exports:m.exports,require:key=>mocks[key],AbortController,Date,console});
  return m.exports;
}
function fixture(api) {
  let index=0;
  const slots=[], pending=[];
  const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const react={
    useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},
    useRef(initial){const i=index++;if(!(i in slots))slots[i]={current:initial};return slots[i]},
    useCallback(fn,deps){const i=index++;if(!slots[i]||!equal(slots[i].deps,deps))slots[i]={deps,fn};return slots[i].fn},
    useEffect(fn,deps){const i=index++;if(!slots[i]||!equal(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};pending.push(()=>{old?.cleanup?.();slots[i].cleanup=fn()})}},
  };
  const module=compile('components/decision/AnalysisHistory.tsx',{'react':react,'react/jsx-runtime':{},'@/components/ui/button':{},'@/lib/i18n':{},'./shared':{},'@/lib/stockAnalysisHistory':{...api,HistoryError}});
  return {render(ticker='NVDA'){index=0;return module.useStockHistory(ticker,'technical')},effects(){pending.splice(0).forEach(fn=>fn())}};
}
const version=(id,extra={})=>({id,ticker:'NVDA',kind:'technical',created_at:'2026-10-09T00:00:00Z',payload:{summary:id},request:{},bars:[],...extra});

test('refresh loads the saved current version, selecting old versions does not write the head', async()=>{
  const current=version('new'),old=version('old');let writes=0;
  const h=fixture({getStockAnalysisHistory:async()=>({items:[current,old],current,total:2}),activateStockAnalysis:async()=>{writes++}});
  h.render();h.effects();await tick();let state=h.render();assert.equal(state.selected.id,'new');
  await state.select(old);state=h.render();assert.equal(state.selected.id,'old');assert.equal(state.current.id,'new');assert.equal(writes,0);
});
test('a slow response for the previous ticker cannot replace the new ticker data',async()=>{
  const slow=deferred(),fast=deferred();const h=fixture({getStockAnalysisHistory:t=>t==='NVDA'?slow.promise:fast.promise});
  h.render('NVDA');h.effects();h.render('AAPL');h.effects();
  fast.resolve({items:[version('aapl')],current:version('aapl'),total:1});await tick();
  slow.resolve({items:[version('nvda')],current:version('nvda'),total:1});await tick();
  assert.equal(h.render('AAPL').selected.id,'aapl');
});
test('activation conflict reloads the current pointer and leaves the old version selected',async()=>{
  let calls=0;const old=version('old'),newer=version('newer');
  const h=fixture({getStockAnalysisHistory:async()=>({items:[old,newer],current:calls++?newer:old,total:2}),activateStockAnalysis:async()=>{throw new HistoryError(409)}});
  h.render();h.effects();await tick();let state=h.render();await state.select(newer);state=h.render();await state.activate();state=h.render();
  assert.equal(state.current.id,'newer');assert.equal(state.error,409);assert.equal(state.selected.id,'newer');
});
test('failed history refresh keeps the last saved analysis available',async()=>{
  let fail=false;const old=version('saved');const h=fixture({getStockAnalysisHistory:async()=>{if(fail)throw new HistoryError(503);return {items:[old],current:old,total:1}}});
  h.render();h.effects();await tick();fail=true;await h.render().load();const state=h.render();assert.equal(state.selected.id,'saved');assert.equal(state.error,503);assert.equal(state.busy,false);
});
test('old drawings retain original time/price coordinates and stable identifiers',()=>{
  const {analysisDrawings}=compile('components/youtube/aiDrawings.ts',{});
  const result={version_id:'saved',generated_at:'2026-10-01',view:{end:'2026-09-30'},levels:[{kind:'support',price:140}],trendlines:[{kind:'resistance',start:{date:'2026-09-01',price:170},end:{date:'2026-09-10',price:165}}],fib:{from:{date:'2026-09-01',price:100},to:{date:'2026-09-30',price:150}}};
  const one=analysisDrawings(result,k=>k),two=analysisDrawings(result,k=>k);
  assert.equal(one[0].points[0].time,Date.parse('2026-09-30'));assert.equal(one[1].points[1].price,165);assert.equal(one[2].type,'fib');assert.equal(one[0].id,two[0].id);
});

test('PriceChart keeps text analysis and AI overlays in independent history channels', async () => {
  let cursor=0;const slots=[],effects=[],calls=[];
  const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]},useCallback:fn=>fn,useMemo:fn=>fn(),useEffect:fn=>effects.push(fn)};
  const payload=(price,id)=>({version_id:id,summary:id,interval:'1d',view:{end:'2026-10-01'},levels:[{kind:'support',price}],trendlines:[],fib:null});
  const technical=version('text',{payload:payload(100,'text')});
  const drawn=version('lines',{kind:'drawings',payload:payload(200,'lines')});
  const state=kind=>({items:[],total:0,busy:false,error:null,current:kind==='technical'?technical:drawn,selected:kind==='technical'?technical:drawn,load:async()=>calls.push(kind),select:async()=>{},activate:async()=>{}});
  const drawingModule=compile('components/youtube/aiDrawings.ts',{});
  const element=(type,props)=>({type,props});
  const h=compile('components/youtube/PriceChart.tsx',{
    react,'react/jsx-runtime':{jsx:element,jsxs:element,Fragment:'fragment'},'date-fns':require('date-fns'),
    '@/components/ui/dialog':{Dialog:'dialog',DialogClose:'close',DialogContent:'content',DialogDescription:'description',DialogTitle:'title'},
    '@/components/ui/button':{Button:'button'},'lucide-react':{X:'icon'},
    '@/lib/youtubeOpinionsApi':{getYouTubeStockDetail:async()=>({opinions:[]})},
    './chartDrawings':{useSyncedDrawings:()=>({drawings:[],setDrawings:()=>{},status:'synced'})},
    '@/components/decision/SavedAnalysisData':{default:'data'},
    '@/components/decision/AnalysisHistory':{default:'history',useStockHistory:(_,kind)=>state(kind)},
    './aiDrawings':drawingModule,'./chart/ChartView':{default:'chart'},'./chart/TechnicalFocusSelector':{default:'focus'},
    '@/lib/technicalFocus':{DEFAULT_TECHNICAL_FOCUS:{categories:['levels'],custom_scenarios:[]}},
  });
  const props={symbol:'NVDA',range:'3m',from:'',to:'',opinions:[],formatDate:v=>v,t:k=>k};
  const render=()=>{cursor=0;effects.length=0;return h.default(props)};
  const tree=render();const chart=tree.props.children.find(node=>node?.type==='chart');
  assert.equal(chart.props.savedAnalysis.summary,'text');
  assert.equal(chart.props.drawings[0].points[0].price,200);
  assert.equal(chart.props.savedDrawings.summary,'lines');
  await chart.props.onAnalysisChange(payload(300,'new-text'));await tick();
  assert.deepEqual(calls,['technical']);
  await chart.props.onDrawingsChange(payload(400,'new-lines'));await tick();
  assert.deepEqual(calls,['technical','drawings']);
  await chart.props.onDrawingsChange(null);const cleared=render().props.children.find(node=>node?.type==='chart');
  assert.equal(cleared.props.drawings.length,0);
  assert.equal(cleared.props.savedAnalysis.summary,'text');
});


test('computed moving average paths and candle annotations preserve stored anchors',()=>{
  const {analysisDrawings}=compile('components/youtube/aiDrawings.ts',{});
  const result={version_id:'patterns',generated_at:'2026-10-09',view:{end:'2026-10-07'},levels:[],trendlines:[],fib:null,
    overlays:[{category:'moving_averages',label:'EMA20',shape:'line',direction:'neutral',points:[{date:'2026-10-01',price:100},{date:'2026-10-02',price:101},{date:'2026-10-03',price:102}]},
    {category:'candlesticks',label:'Doji',shape:'area',direction:'neutral',points:[{date:'2026-10-06',price:100},{date:'2026-10-07',price:104}]}]};
  const drawings=analysisDrawings(result,k=>k);
  assert.equal(drawings[0].type,'polyline');assert.equal(drawings[0].points.length,3);
  assert.equal(drawings[0].points[1].time,Date.parse('2026-10-02'));
  assert.equal(drawings[1].type,'rect');assert.equal(drawings[1].label,'Doji');
  assert.equal(drawings[0].id,analysisDrawings(result,k=>k)[0].id);
});

test('entry stop and target overlays keep saved prices and calculated risk reward',()=>{
  const {analysisDrawings}=compile('components/youtube/aiDrawings.ts',{});
  const result={version_id:'plan',generated_at:'2026-10-09',view:{end:'2026-10-07'},levels:[],trendlines:[],fib:null,
    setup:{direction:'bullish',entry_low:105,entry_high:107,invalidation:100,targets:[115,120],risk_reward:1.5}};
  const drawings=analysisDrawings(result,k=>k);
  assert.equal(drawings.length,4);
  assert.deepEqual(Array.from(drawings,d=>d.points[0].price),[106,100,115,120]);
  assert.ok(drawings[2].label.includes('1.50 : 1'));
  assert.ok(drawings[1].label.includes('stop'));
  assert.ok(drawings.every(d=>d.type==='hline' && d.source==='ai' && d.points[0].time===Date.parse('2026-10-07')));
  assert.equal(drawings[0].id,analysisDrawings(result,k=>k)[0].id);
  assert.equal(analysisDrawings({...result,setup:null},k=>k).length,0);
  const short=analysisDrawings({...result,setup:{...result.setup,direction:'bearish',entry_low:110,entry_high:112,invalidation:116,targets:[105,100],risk_reward:1.2}},k=>k);
  assert.deepEqual(Array.from(short,d=>d.points[0].price),[111,116,105,100]);
});
