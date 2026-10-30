#!/usr/bin/env node
/* Turns Microsoft's Copilot credit consumption report + your validation run log into
 * measured credits per item, per scheduled run and per chat session — the three numbers
 * the pricing calculator needs.
 *
 *   node analyze.js --report <ppac-report.csv> --runlog <runlog.csv> [--agent "Agent name"] [--json]
 *
 * report: the detailed Copilot credits report downloaded from Power Platform admin center
 *         (Licensing > Copilot Studio > Environments > <env> > Copilot credit consumption details > Download).
 *         Columns are matched by name: a date column, "Agent name", "Product / AI feature",
 *         "LLM model", "Billed credits", "Non-billed credits".
 * runlog: one row per UTC day of the validation, see examples/runlog-template.csv.
 * The report is daily, so each validation day should run one kind of work only.
 */
'use strict';
const fs = require('node:fs');

function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  const header = rows.shift().map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

function findColumn(headers, patterns, required, label) {
  for (const p of patterns) {
    const h = headers.find((x) => p.test(x));
    if (h) return h;
  }
  if (required) throw new Error(`Report has no ${label} column. Columns found: ${headers.join(', ')}`);
  return null;
}

const num = (v) => { const x = Number(String(v ?? '').replace(/[, ]/g, '')); return Number.isFinite(x) ? x : 0; };
const norm = (v) => String(v ?? '').trim().toLowerCase();

function toIsoDate(v) {
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); // M/D/YYYY as PPAC exports in en-US
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

function analyze(reportRows, runlogRows, { agent } = {}) {
  const headers = Object.keys(reportRows[0] || {});
  const col = {
    date: findColumn(headers, [/^usage date$/i, /^date$/i, /date/i, /day/i], true, 'date'),
    agent: findColumn(headers, [/^agent name$/i, /agent/i], true, 'agent name'),
    feature: findColumn(headers, [/product\s*\/\s*ai feature/i, /feature/i], false),
    model: findColumn(headers, [/llm model/i, /model/i], false),
    billed: findColumn(headers, [/^billed credits$/i, /^billed/i], true, 'billed credits'),
    nonBilled: findColumn(headers, [/non.?billed/i], false)
  };

  const days = runlogRows.map((r) => ({
    date: toIsoDate(r.date),
    agent: r.agent || agent || '',
    scenario: norm(r.scenario),
    items: num(r.items), scheduledRuns: num(r.scheduledRuns), chatSessions: num(r.chatSessions),
    notes: r.notes || ''
  }));

  const warnings = [];
  const features = new Map(); const models = new Set();
  for (const d of days) {
    const rows = reportRows.filter((r) => toIsoDate(r[col.date]) === d.date && norm(r[col.agent]) === norm(d.agent));
    d.billed = rows.reduce((t, r) => t + num(r[col.billed]), 0);
    d.nonBilled = col.nonBilled ? rows.reduce((t, r) => t + num(r[col.nonBilled]), 0) : 0;
    d.byFeature = {};
    for (const r of rows) {
      const f = col.feature ? r[col.feature] || '(blank)' : '(all)';
      d.byFeature[f] = (d.byFeature[f] || 0) + num(r[col.billed]);
      features.set(f, (features.get(f) || 0) + num(r[col.billed]));
      if (col.model && r[col.model]) models.add(r[col.model]);
    }
    if (!rows.length) warnings.push(`${d.date} ${d.agent}: no rows in the report. The report can lag by a day; download it again later, or check the agent name.`);
    if (d.nonBilled > 0) warnings.push(`${d.date}: ${round(d.nonBilled)} non-billed credits (for example Microsoft 365 Copilot users or test runs). They are not counted.`);
    const kinds = [d.items > 0, d.scheduledRuns > 0, d.chatSessions > 0].filter(Boolean).length;
    d.mixed = kinds > 1;
  }

  // Pure days first, then subtract background work from item days.
  const pure = (pick, unit) => days.filter((d) => d[unit] > 0 && pick(d)).map((d) => d.billed / d[unit]);
  const runSamples = pure((d) => d.items === 0 && d.chatSessions === 0, 'scheduledRuns');
  const chatSamples = pure((d) => d.items === 0 && d.scheduledRuns === 0, 'chatSessions');
  const perRun = mean(runSamples);
  const perChat = mean(chatSamples);

  const itemSamples = [];
  for (const d of days.filter((x) => x.items > 0)) {
    let background = 0;
    if (d.scheduledRuns > 0) {
      if (perRun == null) { warnings.push(`${d.date}: item day also had ${d.scheduledRuns} scheduled runs but no scheduled-only day was measured, so they are counted as item cost (overstates per-item credits).`); }
      else background += d.scheduledRuns * perRun;
    }
    if (d.chatSessions > 0) {
      if (perChat == null) { warnings.push(`${d.date}: item day also had ${d.chatSessions} chat sessions but no chat-only day was measured, so they are counted as item cost.`); }
      else background += d.chatSessions * perChat;
    }
    d.itemCredits = Math.max(0, d.billed - background);
    itemSamples.push(d.itemCredits / d.items);
  }
  const perItem = mean(itemSamples);

  for (const m of models) if (/o\d|reason|think|premium/i.test(m)) warnings.push(`Model "${m}" appears in the report. Token-billed models vary most; run more items before trusting the average.`);
  const premium = [...features.keys()].find((f) => /premium/i.test(f));
  if (premium) warnings.push(`"${premium}" makes up ${pct(features.get(premium), sum(features))} of billed credits. This is token-based and grows with long instructions, skills and tool results.`);
  if (itemSamples.length && itemSamples.length < 2) warnings.push('Only one item day measured. Run a second day to see how much it varies.');

  return {
    days,
    measured: {
      creditsPerItem: perItem == null ? 0 : round(perItem),
      creditsPerScheduledRun: perRun == null ? 0 : round(perRun),
      creditsPerChatSession: perChat == null ? 0 : round(perChat)
    },
    spread: { perItem: minMax(itemSamples), perScheduledRun: minMax(runSamples), perChatSession: minMax(chatSamples) },
    features: [...features.entries()].sort((a, b) => b[1] - a[1]).map(([name, credits]) => ({ name, credits: round(credits), share: pct(credits, sum(features)) })),
    models: [...models],
    warnings
  };
}

