const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const moduleFixture = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/opinionDates.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: moduleFixture.exports, Date, Intl });
const { opinionDay, formatOpinionDate } = moduleFixture.exports;

test('opinion dates do not move with browser timezone or locale', () => {
  const original = process.env.TZ;
  try {
    for (const zone of ['America/Los_Angeles', 'Asia/Shanghai', 'UTC']) {
      process.env.TZ = zone;
      assert.equal(opinionDay('2026-10-09T02:42:56Z'), '2026-10-08');
      assert.equal(opinionDay('2026-10-09T23:07:18Z'), '2026-10-09');
      assert.equal(formatOpinionDate('2026-10-09', 'en-US'), 'Oct 9, 2026');
      assert.equal(formatOpinionDate('2026-10-09T02:42:56Z', 'en-US'), 'Oct 8, 2026');
      assert.equal(formatOpinionDate('2026-10-09', 'zh-CN'), '2026年10月9日');
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test('New York dates honor daylight saving transitions and winter offsets', () => {
  assert.equal(opinionDay('2026-03-08T04:30:00Z'), '2026-03-07');
  assert.equal(opinionDay('2026-03-08T07:30:00Z'), '2026-03-08');
  assert.equal(opinionDay('2026-11-01T04:30:00Z'), '2026-11-01');
  assert.equal(opinionDay('2026-01-09T04:42:56Z'), '2026-01-08');
  assert.equal(formatOpinionDate(null, 'en-US'), '');
  assert.equal(formatOpinionDate('invalid', 'en-US'), '');
});
