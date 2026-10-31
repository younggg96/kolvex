const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function fixture(fetch = () => {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/stockFundamentals.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, fetch, Date, URLSearchParams });
  return module.exports;
}
test('financial periods sort by ending date, discard invalid dates, and preserve real zero values', () => {
  const { sortPeriods, metricValue } = fixture();
  const rows = [{period:'2024-01-31', Revenue:0}, {period:'invalid', Revenue:3}, {period:'2026-01-31', Revenue:NaN, 'Total Revenue':9}];
  assert.equal(sortPeriods(rows)[0].period, '2026-01-31');
  assert.equal(sortPeriods(rows).length, 2);
  assert.equal(rows[0].period, '2024-01-31');
  assert.equal(metricValue(rows[0], ['Revenue']), 0);
  assert.equal(metricValue(rows[2], ['Revenue', 'Total Revenue']), 9);
  assert.equal(metricValue(rows[2], ['missing']), null);
});
test('dated EPS surprise is already percent; history surprise is fractional and future estimates survive fallback', () => {
  const { earningsRows } = fixture();
  const row = {date:'2026-08-20',reported_eps:0,eps_estimate:0,surprise_percent:6.2};
  assert.equal(earningsRows({earnings_history:[],earnings_dates:[row]})[0].surprise, 6.2);
  const rows = earningsRows({earnings_history:[{quarter:'2026-04-30',eps_actual:2,eps_estimate:1.9,surprise_percent:.062}],earnings_dates:[{date:'2099-11-20',reported_eps:null,eps_estimate:2.5,surprise_percent:NaN}]});
  assert.equal(rows[0].surprise, 6.2);
  assert.equal(rows.length,2);
  assert.equal(rows[1].estimate,2.5);
  assert.equal(rows[1].surprise,null);
});
test('CSV protects source strings from formula injection without changing negative numeric values', () => {
  const { csvCell } = fixture();
  assert.equal(csvCell('=cmd()'), '"\'=cmd()"');
  assert.equal(csvCell(-12), '"-12"');
  assert.equal(csvCell('a"b,c'), '"a""b,c"');
});
test('failed upstream data rejects and cancellation reaches fetch', async () => {
  const signal = new AbortController().signal;
  let seen;
  const { loadFundamentals } = fixture(async (_key, options) => {seen = options.signal; return {ok:false,status:502};});
  await assert.rejects(loadFundamentals('/test',signal), {status:502});
  assert.equal(seen, signal);
});
function proxyFixture(fetch) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../app/api/market/fundamentals/[symbol]/[kind]/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports:module.exports, fetch, URL, AbortSignal, process:{env:{}}, require:() => ({NextResponse:{json:(body, options={})=>({body,status:options.status??200,headers:options.headers})}}) });
  return module.exports.GET;
}
test('fundamentals proxy rejects unrecognized data kinds and symbols before fetching', async () => {
  const GET = proxyFixture(() => {throw new Error('must not fetch');});
  assert.equal((await GET({url:'http://localhost/test'}, {params:{symbol:'NVDA',kind:'arbitrary'}})).status,400);
  assert.equal((await GET({url:'http://localhost/test'}, {params:{symbol:'../secret',kind:'earnings'}})).status,400);
});
test('fundamentals proxy forwards the reporting frequency and rejects malformed upstream data', async () => {
  let requested;
  const GET = proxyFixture(async (url) => {requested=url;return {ok:true,json:async()=>({data:[]})};});
  assert.equal((await GET({url:'http://localhost/test?quarterly=true'}, {params:{symbol:'nvda',kind:'cash-flow'}})).status,200);
  assert.equal(requested,'http://localhost:8080/api/v1/market/cash-flow/NVDA?quarterly=true');
  const malformed = proxyFixture(async () => ({ok:true,json:async()=>({earnings_history:[]})}));
  assert.equal((await malformed({url:'http://localhost/test'}, {params:{symbol:'NVDA',kind:'earnings'}})).status,502);
});
