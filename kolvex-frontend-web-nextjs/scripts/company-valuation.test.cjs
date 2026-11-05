const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function library(fetch) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/companyValuation.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, fetch });
  return module.exports;
}
const source = () => ({ snapshot_id: 'a'.repeat(64), inputs: { revenue: 302969000000.123, shares: 24147000001, eps: 7.91234567, cash: 62469000000, debt: 38351000000, other_claims: 0, tax_rate: .16046120899784108 }, operating_margin: .652142 });
test('untouched displayed inputs preserve vendor precision', () => {
  const lib = library(), data = source(), draft = lib.initialCompanyDraft(data);
  const command = lib.buildCompanyCommand(data, 'dcf', draft);
  assert.equal(Object.keys(command.inputs).length, 0);
  assert.equal(command.scenarios.base.discount_rate, .1);
});
test('edited money and share inputs convert explicit billions and millions', () => {
  const lib = library(), data = source(), draft = lib.initialCompanyDraft(data);
  draft.inputs.revenue = '100'; draft.inputs.shares = '250'; draft.inputs.tax_rate = '21'; draft.edited = ['revenue', 'shares', 'tax_rate'];
  const command = lib.buildCompanyCommand(data, 'dcf', draft);
  assert.equal(command.inputs.revenue, 100e9); assert.equal(command.inputs.shares, 250e6); assert.equal(command.inputs.tax_rate, .21);
});
test('PE requires user chosen targets and does not reuse the market PE', () => {
  const lib = library(), data = source(), draft = lib.initialCompanyDraft(data);
  assert.throws(() => lib.buildCompanyCommand(data, 'pe', draft), /required/);
  for (const key of lib.companyScenarios) draft.scenarios[key].target_pe = '20';
  assert.equal(lib.buildCompanyCommand(data, 'pe', draft).scenarios.base.target_pe, 20);
});
test('PEG uses percent-point growth exactly once and requires positive growth', () => {
  const lib = library(), data = source(), draft = lib.initialCompanyDraft(data);
  for (const key of lib.companyScenarios) draft.scenarios[key].eps_growth = '20';
  assert.equal(lib.buildCompanyCommand(data, 'peg', draft).scenarios.base.eps_growth, .2);
  draft.scenarios.base.eps_growth = '0'; assert.throws(() => lib.buildCompanyCommand(data, 'peg', draft), /range/);
});
test('terminal limits, blank inputs, invalid values and missing debt block calculation', () => {
  const lib = library(), data = source(), draft = lib.initialCompanyDraft(data);
  draft.terminal_growth = '8'; assert.throws(() => lib.buildCompanyCommand(data, 'dcf', draft), /range/);
  draft.terminal_growth = '5'; draft.scenarios.base.discount_rate = '5'; assert.throws(() => lib.buildCompanyCommand(data, 'dcf', draft), /terminal/);
  const next = lib.initialCompanyDraft(data); next.inputs.cash = ''; next.edited = ['cash']; assert.throws(() => lib.buildCompanyCommand(data, 'dcf', next), /required/);
  data.inputs.debt = null; assert.throws(() => lib.buildCompanyCommand(data, 'dcf', lib.initialCompanyDraft(data)), /required/);
});
test('snapshot conflicts propagate for the explicit refresh flow', async () => {
  const lib = library(async () => ({ ok: false, status: 409, json: async () => ({ detail: 'Snapshot changed' }) }));
  await assert.rejects(lib.calculateCompany('NVDA', {}, new AbortController().signal), error => error.status === 409);
});
test('POST sends assumptions to same-origin calculator without reading a provider', async () => {
  const calls = []; const lib = library(async (...args) => { calls.push(args); return { ok: true, json: async () => ({ status: 'complete' }) }; });
  const command = lib.buildCompanyCommand(source(), 'dcf', lib.initialCompanyDraft(source()));
  await lib.calculateCompany('BRK.B', command, new AbortController().signal);
  assert.equal(calls.length, 1); assert.equal(calls[0][0], '/api/market/valuation/BRK.B/calculate');
  assert.equal(JSON.parse(calls[0][1].body).model, 'dcf');
});
test('new drafts start margin at the reported figure and send it with DCF', () => {
  const lib = library(), data = { ...source(), operating_margin: -.3 }, draft = lib.initialCompanyDraft(data);
  const command = lib.buildCompanyCommand(data, 'dcf', draft);
  assert.equal(command.scenarios.base.starting_margin, -.3);
  assert.equal(command.scenarios.base.operating_margin, -.3);
});
test('AI assumptions fill the draft as editable percentages and leave other models alone', () => {
  const lib = library(), data = { ...source(), operating_margin: -.3 };
  const row = { revenue_growth: .11, starting_margin: -.3, operating_margin: .18, reinvestment_rate: .5, discount_rate: .115 };
  const ai = { assumptions: { dcf: { scenarios: { conservative: row, base: row, optimistic: row }, years: 10, terminal_growth: .025, terminal_roic: .18 } } };
  const draft = lib.applyAiAssumptions(lib.initialCompanyDraft(data), ai);
  assert.equal(draft.scenarios.base.operating_margin, '18');
  assert.equal(draft.scenarios.base.discount_rate, '11.5');
  assert.equal(draft.years, '10');
  assert.equal(draft.terminal_growth, '2.5');
  assert.equal(draft.scenarios.base.target_pe, '');
  const command = lib.buildCompanyCommand(data, 'dcf', draft);
  assert.equal(command.scenarios.base.discount_rate, .115);
  assert.equal(command.years, 10);
  assert.equal(Object.keys(command.inputs).length, 0);
});
test('AI PE and PEG assumptions fill their own fields', () => {
  const lib = library(), data = source();
  const peg = { target_peg: 1.25, eps_growth: .2 }, pe = { target_pe: 30 };
  const draft = lib.applyAiAssumptions(lib.initialCompanyDraft(data), { assumptions: {
    pe: { scenarios: { conservative: pe, base: pe, optimistic: pe } }, peg: { scenarios: { conservative: peg, base: peg, optimistic: peg } } } });
  assert.equal(draft.scenarios.base.target_pe, '30');
  assert.equal(draft.scenarios.base.target_peg, '1.25');
  assert.equal(draft.scenarios.base.eps_growth, '20');
  assert.equal(draft.years, '5');
});
