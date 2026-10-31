import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLicence, isAgentEntitled } from '../src/lib/licence.js';

const base = {
  startsAt: '2026-01-01T00:00:00Z',
  expiresAt: '2026-12-31T15:59:59Z',
  graceDays: 7,
  status: 'active'
};
const at = (iso) => new Date(iso);

test('active well before expiry', () => {
  const r = evaluateLicence(base, at('2026-06-01T00:00:00Z'));
  assert.equal(r.state, 'active');
  assert.equal(r.licensed, true);
  assert.equal(r.notice, null);
});

test('expiring within the warning window gives a notice but stays licensed', () => {
  const r = evaluateLicence(base, at('2026-12-20T00:00:00Z'), { warningDays: 30 });
  assert.equal(r.state, 'expiring');
  assert.equal(r.licensed, true);
  assert.match(r.notice, /2026-12-31/);
});

test('grace period after expiry stays licensed with a warning', () => {
  const r = evaluateLicence(base, at('2027-01-03T00:00:00Z'));
  assert.equal(r.state, 'grace');
  assert.equal(r.licensed, true);
  assert.match(r.notice, /stops starting new tasks/);
});

test('blocked after expiry plus grace', () => {
  const r = evaluateLicence(base, at('2027-01-08T00:00:00Z'));
  assert.equal(r.state, 'expired');
  assert.equal(r.licensed, false);
});

test('suspended licence is blocked regardless of dates', () => {
  const r = evaluateLicence({ ...base, status: 'suspended' }, at('2026-06-01T00:00:00Z'));
  assert.equal(r.state, 'suspended');
  assert.equal(r.licensed, false);
});

test('not started yet is blocked', () => {
  const r = evaluateLicence(base, at('2025-12-01T00:00:00Z'));
  assert.equal(r.state, 'not-started');
  assert.equal(r.licensed, false);
});

test('default grace applies when graceDays is missing', () => {
  const { graceDays, ...noGrace } = base;
  assert.equal(evaluateLicence(noGrace, at('2027-01-05T00:00:00Z'), { defaultGraceDays: 7 }).state, 'grace');
  assert.equal(evaluateLicence(noGrace, at('2027-01-05T00:00:00Z'), { defaultGraceDays: 2 }).state, 'expired');
});

test('agent entitlement uses an exact list match', () => {
  const lic = { agents: 'inventory-close-agent, credit-hold-review-agent' };
  assert.equal(isAgentEntitled(lic, 'credit-hold-review-agent'), true);
  assert.equal(isAgentEntitled(lic, 'credit-hold'), false);
});

import { offlineCacheUntil } from '../src/lib/licence.js';

const hoursBetween = (a, b) => (b - a) / 3600000;

test('offline cache window uses the default hours', () => {
  const now = at('2026-06-01T00:00:00Z');
  const ev = evaluateLicence(base, now);
  assert.equal(hoursBetween(now, offlineCacheUntil(base, ev, now, { defaultOfflineHours: 4 })), 4);
});

test('offline window per licence is capped by the maximum', () => {
  const now = at('2026-06-01T00:00:00Z');
  const lic = { ...base, offlineHours: 72 };
  const ev = evaluateLicence(lic, now);
  assert.equal(hoursBetween(now, offlineCacheUntil(lic, ev, now, { maxOfflineHours: 24 })), 24);
});

test('offline window never runs past the end of the grace period', () => {
  const now = at('2027-01-07T14:00:00Z'); // grace ends 2027-01-07T15:59:59Z
  const ev = evaluateLicence(base, now);
  assert.equal(ev.state, 'grace');
  const until = offlineCacheUntil(base, ev, now, { defaultOfflineHours: 4 });
  assert.equal(until.toISOString(), '2027-01-07T15:59:59.000Z');
});

test('offlineHours 0 means no offline use', () => {
  const now = at('2026-06-01T00:00:00Z');
  const lic = { ...base, offlineHours: 0 };
  assert.equal(offlineCacheUntil(lic, evaluateLicence(lic, now), now).getTime(), now.getTime());
});

test('no offline window for a blocked licence', () => {
  const now = at('2027-03-01T00:00:00Z');
  const ev = evaluateLicence(base, now);
  assert.equal(ev.licensed, false);
  assert.equal(offlineCacheUntil(base, ev, now).getTime(), now.getTime());
});
