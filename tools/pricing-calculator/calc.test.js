const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('./calc.js');

const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('credits per item use the published rates', () => {
  // 14 actions x5 + 1 answer x2 + 120 flow actions x0.13 + 3K standard tokens x1.5
  close(C.creditsPerItem({ agentActions: 14, generativeAnswers: 1, flowActions: 120, promptKTokens: 3, promptTier: 'standard' }), 92.1);
  close(C.creditsPerItem({ agentActions: 0, promptKTokens: 2, promptTier: 'premium' }), 20);
  // reasoning model: 4 actions x 2K tokens x 10 credits per 1K on top of 4 x 5
  close(C.creditsPerItem({ agentActions: 4 }, { type: 'reasoning', kTokensPerAction: 2 }), 20 + 80);
});

test('Credit Hold preset: Standard tier, flows do the fetching, pay-as-you-go is cheapest', () => {
  const r = C.calculate(C.fromPreset('credit-hold'));
  // per hold: 6 actions x5 + 180 flow actions x0.13 + 3K prompt tokens x1.5 = 57.9
  close(r.credits.perItem, 57.9);
  // the scheduled check runs no agent: 15 flow actions only
  close(r.credits.perScheduledRun, 1.95);
  close(r.credits.total, 17370 + 858 + 1040);
  assert.equal(r.subscription.chosen.tier, 'Standard');
  assert.equal(r.subscription.monthlySgd, 800);
  assert.match(r.microsoft.bestPlan, /Pay-as-you-go/);
  close(r.microsoft.bestUsd, 19268 * 0.01);
  close(r.customer.valueMonthlySgd, 2750);
  assert.ok(r.warnings.some((w) => /Scheduled runs/.test(w)) === false); // scheduled < items here
});

test('Inventory Close preset: extra legal entity is an add-on, not a higher tier', () => {
  const r = C.calculate(C.fromPreset('inventory-close'));
  assert.equal(r.subscription.chosen.tier, 'Standard');
  assert.equal(r.subscription.chosen.entityAddOn, 250);
  assert.equal(r.subscription.monthlySgd, 1050);
  assert.equal(r.settings.model.type, 'harness');
  // 12 actions x5 + 1 answer x2 + 90 flow actions x0.13 + 12 actions x 1.5K tokens x10
  close(r.credits.perItem, 253.7);
  assert.ok(r.warnings.some((w) => /model tokens/.test(w)));
});

test('auto tier picks the cheapest for the customer', () => {
  const r = C.calculate(C.fromPreset('credit-hold', { itemsPerMonth: 1500 }));
  // Standard: 800 + 1000 x 1.0 = 1800; Plus: 1400
  assert.equal(r.subscription.chosen.tier, 'Plus');
  assert.equal(r.subscription.monthlySgd, 1400);
});

test('annual prepay discount applies to the subscription', () => {
  const r = C.calculate(C.fromPreset('credit-hold', { billing: 'annual' }));
  assert.equal(r.subscription.monthlySgd, 720);
});

test('Microsoft 365 Copilot users make chat free; autonomous runs still cost', () => {
  const r = C.calculate(C.fromPreset('credit-hold', { chat: { usersHaveM365Copilot: true } }));
  assert.equal(r.credits.chat, 0);
  assert.ok(r.credits.scheduled > 0);
});

test('heavy polling raises a warning', () => {
  const r = C.calculate(C.fromPreset('credit-hold', { itemsPerMonth: 20, scheduled: { runsPerMonth: 2880 } }));
  assert.ok(r.warnings.some((w) => /Scheduled runs/.test(w)));
});

test('vendor margin and payback', () => {
  const r = C.calculate(C.fromPreset('credit-hold'));
  close(r.vendor.costSgd, 3 * 90 + 15);
  close(r.vendor.marginPct, (800 - 285) / 800 * 100);
  assert.ok(r.customer.paybackMonths > 0);
  close(r.customer.setupFeeSgd, 9000);
});

test('range: low < expected < high, and the subscription is the same in all three', () => {
  const r = C.calculate(C.fromPreset('credit-hold'));
  assert.ok(r.range.low.credits < r.range.expected.credits);
  assert.ok(r.range.expected.credits < r.range.high.credits);
  close(r.range.expected.credits, r.credits.total);
  close(r.range.high.customerMonthlySgd - r.range.high.microsoftSgd, r.subscription.monthlySgd);
  // standard model high case = steps x2 (prompt tokens x2 too)
  close(r.range.high.credits, 57.9 * 2 * 300 + 440 * (15 * 2 * 0.13) + 40 * (4 * 2 * 5 + 3 * 2 * 2));
});

test('reasoning model adds token credits in every case and widens the high case', () => {
  const std = C.calculate(C.fromPreset('credit-hold'));
  const rsn = C.calculate(C.fromPreset('credit-hold', { model: { type: 'reasoning', kTokensPerAction: 2 } }));
  assert.ok(rsn.range.expected.credits > std.range.expected.credits);
  assert.ok(rsn.range.high.credits / rsn.range.expected.credits > std.range.high.credits / std.range.expected.credits);
});

test('measured values replace the estimate and narrow the range to the measured band', () => {
  const r = C.calculate(C.fromPreset('credit-hold', { measured: { creditsPerItem: 150, creditsPerScheduledRun: 20, creditsPerChatSession: 30 } }));
  assert.equal(r.credits.source, 'measured');
  close(r.range.expected.credits, 150 * 300 + 20 * 440 + 30 * 40);
  close(r.range.high.credits, r.range.expected.credits * 1.15);
  close(r.range.low.credits, r.range.expected.credits * 0.85);
});

test('flexible (previous) designs keep their original estimates for comparison', () => {
  const ch = C.calculate(C.fromPreset('credit-hold-flexible'));
  close(ch.credits.perItem, 92.1);
  close(ch.credits.total, 27630 + 7458 + 1040);
  const ic = C.calculate(C.fromPreset('inventory-close-flexible'));
  close(ic.credits.perItem, 509.8);
  close(ic.credits.total, 15415.4);
  // the lean designs are cheaper in every case
  for (const k of ['credit-hold', 'inventory-close']) {
    const lean = C.calculate(C.fromPreset(k)), flex = C.calculate(C.fromPreset(k + '-flexible'));
    for (const c of C.CASES) assert.ok(lean.range[c].credits < flex.range[c].credits);
  }
});
