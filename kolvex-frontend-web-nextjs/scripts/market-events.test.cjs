const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/marketEvents.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: moduleValue, exports: moduleValue.exports, Date, Intl });
const { calendarDays, eventTime } = moduleValue.exports;

test('the three seven-day weeks remain contiguous across DST and a year boundary', () => {
  for (const start of ['2026-10-26', '2026-12-21']) {
    const days = [0, 7, 14].flatMap(offset => calendarDays(start, offset));
    assert.equal(days.length, 21);
    assert.equal(new Set(days).size, 21);
    assert.equal(days[0], start);
    for (let i=1; i<days.length; i++) assert.equal(Date.parse(days[i])-Date.parse(days[i-1]), 86400000);
  }
});
test('Eastern event clocks use the correct DST offset, independent of viewer timezone', () => {
  assert.equal(eventTime({starts_at:'2026-10-28T18:00:00Z'}, true), '14:00');
  assert.equal(eventTime({starts_at:'2026-11-02T19:00:00Z'}, false), '14:00');
});
test('imprecise schedules have explicit localized labels', () => {
  assert.equal(eventTime({timing:'after_close'}, false), '盘后');
  assert.equal(eventTime({timing:'before_open'}, true), 'Before open');
  assert.equal(eventTime({timing:'tbd'}, false), '时间待定');
});

test('events sort from all-day and premarket to precise time, postmarket and TBD', () => {
  const {eventOrder} = moduleValue.exports;
  const items = [{timing:'tbd'}, {timing:'after_close'}, {timing:'scheduled', starts_at:'2026-10-28T18:00:00Z'}, {timing:'before_open'}, {timing:'all_day'}];
  items.sort((a,b) => eventOrder(a)-eventOrder(b));
  assert.deepEqual(items.map(item => item.timing), ['all_day','before_open','scheduled','after_close','tbd']);
});
