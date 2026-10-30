const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseCsv, analyze, printReport, toIsoDate } = require('./analyze.js');

const read = (f) => parseCsv(fs.readFileSync(path.join(__dirname, 'examples', f), 'utf8'));

test('CSV parser handles quotes, commas and BOM', () => {
  const rows = parseCsv('﻿a,b\n"x, y","say ""hi"""\n');
  assert.deepEqual(rows, [{ a: 'x, y', b: 'say "hi"' }]);
});

test('dates in ISO and US formats', () => {
  assert.equal(toIsoDate('2026-11-05T00:00:00Z'), '2026-11-05');
  assert.equal(toIsoDate('11/5/2026'), '2026-11-05');
});

test('example: scheduled and chat days are measured, then subtracted from item days', () => {
  const r = analyze(read('sample-ppac-report.csv'), read('runlog-template.csv'));
  // scheduled day: 339 credits / 20 runs
  assert.equal(r.measured.creditsPerScheduledRun, 17);
  // chat day: 426 / 15
  assert.equal(r.measured.creditsPerChatSession, 28.4);
  // item days: (2587 - 20*16.95)/20 = 112.4 ; (3053 - 339)/25 = 108.56 -> mean 110.5
  assert.ok(Math.abs(r.measured.creditsPerItem - 110.5) < 0.2, String(r.measured.creditsPerItem));
  assert.equal(r.spread.perItem.samples, 2);
  assert.equal(r.features[0].name, 'Agent action');
  assert.match(printReport(r), /Credits per item:/);
});

test('missing report rows and mixed days without baselines are flagged', () => {
  const report = parseCsv('Usage date,Agent name,Billed credits\n2026-11-05,A,1000\n');
  const runlog = parseCsv('date,agent,scenario,items,scheduledRuns,chatSessions\n2026-11-05,A,items,10,5,0\n2026-11-06,A,items,10,0,0\n');
  const r = analyze(report, runlog);
  assert.ok(r.warnings.some((w) => /no scheduled-only day/.test(w)));
  assert.ok(r.warnings.some((w) => /no rows in the report/.test(w)));
});

test('a report without a billed column is rejected with the columns it found', () => {
  assert.throws(() => analyze(parseCsv('Date,Agent name,Credits\n2026-11-05,A,1\n'), []), /billed credits column/);
});
