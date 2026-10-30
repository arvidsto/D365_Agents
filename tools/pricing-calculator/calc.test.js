const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('./calc.js');

const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('credits per item use the published rates', () => {
  // 14 actions x5 + 1 answer x2 + 120 flow actions x0.13 + 3K standard tokens x1.5
  close(C.creditsPerItem({ agentActions: 14, generativeAnswers: 1, flowActions: 120, promptKTokens: 3, promptTier: 'standard' }), 92.1);
  close(C.creditsPerItem({ agentActions: 0, promptKTokens: 2, promptTier: 'premium', reasoningKTokens: 1 }), 30);
});

test('Credit Hold preset: Standard tier, credits mix packs and pay-as-you-go', () => {
  const r = C.calculate(C.fromPreset('credit-hold'));
  close(r.credits.total, 27630 + 7458 + 1040);
  assert.equal(r.subscription.chosen.tier, 'Standard');
  assert.equal(r.subscription.monthlySgd, 800);
  assert.match(r.microsoft.bestPlan, /1 pack \+ pay-as-you-go/);
  close(r.microsoft.bestUsd, 200 + 11128 * 0.01);
  close(r.customer.valueMonthlySgd, 2750);
  assert.ok(r.warnings.some((w) => /Scheduled runs/.test(w)) === false); // scheduled < items here
});

test('Inventory Close preset: extra legal entity is an add-on, not a higher tier', () => {
  const r = C.calculate(C.fromPreset('inventory-close'));
  assert.equal(r.subscription.chosen.tier, 'Standard');
  assert.equal(r.subscription.chosen.entityAddOn, 250);
  assert.equal(r.subscription.monthlySgd, 1050);
  assert.equal(r.microsoft.bestPlan, 'Pay-as-you-go');
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