function mean(a) { return a.length ? a.reduce((t, x) => t + x, 0) / a.length : null; }
function minMax(a) { return a.length ? { min: round(Math.min(...a)), max: round(Math.max(...a)), samples: a.length } : null; }
function sum(m) { let t = 0; for (const v of m.values()) t += v; return t; }
function pct(x, t) { return t ? `${Math.round((x / t) * 100)}%` : '0%'; }
function round(x) { return Math.round(x * 10) / 10; }

function printReport(r) {
  const lines = [];
  lines.push('Validation days');
  lines.push('date        scenario    items  runs  chats  billed credits  note');
  for (const d of r.days) {
    lines.push(`${d.date}  ${d.scenario.padEnd(10)}  ${String(d.items).padStart(5)}  ${String(d.scheduledRuns).padStart(4)}  ${String(d.chatSessions).padStart(5)}  ${String(round(d.billed)).padStart(14)}  ${d.mixed ? 'mixed day' : ''}`);
  }
  lines.push('');
  lines.push('Where the credits went');
  for (const f of r.features) lines.push(`  ${f.name}: ${f.credits} (${f.share})`);
  if (r.models.length) lines.push(`Models seen: ${r.models.join(', ')}`);
  lines.push('');
  lines.push('Measured (enter these in the pricing calculator under "AI model & measured usage")');
  const s = r.spread;
  lines.push(`  Credits per item:          ${r.measured.creditsPerItem || 'not measured'}${s.perItem ? `   (range ${s.perItem.min}–${s.perItem.max} over ${s.perItem.samples} day(s))` : ''}`);
  lines.push(`  Credits per scheduled run: ${r.measured.creditsPerScheduledRun || 'not measured'}${s.perScheduledRun ? `   (range ${s.perScheduledRun.min}–${s.perScheduledRun.max})` : ''}`);
  lines.push(`  Credits per chat session:  ${r.measured.creditsPerChatSession || 'not measured'}${s.perChatSession ? `   (range ${s.perChatSession.min}–${s.perChatSession.max})` : ''}`);
  if (r.warnings.length) { lines.push(''); lines.push('Check'); for (const w of r.warnings) lines.push(`  - ${w}`); }
  return lines.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
  const report = opt('report'), runlog = opt('runlog');
  if (!report || !runlog) {
    console.error('Usage: node analyze.js --report <ppac-report.csv> --runlog <runlog.csv> [--agent "Agent name"] [--json]');
    process.exit(2);
  }
  const result = analyze(parseCsv(fs.readFileSync(report, 'utf8')), parseCsv(fs.readFileSync(runlog, 'utf8')), { agent: opt('agent') });
  console.log(args.includes('--json') ? JSON.stringify(result.measured, null, 2) : printReport(result));
}

module.exports = { parseCsv, analyze, printReport, toIsoDate };
